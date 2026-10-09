/* Nav: red satin bar (same cloth as the hero, WebGL) that hides when you scroll down and returns when you scroll up. */

import { silk } from './silk.js';

const bar = document.getElementById('site-nav');
const canvas = document.getElementById('nav-mesh');
const menu = document.getElementById('mobile-menu');

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uUnit; // render pixels per cloth unit, so the folds match the hero's scale

float hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }

float cloth(vec2 p, float t){
  p += .55 * vec2(sin(p.y * 1.3 + t * .9) + .5 * sin(p.y * 2.9 - t * 1.3), cos(p.x * 1.1 - t * .8) + .5 * cos(p.x * 2.3 + t * 1.1));
  float h = sin(p.x * 1.9 + p.y * .9 + t) * .55;
  h += sin(p.x * 1.1 - p.y * 1.7 - t * .8 + h * 1.6) * .35;
  h += sin(p.x * 3.1 + p.y * 2.3 + t * .6 + h * 2.) * .14;
  return h;
}

void main(){
  vec2 p = (gl_FragCoord.xy + vec2(0., 900. * uUnit / 1.7 * .5)) / uUnit;
  float t = uTime * .35;

  float e = .012;
  float h  = cloth(p, t);
  float hx = cloth(p + vec2(e, 0.), t);
  float hy = cloth(p + vec2(0., e), t);
  vec3 n = normalize(vec3((h - hx) / e * .5, (h - hy) / e * .5, 1.));

  vec3 L = normalize(vec3(-.45, .6, .75));
  vec3 H = normalize(L + vec3(0., 0., 1.));
  float diff = clamp(dot(n, L), 0., 1.);
  float ndh = clamp(dot(n, H), 0., 1.);
  float spec = pow(ndh, 110.);
  float sheen = pow(ndh, 8.);

  vec3 deep   = vec3(.42, .02, .06);
  vec3 mid    = vec3(.78, .05, .09);
  vec3 bright = vec3(1.0, .15, .19);
  vec3 gold   = vec3(.92, .62, .16);

  vec3 c = mix(deep, mid, smoothstep(.1, .85, diff));
  c = mix(c, bright, sheen * .7);
  c += gold * (sheen * .05 + spec * .6);

  float r = hash(floor(gl_FragCoord.xy));
  float tw = .5 + .5 * sin(uTime * 2.4 + r * 40.);
  c += gold * step(.992, r) * tw * (.2 + sheen * 1.3) * .8;
  c += vec3(1., .78, .45) * (hash(gl_FragCoord.xy + fract(uTime) * 61.7) - .5) * .05;
  gl_FragColor = vec4(c, 1.);
}`;

let barOn = false;   // the bar's satin is on screen
const kickBar = silk(canvas, FRAG, () => barOn, (gl, prog, scale) => {
  // the hero shows 1.7 cloth units over ~800px; keep the same fold size here
  gl.uniform1f(gl.getUniformLocation(prog, 'uUnit'), (800 * scale) / 1.7);
});

/* full-screen menu: black silk with a red reflection and golden noise, like the footer */

const MENU_FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;

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

  vec3 black = vec3(.012, .004, .006);
  vec3 wine  = vec3(.20, .012, .035);
  vec3 red   = vec3(1., .10, .14);
  vec3 gold  = vec3(.92, .62, .16);

  vec3 c = mix(black, wine, smoothstep(.3, .95, diff) * .4);
  c += red * pow(sheen, 1.6) * .34;
  c += gold * spec * .35;

  float r = hash(floor(gl_FragCoord.xy));
  float tw = .5 + .5 * sin(uTime * 2.4 + r * 40.);
  c += gold * step(.992, r) * tw * (.2 + sheen * 1.3) * .8;
  c += vec3(1., .72, .3) * (hash(gl_FragCoord.xy + fract(uTime) * 61.7) - .5) * .05;
  gl_FragColor = vec4(max(c, 0.), 1.);
}`;

const menuOpen = () => !!menu && !menu.classList.contains('hidden');
const kickMenu = silk(document.getElementById('menu-silk'), MENU_FRAG, menuOpen);
if (menu) new MutationObserver(kickMenu).observe(menu, { attributes: true, attributeFilter: ['class'] });

/* the search sheet wears the same silk */
const searchSheet = document.getElementById('search-dialog');
const kickSearch = silk(document.getElementById('search-silk'), MENU_FRAG, () => !!searchSheet?.open);
if (searchSheet) new MutationObserver(kickSearch).observe(searchSheet, { attributes: true, attributeFilter: ['open'] });


const clearTop = bar?.hasAttribute('data-clear-top');   // home page: see-through over the hero until you scroll
let lastY = scrollY, ticking = false;

function update() {
  ticking = false;
  const y = Math.max(0, scrollY);
  const atTop = y < 8;
  const focusInside = bar.matches(':focus-within') && bar.querySelector(':focus-visible');
  const dy = y - lastY;

  if (atTop || menuOpen() || focusInside || dy < -4) bar.removeAttribute('data-hidden');
  else if (dy > 4 && y > bar.offsetHeight) bar.setAttribute('data-hidden', '');
  if (Math.abs(dy) > 4 || atTop) lastY = y;

  bar.toggleAttribute('data-top', clearTop && atTop);
  const showing = !(clearTop && atTop) && !bar.hasAttribute('data-hidden');
  if (showing !== barOn) { barOn = showing; kickBar(); }
}
function onScroll() {
  if (!ticking) { ticking = true; requestAnimationFrame(update); }
}

if (bar) {
  addEventListener('scroll', onScroll, { passive: true });
  bar.addEventListener('focusin', onScroll);
  update();
}
