/**
 * Ice body of the globe (C-07). One mesh per DATED-1 variant (`min`, `mc`, `max`), all sharing one
 * sphere sector: the shape comes entirely from the signed distance field, so the geometry can be
 * reused and only the uniforms differ.
 *
 * Shape:   h(d) = uProfileK * sqrt(d)     plastic profile, d = distance to the margin in km
 * Morph:   d = mix(dA, dB, uSdfMix)       between the two bracketing DATED-1 slices
 *
 * Interpolating the distance field and *then* applying the profile is what makes the animation
 * continuous: the margin (d = 0) travels, and the height follows it, instead of one outline fading
 * into the next.
 *
 * The body rests on the surface the paleo patch draws, by the same water rule, so the two agree at
 * the margin. Terrain stays flat (`uExag` = 1 by the decision of 2026-10-31) while the ice has its
 * own `uIceExag`: at true scale 3 km of ice is 0.0024 of the 5-unit globe radius — less than the
 * patch's own offset, so it would be invisible. The body is a schematic and is labelled as one.
 */
import { COMMON } from './paleo-shaders';

/** Sampling and shading shared by both stages. */
const ICE_COMMON = /* glsl */ `
  uniform sampler2D uSdfA;
  uniform sampler2D uSdfB;
  uniform float uSdfMix;
  uniform vec4 uBoxI;
  uniform float uProfileK;
  uniform float uIceExag;
  uniform float uExag;

  /** Distance to the margin in km, blended between the bracketing slices. Positive inside. */
  float sdfAt(vec2 ll) {
    vec2 uvI = boxUv(uBoxI, ll);
    return mix(texture2D(uSdfA, uvI).r, texture2D(uSdfB, uvI).r, uSdfMix);
  }

  float iceThickness(float d) {
    return d > 0.0 ? uProfileK * sqrt(d) : 0.0;
  }

  float thicknessAt(vec2 ll) {
    return iceThickness(sdfAt(ll));
  }

  /** The surface the ice rests on — the same rule as the paleo patch's vertex stage. */
  float bedAt(vec2 ll) {
    float hn = hNowAt(ll);
    float hp = hn - rslAt(uRsl, ll);
    vec2 wm = waterMask(ll, hp);
    float h = hp;
    if (wm.x > 0.5 && hp < 0.0) h = 0.0;
    if (wm.y > 0.5 && hp < uLake) h = uLake;
    return max(h, 0.0);
  }
`;

export const ICE_VERTEX = /* glsl */ `
  ${COMMON}
  ${ICE_COMMON}
  uniform float uR;
  varying vec2 vLL;
  varying float vD;
  varying float vFacing;

  void main() {
    vec2 ll = vec2(uBoxI.x + uv.x * (uBoxI.z - uBoxI.x), uBoxI.y + uv.y * (uBoxI.w - uBoxI.y));
    vLL = ll;
    float d = sdfAt(ll);
    vD = d;
    float surface = bedAt(ll) * uExag + iceThickness(d) * uIceExag;
    vec3 nrm = normalize(position);
    vec3 p = position + nrm * (uR * surface / 6371000.0);
    // Nothing in this scene writes depth — the globe sphere is a raycast target and is not
    // rendered — so the far hemisphere is culled here instead, or ice behind the Earth would show
    // through it. The mesh carries no transform, so object space is world space.
    vFacing = dot(nrm, normalize(cameraPosition - p));
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

export const ICE_FRAGMENT = /* glsl */ `
  ${COMMON}
  ${ICE_COMMON}
  uniform vec3 uColor;
  uniform vec3 uEdge;
  uniform float uOpacity;
  uniform float uFade;
  /** Alpha ramp at the margin (km) — narrow, so the silhouette stays crisp. */
  uniform float uFeatherKm;
  /** Width of the margin highlight (km) — wide, so the extent reads as a line. */
  uniform float uRimKm;
  varying vec2 vLL;
  varying float vD;
  varying float vFacing;

  void main() {
    if (vFacing <= 0.0) discard;
    vec2 ll = vLL;
    // vD is the per-vertex distance, interpolated: good enough to reject whole quads cheaply, but
    // the margin itself is taken from the texture so the silhouette does not follow the tessellation.
    if (vD < -12.0) discard;
    float d = sdfAt(ll);
    if (d < -2.0) discard;

    // Surface slope of the ice, in the local (east, north, up) frame and with the same light and
    // response curve as the baked terrain hillshade, so ice and land agree.
    float e = 0.12;
    float hE = thicknessAt(ll + vec2(e, 0.0));
    float hW = thicknessAt(ll - vec2(e, 0.0));
    float hN = thicknessAt(ll + vec2(0.0, e));
    float hS = thicknessAt(ll - vec2(0.0, e));
    float mx = 111320.0 * cos(radians(ll.y)) * e * 2.0;
    float my = 110570.0 * e * 2.0;
    float gx = -(hE - hW) / mx * uIceExag;
    float gy = -(hN - hS) / my * uIceExag;
    vec3 L = vec3(-0.6, 0.6, 0.9);
    float ln = length(L);
    float nl = length(vec3(gx, gy, 1.0));
    float dotNL = (gx * L.x + gy * L.y + L.z) / (nl * ln);
    float shade = clamp(1.0 + 0.9 * (dotNL - L.z / ln), 0.55, 1.35);

    vec3 col = uColor * shade;
    // Margin highlight: the DATED-1 outline itself, drawn on the body rather than under it.
    col = mix(col, uEdge, (1.0 - smoothstep(0.0, uRimKm, d)) * 0.6);

    // Fade at the edge of the domain, where DATED-1 continues past the RSL grid (Kara Sea).
    float edge = min(min(ll.x - uBoxI.x, uBoxI.z - ll.x), min(ll.y - uBoxI.y, uBoxI.w - ll.y));
    float a = uOpacity * uFade * smoothstep(0.0, uFeatherKm, d) * smoothstep(0.0, 1.5, edge)
            * smoothstep(0.0, 0.10, vFacing); // soften the cut at the limb
    if (a <= 0.003) discard;
    gl_FragColor = vec4(col, a);
    #include <colorspace_fragment>
  }
`;
