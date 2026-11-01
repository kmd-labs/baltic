import {
  AfterViewInit,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  QueryList,
  ViewChild,
  ViewChildren,
  effect,
  inject,
  input,
  output
} from '@angular/core';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ThemeService } from '@kmd/design-system/services/theme.service';
import { isAtMost, isMobileLandscape } from '@kmd/design-system/utils/breakpoints';
import { I18nService } from '../../core/i18n/i18n.service';
import { IceVariant, PaleoDataService, PaleoFrame, TRANSECT } from '../../core/data/paleo-data.service';
import { WATER_LAKE, WATER_OCEAN } from '../../core/data/water';
import { nearestFrame, phaseAt, WaterClass } from '../../core/data/timeline';
import { SILLS } from '../../core/data/geo';
import { PATCH_FRAGMENT, PATCH_VERTEX } from './paleo-shaders';
import { ICE_FRAGMENT, ICE_VERTEX } from './ice-shaders';
import { ICE_DOMAIN, ICE_PROFILE_K, ICE_SDF_SCALE, iceBracket } from '../../core/data/ice-field';

/** RSL is resampled at this granularity so scrubbing reuses cached fields. */
const RSL_STEP_YR = 25;

export interface GlobeLayers {
  ice: boolean;
  band: boolean;
  today: boolean;
  prev: boolean;
  sills: boolean;
  transect: boolean;
  labels: boolean;
}

export interface GlobeLabel {
  id: string;
  text: string;
  lon: number;
  lat: number;
  kind: 'place' | 'sill';
}

export interface GlobePointer {
  lon: number;
  lat: number;
  x: number;
  y: number;
}

/**
 * Globe from kmd-labs/el-nino reduced to a European cap (I-05; decision 2026-10-31): only the
 * Steffen & Kaufmann RSL domain (10°W–70°E / 45–85°N) is drawn, as a curved patch of the
 * sphere on the page background — the rest of the globe is cut away.
 *
 * The patch is shaded per pixel on the GPU from the present-day grids and the RSL field
 * (paleo-shaders.ts) and displaced by H_paleo. The camera starts over the Baltic; dragging only
 * tilts and springs back to the Baltic.
 */
@Component({
  selector: 'app-globe',
  standalone: true,
  template: `
    <canvas #canvas class="globe-canvas" [attr.aria-label]="i18n.t().stageAriaLabel" role="img"></canvas>
    <div class="labels" aria-hidden="true">
      @for (l of labels(); track l.id) {
        <span #lbl class="lbl" [class.lbl--sill]="l.kind === 'sill'" [hidden]="!showLabel(l)">{{ l.text }}</span>
      }
    </div>
  `,
  styles: [
    `
      :host { position: absolute; inset: 0; display: block; }
      .globe-canvas { width: 100%; height: 100%; display: block; touch-action: none; cursor: crosshair; }
      .labels { position: absolute; inset: 0; pointer-events: none; overflow: hidden; }
      .lbl {
        position: absolute; left: 0; top: 0; white-space: nowrap; will-change: transform;
        font-family: var(--font-family); font-size: 11px; font-weight: 600; letter-spacing: 0.01em;
        color: var(--color-text-bright);
        text-shadow: 0 0 3px rgba(255, 255, 255, 0.95), 0 0 6px rgba(255, 255, 255, 0.8);
      }
      .lbl::before {
        content: ''; display: inline-block; width: 4px; height: 4px; margin-right: 5px; border-radius: 50%;
        background: var(--color-text-bright); vertical-align: middle;
      }
      .lbl--sill { font-size: 10.5px; color: var(--color-accent); }
      .lbl--sill::before { width: 6px; height: 6px; border-radius: 1px; transform: rotate(45deg); background: var(--color-accent); }
    `
  ]
})
export class GlobeComponent implements AfterViewInit, OnDestroy {
  /** Time shown, cal yr BP. */
  readonly t = input.required<number>();
  readonly layers = input.required<GlobeLayers>();
  /** Vertical exaggeration of the 3D relief; flat (×1) by decision 2026-10-31. */
  readonly exaggeration = input<number>(1);
  /**
   * Vertical exaggeration of the ice body alone. The terrain is deliberately flat, and at true
   * scale ~3 km of ice is 0.0024 of the 5-unit globe radius — less than the paleo patch's own
   * offset, so the dome would be invisible. ×45 puts a 3 km dome at ~0.11 units over an ~800 km
   * half-width: a legible dome, still shallow enough to read as ice rather than a cone.
   */
  readonly iceExaggeration = input<number>(45);
  readonly labels = input<GlobeLabel[]>([]);
  readonly hover = output<GlobePointer | null>();

  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChildren('lbl') labelRefs!: QueryList<ElementRef<HTMLSpanElement>>;

  readonly i18n = inject(I18nService);
  private readonly zone = inject(NgZone);
  private readonly theme = inject(ThemeService);
  private readonly data = inject(PaleoDataService);

  private readonly R = 5;
  private readonly DEG = Math.PI / 180;

  private readonly FOCUS = { lon: 20, lat: 59 };
  private readonly TILT_AZIMUTH = 22 * (Math.PI / 180);
  private readonly TILT_POLAR = 14 * (Math.PI / 180);
  private readonly SPRING_RATE = 3.2;

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private controls!: OrbitControls;
  private ocean!: THREE.Mesh;

  private patchMat?: THREE.ShaderMaterial;
  private rslTex?: THREE.DataTexture;
  private waterTex?: THREE.DataTexture;
  private rslPrevTex?: THREE.DataTexture;
  private waterPrevTex?: THREE.DataTexture;
  private earlierShown: PaleoFrame | null = null;
  private overlayCanvas?: HTMLCanvasElement;
  private overlayTex?: THREE.CanvasTexture;
  private overlayBCanvas?: HTMLCanvasElement;
  private overlayBTex?: THREE.CanvasTexture;
  private waterBTex?: THREE.DataTexture;
  private iceMats = new Map<IceVariant, THREE.ShaderMaterial>();
  private iceMeshes = new Map<IceVariant, THREE.Mesh>();
  private iceSdfTex = new Map<string, THREE.DataTexture>();
  /** Slice pair bound to each variant's material, tracked per variant: a layer that is off when
   *  the pair changes must still pick up the new textures when it is switched back on. */
  private shownIceSlices = new Map<IceVariant, string>();
  private frame: PaleoFrame | null = null;
  private frameB: PaleoFrame | null = null;
  private earlierTarget = -1;
  private shownT = -1;
  /** Render only when something changed (camera, data, layers, size). */
  private needsRender = true;

  private readonly target = new THREE.Spherical();
  private readonly tmpSph = new THREE.Spherical();
  private readonly tmpV = new THREE.Vector3();
  private readonly tmpN = new THREE.Vector3();
  private readonly camDir = new THREE.Vector3();
  private readonly raycaster = new THREE.Raycaster();
  private readonly ndc = new THREE.Vector2();
  private defaultDistance = 8;
  private dragging = false;
  private animId: number | null = null;
  private lastTime = 0;
  private resizeObs?: ResizeObserver;
  private pendingHover: PointerEvent | null = null;

  constructor() {
    effect(() => {
      const t = this.t();
      this.data.version();
      if (this.data.state() !== 'ready' || !this.patchMat) return;
      this.zone.runOutsideAngular(() => this.showFrame(t));
    });
    effect(() => {
      this.labels();
      this.i18n.lang();
      this.needsRender = true;
    });
    effect(() => {
      const L = this.layers();
      const ex = this.exaggeration();
      if (!this.patchMat) return;
      this.patchMat.uniforms['uShowToday'].value = L.today ? 1 : 0;
      this.patchMat.uniforms['uShowPrev'].value = L.prev ? 1 : 0;
      this.patchMat.uniforms['uExag'].value = ex;
      this.iceExaggeration();
      this.zone.runOutsideAngular(() => {
        if (this.shownT >= 0) this.showIce(this.shownT);
        this.drawOverlay();
      });
      this.needsRender = true;
    });
  }

  ngAfterViewInit(): void {
    this.zone.runOutsideAngular(() => {
      this.initThree();
      this.initPointer();
      this.handleResize();
      this.resizeObs = new ResizeObserver(() => this.handleResize());
      this.resizeObs.observe(this.canvasRef.nativeElement);
      const dock = document.querySelector('.dock-wrap');
      if (dock) this.resizeObs.observe(dock);
      this.animate(performance.now());
    });
    this.data.load().then(() => {
      if (this.data.state() !== 'ready') return;
      this.zone.runOutsideAngular(() => {
        this.initPatch();
        this.drawOverlay();
        this.showFrame(this.t());
      });
    });
  }

  ngOnDestroy(): void {
    this.resizeObs?.disconnect();
    if (this.animId !== null) cancelAnimationFrame(this.animId);
    for (const tex of this.iceSdfTex.values()) tex.dispose();
    for (const mat of this.iceMats.values()) mat.dispose();
    this.iceMeshes.forEach(m => m.geometry.dispose());
    this.controls?.dispose();
    this.renderer?.dispose();
  }

  // ─── public controls ────────────────────────────────────────────────────

  zoomBy(factor: number): void {
    const d = THREE.MathUtils.clamp(this.camera.position.length() * factor, this.controls.minDistance, this.controls.maxDistance);
    this.camera.position.setLength(d);
    this.needsRender = true;
  }

  fit(): void {
    this.camera.position.setLength(this.defaultDistance);
    this.needsRender = true;
  }

  showLabel(l: GlobeLabel): boolean {
    const L = this.layers();
    return l.kind === 'sill' ? L.sills : L.labels;
  }

  // ─── scene ──────────────────────────────────────────────────────────────

  private pos(lon: number, lat: number, r: number, out = new THREE.Vector3()): THREE.Vector3 {
    const phi = ((lon + 180) / 360) * Math.PI * 2;
    const th = (90 - lat) * this.DEG;
    return out.set(-r * Math.cos(phi) * Math.sin(th), r * Math.cos(th), r * Math.sin(phi) * Math.sin(th));
  }

  private lonLat(p: THREE.Vector3): { lon: number; lat: number } {
    const r = p.length();
    const lat = 90 - Math.acos(p.y / r) / this.DEG;
    let lon = Math.atan2(p.z, -p.x) / this.DEG - 180;
    if (lon < -180) lon += 360;
    return { lon, lat };
  }

  private initThree(): void {
    const canvas = this.canvasRef.nativeElement;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    // 1.5 is visually close to 2 on HiDPI screens at ~56% of the fragment cost.
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(this.theme.getTokenColor('globe-bg', '#f5f7fb'));
    this.camera = new THREE.PerspectiveCamera(36, 1, 0.05, 400);
    this.scene.add(this.camera);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xdbe4f0, 1.25));
    const head = new THREE.DirectionalLight(0xffffff, 0.75);
    head.position.set(2, 3, 5);
    this.camera.add(head);

    this.target.setFromVector3(this.pos(this.FOCUS.lon, this.FOCUS.lat, 1));
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = false;
    this.controls.autoRotate = false;
    this.controls.rotateSpeed = 0.5;
    this.controls.zoomSpeed = 0.8;
    this.controls.minAzimuthAngle = this.target.theta - this.TILT_AZIMUTH;
    this.controls.maxAzimuthAngle = this.target.theta + this.TILT_AZIMUTH;
    this.controls.minPolarAngle = Math.max(0.05, this.target.phi - this.TILT_POLAR);
    this.controls.maxPolarAngle = this.target.phi + this.TILT_POLAR;
    this.controls.addEventListener('start', () => (this.dragging = true));
    this.controls.addEventListener('end', () => (this.dragging = false));
    this.controls.addEventListener('change', () => (this.needsRender = true));

    const compact = isAtMost('mobile') && !isMobileLandscape();
    this.controls.minDistance = this.R * 1.12;
    this.controls.maxDistance = this.R * (compact ? 4.2 : 3.2);
    this.defaultDistance = this.R * (compact ? 2.2 : 1.62);
    this.pos(this.FOCUS.lon, this.FOCUS.lat, this.defaultDistance, this.camera.position);
    this.controls.update();

    // Only the European cap is drawn (decision 2026-10-31); this sphere is never rendered and
    // serves the pointer (hover, click) only.
    this.ocean = new THREE.Mesh(new THREE.SphereGeometry(this.R, 96, 48), new THREE.MeshBasicMaterial());
    this.ocean.visible = false;
    this.scene.add(this.ocean);
  }

  // ─── paleo patch ────────────────────────────────────────────────────────

  private initPatch(): void {
    const E = this.data.europe!;
    const B = this.data.baltic!;
    const Rg = this.data.rslGrid!;
    const [w, s, e, n] = E.bbox;
    const mobile = isAtMost('mobile');

    const half = (values: Float32Array, nx: number, ny: number) => {
      const out = new Uint16Array(values.length);
      for (let i = 0; i < values.length; i++) out[i] = THREE.DataUtils.toHalfFloat(Number.isNaN(values[i]) ? 0 : values[i]);
      return this.dataTex(out, nx, ny, THREE.RedFormat, THREE.HalfFloatType);
    };
    const demE = this.demTexture(this.data.hNowEurope!, E);
    const demB = this.demTexture(this.data.hNowBaltic!, B);
    this.rslTex = half(new Float32Array(Rg.nx * Rg.ny), Rg.nx, Rg.ny);
    this.rslPrevTex = half(new Float32Array(Rg.nx * Rg.ny), Rg.nx, Rg.ny);
    this.waterPrevTex = this.dataTex(new Uint8Array(B.nx * B.ny * 2), B.nx, B.ny, THREE.RGFormat, THREE.UnsignedByteType);
    this.waterTex = this.dataTex(new Uint8Array(B.nx * B.ny * 2), B.nx, B.ny, THREE.RGFormat, THREE.UnsignedByteType);
    this.waterBTex = this.dataTex(new Uint8Array(B.nx * B.ny * 2), B.nx, B.ny, THREE.RGFormat, THREE.UnsignedByteType);

    this.overlayCanvas = document.createElement('canvas');
    // Ice outlines only: 2048 px over Europe is enough, and uploads stay small.
    this.overlayCanvas.width = 2048;
    this.overlayCanvas.height = Math.round((this.overlayCanvas.width * (n - s)) / (e - w));
    this.overlayTex = new THREE.CanvasTexture(this.overlayCanvas);
    this.overlayTex.colorSpace = THREE.SRGBColorSpace;
    this.overlayTex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();

    // Finer overlay for the Baltic window only (lines stay sharp when zoomed in).
    const [bw, bs, be, bn] = B.bbox;
    this.overlayBCanvas = document.createElement('canvas');
    this.overlayBCanvas.width = mobile ? 2048 : 4096;
    this.overlayBCanvas.height = Math.round((this.overlayBCanvas.width * (bn - bs)) / (be - bw));
    this.overlayBTex = new THREE.CanvasTexture(this.overlayBCanvas);
    this.overlayBTex.colorSpace = THREE.SRGBColorSpace;
    this.overlayBTex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();

    const c = (token: string, fb: string) => new THREE.Color(this.theme.getTokenColor(token, fb));
    this.patchMat = new THREE.ShaderMaterial({
      vertexShader: PATCH_VERTEX,
      fragmentShader: PATCH_FRAGMENT,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uDemE: { value: demE },
        uDemB: { value: demB },
        uRsl: { value: this.rslTex },
        uWater: { value: this.waterTex },
        uWaterB: { value: this.waterBTex },
        uWaterMix: { value: 0 },
        uRslPrev: { value: this.rslPrevTex },
        uWaterPrev: { value: this.waterPrevTex },
        uLakePrev: { value: 0 },
        uPrevReady: { value: 0 },
        uOverlay: { value: this.overlayTex },
        uOverlayB: { value: this.overlayBTex },
        uBoxE: { value: new THREE.Vector4(...E.bbox) },
        uBoxB: { value: new THREE.Vector4(...B.bbox) },
        uBoxR: { value: new THREE.Vector4(...Rg.bbox) },
        uLake: { value: 0 },
        uExag: { value: this.exaggeration() },
        uR: { value: this.R },
        uFeather: { value: 1.5 },
        uShowToday: { value: this.layers().today ? 1 : 0 },
        uShowPrev: { value: this.layers().prev ? 1 : 0 },
        cLand: { value: c('globe-land-fill', '#cfd8e3') },
        cSeabed: { value: c('paleo-seabed', '#e4dccb') },
        cBasin: { value: c('paleo-brackish', '#8dbcdc') },
        cOcean: { value: c('globe-ocean', '#e0f2fe') },
        cOceanDeep: { value: c('paleo-water-shallow', '#bae6fd') },
        cCoast: { value: c('neutral-600', '#475569') },
        cPrev: { value: c('accent', '#d37400') }
      }
    });
    const geo = new THREE.SphereGeometry(
      this.R * 1.0035,
      mobile ? 300 : 480,
      mobile ? 150 : 240,
      (w + 180) * this.DEG,
      (e - w) * this.DEG,
      (90 - n) * this.DEG,
      (n - s) * this.DEG
    );
    const patch = new THREE.Mesh(geo, this.patchMat);
    patch.renderOrder = 10;
    this.scene.add(patch);
    this.initIce(mobile);
  }

  // ─── ice body (C-07) ────────────────────────────────────────────────────

  /**
   * One mesh per DATED-1 variant over the ice domain, all sharing a single sphere sector: the shape
   * comes from the distance field in the shader, so nothing but the uniforms differs.
   *
   * `min` ⊂ `mc` ⊂ `max` are nested, so an opaque `mc` would hide `min` entirely. All three are
   * therefore translucent and drawn inner to outer: the extents read as three steps of brightness,
   * with the margin of each picked out by its own highlight.
   *
   * Like the paleo patch, the shells do not use the depth buffer — nothing in this scene writes to
   * it — so ordering is by `renderOrder` and the far hemisphere is culled in the shader.
   */
  private initIce(mobile: boolean): void {
    const [w, s, e, n] = ICE_DOMAIN.bbox;
    const geo = new THREE.SphereGeometry(
      this.R * 1.0035,
      mobile ? 224 : 480,
      mobile ? 96 : 192,
      (w + 180) * this.DEG,
      (e - w) * this.DEG,
      (90 - n) * this.DEG,
      (n - s) * this.DEG
    );
    const shared = this.patchMat!.uniforms;
    // The --color-paleo-ice* tokens carry their alpha inside rgba(), which was the opacity of the
    // old flat fill; THREE.Color keeps only the hue. Three nested shells need their own opacities
    // anyway — 0.92 for mc would hide min completely — so those are set per variant below.
    const ice = this.theme.getTokenColor('paleo-ice', 'rgba(255,255,255,0.92)');
    const band = this.theme.getTokenColor('paleo-ice-band', 'rgba(255,255,255,0.45)');
    const edge = this.theme.getTokenColor('paleo-ice-edge', '#7dd3fc');
    // opacity, rim width (km), render order — inner to outer
    const look: Record<IceVariant, { color: string; opacity: number; rim: number; order: number }> = {
      min: { color: band, opacity: 0.42, rim: 6, order: 11 },
      mc: { color: ice, opacity: 0.46, rim: 9, order: 12 },
      max: { color: band, opacity: 0.24, rim: 14, order: 13 }
    };
    for (const variant of ['min', 'mc', 'max'] as IceVariant[]) {
      const L = look[variant];
      const mat = new THREE.ShaderMaterial({
        vertexShader: ICE_VERTEX,
        fragmentShader: ICE_FRAGMENT,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        uniforms: {
          uDemE: shared['uDemE'],
          uDemB: shared['uDemB'],
          uRsl: shared['uRsl'],
          uRslPrev: shared['uRslPrev'],
          uWater: shared['uWater'],
          uWaterB: shared['uWaterB'],
          uWaterPrev: shared['uWaterPrev'],
          uWaterMix: shared['uWaterMix'],
          uLakePrev: shared['uLakePrev'],
          uPrevReady: shared['uPrevReady'],
          uBoxE: shared['uBoxE'],
          uBoxB: shared['uBoxB'],
          uBoxR: shared['uBoxR'],
          uLake: shared['uLake'],
          uExag: shared['uExag'],
          uR: { value: this.R },
          uBoxI: { value: new THREE.Vector4(...ICE_DOMAIN.bbox) },
          uSdfA: { value: this.sdfTexture(20, variant) },
          uSdfB: { value: this.sdfTexture(20, variant) },
          uSdfMix: { value: 0 },
          uProfileK: { value: ICE_PROFILE_K },
          uIceExag: { value: this.iceExaggeration() },
          uColor: { value: new THREE.Color(L.color) },
          uEdge: { value: new THREE.Color(edge) },
          uOpacity: { value: L.opacity },
          uFade: { value: 0 },
          uFeatherKm: { value: 1.5 },
          uRimKm: { value: L.rim }
        }
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.renderOrder = L.order;
      mesh.visible = false;
      this.iceMats.set(variant, mat);
      this.iceMeshes.set(variant, mesh);
      this.scene.add(mesh);
    }
  }

  /** Signed-distance texture for one DATED-1 slice, built once and kept. */
  private sdfTexture(ka: number, variant: IceVariant): THREE.DataTexture {
    const key = `${ka}:${variant}`;
    const hit = this.iceSdfTex.get(key);
    if (hit) return hit;
    const src = this.data.iceSdf(ka, variant);
    const half = new Uint16Array(src.length);
    for (let i = 0; i < src.length; i++) half[i] = THREE.DataUtils.toHalfFloat(src[i] / ICE_SDF_SCALE);
    const tex = this.dataTex(half, ICE_DOMAIN.nx, ICE_DOMAIN.ny, THREE.RedFormat, THREE.HalfFloatType);
    this.iceSdfTex.set(key, tex);
    return tex;
  }

  /** Slice pair and blend weight for t; drives both the shape and the fade below 10 ka. */
  private showIce(t: number): void {
    if (!this.iceMats.size) return;
    const b = iceBracket(t);
    const L = this.layers();
    for (const [variant, mat] of this.iceMats) {
      const on = variant === 'mc' ? L.ice : L.band;
      const mesh = this.iceMeshes.get(variant)!;
      mesh.visible = !!b && on;
      if (!b || !on) continue;
      const pair = `${b.kaA}:${b.kaB}`;
      if (this.shownIceSlices.get(variant) !== pair) {
        this.shownIceSlices.set(variant, pair);
        mat.uniforms['uSdfA'].value = this.sdfTexture(b.kaA, variant);
        mat.uniforms['uSdfB'].value = this.sdfTexture(b.kaB, variant);
      }
      mat.uniforms['uSdfMix'].value = b.w;
      mat.uniforms['uFade'].value = b.fade;
      mat.uniforms['uIceExag'].value = this.iceExaggeration();
    }
  }

  private dataTex(
    data: Uint8Array | Uint16Array,
    w: number,
    h: number,
    format: THREE.PixelFormat,
    type: THREE.TextureDataType
  ): THREE.DataTexture {
    const tex = new THREE.DataTexture(data, w, h, format, type);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.unpackAlignment = 1;
    tex.flipY = false;
    tex.needsUpdate = true;
    return tex;
  }

  /**
   * Time is continuous. RSL and the ice body follow it directly — the shader computes H_paleo and
   * the ice profile itself — while the water mask, which costs a flood fill per frame, is blended
   * between the two bracketing frames of the 1 ka timeline.
   */
  private showFrame(t: number): void {
    if (!this.patchMat) return;
    const u = this.patchMat.uniforms;
    if (t !== this.shownT) {
      this.shownT = t;
      // Quantised so scrubbing reuses cached RSL fields; 25 years is far below one pixel of the
      // timeline and well inside the 1 m agreement the pipeline is checked against (I-01).
      const q = Math.round(t / RSL_STEP_YR) * RSL_STEP_YR;
      this.setHalf(this.rslTex!, this.data.rsl(q));
      this.setHalf(this.rslPrevTex!, this.data.rsl(q + 1000));
      const cls: WaterClass = phaseAt(t).cls;
      const token = cls === 'marine' ? 'paleo-marine' : cls === 'brackish' ? 'paleo-brackish' : 'paleo-fresh';
      (u['cBasin'].value as THREE.Color).set(this.theme.getTokenColor(token, '#8dbcdc'));
      this.showIce(t);
    }

    const { a, b, w } = this.data.bracket(t);
    if (a && a !== this.frame) {
      this.frame = a;
      this.fillWaterTex(this.waterTex!, a.water);
    }
    if (b && b !== this.frameB) {
      this.frameB = b;
      this.fillWaterTex(this.waterBTex!, b.water);
    }
    u['uWaterMix'].value = this.frame && this.frameB ? w : 0;
    if (this.frame) {
      const la = this.frame.lakeLevelM;
      u['uLake'].value = this.frameB ? la + (this.frameB.lakeLevelM - la) * w : la;
    }

    // The ghost coast is a reference contour, so it stays on the 1 ka grid: following it
    // continuously would ask the worker for a new fill on every tick.
    const te = nearestFrame(t) + 1000;
    if (te !== this.earlierTarget) {
      this.earlierTarget = te;
      this.earlierShown = null;
      u['uPrevReady'].value = 0;
    }
    const e = this.data.earlier(t);
    if (e && e !== this.earlierShown) {
      this.earlierShown = e;
      this.fillWaterTex(this.waterPrevTex!, e.water);
      u['uLakePrev'].value = e.lakeLevelM;
      u['uPrevReady'].value = 1;
    }
    this.needsRender = true;
  }

  private setHalf(tex: THREE.DataTexture, v: Float32Array): void {
    const d = tex.image.data as Uint16Array;
    for (let i = 0; i < v.length; i++) d[i] = THREE.DataUtils.toHalfFloat(v[i]);
    tex.needsUpdate = true;
  }

  private fillWaterTex(tex: THREE.DataTexture, water: Uint8Array): void {
    const d = tex.image.data as Uint8Array;
    for (let i = 0; i < water.length; i++) {
      d[i * 2] = water[i] === WATER_OCEAN ? 255 : 0;
      d[i * 2 + 1] = water[i] === WATER_LAKE ? 255 : 0;
    }
    tex.needsUpdate = true;
  }

  /** Present-day heights (r) with a hillshade factor baked once (g), as RG half floats. */
  private demTexture(h: Float32Array, g: { nx: number; ny: number; bbox: readonly [number, number, number, number] }): THREE.DataTexture {
    const { nx, ny } = g;
    const [west, south, east, north] = g.bbox;
    const dLon = (east - west) / nx;
    const dLat = (north - south) / ny;
    const z = (i: number) => (Number.isNaN(h[i]) ? 0 : h[i]);
    const out = new Uint16Array(nx * ny * 2);
    const lx = -0.6;
    const ly = 0.6;
    const lz = 0.9;
    const ln = Math.hypot(lx, ly, lz);
    for (let r = 0; r < ny; r++) {
      const lat = north - (r + 0.5) * dLat;
      const mx = 111320 * Math.cos(lat * this.DEG) * dLon * 2;
      const my = 110570 * dLat * 2;
      const r0 = Math.max(0, r - 1);
      const r1 = Math.min(ny - 1, r + 1);
      for (let c = 0; c < nx; c++) {
        const i = r * nx + c;
        const c0 = Math.max(0, c - 1);
        const c1 = Math.min(nx - 1, c + 1);
        const gx = (-(z(r * nx + c1) - z(r * nx + c0)) / mx) * 14;
        const gy = (-(z(r0 * nx + c) - z(r1 * nx + c)) / my) * 14;
        const nl = Math.hypot(gx, gy, 1);
        const dot = (gx * lx + gy * ly + lz) / (nl * ln);
        const shade = clamp(1 + 0.9 * (dot - lz / ln), 0.55, 1.35);
        out[i * 2] = THREE.DataUtils.toHalfFloat(z(i));
        out[i * 2 + 1] = THREE.DataUtils.toHalfFloat(shade);
      }
    }
    return this.dataTex(out, nx, ny, THREE.RGFormat, THREE.HalfFloatType);
  }

  /**
   * Annotation layer over the patch domain. Ice used to be painted flat here and is now a 3D body
   * (see initIce), which leaves this canvas empty — the lines that remain all fall inside the
   * Baltic window. Kept because it is the only annotation surface that spans the whole patch.
   *
   * Nothing here depends on time, so it is redrawn on layer and theme changes only: it is a 2048 px
   * texture upload, and time now advances continuously rather than once per 1000 years.
   */
  private drawOverlay(): void {
    const cv = this.overlayCanvas;
    if (!cv || !this.data.europe) return;
    cv.getContext('2d')!.clearRect(0, 0, cv.width, cv.height);
    if (this.overlayTex) this.overlayTex.needsUpdate = true;
    this.drawOverlayBaltic();
  }

  /** Lines inside the Baltic window: transect and sills. */
  private drawOverlayBaltic(): void {
    const cv = this.overlayBCanvas;
    const B = this.data.baltic;
    if (!cv || !B) return;
    const ctx = cv.getContext('2d')!;
    const W = cv.width;
    const H = cv.height;
    const [w, s, e, n] = B.bbox;
    ctx.clearRect(0, 0, W, H);
    const sx = W / (e - w);
    const sy = H / (n - s);
    const L = this.layers();
    const ink = this.theme.getTokenColor('neutral-800', '#1e293b');
    if (L.transect) {
      ctx.beginPath();
      TRANSECT.forEach(([lon, lat], i) => {
        if (i) ctx.lineTo((lon - w) * sx, (n - lat) * sy);
        else ctx.moveTo((lon - w) * sx, (n - lat) * sy);
      });
      ctx.setLineDash([W / 160, W / 260]);
      ctx.strokeStyle = ink;
      ctx.lineWidth = W / 900;
      ctx.stroke();
      ctx.setLineDash([]);
      for (const [lon, lat] of [TRANSECT[0], TRANSECT[TRANSECT.length - 1]]) {
        ctx.beginPath();
        ctx.arc((lon - w) * sx, (n - lat) * sy, W / 380, 0, Math.PI * 2);
        ctx.fillStyle = ink;
        ctx.fill();
      }
    }
    if (L.sills) {
      const r = W / 450;
      ctx.fillStyle = this.theme.getTokenColor('accent', '#d37400');
      for (const sl of SILLS) {
        const x = (sl.lon - w) * sx;
        const y = (n - sl.lat) * sy;
        ctx.beginPath();
        ctx.moveTo(x, y - r);
        ctx.lineTo(x + r, y);
        ctx.lineTo(x, y + r);
        ctx.lineTo(x - r, y);
        ctx.closePath();
        ctx.fill();
      }
    }
    if (this.overlayBTex) this.overlayBTex.needsUpdate = true;
    this.needsRender = true;
  }

  // ─── pointer ────────────────────────────────────────────────────────────

  private initPointer(): void {
    const cv = this.canvasRef.nativeElement;
    cv.addEventListener('pointermove', e => (this.pendingHover = e), { passive: true });
    cv.addEventListener('pointerleave', () => {
      this.pendingHover = null;
      this.zone.run(() => this.hover.emit(null));
    });
  }

  private hit(e: { clientX: number; clientY: number }): { lon: number; lat: number } | null {
    const r = this.canvasRef.nativeElement.getBoundingClientRect();
    this.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const hit = this.raycaster.intersectObject(this.ocean, false)[0];
    return hit ? this.lonLat(hit.point) : null;
  }

  private flushHover(): void {
    const e = this.pendingHover;
    if (!e) return;
    this.pendingHover = null;
    if (this.dragging) return;
    const ll = this.hit(e);
    this.zone.run(() => this.hover.emit(ll ? { ...ll, x: e.clientX, y: e.clientY } : null));
  }

  // ─── loop ───────────────────────────────────────────────────────────────

  private handleResize(): void {
    const canvas = this.canvasRef.nativeElement;
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    const dock = document.querySelector('.dock-wrap') as HTMLElement | null;
    const lift = dock ? Math.min(dock.offsetHeight, h * 0.55) / 2 : 0;
    this.camera.setViewOffset(w, h, 0, lift, w, h);
    this.camera.updateProjectionMatrix();
    this.needsRender = true;
  }

  private placeLabels(): void {
    const refs = this.labelRefs?.toArray();
    const data = this.labels();
    if (!refs || refs.length !== data.length) return;
    const canvas = this.canvasRef.nativeElement;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    this.camDir.copy(this.camera.position).normalize();
    for (let i = 0; i < refs.length; i++) {
      const el = refs[i].nativeElement;
      const p = this.pos(data[i].lon, data[i].lat, this.R * 1.006, this.tmpV);
      const facing = this.tmpN.copy(p).normalize().dot(this.camDir);
      p.project(this.camera);
      const zoomedOut = data[i].kind === 'sill' && this.camera.position.length() > this.R * 1.42;
      el.style.opacity = facing > 0.2 && p.z < 1 && !zoomedOut ? '1' : '0';
      el.style.transform = `translate(${((p.x + 1) / 2) * w - 3}px, ${((1 - p.y) / 2) * h - 7}px)`;
    }
  }

  private animate = (now: number): void => {
    this.animId = requestAnimationFrame(this.animate);
    const dt = Math.min(0.1, (now - this.lastTime) / 1000 || 0);
    this.lastTime = now;
    if (!this.dragging) {
      this.tmpSph.setFromVector3(this.camera.position);
      const k = 1 - Math.exp(-dt * this.SPRING_RATE);
      const dTheta = this.target.theta - this.tmpSph.theta;
      const dPhi = this.target.phi - this.tmpSph.phi;
      if (Math.abs(dTheta) > 1e-4 || Math.abs(dPhi) > 1e-4) {
        this.tmpSph.theta += dTheta * k;
        this.tmpSph.phi += dPhi * k;
        this.camera.position.setFromSpherical(this.tmpSph);
        this.camera.lookAt(0, 0, 0);
        this.needsRender = true;
      }
    }
    if (this.controls.update()) this.needsRender = true;
    this.flushHover();
    if (!this.needsRender) return;
    this.needsRender = false;
    this.placeLabels();
    this.renderer.render(this.scene, this.camera);
  };

}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
