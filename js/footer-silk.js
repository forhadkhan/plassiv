/* Footer: black satin with a red reflection and golden sparkle noise (WebGL), same cloth as the hero. */

import { silk } from './silk.js';

const footer = document.getElementById('contact');
const canvas = document.getElementById('footer-silk');
const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uFade; // height of the paper-to-silk dissolve at the top edge, in pixels

float hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }

float cloth(vec2 p, float t){
  p += .55 * vec2(sin(p.y * 1.3 + t * .9) + .5 * sin(p.y * 2.9 - t * 1.3), cos(p.x * 1.1 - t * .8) + .5 * cos(p.x * 2.3 + t * 1.1));
  float h = sin(p.x * 1.9 + p.y * .9 + t) * .55;
  h += sin(p.x * 1.1 - p.y * 1.7 - t * .8 + h * 1.6) * .35;
  h += sin(p.x * 3.1 + p.y * 2.3 + t * .6 + h * 2.) * .14;
  return h;
}

void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 p = uv * vec2(uRes.x / uRes.y, 1.) * 1.5;
  float t = uTime * .3;

  float e = .012;
  float h  = cloth(p, t);
  float hx = cloth(p + vec2(e, 0.), t);
  float hy = cloth(p + vec2(0., e), t);
  vec3 n = normalize(vec3((h - hx) / e * .5, (h - hy) / e * .5, 1.));

  vec3 L = normalize(vec3(-.4, .55, .75));
  vec3 H = normalize(L + vec3(0., 0., 1.));
  float diff  = clamp(dot(n, L), 0., 1.);
  float ndh   = clamp(dot(n, H), 0., 1.);
  float spec  = pow(ndh, 110.);
  float sheen = pow(ndh, 9.);

  vec3 black  = vec3(.012, .004, .006);
  vec3 wine   = vec3(.20, .012, .035);
  vec3 red    = vec3(1., .10, .14);
  vec3 gold   = vec3(.92, .62, .16);

  vec3 c = mix(black, wine, smoothstep(.3, .95, diff) * .4);
  c += red * pow(sheen, 1.6) * .34;          // red reflection riding the folds
  c += gold * spec * .35;          // faint gold glint at the very crest

  // golden noise: tiny sparkles that twinkle, brighter where the cloth catches the light
  vec2 cell = floor(gl_FragCoord.xy);
  float r = hash(cell);
  float tw = .5 + .5 * sin(uTime * 2.4 + r * 40.);
  float sp = step(.975, r) * tw * (.2 + sheen * 1.3);
  c += gold * sp * .8;

  float g = hash(gl_FragCoord.xy + fract(uTime) * 61.7) - .5;
  c += vec3(1., .72, .3) * g * .05;
  c = max(c, 0.);

  // top edge: the same silk keeps flowing up into the white. A slow wave rolls along the edge, the red
  // reflection brightens as it climbs, and the folds' sheen holds the white back so the waves stay visible
  float d = 1. - clamp((uRes.y - gl_FragCoord.y) / uFade, 0., 1.);   // 1 at the top edge, 0 where the fade ends
  // the cloth's own folds push the edge up and down, so the waves are plainly visible inside the fade
  d = clamp(d + ((diff - .45) * .55 + .06 * sin(p.x * 1.6 + t * 1.1 + h * 1.2)) * sin(3.14159 * d), 0., 1.);
  float k = d * d * (3. - 2. * d);                                    // smoothstep, a long even ramp
  vec3 lit = c + red * (.1 + sheen * .85) * sin(3.14159 * k) * 1.2;   // red reflection rides the wave through the dissolve
  vec3 paper = vec3(.9647, .9451, .9059);                              // the page colour (--color-paper)
  c = mix(lit, paper, k);
  c = mix(c, paper, smoothstep(.96, 1., d));                          // exactly paper at the seam, so no edge line shows
  gl_FragColor = vec4(c, 1.);
}`;

let inView = false;
const kick = silk(canvas, FRAG, () => inView, (gl, prog, scale) => {
  // the fade is 22rem tall (--fade on the footer), shorter when the footer itself is short
  const fade = parseFloat(getComputedStyle(footer).getPropertyValue('--fade')) || 22;
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  gl.uniform1f(gl.getUniformLocation(prog, 'uFade'), Math.min(fade * rem * scale, gl.canvas.height * 0.5));
});
if (footer && 'IntersectionObserver' in window) {
  new IntersectionObserver(([e]) => { inView = e.isIntersecting; kick(); }, { rootMargin: '300px 0px' }).observe(footer);
}
