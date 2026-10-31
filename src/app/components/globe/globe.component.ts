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
import * as d3Geo from 'd3-geo';
import { ThemeService } from '@kmd/design-system/services/theme.service';
import { isAtMost, isMobileLandscape } from '@kmd/design-system/utils/breakpoints';
import { I18nService } from '../../core/i18n/i18n.service';
import { PaleoDataService, PaleoFrame, TRANSECT } from '../../core/data/paleo-data.service';
import { WATER_LAKE, WATER_OCEAN } from '../../core/data/water';
import { phaseAt, WaterClass } from '../../core/data/timeline';
import { SILLS } from '../../core/data/geo';
import { PATCH_FRAGMENT, PATCH_VERTEX } from './paleo-shaders';

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
  readonly exaggeration = input<number>(10);
  readonly labels = input<GlobeLabel[]>([]);
  readonly hover = output<GlobePointer | null>();
  readonly pick = output<{ lon: number; lat: number }>();

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
  private overlayCanvas?: HTMLCanvasElement;
  private overlayTex?: THREE.CanvasTexture;
  private overlayBCanvas?: HTMLCanvasElement;
  private overlayBTex?: THREE.CanvasTexture;
  private frame: PaleoFrame | null = null;
  private shownT = -1;
  private prevShoreShown: Float32Array | null = null;
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
  private downAt: { x: number; y: number } | null = null;
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
      this.zone.runOutsideAngular(() => this.drawOverlay());
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
        this.showFrame(this.t());
      });
    });
  }

  ngOnDestroy(): void {
    this.resizeObs?.disconnect();
    if (this.animId !== null) cancelAnimationFrame(this.animId);
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
    this.waterTex = this.dataTex(new Uint8Array(B.nx * B.ny * 2), B.nx, B.ny, THREE.RGFormat, THREE.UnsignedByteType);

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
   * RSL updates immediately (the shader computes H_paleo itself); the water mask follows when
   * the worker delivers the frame — usually already cached by the background precomputation.
   */
  private showFrame(t: number): void {
    if (!this.patchMat) return;
    const u = this.patchMat.uniforms;
    if (t !== this.shownT) {
      this.shownT = t;
      const d = this.rslTex!.image.data as Uint16Array;
      const v = this.data.rsl(t);
      for (let i = 0; i < v.length; i++) d[i] = THREE.DataUtils.toHalfFloat(v[i]);
      this.rslTex!.needsUpdate = true;
      const cls: WaterClass = phaseAt(t).cls;
      const token = cls === 'marine' ? 'paleo-marine' : cls === 'brackish' ? 'paleo-brackish' : 'paleo-fresh';
      (u['cBasin'].value as THREE.Color).set(this.theme.getTokenColor(token, '#8dbcdc'));
      this.drawOverlay();
    }
    const f = this.data.frame(t);
    if (f && f !== this.frame) {
      this.frame = f;
      const wd = this.waterTex!.image.data as Uint8Array;
      for (let i = 0; i < f.water.length; i++) {
        wd[i * 2] = f.water[i] === WATER_OCEAN ? 255 : 0;
        wd[i * 2 + 1] = f.water[i] === WATER_LAKE ? 255 : 0;
      }
      this.waterTex!.needsUpdate = true;
      u['uLake'].value = f.lakeLevelM;
    }
    const prev = this.data.peek(t + 1000)?.shore ?? null;
    if (prev !== this.prevShoreShown) this.drawOverlayBaltic();
    this.needsRender = true;
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

  /** Ice (mc + min/max band), sills and the transect line, in the patch's lon/lat frame. */
  private drawOverlay(): void {
    const cv = this.overlayCanvas;
    const E = this.data.europe;
    if (!cv || !E) return;
    const ctx = cv.getContext('2d')!;
    const W = cv.width;
    const H = cv.height;
    const [w, s, e, n] = E.bbox;
    ctx.clearRect(0, 0, W, H);
    const sx = W / (e - w);
    const sy = H / (n - s);
    const proj = d3Geo.geoTransform({
      point(lon: number, lat: number) {
        this.stream.point((lon - w) * sx, (n - lat) * sy);
      }
    });
    const path = d3Geo.geoPath(proj, ctx);
    const L = this.layers();
    const ice = this.shownT >= 0 ? this.data.iceFor(this.shownT) : null;
    const edge = this.theme.getTokenColor('paleo-ice-edge', '#7dd3fc');
    if (ice) {
      if (L.band && ice.features.max) {
        ctx.beginPath();
        path(ice.features.max);
        ctx.fillStyle = this.theme.getTokenColor('paleo-ice-band', 'rgba(255,255,255,0.45)');
        ctx.fill();
      }
      if (L.ice && ice.features.mc) {
        ctx.beginPath();
        path(ice.features.mc);
        ctx.fillStyle = this.theme.getTokenColor('paleo-ice', 'rgba(255,255,255,0.92)');
        ctx.fill();
        ctx.strokeStyle = edge;
        ctx.lineWidth = W / 1400;
        ctx.stroke();
      }
      if (L.band && ice.features.min) {
        ctx.beginPath();
        path(ice.features.min);
        ctx.setLineDash([W / 400, W / 600]);
        ctx.strokeStyle = edge;
        ctx.lineWidth = W / 2000;
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
    if (this.overlayTex) this.overlayTex.needsUpdate = true;
    this.drawOverlayBaltic();
  }

  /** Lines inside the Baltic window: coast 1000 years earlier, transect, sills. */
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
    // Coast 1000 years earlier: the shoreline of the frame t + 1000 (Baltic window).
    const segs = this.shownT >= 0 ? (this.data.peek(this.shownT + 1000)?.shore ?? null) : null;
    this.prevShoreShown = segs;
    if (L.prev && segs) {
      ctx.beginPath();
      for (let i = 0; i < segs.length; i += 4) {
        ctx.moveTo((segs[i] - w) * sx, (n - segs[i + 1]) * sy);
        ctx.lineTo((segs[i + 2] - w) * sx, (n - segs[i + 3]) * sy);
      }
      ctx.strokeStyle = this.theme.getTokenColor('accent', '#d37400');
      ctx.globalAlpha = 0.85;
      ctx.lineWidth = W / 1100;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
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
    cv.addEventListener('pointerdown', e => (this.downAt = { x: e.clientX, y: e.clientY }));
    cv.addEventListener('pointerup', e => {
      const d = this.downAt;
      this.downAt = null;
      if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4) return;
      const ll = this.hit(e);
      if (ll) this.zone.run(() => this.pick.emit(ll));
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
