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
import * as topojson from 'topojson-client';
import type { Feature, FeatureCollection } from 'geojson';
import { ThemeService } from '@kmd/design-system/services/theme.service';
import { isAtMost, isMobileLandscape } from '@kmd/design-system/utils/breakpoints';
import { I18nService } from '../../core/i18n/i18n.service';
import { PaleoDataService, PaleoFrame, TRANSECT, Water } from '../../core/data/paleo-data.service';
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
 * Globe ported from kmd-labs/el-nino — only the globe and its relief (I-05): sphere, land
 * texture on an equirectangular canvas, ETOPO2 displacement, Natural Earth relief, glow.
 *
 * The paleo region is a separate dense patch on the sphere, shaded per pixel on the GPU
 * from the present-day grids and the RSL field (paleo-shaders.ts), displaced by H_paleo.
 * The camera starts over the Baltic; dragging only tilts and springs back to the Baltic.
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
  private readonly ELEV_CEILING_M = 9000;
  private readonly EARTH_RADIUS_M = 6371000;
  private readonly ELEV_EXAGGERATION = 10;
  private readonly RELIEF_STRENGTH = 0.55;
  private readonly RELIEF_RANGE = 46;

  private readonly FOCUS = { lon: 20, lat: 59 };
  private readonly TILT_AZIMUTH = 22 * (Math.PI / 180);
  private readonly TILT_POLAR = 14 * (Math.PI / 180);
  private readonly SPRING_RATE = 3.2;

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private controls!: OrbitControls;
  private ocean!: THREE.Mesh;
  private landMat!: THREE.MeshLambertMaterial;
  private landCanvas!: HTMLCanvasElement;
  private landTex!: THREE.CanvasTexture;
  private land: FeatureCollection | Feature | null = null;
  private relief: { data: Uint8Array; w: number; h: number; base: number } | null = null;
  private reliefCanvas: HTMLCanvasElement | null = null;

  private patchMat?: THREE.ShaderMaterial;
  private rslTex?: THREE.DataTexture;
  private rslPrevTex?: THREE.DataTexture;
  private waterTex?: THREE.DataTexture;
  private overlayCanvas?: HTMLCanvasElement;
  private overlayTex?: THREE.CanvasTexture;
  private overlayBCanvas?: HTMLCanvasElement;
  private overlayBTex?: THREE.CanvasTexture;
  private frame: PaleoFrame | null = null;

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
      if (this.data.state() !== 'ready' || !this.patchMat) return;
      this.zone.runOutsideAngular(() => this.showFrame(t));
    });
    effect(() => {
      const L = this.layers();
      const ex = this.exaggeration();
      if (!this.patchMat) return;
      this.patchMat.uniforms['uShowToday'].value = L.today ? 1 : 0;
      this.patchMat.uniforms['uShowPrev'].value = L.prev ? 1 : 0;
      this.patchMat.uniforms['uExag'].value = ex;
      this.zone.runOutsideAngular(() => this.drawOverlay());
    });
  }

  ngAfterViewInit(): void {
    this.zone.runOutsideAngular(() => {
      this.initThree();
      this.initLand();
      this.initGlow();
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
  }

  fit(): void {
    this.camera.position.setLength(this.defaultDistance);
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
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

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

    const compact = isAtMost('mobile') && !isMobileLandscape();
    this.controls.minDistance = this.R * 1.12;
    this.controls.maxDistance = this.R * (compact ? 4.2 : 3.2);
    this.defaultDistance = this.R * (compact ? 2.2 : 1.62);
    this.pos(this.FOCUS.lon, this.FOCUS.lat, this.defaultDistance, this.camera.position);
    this.controls.update();

    this.ocean = new THREE.Mesh(
      new THREE.SphereGeometry(this.R, 128, 64),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(this.theme.getTokenColor('globe-ocean', '#e0f2fe')) })
    );
    this.scene.add(this.ocean);
  }

  private initGlow(): void {
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        c: { value: new THREE.Color(this.theme.getTokenColor('globe-glow', '#0f172a')) },
        uOpacity: { value: 0.22 },
        uPower: { value: 2.2 }
      },
      vertexShader: `
        varying vec3 vN; varying vec3 vV;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        uniform vec3 c; uniform float uOpacity; uniform float uPower; varying vec3 vN; varying vec3 vV;
        void main() {
          float d = clamp(-dot(vN, vV), 0.0, 1.0);
          gl_FragColor = vec4(c, pow(clamp(d / 0.4938, 0.0, 1.0), uPower) * uOpacity);
        }`,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false
    });
    this.scene.add(new THREE.Mesh(new THREE.SphereGeometry(this.R * 1.15, 64, 32), mat));
  }

  private initLand(): void {
    const size = this.renderer.capabilities.maxTextureSize >= 8192 && !isAtMost('mobile') ? 4096 : 2048;
    this.landCanvas = document.createElement('canvas');
    this.landCanvas.width = size;
    this.landCanvas.height = size / 2;
    this.landTex = new THREE.CanvasTexture(this.landCanvas);
    this.landTex.colorSpace = THREE.SRGBColorSpace;
    this.landTex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    this.landMat = new THREE.MeshLambertMaterial({ map: this.landTex, transparent: true, depthWrite: false });
    this.landMat.color.setHex(0x000000);
    this.landMat.emissive.setHex(0xffffff);
    this.landMat.emissiveMap = this.landTex;
    const seg = isAtMost('mobile') ? 256 : 384;
    this.scene.add(new THREE.Mesh(new THREE.SphereGeometry(this.R * 1.003, seg, seg / 2), this.landMat));
    this.drawLand();

    fetch('assets/data/globe/land-50m.json')
      .then(r => r.json())
      .then(topology => {
        this.land = topojson.feature(topology, topology.objects.land) as unknown as FeatureCollection;
        this.drawLand();
        setTimeout(() => {
          this.loadRelief();
          this.loadElevation();
        }, 120);
      })
      .catch(err => console.warn('Could not load land data:', err));
  }

  private loadElevation(): void {
    const file = isAtMost('mobile') ? 'assets/data/globe/elevation-1k.png' : 'assets/data/globe/elevation.png';
    new THREE.TextureLoader().load(
      file,
      tex => {
        tex.colorSpace = THREE.NoColorSpace;
        this.landMat.displacementMap = tex;
        this.landMat.displacementScale = this.R * (this.ELEV_CEILING_M / this.EARTH_RADIUS_M) * this.ELEV_EXAGGERATION;
        this.landMat.needsUpdate = true;
      },
      undefined,
      () => console.warn('Could not load elevation data')
    );
  }

  /** Natural Earth relief in the El Niño 'KMDR' format. The 2k file keeps the first load under 4 MB. */
  private async loadRelief(): Promise<void> {
    try {
      const resp = await fetch('assets/data/globe/relief-2k.bin.gz');
      if (!resp.ok) return;
      let buf = await resp.arrayBuffer();
      const magic = new Uint8Array(buf, 0, Math.min(2, buf.byteLength));
      if (magic[0] === 0x1f && magic[1] === 0x8b) {
        const stream = new Response(buf).body!.pipeThrough(new DecompressionStream('gzip'));
        buf = await new Response(stream).arrayBuffer();
      }
      const head = new DataView(buf);
      if (buf.byteLength < 10 || head.getUint32(0, false) !== 0x4b4d4452) return;
      const w = head.getUint16(4, true);
      const h = head.getUint16(6, true);
      if (buf.byteLength < 10 + w * h) return;
      this.relief = { data: new Uint8Array(buf, 10, w * h), w, h, base: head.getUint8(8) };
      this.reliefCanvas = null;
      this.drawLand();
    } catch (err) {
      console.warn('Could not load relief data:', err);
    }
  }

  private drawLand(): void {
    const ctx = this.landCanvas.getContext('2d');
    if (!ctx) return;
    const W = this.landCanvas.width;
    const H = this.landCanvas.height;
    ctx.clearRect(0, 0, W, H);
    const proj = d3Geo.geoEquirectangular().scale(W / (2 * Math.PI)).translate([W / 2, H / 2]).precision(0.1);
    const path = d3Geo.geoPath(proj, ctx);
    ctx.beginPath();
    path(d3Geo.geoGraticule().step([10, 10])());
    ctx.strokeStyle = this.theme.getTokenColor('globe-graticule', 'rgba(15, 23, 42, 0.07)');
    ctx.lineWidth = W / 2048;
    ctx.stroke();
    if (!this.land) {
      this.landTex.needsUpdate = true;
      return;
    }
    const fill = this.theme.getTokenColor('globe-land-fill', '#cfd8e3');
    ctx.beginPath();
    path(this.land);
    ctx.fillStyle = fill;
    ctx.fill();
    const relief = this.reliefLayer(fill);
    if (relief) {
      ctx.save();
      ctx.clip();
      ctx.drawImage(relief, 0, 0, W, H);
      ctx.restore();
    }
    ctx.beginPath();
    path(this.land);
    ctx.strokeStyle = this.theme.getTokenColor('globe-land-stroke', 'rgba(71, 85, 105, 0.55)');
    ctx.lineWidth = W / 2400;
    ctx.stroke();
    this.landTex.needsUpdate = true;
  }

  private reliefLayer(fill: string): HTMLCanvasElement | null {
    const r = this.relief;
    if (!r) return null;
    if (this.reliefCanvas) return this.reliefCanvas;
    const cv = document.createElement('canvas');
    cv.width = r.w;
    cv.height = r.h;
    const cx = cv.getContext('2d');
    if (!cx) return null;
    const [fr, fg, fb] = this.cssToRgb(fill);
    const img = cx.createImageData(r.w, r.h);
    const px = img.data;
    for (let i = 0, o = 0; i < r.data.length; i++, o += 4) {
      const f = 1 + this.RELIEF_STRENGTH * clamp((r.data[i] - r.base) / this.RELIEF_RANGE, -1, 1);
      px[o] = fr * f;
      px[o + 1] = fg * f;
      px[o + 2] = fb * f;
      px[o + 3] = 255;
    }
    cx.putImageData(img, 0, 0);
    this.reliefCanvas = cv;
    return cv;
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
    const demE = half(this.data.hNowEurope!, E.nx, E.ny);
    const demB = half(this.data.hNowBaltic!, B.nx, B.ny);
    this.rslTex = half(new Float32Array(Rg.nx * Rg.ny), Rg.nx, Rg.ny);
    this.rslPrevTex = half(new Float32Array(Rg.nx * Rg.ny), Rg.nx, Rg.ny);
    this.waterTex = this.dataTex(new Uint8Array(B.nx * B.ny * 2), B.nx, B.ny, THREE.RGFormat, THREE.UnsignedByteType);

    this.overlayCanvas = document.createElement('canvas');
    this.overlayCanvas.width = mobile ? 2048 : 4096;
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
        uRslPrev: { value: this.rslPrevTex },
        uWater: { value: this.waterTex },
        uOverlay: { value: this.overlayTex },
        uOverlayB: { value: this.overlayBTex },
        uBoxE: { value: new THREE.Vector4(...E.bbox) },
        uBoxB: { value: new THREE.Vector4(...B.bbox) },
        uBoxR: { value: new THREE.Vector4(...Rg.bbox) },
        uTexelE: { value: new THREE.Vector2((e - w) / E.nx, (n - s) / E.ny) },
        uTexelB: { value: new THREE.Vector2((B.bbox[2] - B.bbox[0]) / B.nx, (B.bbox[3] - B.bbox[1]) / B.ny) },
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
        cOceanDeep: { value: c('paleo-water-deep', '#7dd3fc') },
        cCoast: { value: c('neutral-600', '#475569') },
        cPrev: { value: c('accent', '#d37400') }
      }
    });
    const geo = new THREE.SphereGeometry(
      this.R * 1.0035,
      mobile ? 300 : 500,
      mobile ? 170 : 280,
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

  private showFrame(t: number): void {
    if (!this.patchMat) return;
    const f = this.data.frame(t);
    this.frame = f;
    const setHalf = (tex: THREE.DataTexture, v: Float32Array) => {
      const d = tex.image.data as Uint16Array;
      for (let i = 0; i < v.length; i++) d[i] = THREE.DataUtils.toHalfFloat(v[i]);
      tex.needsUpdate = true;
    };
    setHalf(this.rslTex!, f.rsl);
    setHalf(this.rslPrevTex!, f.rslPrev);
    const wd = this.waterTex!.image.data as Uint8Array;
    for (let i = 0; i < f.water.length; i++) {
      wd[i * 2] = f.water[i] === Water.Ocean ? 255 : 0;
      wd[i * 2 + 1] = f.water[i] === Water.Lake ? 255 : 0;
    }
    this.waterTex!.needsUpdate = true;
    const u = this.patchMat.uniforms;
    u['uLake'].value = f.lakeLevelM;
    const cls: WaterClass = phaseAt(t).cls;
    const token = cls === 'marine' ? 'paleo-marine' : cls === 'brackish' ? 'paleo-brackish' : 'paleo-fresh';
    (u['cBasin'].value as THREE.Color).set(this.theme.getTokenColor(token, '#8dbcdc'));
    this.drawOverlay();
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
    const ice = this.frame?.ice;
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
    if (L.prev && this.frame && this.frame.t + 1000 <= 20000) {
      const segs = this.data.shoreline(this.frame.t + 1000);
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
      }
    }
    this.controls.update();
    this.flushHover();
    this.placeLabels();
    this.renderer.render(this.scene, this.camera);
  };

  private cssToRgb(css: string): [number, number, number] {
    const cv = document.createElement('canvas');
    cv.width = 1;
    cv.height = 1;
    const cx = cv.getContext('2d', { willReadFrequently: true });
    if (!cx) return [207, 216, 227];
    cx.fillStyle = '#cfd8e3';
    cx.fillStyle = css;
    cx.fillRect(0, 0, 1, 1);
    const d = cx.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2]];
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
