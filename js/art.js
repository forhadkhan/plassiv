/* Generative art: black marble run through with gold veins (WebGL), behind the "about" section. */
import { silk } from './silk.js';

const MARBLE = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uFade; // height of the paper-to-stone dissolve at the top and bottom edges, in pixels

float hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3. - 2. * f);
  return mix(mix(hash(i), hash(i + vec2(1., 0.)), f.x), mix(hash(i + vec2(0., 1.)), hash(i + vec2(1., 1.)), f.x), f.y);
}
float fbm(vec2 p){
  float v = 0., a = .5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = mat2(1.6, 1.2, -1.2, 1.6) * p; a *= .5; }
  return v;
}

void main(){
  vec2 uv = gl_FragCoord.xy / 420.;   // fixed scale, so a tall section gets more stone, not bigger stone
  float t = uTime * .035;
  vec2 p = uv * 1.9;

  // domain warping: the stone folds into itself, slowly drifting
  vec2 q = vec2(fbm(p + vec2(0., t)), fbm(p + vec2(5.2, 1.3) - t));
  vec2 r = vec2(fbm(p + 3. * q + vec2(1.7, 9.2) + t * .6), fbm(p + 3. * q + vec2(8.3, 2.8) - t * .5));
  float f = fbm(p + 3.2 * r);

  vec3 black = vec3(.012, .004, .007);
  vec3 wine  = vec3(.16, .012, .04);
  vec3 gold  = vec3(.93, .66, .24);
  vec3 pale  = vec3(1., .88, .62);

  vec3 c = mix(black, wine, smoothstep(.25, .85, r.y) * .45);
  c += wine * .3 * smoothstep(.45, .9, f);

  // veins where the field crosses its midline: a hard thin core, a soft glow around it
  float m = abs(f - .52);
  float core = smoothstep(.0065, .0, m);
  float glow = exp(-m * 26.) * .07;
  float m2 = abs(fbm(p * 1.7 + 3. * r + 7.) - .5);
  float fine = smoothstep(.0045, .0, m2) * .22;

  // a faint shimmer travels along the veins
  float shimmer = .85 + .15 * sin(uTime * .35 + f * 18. + q.x * 6.);
  vec3 vein = mix(gold, pale, core * shimmer * .35);
  c += vein * (core + fine + glow) * shimmer * .26;

  // tiny gold sparkles that twinkle, brighter near the veins
  vec2 cell = floor(gl_FragCoord.xy);
  float rnd = hash(cell);
  float tw = .5 + .5 * sin(uTime * 2.2 + rnd * 40.);
  c += gold * step(.9985, rnd) * tw * (.1 + (core + glow) * .8);

  c += vec3(1., .72, .3) * (hash(gl_FragCoord.xy + fract(uTime) * 61.7) - .5) * .025;

  // vignette keeps the copy readable at the edges
  vec2 vc = gl_FragCoord.xy / uRes - .5;
  c *= 1. - dot(vc, vc) * 1.1;

  // top and bottom edges dissolve paper -> red -> the dark body in one long, smooth ramp
  float edge = min(gl_FragCoord.y, uRes.y - gl_FragCoord.y);
  float ft = clamp(edge / uFade, 0., 1.);                      // 0 at either edge, 1 where the fade ends
  // a very slow, low-frequency drift bends the front a little; no sharp features, so the ramp stays smooth
  float w = noise(gl_FragCoord.xy / uFade * vec2(.55, .8) + vec2(uTime * .03, -uTime * .02)) - .5;
  ft = clamp(ft + w * .22 * sin(3.14159 * ft), 0., 1.);          // zero push at the seam and at the inner end
  float s = ft * ft * ft * (ft * (ft * 6. - 15.) + 10.);           // smootherstep
  vec3 paper = vec3(.9647, .9451, .9059);                     // the page colour (--color-paper)
  vec3 red = vec3(.66, .05, .08);                             // the hero's red
  vec3 ramp = mix(paper, red, smoothstep(0., .6, s));
  c = mix(ramp, max(c, 0.), smoothstep(.3, 1., s));           // red eases into the body, no dark band in between
  gl_FragColor = vec4(c, 1.);
}`;

const about = document.getElementById('about');
let on = false;
const kick = silk(document.getElementById('about-art'), MARBLE, () => on, (gl, prog, scale) => {
  // --fade on the section sets the dissolve height (rem), shorter when the section itself is short
  const fade = parseFloat(getComputedStyle(about).getPropertyValue('--fade')) || 14;
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  gl.uniform1f(gl.getUniformLocation(prog, 'uFade'), Math.min(fade * rem * scale, gl.canvas.height * 0.4));
});
if (about && 'IntersectionObserver' in window) {
  new IntersectionObserver(([e]) => { on = e.isIntersecting; kick(); }, { rootMargin: '300px 0px' }).observe(about);
}
