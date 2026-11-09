import { WATER_RULE_GLSL } from '../../core/data/water';

/**
 * Shaders of the paleo patch. Everything is evaluated per vertex / per pixel from the
 * present-day grids and the RSL field, so the shoreline stays sharp at any zoom:
 *   H_paleo = H_now − RSL(t)            (no separate eustatic term — C-03)
 * Textures are cell-registered with rows from the north, sampled with linear filtering —
 * the same bilinear rule as the pipeline (paleo.ts / postglacial.py).
 */

/** Shared by the paleo patch and the ice body, which rests on the surface the patch draws. */
export const COMMON = /* glsl */ `
  uniform sampler2D uDemE;
  uniform sampler2D uDemB;
  uniform sampler2D uRsl;
  uniform sampler2D uRslPrev;
  uniform sampler2D uWater;
  uniform sampler2D uWaterB;
  uniform sampler2D uWaterPrev;
  uniform float uLakePrev;
  uniform float uPrevReady;
  uniform vec4 uBoxE;   // west, south, east, north
  uniform vec4 uBoxB;
  uniform vec4 uBoxR;
  uniform float uLake;

  vec2 boxUv(vec4 box, vec2 ll) {
    return vec2((ll.x - box.x) / (box.z - box.x), (box.w - ll.y) / (box.w - box.y));
  }

  // The globe is cut to the block's rectangle (decision 2026-11-09), so both views show one area.
  // uCutLcc = (n, F, rho0, lon0) of the block's Lambert conic, uCutRect = projected x0, y0, x1, y1
  // (projection.ts). Returns the distance to the nearest edge in degrees of arc, negative outside.
  uniform vec4 uCutLcc;
  uniform vec4 uCutRect;
  float blockEdgeDeg(vec2 ll) {
    float rho = uCutLcc.y / pow(tan(0.78539816 + radians(ll.y) * 0.5), uCutLcc.x);
    float th = uCutLcc.x * radians(ll.x - uCutLcc.w);
    vec2 p = vec2(rho * sin(th), uCutLcc.z - rho * cos(th));
    float d = min(min(p.x - uCutRect.x, uCutRect.z - p.x), min(p.y - uCutRect.y, uCutRect.w - p.y));
    return degrees(d);
  }
  bool inBox(vec4 box, vec2 ll, float margin) {
    return ll.x > box.x + margin && ll.x < box.z - margin && ll.y > box.y + margin && ll.y < box.w - margin;
  }
  // r: present-day height (m), g: hillshade factor baked on the CPU.
  vec2 demAt(vec2 ll) {
    return inBox(uBoxB, ll, 0.05) ? texture2D(uDemB, boxUv(uBoxB, ll)).rg : texture2D(uDemE, boxUv(uBoxE, ll)).rg;
  }
  float hNowAt(vec2 ll) {
    return demAt(ll).r;
  }
  float rslAt(sampler2D s, vec2 ll) {
    return texture2D(s, boxUv(uBoxR, ll)).r;
  }
  // x: ocean-connected, y: lake (basin) — from the CPU flood fill in the Baltic window.
  //
  // The fill is only defined on the 1 ka timeline, so the two bracketing frames are UNIONED, not
  // blended. The mask then answers one question only — does this cell belong to the connected water
  // body anywhere in this interval — and the shoreline is left entirely to hp, which is continuous
  // because RSL is interpolated between the source layers. Blending the two and thresholding at 0.5
  // instead made each cell flip at the midpoint of its interval: wherever the mask was the binding
  // constraint the water's edge sat still for 1 000 years and then jumped, while the coast slid on
  // smoothly. The union can only ever be the looser constraint, so hp sets the edge everywhere and
  // the two move as one.
  //
  // Nothing is over-flooded by this: a cell enters the union only if the flood fill itself called
  // it connected water at one of the two frames, so inland depressions below sea level stay dry.
  vec2 waterMask(vec2 ll, float hp) {
    if (inBox(uBoxB, ll, 0.05)) {
      vec2 uvB = boxUv(uBoxB, ll);
      return max(texture2D(uWater, uvB).rg, texture2D(uWaterB, uvB).rg);
    }
    return vec2(hp < 0.0 ? 1.0 : 0.0, 0.0);
  }

  // The basin boundary and the lake-before-ocean precedence are generated from water.ts, which is
  // also what the CPU side runs: oceanSide decides which water the published metrics count, and
  // with the union above both mask channels are candidates at once right through a phase change,
  // so the two sides cannot be left to agree by comment alone (A-02).
  ${WATER_RULE_GLSL}
`;

/**
 * Look of the water, shared by the globe patch and the block's water sheets (decision 2026-11-09)
 * so switching views does not change how the sea reads. Everything comes from data the shaders
 * already have — no new files:
 *
 * - three families: open ocean, the Baltic basin in the phase's colour, a lake (from the water
 *   mask and oceanSide, the same rule as the published metrics);
 * - stepped depth bands at 10 / 30 / 60 / 100 / 200 / 500 m with soft edges, like a bathymetric
 *   chart, and isobaths every 50 m below 25 m;
 * - the relief of the bed through the water (`shade`, the same hillshade response as the land);
 * - water that was land 1000 years earlier (`wasLand`, from the frame t + 1000) hatched — it
 *   belongs to the "coast −1000 years" layer;
 * - milky meltwater within ~90 km of the ice margin, from the DATED-1 distance field (km, positive
 *   inside the ice), blended between the bracketing slices like the ice body itself.
 */
export const WATER_LOOK = /* glsl */ `
  uniform vec3 wOcean0;
  uniform vec3 wOcean1;
  uniform vec3 wBasin;
  uniform vec3 wLake0;
  uniform vec3 wLake1;
  uniform vec3 wMelt;
  uniform vec3 wNew;
  uniform sampler2D uMeltA;
  uniform sampler2D uMeltB;
  uniform float uMeltMix;
  uniform float uMeltOn;
  uniform vec4 uMeltBox;
  // Ice of the frame t + 1000, so water uncovered by the retreating ice is not mistaken for land
  // flooded by the sea (it was ice, not land).
  uniform sampler2D uPrevIceA;
  uniform sampler2D uPrevIceB;
  uniform float uPrevIceMix;
  uniform float uPrevIceOn;

  /** 1 where the frame t + 1000 had ice over this point. */
  float wasIce(vec2 ll) {
    if (uPrevIceOn <= 0.0) return 0.0;
    vec2 u = boxUv(uMeltBox, ll);
    return step(0.0, mix(texture2D(uPrevIceA, u).r, texture2D(uPrevIceB, u).r, uPrevIceMix));
  }

  // Hillshade factor of the present-day bed (slopes barely change with RSL), with the light and
  // response of the baked land shading. For the block, whose DEM texture carries no shade channel.
  float reliefShade(vec2 ll) {
    float e = 0.04;
    float hl = hNowAt(ll - vec2(e, 0.0));
    float hr = hNowAt(ll + vec2(e, 0.0));
    float hd = hNowAt(ll - vec2(0.0, e));
    float hu = hNowAt(ll + vec2(0.0, e));
    float mx = 111320.0 * cos(radians(ll.y)) * e * 2.0;
    float my = 110570.0 * e * 2.0;
    vec3 n = normalize(vec3(-(hr - hl) / mx * 14.0, -(hu - hd) / my * 14.0, 1.0));
    vec3 L = normalize(vec3(-0.6, 0.6, 0.9));
    return clamp(1.0 + 0.9 * (dot(n, L) - L.z), 0.55, 1.35);
  }

  // kind: 0 open ocean, 1 Baltic basin, 2 lake.
  vec3 waterLook(vec2 ll, float depth, int kind, float shade, float wasLand) {
    float b = smoothstep(8.0, 12.0, depth) + smoothstep(27.0, 33.0, depth) + smoothstep(56.0, 64.0, depth)
            + smoothstep(94.0, 106.0, depth) + smoothstep(188.0, 212.0, depth) + smoothstep(470.0, 530.0, depth);
    float k = b / 6.0;
    vec3 col;
    if (kind == 0) col = mix(wOcean0, wOcean1, k);
    else if (kind == 2) col = mix(wLake0, wLake1, k);
    else col = mix(mix(wBasin, vec3(1.0), 0.6), wBasin * 0.82, k);

    // The bed under the water: strongest in the shallows, where it is also the most legible.
    col *= mix(1.0, shade, mix(0.6, 0.35, k));

    // Isobaths every 50 m, as hairlines of constant screen width.
    float off = abs(fract(depth / 50.0 + 0.5) - 0.5) * 50.0;
    float iso = 1.0 - smoothstep(0.5, 1.5, off / max(fwidth(depth), 1e-3));
    col = mix(col, col * 0.8, iso * step(25.0, depth) * 0.5);

    // Meltwater near the ice margin.
    if (uMeltOn > 0.0) {
      vec2 u = boxUv(uMeltBox, ll);
      float d = mix(texture2D(uMeltA, u).r, texture2D(uMeltB, u).r, uMeltMix);
      float m = (1.0 - smoothstep(0.0, 90.0, -d)) * step(d, 0.0);
      col = mix(col, wMelt, m * 0.55 * uMeltOn);
    }

    // Flooded within the last 1000 years: a fine hatch, constant on screen. Not where the ice stood
    // 1000 years earlier — that water was uncovered by the retreating ice, not taken from the land.
    float hatch = step(fract((gl_FragCoord.x + gl_FragCoord.y) / 7.0), 0.3);
    col = mix(col, wNew, wasLand * (1.0 - wasIce(ll)) * hatch * 0.5);
    return col;
  }
`;

export const PATCH_VERTEX = /* glsl */ `
  ${COMMON}
  uniform float uExag;
  uniform float uR;
  varying vec2 vLL;

  void main() {
    vec2 ll = vec2(uBoxE.x + uv.x * (uBoxE.z - uBoxE.x), uBoxE.y + uv.y * (uBoxE.w - uBoxE.y));
    vLL = ll;
    float hn = hNowAt(ll);
    float hp = hn - rslAt(uRsl, ll);
    vec2 wm = waterMask(ll, hp);
    float h = isLakeAt(wm, hp) ? uLake : isOceanAt(wm, hp) ? 0.0 : hp;
    float disp = uR * max(h, 0.0) / 6371000.0 * uExag;
    vec3 p = position + normalize(position) * disp;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

export const PATCH_FRAGMENT = /* glsl */ `
  ${COMMON}
  ${WATER_LOOK}
  uniform sampler2D uOverlay;
  uniform sampler2D uOverlayB;
  uniform vec3 cLand;
  uniform vec3 cSeabed;
  uniform vec3 cBasin;
  uniform vec3 cOcean;
  uniform vec3 cOceanDeep;
  uniform vec3 cCoast;
  uniform vec3 cPrev;
  uniform float uShowToday;
  uniform float uShowPrev;

  // Signed water field of the frame 1000 years earlier, by the same rule as the raster:
  // > 0 where that frame shows water. Its zero contour is the coast 1000 years earlier.
  float prevWaterField(vec2 ll, float hn) {
    float hp = hn - rslAt(uRslPrev, ll);
    if (inBox(uBoxB, ll, 0.05)) {
      vec2 m = texture2D(uWaterPrev, boxUv(uBoxB, ll)).rg;
      float ocean = min(-hp, (m.x - 0.5) * 2000.0);
      float lake = min(uLakePrev - hp, (m.y - 0.5) * 2000.0);
      return max(ocean, lake);
    }
    return -hp;
  }
  uniform float uFeather;
  varying vec2 vLL;

  float contourLine(float v, float width) {
    float d = abs(v) / max(fwidth(v), 1e-4);
    return 1.0 - smoothstep(width * 0.5, width * 0.5 + 1.0, d);
  }

  void main() {
    vec2 ll = vLL;
    vec2 dem = demAt(ll);
    float hn = dem.r;
    float shade = dem.g;
    float hp = hn - rslAt(uRsl, ll);
    vec2 wm = waterMask(ll, hp);
    bool lake = isLakeAt(wm, hp);
    bool ocean = isOceanAt(wm, hp);

    // The coast-1000-years layer: ready inside the Baltic window once frame t + 1000 has arrived,
    // and faded out along the window's edge where the water rule changes (fill inside, threshold
    // outside), which would otherwise draw a false contour there.
    float prevReady = inBox(uBoxB, ll, 0.05) ? uPrevReady : 1.0;
    vec4 bd = vec4(ll.x - uBoxB.x, uBoxB.z - ll.x, ll.y - uBoxB.y, uBoxB.w - ll.y);
    float edgeDist = abs(min(min(bd.x, bd.y), min(bd.z, bd.w)));
    float seam = inBox(uBoxB, ll, -0.3) ? smoothstep(0.05, 0.25, edgeDist) : 1.0;
    float prevField = prevWaterField(ll, hn);

    vec3 col;
    if (ocean || lake) {
      float level = lake ? uLake : 0.0;
      float depth = level - hp;
      // Basin colour (fresh / brackish / marine) only for the Baltic basin itself; every other
      // water body — North Sea, Norwegian and Barents Sea, White Sea — is open ocean.
      bool basin = inBox(uBoxB, ll, 0.05) && !oceanSide(ll);
      int kind = lake ? 2 : (basin ? 1 : 0);
      float wasLand = step(prevField, 0.0) * uShowPrev * prevReady * seam;
      col = waterLook(ll, depth, kind, shade, wasLand);
      // Shoreline of the frame.
      col = mix(col, col * 0.72, contourLine(hp - level, 1.4) * 0.9);
    } else {
      // Land that is sea floor today is tinted, so emerged shelves stand out.
      vec3 base = hn < 0.0 ? mix(cLand, cSeabed, 0.55) : cLand;
      col = base * shade;
    }

    // Present-day coastline and the coast 1000 years earlier.
    col = mix(col, cCoast, contourLine(hn, 1.2) * uShowToday * 0.85);
    col = mix(col, cPrev, contourLine(prevField, 1.1) * uShowPrev * prevReady * seam * 0.8);

    // Ice, sills, transect: painted on the overlay canvas.
    vec4 ov = texture2D(uOverlay, vec2((ll.x - uBoxE.x) / (uBoxE.z - uBoxE.x), (ll.y - uBoxE.y) / (uBoxE.w - uBoxE.y)));
    col = mix(col, ov.rgb, ov.a);
    if (inBox(uBoxB, ll, 0.0)) {
      vec4 ovb = texture2D(uOverlayB, vec2((ll.x - uBoxB.x) / (uBoxB.z - uBoxB.x), (ll.y - uBoxB.y) / (uBoxB.w - uBoxB.y)));
      col = mix(col, ovb.rgb, ovb.a);
    }

    float edge = min(min(ll.x - uBoxE.x, uBoxE.z - ll.x), min(ll.y - uBoxE.y, uBoxE.w - ll.y));
    float cut = blockEdgeDeg(ll);
    if (cut <= 0.0) discard;
    gl_FragColor = vec4(col, smoothstep(0.0, uFeather, edge) * smoothstep(0.0, uFeather, cut));
    #include <colorspace_fragment>
  }
`;

