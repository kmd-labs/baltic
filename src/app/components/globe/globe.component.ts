import {
  AfterViewInit,
  Component,
  ElementRef,
  NgZone,
  OnDestroy,
  ViewChild,
  effect,
  inject,
  input
} from '@angular/core';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as d3Geo from 'd3-geo';
import * as topojson from 'topojson-client';
import type { Feature, FeatureCollection } from 'geojson';
import { ThemeService } from '@kmd/design-system/services/theme.service';
import { isAtMost, isMobileLandscape } from '@kmd/design-system/utils/breakpoints';
import { I18nService } from '../../core/i18n/i18n.service';
import { PaleoDataService, PaleoFrame } from '../../core/data/paleo-data.service';

/**
 * Globe ported from kmd-labs/el-nino — only the globe and its relief (I-05):
 * sphere, land texture painted on an equirectangular canvas, ETOPO2 displacement,
 * Natural Earth shaded relief, glow. Everything else from El Niño is left out.
 *
 * On top of it, inside the DEM domain, the paleo layer: H_paleo = H_now − RSL(t)
 * coloured as water / land, with the DATED-1 ice outline (C-03 / C-07 prototype).
 *
 * The camera starts over the Baltic. Dragging tilts the globe within a small cone and,
 * on release, it springs back so the Baltic is centred again.
 */
@Component({
  selector: 'app-globe',
  standalone: true,
  template: `<canvas #canvas class="globe-canvas" [attr.aria-label]="i18n.t().stageAriaLabel" role="img"></canvas>`,
  styles: [
    `
      :host { position: absolute; inset: 0; display: block; }
      .globe-canvas { width: 100%; height: 100%; display: block; touch-action: none; cursor: grab; }
      .globe-canvas:active { cursor: grabbing; }
    `
  ]
})
export class GlobeComponent implements AfterViewInit, OnDestroy {
  /** Time shown, ka BP. */
  readonly ka = input.required<number>();

  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  readonly i18n = inject(I18nService);
  private readonly zone = inject(NgZone);
  private readonly theme = inject(ThemeService);
  private readonly data = inject(PaleoDataService);

  // Sphere geometry, as in El Niño.
  private readonly R = 5;
  private readonly DEG = Math.PI / 180;
  /** Metres that map to white in elevation.png (MAX_ELEV_M in el-nino/scripts/fetch-elevation.mjs). */
  private readonly ELEV_CEILING_M = 9000;
  private readonly EARTH_RADIUS_M = 6371000;
  private readonly ELEV_EXAGGERATION = 10;
  private readonly RELIEF_STRENGTH = 0.55;
  private readonly RELIEF_RANGE = 46;

  // Camera: centred on the Baltic, tilt cone and spring-back.
  private readonly FOCUS = { lon: 20, lat: 59 };
  private readonly TILT_AZIMUTH = 22 * (Math.PI / 180);
  private readonly TILT_POLAR = 14 * (Math.PI / 180);
  private readonly SPRING_RATE = 3.2; // 1/s

  // Paleo colouring.
  private readonly WATER_DEPTH_RANGE_M = 250;
  private readonly FEATHER_CELLS = 30;

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private controls!: OrbitControls;
  private oceanMat!: THREE.MeshBasicMaterial;
  private landMat!: THREE.MeshLambertMaterial;
  private glowMat!: THREE.ShaderMaterial;
  private landCanvas!: HTMLCanvasElement;
  private landTex!: THREE.CanvasTexture;
  private land: FeatureCollection | Feature | null = null;
  private relief: { data: Uint8Array; w: number; h: number; base: number } | null = null;
  private reliefCanvas: HTMLCanvasElement | null = null;
  private paleoCanvas: HTMLCanvasElement | null = null;
  private hillshade: Float32Array | null = null;
  private hPaleoBuf: Float32Array | undefined;
  private frame: PaleoFrame | null = null;

  private readonly target = new THREE.Spherical();
  private readonly tmpSph = new THREE.Spherical();
  private dragging = false;
  private animId: number | null = null;
  private lastTime = 0;
  private resizeObs?: ResizeObserver;

  constructor() {
    effect(() => {
      const ka = this.ka();
      if (this.data.state() !== 'ready' || !this.landCanvas) return;
      this.zone.runOutsideAngular(() => this.showFrame(ka));
    });
  }

  ngAfterViewInit(): void {
    this.zone.runOutsideAngular(() => {
      this.initThree();
      this.initLand();
      this.initGlow();
      this.handleResize();
      this.resizeObs = new ResizeObserver(() => this.handleResize());
      this.resizeObs.observe(this.canvasRef.nativeElement);
      const dock = document.querySelector('.dock-wrap');
      if (dock) this.resizeObs.observe(dock);
      this.animate(performance.now());
    });
    this.data.load().then(() => {
      if (this.data.state() === 'ready') this.zone.runOutsideAngular(() => this.showFrame(this.ka()));
    });
  }

  ngOnDestroy(): void {
    this.resizeObs?.disconnect();
    if (this.animId !== null) cancelAnimationFrame(this.animId);
    this.controls?.dispose();
    this.renderer?.dispose();
  }

  // ─── Scene ──────────────────────────────────────────────────────────────

  private pos(lon: number, lat: number, r: number, out = new THREE.Vector3()): THREE.Vector3 {
    const phi = ((lon + 180) / 360) * Math.PI * 2;
    const th = (90 - lat) * this.DEG;
    return out.set(-r * Math.cos(phi) * Math.sin(th), r * Math.cos(th), r * Math.sin(phi) * Math.sin(th));
  }

  private initThree(): void {
    const canvas = this.canvasRef.nativeElement;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(this.theme.getTokenColor('globe-bg', '#f5f7fb'));

    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 400);
    this.scene.add(this.camera);

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xdbe4f0, 1.25));
    const head = new THREE.DirectionalLight(0xffffff, 0.75);
    head.position.set(2, 3, 5);
    this.camera.add(head);

    // Camera target: the Baltic. OrbitControls angles are measured around +Y.
    this.target.setFromVector3(this.pos(this.FOCUS.lon, this.FOCUS.lat, 1));
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = false;
    this.controls.autoRotate = false;
    this.controls.rotateSpeed = 0.5;
    this.controls.minAzimuthAngle = this.target.theta - this.TILT_AZIMUTH;
    this.controls.maxAzimuthAngle = this.target.theta + this.TILT_AZIMUTH;
    this.controls.minPolarAngle = Math.max(0.05, this.target.phi - this.TILT_POLAR);
    this.controls.maxPolarAngle = this.target.phi + this.TILT_POLAR;
    this.controls.addEventListener('start', () => (this.dragging = true));
    this.controls.addEventListener('end', () => (this.dragging = false));

    const compact = isAtMost('mobile') && !isMobileLandscape();
    this.controls.minDistance = this.R * (compact ? 1.45 : 1.3);
    this.controls.maxDistance = this.R * (compact ? 4.2 : 3.2);
    this.pos(this.FOCUS.lon, this.FOCUS.lat, this.R * (compact ? 2.2 : 1.62), this.camera.position);
    this.controls.update();

    // Ocean: plain sphere under the land layer.
    this.oceanMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(this.theme.getTokenColor('globe-ocean', '#e0f2fe')) });
    this.scene.add(new THREE.Mesh(new THREE.SphereGeometry(this.R, 128, 64), this.oceanMat));
  }

  private initGlow(): void {
    // Outer halo sphere, as in El Niño (limb at -dot(vN, vV) = sqrt(1 - (1/1.15)^2) = 0.4938).
    this.glowMat = new THREE.ShaderMaterial({
      uniforms: {
        c: { value: new THREE.Color(this.theme.getTokenColor('globe-glow', '#0f172a')) },
        uOpacity: { value: 0.22 },
        uPower: { value: 2.2 }
      },
      vertexShader: `
        varying vec3 vN;
        varying vec3 vV;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vN = normalize(normalMatrix * normal);
          vV = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        uniform vec3 c;
        uniform float uOpacity;
        uniform float uPower;
        varying vec3 vN;
        varying vec3 vV;
        void main() {
          float d = clamp(-dot(vN, vV), 0.0, 1.0);
          float t = clamp(d / 0.4938, 0.0, 1.0);
          gl_FragColor = vec4(c, pow(t, uPower) * uOpacity);
        }
      `,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false
    });
    this.scene.add(new THREE.Mesh(new THREE.SphereGeometry(this.R * 1.15, 64, 32), this.glowMat));
  }

  private initLand(): void {
    const size = this.renderer.capabilities.maxTextureSize >= 8192 && !isAtMost('mobile') ? 4096 : 2048;
    this.landCanvas = document.createElement('canvas');
    this.landCanvas.width = size;
    this.landCanvas.height = size / 2;
    this.landTex = new THREE.CanvasTexture(this.landCanvas);
    this.landTex.colorSpace = THREE.SRGBColorSpace;
    this.landTex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();

    // Emissive-only, as in El Niño: the texture is the colour, the lights only shape the relief.
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

  /** Natural Earth shaded relief packed as 'KMDR', u16 w, u16 h, u8 base, u8 version (El Niño format). */
  private async loadRelief(): Promise<void> {
    try {
      const file = isAtMost('mobile') ? 'assets/data/globe/relief-2k.bin.gz' : 'assets/data/globe/relief.bin.gz';
      const resp = await fetch(file);
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

  // ─── Texture ────────────────────────────────────────────────────────────

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

    const fill = this.theme.getTokenColor('globe-land-fill', '#cfd8e3');
    if (this.land) {
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
    }

    // Paleo layer inside the DEM domain, feathered into the present-day globe at its edge.
    const grid = this.data.demGrid;
    if (this.paleoCanvas && grid) {
      const [west, south, east, north] = grid.bbox;
      const x = ((west + 180) / 360) * W;
      const y = ((90 - north) / 180) * H;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(this.paleoCanvas, x, y, ((east - west) / 360) * W, ((north - south) / 180) * H);
    }

    if (this.frame) this.drawIce(ctx, path, W);

    // Present-day coastline, for comparison with the paleo shore.
    if (this.land) {
      ctx.beginPath();
      path(this.land);
      ctx.strokeStyle = this.theme.getTokenColor('globe-land-stroke', 'rgba(71, 85, 105, 0.55)');
      ctx.lineWidth = W / 2400;
      ctx.stroke();
    }

    this.landTex.needsUpdate = true;
  }

  private drawIce(ctx: CanvasRenderingContext2D, path: d3Geo.GeoPath<any, d3Geo.GeoPermissibleObjects>, W: number): void {
    const { mc, min, max } = this.frame!.ice;
    if (max) {
      ctx.beginPath();
      path(max);
      ctx.fillStyle = this.theme.getTokenColor('paleo-ice-band', 'rgba(255, 255, 255, 0.45)');
      ctx.fill();
    }
    if (mc) {
      ctx.beginPath();
      path(mc);
      ctx.fillStyle = this.theme.getTokenColor('paleo-ice', 'rgba(255, 255, 255, 0.92)');
      ctx.fill();
      ctx.strokeStyle = this.theme.getTokenColor('paleo-ice-edge', '#7dd3fc');
      ctx.lineWidth = W / 1600;
      ctx.stroke();
    }
    if (min) {
      ctx.beginPath();
      path(min);
      ctx.setLineDash([W / 500, W / 700]);
      ctx.strokeStyle = this.theme.getTokenColor('paleo-ice-edge', '#7dd3fc');
      ctx.lineWidth = W / 2400;
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  /** Land fill shaded by the Natural Earth relief (El Niño). */
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

  // ─── Paleo frame ────────────────────────────────────────────────────────

  private showFrame(ka: number): void {
    const grid = this.data.demGrid;
    if (!grid) return;
    this.frame = this.data.frame(ka, this.hPaleoBuf);
    this.hPaleoBuf = this.frame.hPaleo;
    this.paintPaleo(this.frame.hPaleo, grid.nx, grid.ny);
    this.drawLand();
  }

  /**
   * Water where H_paleo < 0 (no flood-fill yet — C-04), land shaded by a hillshade of the
   * present-day grid. The outer FEATHER_CELLS fade out so the domain edge does not show.
   */
  private paintPaleo(h: Float32Array, nx: number, ny: number): void {
    if (!this.paleoCanvas) {
      this.paleoCanvas = document.createElement('canvas');
      this.paleoCanvas.width = nx;
      this.paleoCanvas.height = ny;
    }
    const cx = this.paleoCanvas.getContext('2d');
    if (!cx) return;
    const shade = this.hillshade ?? (this.hillshade = this.computeHillshade());
    const land = this.cssToRgb(this.theme.getTokenColor('globe-land-fill', '#cfd8e3'));
    const shallow = this.cssToRgb(this.theme.getTokenColor('paleo-water-shallow', '#bae6fd'));
    const deep = this.cssToRgb(this.theme.getTokenColor('paleo-water-deep', '#7dd3fc'));
    const ocean = this.cssToRgb(this.theme.getTokenColor('globe-ocean', '#e0f2fe'));
    const img = cx.createImageData(nx, ny);
    const px = img.data;
    const F = this.FEATHER_CELLS;
    for (let r = 0, i = 0; r < ny; r++) {
      const er = Math.min(r, ny - 1 - r);
      for (let c = 0; c < nx; c++, i++) {
        const o = i * 4;
        const v = h[i];
        if (Number.isNaN(v)) {
          px[o + 3] = 0;
          continue;
        }
        if (v < 0) {
          // Shallow water lighter, deep water towards the ocean tint of the rest of the globe.
          const t = clamp(-v / this.WATER_DEPTH_RANGE_M, 0, 1);
          const a = t < 0.5 ? shallow : deep;
          const b = t < 0.5 ? deep : ocean;
          const u = t < 0.5 ? t * 2 : (t - 0.5) * 2;
          px[o] = a[0] + (b[0] - a[0]) * u;
          px[o + 1] = a[1] + (b[1] - a[1]) * u;
          px[o + 2] = a[2] + (b[2] - a[2]) * u;
        } else {
          const f = shade[i];
          px[o] = land[0] * f;
          px[o + 1] = land[1] * f;
          px[o + 2] = land[2] * f;
        }
        const e = Math.min(er, c, nx - 1 - c);
        px[o + 3] = e >= F ? 255 : (255 * e) / F;
      }
    }
    cx.putImageData(img, 0, 0);
  }

  /** Hillshade factor (~0.6–1.4) of the present-day grid; slopes barely change with RSL. */
  private computeHillshade(): Float32Array {
    const g = this.data.demGrid!;
    const z = new Float32Array(g.nx * g.ny);
    const raw = g.raw;
    for (let i = 0; i < z.length; i++) z[i] = raw[i] === g.nodata ? 0 : raw[i] * g.scale + g.offset;
    const [west, south, east, north] = g.bbox;
    const dLon = (east - west) / g.nx;
    const dLat = (north - south) / g.ny;
    const out = new Float32Array(z.length);
    const lx = -0.6;
    const ly = 0.6; // light from the north-west
    const exaggeration = 12;
    for (let r = 0; r < g.ny; r++) {
      const lat = north - (r + 0.5) * dLat;
      const mx = 111320 * Math.cos(lat * this.DEG) * dLon;
      const my = 111320 * dLat;
      const r0 = Math.max(0, r - 1);
      const r1 = Math.min(g.ny - 1, r + 1);
      for (let c = 0; c < g.nx; c++) {
        const c0 = Math.max(0, c - 1);
        const c1 = Math.min(g.nx - 1, c + 1);
        const dzdx = (z[r * g.nx + c1] - z[r * g.nx + c0]) / ((c1 - c0) * mx);
        const dzdy = (z[r0 * g.nx + c] - z[r1 * g.nx + c]) / ((r1 - r0) * my);
        const s = (dzdx * lx + dzdy * ly) * exaggeration;
        out[r * g.nx + c] = 1 + this.RELIEF_STRENGTH * clamp(s, -1, 1);
      }
    }
    return out;
  }

  // ─── Loop ───────────────────────────────────────────────────────────────

  private handleResize(): void {
    const canvas = this.canvasRef.nativeElement;
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // Keep the Baltic in the free space above the dock.
    const dock = document.querySelector('.dock-wrap') as HTMLElement | null;
    const lift = dock ? Math.min(dock.offsetHeight, h * 0.3) / 2 : 0;
    this.camera.setViewOffset(w, h, 0, lift, w, h);
    this.camera.updateProjectionMatrix();
  }

  private animate = (now: number): void => {
    this.animId = requestAnimationFrame(this.animate);
    const dt = Math.min(0.1, (now - this.lastTime) / 1000 || 0);
    this.lastTime = now;

    if (!this.dragging) {
      // Spring back so the Baltic is centred again; the zoom the user chose is kept.
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
