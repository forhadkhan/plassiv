/* Hero model: hover him (mouse), or tap him (touch), and he turns to look at you. The photo shatters into a few thousand
   triangles that scatter a little, tumbling in place, and settle again as the camera-facing photo (after Szenia Zadvornykh's
   "THREE Text Animation #5": every face of the mesh flies off on its own axis, delayed by its distance from the centre).
   Every triangle carries its own piece of the photo, so both ends are exactly the two photos. A timeline value t
   (0 = original, 1 = camera-facing) drives everything, so he can change his mind half-way and the shards fly back.
   Without WebGL2 it is a plain cross-fade. The OS reduced-motion setting is deliberately not consulted: this is the
   signature effect of the page, so it plays for everyone. */

import { afterPaint } from './silk.js';

const hero = document.getElementById('top');
const fig = hero?.querySelector('.hero-float');
const canvas = document.getElementById('hero-gaze');
const base = fig?.querySelector('img');
if (hero && fig && canvas && base && !navigator.connection?.saveData) afterPaint(start);

const W = 900, H = 1254;             // photo space (the two photos are registered in it)
const COLS = 150, ROWS = 209;        // the mesh: ~6px cells, two triangles each (micro shards)

/* No attributes: triangle number and corner come from gl_VertexID. Grid nodes are nudged by a hash so the shards are
   irregular, but the nodes are shared, so at rest the mesh is seamless; the border nodes stay put. */
const VERT = `#version 300 es
precision highp float;
const int COLS = ${COLS}, ROWS = ${ROWS};
const vec2 PH = vec2(${W}., ${H}.), CEN = vec2(450., 610.);
uniform float uT;
uniform vec4 uFig;                   // where the photo sits in the canvas (canvas uv: x, y, width, height)
out vec2 vUv; flat out float vNew; out vec3 vLit;

float hash(vec2 p){ vec3 q = fract(vec3(p.xyx) * .1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
vec3 rnd(vec2 c){ return vec3(hash(c), hash(c + 17.3), hash(c + 53.1)); }
vec2 node(ivec2 g){
  vec2 cell = PH / vec2(float(COLS), float(ROWS)), p = vec2(g) * cell;
  if (g.x > 0 && g.y > 0 && g.x < COLS && g.y < ROWS) p += (vec2(hash(vec2(g)), hash(vec2(g) + 9.1)) - .5) * cell * .75;
  return p;
}
ivec2 corner(int s, int k){
  if (s == 0) return k == 0 ? ivec2(0,0) : k == 1 ? ivec2(1,0) : ivec2(0,1);
  if (s == 1) return k == 0 ? ivec2(1,0) : k == 1 ? ivec2(1,1) : ivec2(0,1);
  if (s == 2) return k == 0 ? ivec2(0,0) : k == 1 ? ivec2(1,0) : ivec2(1,1);
  return k == 0 ? ivec2(0,0) : k == 1 ? ivec2(1,1) : ivec2(0,1);
}
vec3 spin(vec3 v, vec3 ax, float a){ return v * cos(a) + cross(ax, v) * sin(a) + ax * dot(ax, v) * (1. - cos(a)); }

void main(){
  int tri = gl_VertexID / 3, k = gl_VertexID % 3, cell = tri / 2, hf = tri % 2;
  ivec2 g = ivec2(cell % COLS, cell / COLS);
  int sub = (hash(vec2(g) + 3.7) > .5 ? 2 : 0) + hf;                        // which way the cell is split, and which half
  vec2 p0 = node(g + corner(sub, 0)), p1 = node(g + corner(sub, 1)), p2 = node(g + corner(sub, 2));
  vec2 mid = (p0 + p1 + p2) / 3., pk = k == 0 ? p0 : k == 1 ? p1 : p2;

  vec3 r = rnd(vec2(float(tri), 1.3));
  // the middle of the photo goes first and the edges follow, close enough together that it reads as one burst
  float delay = (1. - clamp(length((mid - CEN) / (PH * .5)) / 1.15, 0., 1.)) * .14 + r.x * .04;
  float u = clamp((uT - delay) / .84, 0., 1.);
  float a = smoothstep(0., .5, u) - smoothstep(.5, 1., u);                     // 0 at home, 1 at the far end of its flight
  float ang = 6.2832 * (1. + floor(r.y * 2.)) * (r.z < .5 ? -1. : 1.) * smoothstep(0., 1., u);   // whole turns: upright again at home
  vec3 ax = normalize(rnd(vec2(float(tri), 5.9)) * 2. - 1. + .001);

  // where it drifts to: only a short hop from its own place, flat (no depth, no perspective), then it settles as the other photo
  vec2 dir = normalize(mid - CEN + (r.xy - .5) * 60. + .001);
  vec3 away = vec3(mid + dir * (14. + r.x * 40.) + (rnd(vec2(float(tri), 8.1)).xy - .5) * 50., 0.);
  vec3 off = spin(vec3(pk - mid, 0.) * (1. - .45 * a), ax, ang);
  vec3 P = mix(vec3(mid, 0.), away, a) + off;
  vec2 q = P.xy;

  vec3 nrm = spin(vec3(0., 0., 1.), ax, ang);
  vec3 L = normalize(vec3(-.45, .55, .7)), Hh = normalize(L + vec3(0., 0., 1.));
  vLit = vec3(abs(dot(nrm, L)), pow(abs(dot(nrm, Hh)), 28.), smoothstep(0., .25, a));
  vUv = pk / PH;
  vNew = step(.5, u);
  vec2 c = uFig.xy + uFig.zw * (q / PH);
  gl_Position = vec4(c.x * 2. - 1., 1. - c.y * 2., clamp(-P.z / 1400., -.95, .95), 1.);
}`;

const FRAG = `#version 300 es
precision highp float;
uniform sampler2D uA, uB;
in vec2 vUv; flat in float vNew; in vec3 vLit;
out vec4 o;
void main(){
  vec4 t = mix(texture(uA, vUv), texture(uB, vUv), vNew);   // premultiplied
  if (t.a < .02) discard;
  float shade = mix(1., .38 + .95 * vLit.x, vLit.z);                          // flat shading, only once it has left home
  o = vec4(t.rgb * shade + vec3(1., .78, .42) * vLit.y * vLit.z * .6 * t.a, t.a);
}`;

const load = (src) => new Promise((res, rej) => {
  const im = new Image();
  im.decoding = 'async';
  im.onload = () => res(im);
  im.onerror = rej;
  im.src = src;
});

function start() {
  Promise.all([load(base.currentSrc || base.src), load('assets/img/hero-gaze.webp')])
    .then(([side, front]) => run(side, front))
    .catch(() => {});
}

function run(side, front) {
  /* silhouette of the figure, so only his body (not the empty corners of the box) reacts */
  const mask = document.createElement('canvas');
  mask.width = 90; mask.height = 125;
  const mctx = mask.getContext('2d', { willReadFrequently: true });
  mctx.drawImage(side, 0, 0, 90, 125);
  const alpha = mctx.getImageData(0, 0, 90, 125).data;
  const onFigure = (e) => {
    const r = base.getBoundingClientRect();
    const x = Math.floor((e.clientX - r.left) / r.width * 90), y = Math.floor((e.clientY - r.top) / r.height * 125);
    return x >= 0 && y >= 0 && x < 90 && y < 125 && alpha[(y * 90 + x) * 4 + 3] > 40;
  };

  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: true, depth: true, powerPreference: 'low-power' });
  let paint, place = () => {}, live = true;
  if (gl) {
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);
    gl.bindVertexArray(gl.createVertexArray());                                // empty: the triangles come from gl_VertexID

    const tex = (unit, img) => {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    };
    tex(0, side); tex(1, front);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);

    const U = (n) => gl.getUniformLocation(prog, n);
    const uT = U('uT'), uFig = U('uFig');
    gl.uniform1i(U('uA'), 0); gl.uniform1i(U('uB'), 1);
    /* the canvas is larger than the photo, so shards can fly out past his outline: say where the photo sits in it */
    place = () => {
      const c = canvas.getBoundingClientRect(), f = base.getBoundingClientRect();
      gl.uniform4f(uFig, (f.left - c.left) / c.width, (f.top - c.top) / c.height, f.width / c.width, f.height / c.height);
    };
    paint = (t) => {
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0); gl.clearDepth(1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.uniform1f(uT, t);
      gl.drawArrays(gl.TRIANGLES, 0, COLS * ROWS * 6);
    };
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); fig.classList.remove('gaze'); live = false; });
  } else {
    const ctx = canvas.getContext('2d');
    paint = (t) => {
      const c = canvas.getBoundingClientRect(), f = base.getBoundingClientRect(), k = canvas.width / c.width;
      const x = (f.left - c.left) * k, y = (f.top - c.top) * k, w = f.width * k, h = f.height * k;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = 1; ctx.drawImage(side, x, y, w, h);
      ctx.globalAlpha = Math.min(1, Math.max(0, t)); ctx.drawImage(front, x, y, w, h);
    };
  }

  const size = () => {
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    const w = Math.max(2, Math.round(canvas.clientWidth * dpr)), h = Math.max(2, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    place();
  };

  /* the timeline runs at an almost steady pace towards the target, so reversing half-way sends the shards back the way
     they came. Becoming the camera-facing photo takes longer than turning back. */
  let x = 0, target = 0, raf = 0, prev = 0, held = false, timer = 0, revert = 0, pend = null;
  const eased = (u) => u * u * (3 - 2 * u) * .3 + u * .7;
  const frame = (now) => {
    raf = 0;
    if (!live || document.hidden) { prev = 0; return; }
    const dt = Math.min(0.05, prev ? (now - prev) / 1000 : 0.016);
    prev = now;
    const dur = target > x ? 1.1 : .9;
    x = target > x ? Math.min(target, x + dt / dur) : Math.max(target, x - dt / dur);
    paint(eased(x));
    if (x === target) {
      prev = 0;
      if (x === 0) fig.classList.remove('gaze');   // back at rest: the plain photo takes over again
    } else raf = requestAnimationFrame(frame);
  };
  const aim = (to) => {
    target = to;
    if (to && !fig.classList.contains('gaze')) { size(); paint(eased(x)); fig.classList.add('gaze'); }
    if (!raf) raf = requestAnimationFrame(frame);
  };
  /* a short pause before reacting (a cursor that only crosses him shouldn't make him vanish) and before looking away */
  const want = (to, delay) => {
    if (to === pend) return;
    clearTimeout(timer); pend = null;
    if (to === target) return;
    pend = to;
    timer = setTimeout(() => { pend = null; aim(to); }, delay);
  };

  size(); paint(0);   // warm up the GPU now, while the canvas is still invisible, so the first hover doesn't hitch
  const ro = new ResizeObserver(() => { if (fig.classList.contains('gaze')) { size(); paint(eased(x)); } });
  ro.observe(canvas); ro.observe(base);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && !raf && x !== target) raf = requestAnimationFrame(frame); });

  const interactive = (e) => e.target.closest?.('a, button, input, [role=button]');
  hero.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || held) return;
    const on = onFigure(e) && !interactive(e);
    want(on ? 1 : 0, on ? 70 : 320);
  }, { passive: true });
  hero.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && !held) want(0, 320); });

  /* touch: a tap on him makes him look at you, and he looks away after a few seconds, or on the next tap.
     A mouse click does the same instantly, without waiting for the hover pause. */
  let down = null;
  hero.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
  hero.addEventListener('pointercancel', () => { down = null; });
  hero.addEventListener('pointerup', (e) => {
    const d = down; down = null;
    if (!d || interactive(e) || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 12 || performance.now() - d.t > 600) return;
    clearTimeout(revert); clearTimeout(timer); pend = null;
    if (e.pointerType === 'mouse') { if (onFigure(e)) aim(1); return; }
    if (onFigure(e) && !held) {
      held = true;
      aim(1);
      revert = setTimeout(() => { held = false; aim(0); }, 6200);
    } else if (held) {
      held = false;
      aim(0);
    }
  });
}
