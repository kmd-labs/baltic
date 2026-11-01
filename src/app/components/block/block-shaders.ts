/**
 * Shaders of the block view: a rectangle of ground turned into a solid slab, with the seabed and
 * the mountains on one shared vertical exaggeration.
 *
 * Geometry comes in already flattened: every vertex carries its projected position (`aProj`) and
 * the component places it in world X/Z, while the shader supplies only the height. `aFace` says
 * which part of the slab it belongs to (top surface, wall, plinth) and `aTop` whether it follows
 * the terrain or sits on the plinth, so one material covers the whole object and the walls join the
 * surface seamlessly — they evaluate the same height function.
 *
 * Everything is still sampled by lon/lat through the shared `COMMON` block, so the data layer is
 * exactly the one the globe uses. The link between the two is `lccInv`, the inverse of the
 * projection in projection.ts; the fragment stage re-derives lon/lat from the interpolated
 * projected position, which is exact at any tessellation because the slab is linear in that space.
 *
 * Unlike the globe's patch, the surface here is the *bare bed* — H_paleo with no water fill. Water
 * is a separate translucent sheet (WATER_*), so the basin's depth stays visible through it.
 */
import { COMMON } from '../globe/paleo-shaders';

/** Projection, vertical scale and the height of the bed. Shared by every stage of the block. */
const BLOCK_COMMON = /* glsl */ `
  uniform vec4 uRect;      // projected x0, y0, x1, y1
  uniform vec3 uLcc;       // n, F, rho0
  uniform float uLon0;
  uniform float uPerM;     // world units per metre of elevation at exaggeration 1
  uniform float uVExag;
  uniform float uBaseY;    // world Y of the plinth

  /** Inverse Lambert conformal conic; mirrors lccInverse() in projection.ts. */
  vec2 lccInv(vec2 p) {
    float n = uLcc.x;
    float F = uLcc.y;
    float dy = uLcc.z - p.y;
    float sgn = n >= 0.0 ? 1.0 : -1.0;
    float rho = sgn * length(vec2(p.x, dy));
    float th = atan(sgn * p.x, sgn * dy);
    return vec2(uLon0 + degrees(th / n), degrees(2.0 * atan(pow(F / rho, 1.0 / n)) - 1.5707963));
  }

  /** Bare bed in metres: H_paleo = H_now − RSL(t), never filled up to a water surface. */
  float bedM(vec2 ll) {
    return hNowAt(ll) - rslAt(uRsl, ll);
  }

  float toY(float m) {
    return m * uPerM * uVExag;
  }
  float toM(float y) {
    return y / (uPerM * uVExag);
  }

  /** Lambert shade from a local slope, with the same light and curve as the baked hillshade. */
  float slopeShade(float gx, float gy) {
    vec3 L = vec3(-0.6, 0.6, 0.9);
    float ln = length(L);
    float nl = length(vec3(gx, gy, 1.0));
    float d = (gx * L.x + gy * L.y + L.z) / (nl * ln);
    return clamp(1.0 + 0.9 * (d - L.z / ln), 0.55, 1.35);
  }

  /** Metres per degree, east and north, at this latitude. */
  vec2 metresPerDeg(float lat) {
    return vec2(111320.0 * cos(radians(lat)), 110570.0);
  }

`;

/**
 * Fragment-only helpers. `fwidth` and the other derivative functions exist solely in the fragment
 * language, so a vertex shader that merely *contains* this fails to compile — it cannot live in
 * BLOCK_COMMON, which both stages include.
 */
const BLOCK_FRAG = /* glsl */ `
  float hairline(float v, float width) {
    return 1.0 - smoothstep(width * 0.5, width * 0.5 + 1.0, abs(v) / max(fwidth(v), 1e-4));
  }

  /**
   * Signed water field of the frame 1000 years earlier, by the same rule as the globe's patch:
   * positive where that frame showed water, so its zero contour is the coast of 1000 years ago.
   * Inside the Baltic window the flood fill decides; outside it, the threshold on H_paleo does.
   */
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
`;

const BLOCK_ATTRS = /* glsl */ `
  attribute vec2 aProj;
  attribute float aFace;   // 0 top surface, 1 wall, 2 plinth
  attribute float aTop;    // 1 follows the bed, 0 sits on the plinth
`;

export const BLOCK_VERTEX = /* glsl */ `
  ${COMMON}
  ${BLOCK_COMMON}
  ${BLOCK_ATTRS}
  varying vec2 vProj;
  varying float vFace;
  varying float vY;

  void main() {
    vProj = aProj;
    vFace = aFace;
    float y = aTop > 0.5 ? toY(bedM(lccInv(aProj))) : uBaseY;
    vY = y;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position.x, y, position.z, 1.0);
  }
`;

export const BLOCK_FRAGMENT = /* glsl */ `
  ${COMMON}
  ${BLOCK_COMMON}
  ${BLOCK_FRAG}
  uniform vec3 cLand;
  uniform vec3 cLandMid;
  uniform vec3 cLandHigh;
  uniform vec3 cLandPeak;
  uniform vec3 cSeabed;
  uniform vec3 cDeep;
  uniform vec3 cWall;
  uniform vec3 cPlinth;
  uniform vec3 cLine;
  uniform vec3 cPrev;
  uniform float uShowToday;
  uniform float uShowPrev;
  varying vec2 vProj;
  varying float vFace;
  varying float vY;

  void main() {
    if (vFace > 1.5) {
      gl_FragColor = vec4(cPlinth, 1.0);
      #include <colorspace_fragment>
      return;
    }

    vec2 ll = lccInv(vProj);

    if (vFace > 0.5) {
      // Wall of the slab: plain material carrying the elevation scale. Sea level is the strong
      // line, every 500 m a faint one — the walls are where a depth reads off an object like this.
      float m = toM(vY);
      vec3 col = cWall * (m < 0.0 ? 0.93 : 1.0);
      float g = m / 500.0;
      col = mix(col, cLine, hairline(fract(g + 0.5) - 0.5, 1.0) * 0.22);
      col = mix(col, cLine, hairline(m / 500.0, 1.4) * 0.75);
      gl_FragColor = vec4(col, 1.0);
      #include <colorspace_fragment>
      return;
    }

    // Top surface: the bed itself, dry or drowned.
    // Dry land is tinted by elevation, so height is legible as colour and not only as relief.
    // Stops follow this block's own hypsometry: median land ~190 m, a third above 500 m, a tenth
    // above 1000 m, highest point 1987 m.
    float hn = hNowAt(ll);
    float hp = hn - rslAt(uRsl, ll);
    vec2 wm = waterMask(ll, hp);
    bool ocean = wm.x > 0.5 && hp < 0.0;
    bool lake = !ocean && wm.y > 0.5 && hp < uLake;

    vec3 col;
    if (ocean || lake) {
      float level = lake ? uLake : 0.0;
      col = mix(cSeabed, cDeep, smoothstep(0.0, 420.0, level - hp));
    } else {
      vec3 tint = mix(cLand, cLandMid, smoothstep(0.0, 350.0, hp));
      tint = mix(tint, cLandHigh, smoothstep(350.0, 1100.0, hp));
      tint = mix(tint, cLandPeak, smoothstep(1100.0, 1700.0, hp));
      // Ground that is sea floor today still reads as sea floor once it emerges.
      col = hn < 0.0 ? mix(tint, cSeabed, 0.55) : tint;
    }

    // Relief shading from the bed's own slope — the whole point of the view, so it is computed
    // rather than read from the baked 2D hillshade. The step matches the grid actually in use:
    // sampling finer than the data only reads back the bilinear ramp between cell centres.
    float e = inBox(uBoxB, ll, 0.05) ? 0.025 : 0.05;
    vec2 mpd = metresPerDeg(ll.y);
    float hE = bedM(ll + vec2(e, 0.0));
    float hW = bedM(ll - vec2(e, 0.0));
    float hN = bedM(ll + vec2(0.0, e));
    float hS = bedM(ll - vec2(0.0, e));
    float gx = -(hE - hW) / (mpd.x * e * 2.0) * uVExag;
    float gy = -(hN - hS) / (mpd.y * e * 2.0) * uVExag;
    col *= slopeShade(gx, gy);

    col = mix(col, cLine, hairline(hn, 1.2) * uShowToday * 0.55);

    // Coast of 1000 years earlier. Drawn on the bed, so where that shore is now drowned the line
    // shows through the water sheet — which is the useful part on a view with real bathymetry.
    // The water rule changes at the edge of the Baltic window (fill inside, threshold outside) and
    // would draw a false contour along it, so the line fades out in a 0.25 deg band there.
    float prevReady = inBox(uBoxB, ll, 0.05) ? uPrevReady : 1.0;
    vec4 bd = vec4(ll.x - uBoxB.x, uBoxB.z - ll.x, ll.y - uBoxB.y, uBoxB.w - ll.y);
    float edgeDist = abs(min(min(bd.x, bd.y), min(bd.z, bd.w)));
    float seam = inBox(uBoxB, ll, -0.3) ? smoothstep(0.05, 0.25, edgeDist) : 1.0;
    col = mix(col, cPrev, hairline(prevWaterField(ll, hn), 1.1) * uShowPrev * prevReady * seam * 0.85);

    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

export const WATER_VERTEX = /* glsl */ `
  ${COMMON}
  ${BLOCK_COMMON}
  attribute vec2 aProj;
  uniform float uIsLake;
  varying vec2 vProj;

  void main() {
    vProj = aProj;
    float level = uIsLake > 0.5 ? uLake : 0.0;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position.x, toY(level), position.z, 1.0);
  }
`;

export const WATER_FRAGMENT = /* glsl */ `
  ${COMMON}
  ${BLOCK_COMMON}
  ${BLOCK_FRAG}
  uniform float uIsLake;
  uniform vec3 cWater;
  uniform vec3 cWaterDeep;
  varying vec2 vProj;

  void main() {
    vec2 ll = lccInv(vProj);
    float hp = bedM(ll);
    vec2 wm = waterMask(ll, hp);
    float level = uIsLake > 0.5 ? uLake : 0.0;
    bool show = uIsLake > 0.5 ? (wm.y > 0.5 && hp < level) : (wm.x > 0.5 && hp < 0.0);
    if (!show) discard;

    // Shallow water stays clear so the bed shows through; depth both darkens and thickens it,
    // which is what makes the basin and its sills readable at a glance.
    float depth = level - hp;
    float k = smoothstep(0.0, 320.0, depth);
    vec3 col = mix(cWater, cWaterDeep, k);
    float a = mix(0.34, 0.86, smoothstep(0.0, 260.0, depth));
    // Pick out the shoreline, where the sheet meets the bed.
    a = mix(a, 0.95, hairline(depth, 1.6) * 0.5);
    gl_FragColor = vec4(col, a);
    #include <colorspace_fragment>
  }
`;

/**
 * Ice body on the slab. Same distance field and plastic profile as the globe (C-07), but on the
 * block it shares the terrain's exaggeration instead of carrying its own — which is the point of
 * this view: the ice and the mountains are finally on one scale.
 */
export const BLOCK_ICE_VERTEX = /* glsl */ `
  ${COMMON}
  ${BLOCK_COMMON}
  attribute vec2 aProj;
  uniform sampler2D uSdfA;
  uniform sampler2D uSdfB;
  uniform float uSdfMix;
  uniform vec4 uBoxI;
  uniform float uProfileK;
  varying vec2 vProj;
  varying float vD;

  float sdfAt(vec2 ll) {
    vec2 u = boxUv(uBoxI, ll);
    return mix(texture2D(uSdfA, u).r, texture2D(uSdfB, u).r, uSdfMix);
  }
  float iceThickness(float d) {
    return d > 0.0 ? uProfileK * sqrt(d) : 0.0;
  }

  void main() {
    vProj = aProj;
    vec2 ll = lccInv(aProj);
    float d = sdfAt(ll);
    vD = d;
    float y = toY(max(bedM(ll), 0.0) + iceThickness(d));
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position.x, y, position.z, 1.0);
  }
`;

export const BLOCK_ICE_FRAGMENT = /* glsl */ `
  ${COMMON}
  ${BLOCK_COMMON}
  uniform sampler2D uSdfA;
  uniform sampler2D uSdfB;
  uniform float uSdfMix;
  uniform vec4 uBoxI;
  uniform float uProfileK;
  uniform vec3 uColor;
  uniform vec3 uEdge;
  uniform float uOpacity;
  uniform float uFade;
  uniform float uRimKm;
  varying vec2 vProj;
  varying float vD;

  float sdfAt(vec2 ll) {
    vec2 u = boxUv(uBoxI, ll);
    return mix(texture2D(uSdfA, u).r, texture2D(uSdfB, u).r, uSdfMix);
  }
  float iceThickness(float d) {
    return d > 0.0 ? uProfileK * sqrt(d) : 0.0;
  }

  void main() {
    if (vD < -12.0) discard;
    vec2 ll = lccInv(vProj);
    float d = sdfAt(ll);
    if (d < -1.0) discard;

    float e = 0.04;
    vec2 mpd = metresPerDeg(ll.y);
    float hE = iceThickness(sdfAt(ll + vec2(e, 0.0)));
    float hW = iceThickness(sdfAt(ll - vec2(e, 0.0)));
    float hN = iceThickness(sdfAt(ll + vec2(0.0, e)));
    float hS = iceThickness(sdfAt(ll - vec2(0.0, e)));
    float gx = -(hE - hW) / (mpd.x * e * 2.0) * uVExag;
    float gy = -(hN - hS) / (mpd.y * e * 2.0) * uVExag;

    vec3 col = uColor * slopeShade(gx, gy);
    col = mix(col, uEdge, (1.0 - smoothstep(0.0, uRimKm, d)) * 0.6);
    float a = uOpacity * uFade * smoothstep(0.0, 1.5, d);
    if (a <= 0.003) discard;
    gl_FragColor = vec4(col, a);
    #include <colorspace_fragment>
  }
`;
