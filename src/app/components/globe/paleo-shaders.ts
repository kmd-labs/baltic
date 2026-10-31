/**
 * Shaders of the paleo patch. Everything is evaluated per vertex / per pixel from the
 * present-day grids and the RSL field, so the shoreline stays sharp at any zoom:
 *   H_paleo = H_now − RSL(t)            (no separate eustatic term — C-03)
 * Textures are cell-registered with rows from the north, sampled with linear filtering —
 * the same bilinear rule as the pipeline (paleo.ts / postglacial.py).
 */

const COMMON = /* glsl */ `
  uniform sampler2D uDemE;
  uniform sampler2D uDemB;
  uniform sampler2D uRsl;
  uniform sampler2D uRslPrev;
  uniform sampler2D uWater;
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
  vec2 waterMask(vec2 ll, float hp) {
    if (inBox(uBoxB, ll, 0.05)) return texture2D(uWater, boxUv(uBoxB, ll)).rg;
    return vec2(hp < 0.0 ? 1.0 : 0.0, 0.0);
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
    float h = hp;
    if (wm.x > 0.5 && hp < 0.0) h = 0.0;
    if (wm.y > 0.5 && hp < uLake) h = uLake;
    float disp = uR * max(h, 0.0) / 6371000.0 * uExag;
    vec3 p = position + normalize(position) * disp;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

export const PATCH_FRAGMENT = /* glsl */ `
  ${COMMON}
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

  // Same rule as oceanSide() in water.ts.
  bool oceanSide(vec2 ll) {
    return ll.x < 10.3 || (ll.y > 56.95 && ll.x < 12.4) || (ll.y > 62.0 && ll.x < 16.5);
  }

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
    bool ocean = wm.x > 0.5 && hp < 0.0;
    bool lake = !ocean && wm.y > 0.5 && hp < uLake;

    vec3 col;
    if (ocean || lake) {
      float level = lake ? uLake : 0.0;
      float depth = level - hp;
      float k = smoothstep(0.0, 220.0, depth);
      // Basin colour (fresh / brackish / marine) only for the Baltic basin itself; every other
      // water body — North Sea, Norwegian and Barents Sea, White Sea — is open ocean.
      bool basin = inBox(uBoxB, ll, 0.05) && !oceanSide(ll);
      if (ocean && !basin) {
        // Open ocean: a long, soft ramp so the deep Atlantic does not dominate the cap.
        col = mix(cOcean, cOceanDeep, smoothstep(0.0, 1500.0, depth));
      } else {
        col = mix(mix(cBasin, vec3(1.0), 0.45), cBasin, k);
      }
      // Shoreline of the frame.
      col = mix(col, col * 0.72, contourLine(hp - level, 1.4) * 0.9);
    } else {
      // Land that is sea floor today is tinted, so emerged shelves stand out.
      vec3 base = hn < 0.0 ? mix(cLand, cSeabed, 0.55) : cLand;
      col = base * shade;
    }

    // Present-day coastline and the coast 1000 years earlier.
    col = mix(col, cCoast, contourLine(hn, 1.2) * uShowToday * 0.85);
    float prevReady = inBox(uBoxB, ll, 0.05) ? uPrevReady : 1.0;
    // The water rule changes at the edge of the Baltic window (fill inside, threshold outside),
    // which would draw a false contour along it: fade the line out in a 0.25° band there.
    vec4 bd = vec4(ll.x - uBoxB.x, uBoxB.z - ll.x, ll.y - uBoxB.y, uBoxB.w - ll.y);
    float edgeDist = abs(min(min(bd.x, bd.y), min(bd.z, bd.w)));
    float seam = inBox(uBoxB, ll, -0.3) ? smoothstep(0.05, 0.25, edgeDist) : 1.0;
    col = mix(col, cPrev, contourLine(prevWaterField(ll, hn), 1.1) * uShowPrev * prevReady * seam * 0.8);

    // Ice, sills, transect: painted on the overlay canvas.
    vec4 ov = texture2D(uOverlay, vec2((ll.x - uBoxE.x) / (uBoxE.z - uBoxE.x), (ll.y - uBoxE.y) / (uBoxE.w - uBoxE.y)));
    col = mix(col, ov.rgb, ov.a);
    if (inBox(uBoxB, ll, 0.0)) {
      vec4 ovb = texture2D(uOverlayB, vec2((ll.x - uBoxB.x) / (uBoxB.z - uBoxB.x), (ll.y - uBoxB.y) / (uBoxB.w - uBoxB.y)));
      col = mix(col, ovb.rgb, ovb.a);
    }

    float edge = min(min(ll.x - uBoxE.x, uBoxE.z - ll.x), min(ll.y - uBoxE.y, uBoxE.w - ll.y));
    gl_FragColor = vec4(col, smoothstep(0.0, uFeather, edge));
    #include <colorspace_fragment>
  }
`;
