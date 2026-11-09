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
import { isAtMost } from '@kmd/design-system/utils/breakpoints';

import { I18nService } from '../../core/i18n/i18n.service';
import { IceVariant, PaleoDataService, PaleoFrame, RSL_STEP_YR } from '../../core/data/paleo-data.service';
import { nearestFrame, phaseAt, WaterClass } from '../../core/data/timeline';
import { bilinear } from '../../core/data/paleo';
import { inside, WATER_LAKE, WATER_OCEAN } from '../../core/data/water';
import { TransectService } from '../../core/data/transect.service';
import { ICE_DOMAIN, ICE_PROFILE_K, ICE_SDF_SCALE, iceBracket } from '../../core/data/ice-field';
import {
  BLOCK_LCC,
  BLOCK_RECT,
  insideBlock,
  UNITS_PER_M,
  UNITS_PER_PROJ,
  lccForward,
  lccInverse
} from '../../core/data/projection';
import type { GlobeLabel, GlobeLayers, GlobePointer } from '../globe/globe.component';
import {
  BLOCK_FRAGMENT,
  BLOCK_ICE_FRAGMENT,
  BLOCK_ICE_VERTEX,
  BLOCK_VERTEX,
  WATER_FRAGMENT,
  WATER_VERTEX
} from './block-shaders';

/**
 * Depth of the plinth in metres. Below the data (the widened block bottoms out at −3 916 m in the
 * Norwegian Basin), so it reads as the material the slab is cut from rather than as terrain; the
 * elevation ticks on the walls stop where the data stops.
 */
const PLINTH_M = -4500;

/**
 * The area of interest as a solid slab that can be turned in the hand: the bed — seabed and
 * mountains together — on one vertical exaggeration, under a translucent sheet of water.
 *
 * It shares the globe's entire data layer. `COMMON` in paleo-shaders.ts samples everything by
 * lon/lat, so swapping a sphere sector for a projected rectangle only changes where a vertex goes,
 * not what it reads. The one new piece is the projection (projection.ts) and its GLSL inverse.
 *
 * Differences from the globe that matter:
 * - the surface is the bare bed, never filled up to a water level, because the water is a separate
 *   translucent sheet and the depth below it is the thing worth seeing — but the four walls are cut
 *   through that water and show the column, so the basin reads as filling and draining with time;
 * - the depth buffer does the occlusion, so there is no renderOrder juggling and no hemisphere
 *   culling — a closed solid behaves itself;
 * - terrain and ice share one `exaggeration`, instead of the globe's flat terrain and its own ice
 *   factor.
 */
@Component({
  selector: 'app-block',
  standalone: true,
  template: `
    <canvas #canvas class="block-canvas" [attr.aria-label]="i18n.t().stageAriaLabel" role="img"></canvas>
    <div class="labels" aria-hidden="true">
      @for (l of labels(); track l.id) {
        <span #lbl class="lbl" [class.lbl--sill]="l.kind === 'sill'" [hidden]="!showLabel(l)">{{ l.text }}</span>
      }
    </div>
  `,
  styles: [
    `
      :host { position: absolute; inset: 0; display: block; }
      .block-canvas { width: 100%; height: 100%; display: block; touch-action: none; cursor: crosshair; }
      .labels { position: absolute; inset: 0; pointer-events: none; }
      .lbl {
        position: absolute; top: 0; left: 0; white-space: nowrap;
        font-size: 11px; font-weight: 600; color: var(--color-text-bright);
        text-shadow: 0 0 3px var(--color-neutral-0), 0 0 6px var(--color-neutral-0);
        transition: opacity 120ms ease;
      }
      .lbl--sill { color: var(--color-accent); }
      .lbl--sill::before {
        content: ''; display: inline-block; width: 4px; height: 4px; margin-right: 5px;
        border-radius: 50%; background: var(--color-accent);
      }
    `
  ]
})
export class BlockComponent implements AfterViewInit, OnDestroy {
  readonly t = input.required<number>();
  readonly layers = input.required<GlobeLayers>();
  /**
   * Shared by the bed and the ice — one factor for everything, so a depth still reads off the
   * elevation scale on the walls. Relief here is 3 729 m over 1 605 km, 0.23% of the block's width,
   * so it takes a large factor to read as relief at all. On the 11-unit block, ×30 puts the
   * Scandinavian peaks (1 987 m) at 0.41 units and a 3 km ice dome at 0.62: the ice still out-tops
   * the mountains, which is the comparison this view exists for, without the north-west turning
   * into a wall of spikes the way ×60 did (0.82 against a 0.19-unit basin).
   *
   * The cost of one honest scale is that the basin is shallow in the same proportion: 459 m of
   * water is 0.09 units, so the column cut into the walls is thin in the Baltic proper and only
   * really deep in the Atlantic corner (−1 742 m, 0.36 units).
   */
  readonly exaggeration = input<number>(30);
  readonly labels = input<GlobeLabel[]>([]);
  readonly hover = output<GlobePointer | null>();
  /** A click on the block (lon/lat), for drawing a custom transect. */
  readonly pick = output<{ lon: number; lat: number }>();

  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChildren('lbl') labelRefs!: QueryList<ElementRef<HTMLSpanElement>>;

  readonly i18n = inject(I18nService);
  private readonly zone = inject(NgZone);
  private readonly theme = inject(ThemeService);
  private readonly data = inject(PaleoDataService);
  private readonly transects = inject(TransectService);

  private readonly midX = (BLOCK_RECT.x0 + BLOCK_RECT.x1) / 2;
  private readonly midY = (BLOCK_RECT.y0 + BLOCK_RECT.y1) / 2;
  private readonly halfX = ((BLOCK_RECT.x1 - BLOCK_RECT.x0) / 2) * UNITS_PER_PROJ;
  private readonly halfZ = ((BLOCK_RECT.y1 - BLOCK_RECT.y0) / 2) * UNITS_PER_PROJ;

  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private controls!: OrbitControls;

  private slabMat?: THREE.ShaderMaterial;
  private waterMats: THREE.ShaderMaterial[] = [];
  private transectLine?: THREE.Line;
  private pendingDot?: THREE.Mesh;
  /** waterLook uniforms shared by both water sheets. */
  private look?: Record<string, THREE.IUniform>;
  private iceMats = new Map<IceVariant, THREE.ShaderMaterial>();
  private iceMeshes = new Map<IceVariant, THREE.Mesh>();
  private iceSdfTex = new Map<string, THREE.DataTexture>();
  private shownIceSlices = new Map<IceVariant, string>();
  private geometries: THREE.BufferGeometry[] = [];
  private textures: THREE.DataTexture[] = [];

  private rslTex?: THREE.DataTexture;
  private rslPrevTex?: THREE.DataTexture;
  private waterTex?: THREE.DataTexture;
  private waterBTex?: THREE.DataTexture;
  private waterPrevTex?: THREE.DataTexture;
  private frame: PaleoFrame | null = null;
  private frameB: PaleoFrame | null = null;
  private earlierShown: PaleoFrame | null = null;
  private earlierTarget = -1;
  private shownT = -1;
  private rslNow?: Float32Array;
  private needsRender = true;

  private readonly ndc = new THREE.Vector2();
  private readonly raycaster = new THREE.Raycaster();
  private readonly tmpV = new THREE.Vector3();
  private readonly tmpW = new THREE.Vector3();
  private pickBox!: THREE.Box3;
  private defaultDistance = 16;
  private animId: number | null = null;
  private resizeObs?: ResizeObserver;
  private pendingHover: PointerEvent | null = null;

  constructor() {
    effect(() => {
      const t = this.t();
      this.data.version();
      if (this.data.state() !== 'ready' || !this.slabMat) return;
      this.zone.runOutsideAngular(() => this.showFrame(t));
    });
    effect(() => {
      this.labels();
      this.i18n.lang();
      this.needsRender = true;
    });
    // The active transect (preset or custom) and the pending point A while one is being drawn.
    effect(() => {
      this.transects.line();
      this.transects.pending();
      this.layers();
      this.exaggeration();
      if (!this.slabMat) return;
      this.zone.runOutsideAngular(() => this.drawTransect());
    });
    effect(() => {
      const L = this.layers();
      const ex = this.exaggeration();
      if (!this.slabMat) return;
      this.slabMat.uniforms['uShowToday'].value = L.today ? 1 : 0;
      this.slabMat.uniforms['uShowPrev'].value = L.prev ? 1 : 0;
      for (const u of this.vertical()) u['uVExag'].value = ex;
      this.slabMat.uniforms['uBaseY'].value = PLINTH_M * UNITS_PER_M * ex;
      this.zone.runOutsideAngular(() => {
        if (this.shownT >= 0) this.showIce(this.shownT);
        this.updatePickBox();
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
      this.animate();
    });
    this.data.load().then(() => {
      if (this.data.state() !== 'ready') return;
      this.zone.runOutsideAngular(() => {
        this.initSlab();
        this.showFrame(this.t());
      });
    });
  }

  ngOnDestroy(): void {
    this.resizeObs?.disconnect();
    if (this.animId !== null) cancelAnimationFrame(this.animId);
    for (const g of this.geometries) g.dispose();
    for (const t of this.textures) t.dispose();
    for (const t of this.iceSdfTex.values()) t.dispose();
    this.slabMat?.dispose();
    for (const m of this.waterMats) m.dispose();
    for (const m of this.iceMats.values()) m.dispose();
    this.controls?.dispose();
    this.renderer?.dispose();
  }

  // ─── public controls (same surface as the globe, so the HUD can drive either) ──

  zoomBy(factor: number): void {
    const d = THREE.MathUtils.clamp(this.camera.position.length() * factor, this.controls.minDistance, this.controls.maxDistance);
    this.camera.position.setLength(d);
    this.controls.update();
    this.needsRender = true;
  }

  fit(): void {
    this.camera.position.set(0, this.defaultDistance * 0.62, this.defaultDistance * 0.78);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
    this.needsRender = true;
  }

  showLabel(l: GlobeLabel): boolean {
    const L = this.layers();
    return l.kind === 'sill' ? L.sills : L.labels;
  }

  // ─── scene ──────────────────────────────────────────────────────────────

  private initThree(): void {
    const canvas = this.canvasRef.nativeElement;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(this.theme.getTokenColor('globe-bg', '#f5f7fb'));
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.05, 400);
    this.scene.add(this.camera);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = false;
    this.controls.rotateSpeed = 0.55;
    this.controls.zoomSpeed = 0.8;
    // A solid object is meant to be turned all the way round, unlike the globe's fixed cap; the
    // lower limit stops just short of the horizon so you never end up under the plinth.
    this.controls.minPolarAngle = 0.08;
    this.controls.maxPolarAngle = 1.40;
    this.controls.minDistance = 6;
    this.controls.maxDistance = 38;
    this.controls.addEventListener('change', () => (this.needsRender = true));

    const compact = isAtMost('mobile');
    this.defaultDistance = compact ? 21 : 16;
    this.fit();
    this.updatePickBox();
  }

  private updatePickBox(): void {
    const ex = this.exaggeration();
    this.pickBox = new THREE.Box3(
      new THREE.Vector3(-this.halfX, PLINTH_M * UNITS_PER_M * ex, -this.halfZ),
      new THREE.Vector3(this.halfX, 2400 * UNITS_PER_M * ex, this.halfZ)
    );
  }

  /** Every material whose height depends on the vertical exaggeration. */
  private vertical(): Record<string, THREE.IUniform>[] {
    const out: Record<string, THREE.IUniform>[] = [];
    if (this.slabMat) out.push(this.slabMat.uniforms);
    for (const m of this.waterMats) out.push(m.uniforms);
    for (const m of this.iceMats.values()) out.push(m.uniforms);
    return out;
  }

  // ─── geometry ───────────────────────────────────────────────────────────

  /**
   * The transect laid on the surface: the bed, or the water where there is water, lifted a hair so
   * the depth test keeps it in front of what it lies on. Follows time (the bed moves with RSL), the
   * section and the exaggeration.
   */
  private drawTransect(): void {
    if (!this.rslNow) return;
    if (!this.transectLine) {
      const mat = new THREE.LineBasicMaterial({ color: new THREE.Color(this.theme.getTokenColor('neutral-800', '#1e293b')) });
      this.transectLine = new THREE.Line(new THREE.BufferGeometry(), mat);
      this.transectLine.renderOrder = 20;
      this.scene.add(this.transectLine);
      this.pendingDot = new THREE.Mesh(
        new THREE.SphereGeometry(0.05, 16, 12),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(this.theme.getTokenColor('accent', '#d37400')) })
      );
      this.scene.add(this.pendingDot);
    }
    const ex = this.exaggeration();
    const level = this.data.sceneWater(this.shownT)?.lakeLevelM ?? 0;
    const surface = (lon: number, lat: number) => {
      const bed = this.bedAt(lon, lat);
      return (Math.max(bed, 0, bed < level ? level : 0) * UNITS_PER_M * ex) + 0.012;
    };
    const pts = this.transects.line().points;
    const out: number[] = [];
    for (let k = 0; k + 1 < pts.length; k++) {
      const [a0, a1] = pts[k];
      const [b0, b1] = pts[k + 1];
      const steps = 80;
      for (let i = k === 0 ? 0 : 1; i <= steps; i++) {
        const lon = a0 + ((b0 - a0) * i) / steps;
        const lat = a1 + ((b1 - a1) * i) / steps;
        const [px, py] = lccForward(BLOCK_LCC, lon, lat);
        this.world(px, py, this.tmpV);
        out.push(this.tmpV.x, surface(lon, lat), this.tmpV.z);
      }
    }
    this.transectLine.geometry.setAttribute('position', new THREE.Float32BufferAttribute(out, 3));
    this.transectLine.geometry.computeBoundingSphere();
    this.transectLine.visible = this.layers().transect;
    const a = this.transects.pending();
    this.pendingDot!.visible = !!a;
    if (a) {
      const [px, py] = lccForward(BLOCK_LCC, a[0], a[1]);
      this.world(px, py, this.pendingDot!.position);
      this.pendingDot!.position.y = surface(a[0], a[1]);
    }
    this.needsRender = true;
  }

  /** Projected position to world; X is east, −Z is north, Y is up. */
  private world(px: number, py: number, out: THREE.Vector3): THREE.Vector3 {
    return out.set((px - this.midX) * UNITS_PER_PROJ, 0, -(py - this.midY) * UNITS_PER_PROJ);
  }

  /**
   * The slab: top surface, four walls and the plinth in one geometry, so the walls meet the
   * surface exactly — both evaluate the same height from `aProj`.
   */
  private buildSlab(seg: number): THREE.BufferGeometry {
    const pos: number[] = [];
    const proj: number[] = [];
    const face: number[] = [];
    const top: number[] = [];
    const idx: number[] = [];
    const R = BLOCK_RECT;
    const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

    const push = (px: number, py: number, f: number, isTop: number): number => {
      this.world(px, py, this.tmpV);
      pos.push(this.tmpV.x, 0, this.tmpV.z);
      proj.push(px, py);
      face.push(f);
      top.push(isTop);
      return pos.length / 3 - 1;
    };

    // top surface
    for (let j = 0; j <= seg; j++) {
      for (let i = 0; i <= seg; i++) push(lerp(R.x0, R.x1, i / seg), lerp(R.y0, R.y1, j / seg), 0, 1);
    }
    const row = seg + 1;
    for (let j = 0; j < seg; j++) {
      for (let i = 0; i < seg; i++) {
        const a = j * row + i;
        idx.push(a, a + 1, a + row, a + 1, a + row + 1, a + row);
      }
    }

    // walls: one strip per edge, top vertices on the bed, bottom on the plinth
    const edge = (at: (k: number) => [number, number]) => {
      const first = pos.length / 3;
      for (let i = 0; i <= seg; i++) {
        const [px, py] = at(i / seg);
        push(px, py, 1, 1);
        push(px, py, 1, 0);
      }
      for (let i = 0; i < seg; i++) {
        const a = first + i * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    };
    edge(k => [lerp(R.x0, R.x1, k), R.y0]);
    edge(k => [lerp(R.x0, R.x1, k), R.y1]);
    edge(k => [R.x0, lerp(R.y0, R.y1, k)]);
    edge(k => [R.x1, lerp(R.y0, R.y1, k)]);

    // plinth
    const b0 = push(R.x0, R.y0, 2, 0);
    push(R.x1, R.y0, 2, 0);
    push(R.x0, R.y1, 2, 0);
    push(R.x1, R.y1, 2, 0);
    idx.push(b0, b0 + 1, b0 + 2, b0 + 1, b0 + 3, b0 + 2);

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aProj', new THREE.Float32BufferAttribute(proj, 2));
    g.setAttribute('aFace', new THREE.Float32BufferAttribute(face, 1));
    g.setAttribute('aTop', new THREE.Float32BufferAttribute(top, 1));
    g.setIndex(idx);
    this.geometries.push(g);
    return g;
  }

  /** Flat grid over the block, for the water sheets and the ice shells. */
  private buildGrid(seg: number): THREE.BufferGeometry {
    const pos: number[] = [];
    const proj: number[] = [];
    const idx: number[] = [];
    const R = BLOCK_RECT;
    for (let j = 0; j <= seg; j++) {
      const py = R.y0 + ((R.y1 - R.y0) * j) / seg;
      for (let i = 0; i <= seg; i++) {
        const px = R.x0 + ((R.x1 - R.x0) * i) / seg;
        this.world(px, py, this.tmpV);
        pos.push(this.tmpV.x, 0, this.tmpV.z);
        proj.push(px, py);
      }
    }
    const row = seg + 1;
    for (let j = 0; j < seg; j++) {
      for (let i = 0; i < seg; i++) {
        const a = j * row + i;
        idx.push(a, a + 1, a + row, a + 1, a + row + 1, a + row);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aProj', new THREE.Float32BufferAttribute(proj, 2));
    g.setIndex(idx);
    this.geometries.push(g);
    return g;
  }

  // ─── materials ──────────────────────────────────────────────────────────

  private initSlab(): void {
    const E = this.data.europe!;
    const B = this.data.baltic!;
    const Rg = this.data.rslGrid!;
    const mobile = isAtMost('mobile');
    const ex = this.exaggeration();

    // Elevation only: the block computes its shading from the bed's own slope, so the baked 2D
    // hillshade in the globe's DEM texture is not needed here.
    const demE = this.elevationTexture(this.data.hNowEurope!, E.nx, E.ny);
    const demB = this.elevationTexture(this.data.hNowBaltic!, B.nx, B.ny);
    this.rslTex = this.halfTexture(new Float32Array(Rg.nx * Rg.ny), Rg.nx, Rg.ny);
    this.rslPrevTex = this.halfTexture(new Float32Array(Rg.nx * Rg.ny), Rg.nx, Rg.ny);
    this.waterTex = this.byteTexture(B.nx, B.ny);
    this.waterBTex = this.byteTexture(B.nx, B.ny);
    this.waterPrevTex = this.byteTexture(B.nx, B.ny);

    const c = (token: string, fb: string) => new THREE.Color(this.theme.getTokenColor(token, fb));
    const shared: Record<string, THREE.IUniform> = {
      uDemE: { value: demE },
      uDemB: { value: demB },
      uRsl: { value: this.rslTex },
      uRslPrev: { value: this.rslPrevTex },
      uWater: { value: this.waterTex },
      uWaterB: { value: this.waterBTex },
      uWaterPrev: { value: this.waterPrevTex },
      uLakePrev: { value: 0 },
      uPrevReady: { value: 0 },
      uBoxE: { value: new THREE.Vector4(...E.bbox) },
      uBoxB: { value: new THREE.Vector4(...B.bbox) },
      uBoxR: { value: new THREE.Vector4(...Rg.bbox) },
      uLake: { value: 0 },
      uRect: { value: new THREE.Vector4(BLOCK_RECT.x0, BLOCK_RECT.y0, BLOCK_RECT.x1, BLOCK_RECT.y1) },
      uLcc: { value: new THREE.Vector3(BLOCK_LCC.n, BLOCK_LCC.F, BLOCK_LCC.rho0) },
      uLon0: { value: BLOCK_LCC.lon0 },
      uPerM: { value: UNITS_PER_M },
      uVExag: { value: ex },
      uBaseY: { value: PLINTH_M * UNITS_PER_M * ex }
    };
    const fork = (extra: Record<string, THREE.IUniform>) => ({ ...shared, ...extra });

    this.slabMat = new THREE.ShaderMaterial({
      vertexShader: BLOCK_VERTEX,
      fragmentShader: BLOCK_FRAGMENT,
      // The slab is a closed solid, so double-sided costs nothing visible and removes any
      // dependence on the winding of five separately generated faces.
      side: THREE.DoubleSide,
      uniforms: fork({
        cLand: { value: c('paleo-land-low', '#cfd8e3') },
        cLandMid: { value: c('paleo-land-mid', '#d6cfb9') },
        cLandHigh: { value: c('paleo-land-high', '#a89878') },
        cLandPeak: { value: c('paleo-land-peak', '#ece7df') },
        cSeabed: { value: c('paleo-seabed', '#e4dccb') },
        cDeep: { value: c('paleo-earth-line', '#8c8369') },
        cWall: { value: c('neutral-200', '#e2e8f0') },
        cPlinth: { value: c('neutral-300', '#cfd8e3') },
        cLine: { value: c('neutral-600', '#475569') },
        cPrev: { value: c('accent', '#d37400') },
        // The walls cut through the water as well as the rock, so the slab carries the sheets'
        // colours too and the cut column matches the surface standing on it.
        cWater: { value: c('paleo-water-shallow', '#bae6fd') },
        cWaterDeep: { value: c('paleo-marine', '#3d6aa3') },
        uShowToday: { value: this.layers().today ? 1 : 0 },
        uShowPrev: { value: this.layers().prev ? 1 : 0 }
      })
    });
    const slab = new THREE.Mesh(this.buildSlab(mobile ? 160 : 400), this.slabMat);
    this.scene.add(slab);

    // Two sheets: the ocean at sea level and the basin at its own level during the lake phases.
    // One sheet cannot do both — a flat plane has a single height.
    const waterGeo = this.buildGrid(mobile ? 24 : 48);
    // One set of waterLook uniforms shared by both sheets (paleo-shaders.ts).
    const blank = this.sdfTexture(20, 'mc');
    const waterLookU: Record<string, THREE.IUniform> = {
      wOcean0: { value: c('water-ocean-0', '#dbeef8') },
      wOcean1: { value: c('water-ocean-1', '#6b93b8') },
      wBasin: { value: c('paleo-brackish', '#8dbcdc') },
      wLake0: { value: c('water-lake-0', '#d8f0e6') },
      wLake1: { value: c('water-lake-1', '#4f9a80') },
      wMelt: { value: c('water-melt', '#eef6f4') },
      wNew: { value: new THREE.Color('#ffffff') },
      uMeltA: { value: blank },
      uMeltB: { value: blank },
      uMeltMix: { value: 0 },
      uMeltOn: { value: 0 },
      uMeltBox: { value: new THREE.Vector4(...ICE_DOMAIN.bbox) },
      uPrevIceA: { value: blank },
      uPrevIceB: { value: blank },
      uPrevIceMix: { value: 0 },
      uPrevIceOn: { value: 0 }
    };
    this.look = waterLookU;
    for (const isLake of [0, 1]) {
      const mat = new THREE.ShaderMaterial({
        vertexShader: WATER_VERTEX,
        fragmentShader: WATER_FRAGMENT,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        uniforms: fork({
          uIsLake: { value: isLake },
          uShowPrev: this.slabMat.uniforms['uShowPrev'],
          ...waterLookU
        })
      });
      const mesh = new THREE.Mesh(waterGeo, mat);
      mesh.renderOrder = 5 + isLake;
      this.waterMats.push(mat);
      this.scene.add(mesh);
    }

    // Ice shells, as on the globe: min ⊂ mc ⊂ max, translucent, drawn inner to outer.
    const iceGeo = this.buildGrid(mobile ? 140 : 320);
    const ice = this.theme.getTokenColor('paleo-ice', 'rgba(255,255,255,0.92)');
    const band = this.theme.getTokenColor('paleo-ice-band', 'rgba(255,255,255,0.45)');
    const edge = this.theme.getTokenColor('paleo-ice-edge', '#7dd3fc');
    const look: Record<IceVariant, { color: string; opacity: number; rim: number; order: number }> = {
      min: { color: band, opacity: 0.42, rim: 6, order: 11 },
      mc: { color: ice, opacity: 0.46, rim: 9, order: 12 },
      max: { color: band, opacity: 0.24, rim: 14, order: 13 }
    };
    for (const variant of ['min', 'mc', 'max'] as IceVariant[]) {
      const L = look[variant];
      const mat = new THREE.ShaderMaterial({
        vertexShader: BLOCK_ICE_VERTEX,
        fragmentShader: BLOCK_ICE_FRAGMENT,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        uniforms: fork({
          uSdfA: { value: this.sdfTexture(20, variant) },
          uSdfB: { value: this.sdfTexture(20, variant) },
          uSdfMix: { value: 0 },
          uBoxI: { value: new THREE.Vector4(...ICE_DOMAIN.bbox) },
          uProfileK: { value: ICE_PROFILE_K },
          uColor: { value: new THREE.Color(L.color) },
          uEdge: { value: new THREE.Color(edge) },
          uOpacity: { value: L.opacity },
          uFade: { value: 0 },
          uRimKm: { value: L.rim }
        })
      });
      const mesh = new THREE.Mesh(iceGeo, mat);
      mesh.renderOrder = L.order;
      mesh.visible = false;
      this.iceMats.set(variant, mat);
      this.iceMeshes.set(variant, mesh);
      this.scene.add(mesh);
    }
  }

  private texture(data: Uint16Array | Uint8Array, w: number, h: number, format: THREE.PixelFormat, type: THREE.TextureDataType): THREE.DataTexture {
    const tex = new THREE.DataTexture(data, w, h, format, type);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.unpackAlignment = 1;
    tex.flipY = false;
    tex.needsUpdate = true;
    this.textures.push(tex);
    return tex;
  }

  private fillHalf(tex: THREE.DataTexture, values: Float32Array): void {
    const d = tex.image.data as Uint16Array;
    for (let i = 0; i < values.length; i++) d[i] = THREE.DataUtils.toHalfFloat(values[i]);
    tex.needsUpdate = true;
  }

  private halfTexture(values: Float32Array, w: number, h: number): THREE.DataTexture {
    const out = new Uint16Array(values.length);
    for (let i = 0; i < values.length; i++) out[i] = THREE.DataUtils.toHalfFloat(values[i]);
    return this.texture(out, w, h, THREE.RedFormat, THREE.HalfFloatType);
  }

  private elevationTexture(h: Float32Array, nx: number, ny: number): THREE.DataTexture {
    const out = new Uint16Array(h.length);
    for (let i = 0; i < h.length; i++) out[i] = THREE.DataUtils.toHalfFloat(Number.isNaN(h[i]) ? 0 : h[i]);
    return this.texture(out, nx, ny, THREE.RedFormat, THREE.HalfFloatType);
  }

  private byteTexture(nx: number, ny: number): THREE.DataTexture {
    return this.texture(new Uint8Array(nx * ny * 2), nx, ny, THREE.RGFormat, THREE.UnsignedByteType);
  }

  private sdfTexture(ka: number, variant: IceVariant): THREE.DataTexture {
    const key = `${ka}:${variant}`;
    const hit = this.iceSdfTex.get(key);
    if (hit) return hit;
    const src = this.data.iceSdf(ka, variant);
    const half = new Uint16Array(src.length);
    for (let i = 0; i < src.length; i++) half[i] = THREE.DataUtils.toHalfFloat(src[i] / ICE_SDF_SCALE);
    const tex = new THREE.DataTexture(half, ICE_DOMAIN.nx, ICE_DOMAIN.ny, THREE.RedFormat, THREE.HalfFloatType);
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.unpackAlignment = 1;
    tex.flipY = false;
    tex.needsUpdate = true;
    this.iceSdfTex.set(key, tex);
    return tex;
  }

  // ─── frame ──────────────────────────────────────────────────────────────

  private showFrame(t: number): void {
    if (!this.slabMat) return;
    const us = this.vertical();
    if (t !== this.shownT) {
      this.shownT = t;
      const q = Math.round(t / RSL_STEP_YR) * RSL_STEP_YR;
      this.rslNow = this.data.rsl(q);
      this.fillHalf(this.rslTex!, this.rslNow);
      this.fillHalf(this.rslPrevTex!, this.data.rsl(q + 1000));
      const cls: WaterClass = phaseAt(t).cls;
      const token = cls === 'marine' ? 'paleo-marine' : cls === 'brackish' ? 'paleo-brackish' : 'paleo-fresh';
      const deep = new THREE.Color(this.theme.getTokenColor(token, '#3d6aa3'));
      // The slab too: its walls carry the water column, which takes the phase's colour with it.
      for (const m of [this.slabMat]) (m.uniforms['cWaterDeep'].value as THREE.Color).copy(deep);
      if (this.look) (this.look['wBasin'].value as THREE.Color).copy(deep);
      this.showIce(t);
      this.drawTransect();
    }

    // The pair in play and the level between them come from the data layer, so the picture, the
    // tooltip and the transect cannot answer differently (`A-01`).
    const s = this.data.sceneWater(t);
    if (s) {
      if (s.a !== this.frame) {
        this.frame = s.a;
        this.fillWater(this.waterTex!, s.a.water);
      }
      // The shader unions the two fills, so the second texture must never be left holding a frame
      // from somewhere else on the timeline — a stale one would now contribute instead of being
      // weighted out. With no bracket on the other side it mirrors the first.
      const second = s.b ?? s.a;
      if (second !== this.frameB) {
        this.frameB = second;
        this.fillWater(this.waterBTex!, second.water);
      }
      for (const u of us) u['uLake'].value = s.lakeLevelM;
    }

    // The ghost coast stays on the 1 ka grid: following it continuously would ask the worker for a
    // new flood fill on every tick.
    const te = nearestFrame(t) + 1000;
    if (te !== this.earlierTarget) {
      this.earlierTarget = te;
      this.earlierShown = null;
      for (const u of us) u['uPrevReady'].value = 0;
    }
    const e = this.data.earlier(t);
    if (e && e !== this.earlierShown) {
      this.earlierShown = e;
      this.fillWater(this.waterPrevTex!, e.water);
      for (const u of us) {
        u['uLakePrev'].value = e.lakeLevelM;
        u['uPrevReady'].value = 1;
      }
    }
    this.needsRender = true;
  }

  private fillWater(tex: THREE.DataTexture, water: Uint8Array): void {
    const d = tex.image.data as Uint8Array;
    for (let i = 0; i < water.length; i++) {
      d[i * 2] = water[i] === WATER_OCEAN ? 255 : 0;
      d[i * 2 + 1] = water[i] === WATER_LAKE ? 255 : 0;
    }
    tex.needsUpdate = true;
  }

  private showIce(t: number): void {
    if (!this.iceMats.size) return;
    const b = iceBracket(t);
    // Meltwater follows the data, not the ice layer's visibility.
    if (this.look) {
      const prev = iceBracket(t + 1000);
      this.look['uPrevIceOn'].value = prev ? 1 : 0;
      if (prev) {
        this.look['uPrevIceA'].value = this.sdfTexture(prev.kaA, 'mc');
        this.look['uPrevIceB'].value = this.sdfTexture(prev.kaB, 'mc');
        this.look['uPrevIceMix'].value = prev.w;
      }
      this.look['uMeltOn'].value = b ? b.fade : 0;
      if (b) {
        this.look['uMeltA'].value = this.sdfTexture(b.kaA, 'mc');
        this.look['uMeltB'].value = this.sdfTexture(b.kaB, 'mc');
        this.look['uMeltMix'].value = b.w;
      }
    }
    const L = this.layers();
    for (const [variant, mat] of this.iceMats) {
      const on = variant === 'mc' ? L.ice : L.band;
      this.iceMeshes.get(variant)!.visible = !!b && on;
      if (!b || !on) continue;
      const pair = `${b.kaA}:${b.kaB}`;
      if (this.shownIceSlices.get(variant) !== pair) {
        this.shownIceSlices.set(variant, pair);
        mat.uniforms['uSdfA'].value = this.sdfTexture(b.kaA, variant);
        mat.uniforms['uSdfB'].value = this.sdfTexture(b.kaB, variant);
      }
      mat.uniforms['uSdfMix'].value = b.w;
      mat.uniforms['uFade'].value = b.fade;
    }
  }

  // ─── pointer ────────────────────────────────────────────────────────────

  private initPointer(): void {
    const cv = this.canvasRef.nativeElement;
    cv.addEventListener('pointermove', e => (this.pendingHover = e), { passive: true });
    cv.addEventListener('pointerleave', () => {
      this.pendingHover = null;
      this.zone.run(() => this.hover.emit(null));
    });
    // A click (press and release without dragging) picks a point — used to draw a custom transect.
    let down: { x: number; y: number } | null = null;
    cv.addEventListener('pointerdown', e => (down = { x: e.clientX, y: e.clientY }), { passive: true });
    cv.addEventListener('pointerup', e => {
      const d = down;
      down = null;
      if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 5) return;
      const ll = this.pickAt(e);
      if (ll) this.zone.run(() => this.pick.emit(ll));
    });
  }

  /** Bed elevation in metres at lon/lat, matching bedM() in the shader. */
  private bedAt(lon: number, lat: number): number {
    const b = this.data.baltic!;
    const e = this.data.europe!;
    const hNow = inside(b, lon, lat)
      ? bilinear(this.data.hNowBaltic!, b, lon, lat)
      : bilinear(this.data.hNowEurope!, e, lon, lat);
    return hNow - bilinear(this.rslNow!, this.data.rslGrid!, lon, lat);
  }

  /**
   * Height is applied in the vertex shader, so the geometry on the CPU is flat and a raycast
   * against it would miss by the whole exaggerated relief. March the ray against the height field
   * instead: step until it passes below the bed, then bisect.
   */
  private flushHover(): void {
    const e = this.pendingHover;
    if (!e || !this.rslNow || this.data.state() !== 'ready') return;
    this.pendingHover = null;
    const hit = this.hitAt(e);
    this.zone.run(() => this.hover.emit(hit ? { lon: hit[0], lat: hit[1], x: e.clientX, y: e.clientY } : null));
  }

  /** Point of the block's surface under the pointer (lon/lat), or null off the block. */
  private pickAt(e: { clientX: number; clientY: number }): { lon: number; lat: number } | null {
    if (!this.rslNow || this.data.state() !== 'ready') return null;
    const hit = this.hitAt(e);
    return hit ? { lon: hit[0], lat: hit[1] } : null;
  }

  private hitAt(e: { clientX: number; clientY: number }): [number, number] | null {
    const cv = this.canvasRef.nativeElement;
    const rect = cv.getBoundingClientRect();
    this.ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const ray = this.raycaster.ray;

    const enter = ray.intersectBox(this.pickBox, this.tmpV);
    if (!enter) return null;
    const ex = this.exaggeration();
    const span = this.pickBox.getSize(this.tmpW).length();
    // The entry point lies on the box's face, and floating point puts it a hair outside as often
    // as inside, so the containment test gets a tolerance — without it the march stopped at its
    // first step and picking failed over most of the block.
    const within = this.pickBox.clone().expandByScalar(1e-3);
    const steps = 400;
    const dt = span / steps;
    let prev = 0;
    let prevGap = Number.NaN;
    for (let i = 0; i <= steps; i++) {
      const s = i * dt;
      this.tmpW.copy(enter).addScaledVector(ray.direction, s);
      if (!within.containsPoint(this.tmpW)) break;
      const ll = this.lonLatAt(this.tmpW);
      const gap = this.tmpW.y - this.bedAt(ll[0], ll[1]) * UNITS_PER_M * ex;
      if (!Number.isNaN(prevGap) && prevGap > 0 && gap <= 0) {
        // bisect between prev and s
        let lo = prev;
        let hi = s;
        for (let k = 0; k < 14; k++) {
          const mid = (lo + hi) / 2;
          this.tmpW.copy(enter).addScaledVector(ray.direction, mid);
          const m = this.lonLatAt(this.tmpW);
          if (this.tmpW.y - this.bedAt(m[0], m[1]) * UNITS_PER_M * ex > 0) lo = mid;
          else hi = mid;
        }
        this.tmpW.copy(enter).addScaledVector(ray.direction, (lo + hi) / 2);
        const hit = this.lonLatAt(this.tmpW);
        return insideBlock(hit[0], hit[1]) ? hit : null;
      }
      prev = s;
      prevGap = gap;
    }
    return null;
  }

  private lonLatAt(p: THREE.Vector3): [number, number] {
    return lccInverse(BLOCK_LCC, p.x / UNITS_PER_PROJ + this.midX, -p.z / UNITS_PER_PROJ + this.midY);
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
    if (!refs || refs.length !== data.length || !this.rslNow) return;
    const canvas = this.canvasRef.nativeElement;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const ex = this.exaggeration();
    for (let i = 0; i < refs.length; i++) {
      const el = refs[i].nativeElement;
      const d = data[i];
      if (!insideBlock(d.lon, d.lat)) {
        el.style.opacity = '0';
        continue;
      }
      const [px, py] = lccForward(BLOCK_LCC, d.lon, d.lat);
      this.world(px, py, this.tmpV);
      this.tmpV.y = Math.max(this.bedAt(d.lon, d.lat), 0) * UNITS_PER_M * ex + 0.03;
      this.tmpV.project(this.camera);
      el.style.opacity = this.tmpV.z < 1 ? '1' : '0';
      el.style.transform = `translate(${((this.tmpV.x + 1) / 2) * w - 3}px, ${((1 - this.tmpV.y) / 2) * h - 7}px)`;
    }
  }

  private animate = (): void => {
    this.animId = requestAnimationFrame(this.animate);
    if (this.controls.update()) this.needsRender = true;
    this.flushHover();
    if (!this.needsRender) return;
    this.needsRender = false;
    this.placeLabels();
    this.renderer.render(this.scene, this.camera);
  };
}
