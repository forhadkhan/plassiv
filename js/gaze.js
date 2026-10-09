/* Hero model: hover him (mouse), or tap him (touch), and he turns from the side to look straight at you.
   The two photos are morphed, not cross-faded: scripts/bake-gaze.py bakes a displacement map that carries every
   pixel of the side photo to its place in the frontal one, so the head really rotates. A spring drives the turn,
   which keeps it smooth when the pointer comes and goes mid-way. Without WebGL2 it falls back to a plain cross-fade. */

import { afterPaint } from './silk.js';

const hero = document.getElementById('top');
const fig = hero?.querySelector('.hero-float');
const canvas = document.getElementById('hero-gaze');
const base = fig?.querySelector('img');
if (hero && fig && canvas && base && !navigator.connection?.saveData) afterPaint(start);

const W = 900, H = 1254;   // the photo space the maps are baked in
const still = matchMedia('(prefers-reduced-motion: reduce)');
const ease = (a, b, x) => { x = Math.min(1, Math.max(0, (x - a) / (b - a))); return x * x * (3 - 2 * x); };

const VERT = `#version 300 es
in vec2 p; out vec2 vUv;
void main(){ vUv = vec2(p.x * .5 + .5, .5 - p.y * .5); gl_Position = vec4(p, 0., 1.); }`;
const FRAG = `#version 300 es
precision highp float;
uniform sampler2D uSide, uFront, uFlow;
uniform float uA, uB, uM;
in vec2 vUv; out vec4 o;
// the flow map holds two fields stacked: side -> front on the top half, front -> side on the bottom half
vec2 flow(float half_, vec2 uv){
  vec2 q = vec2(uv.x, clamp(uv.y, .004, .996) * .5 + half_ * .5);
  return (texture(uFlow, q).rg * 255. - 128.) * .5 / vec2(${W}., ${H}.);
}
void main(){
  vec4 a = texture(uSide,  vUv - uA * flow(0., vUv));
  vec4 b = texture(uFront, vUv - uB * flow(1., vUv));
  vec4 c = a * (1. - uM) + b * uM;
  // half-way the two outlines must read as one solid head, not two ghosts: take the union of their coverage
  float k = 4. * uM * (1. - uM); k *= k;
  float al = mix(c.a, max(a.a, b.a), k);
  o = vec4(c.rgb / max(c.a, 1e-4) * al, al);
}`;

const load = (src) => new Promise((res, rej) => {
  const im = new Image();
  im.decoding = 'async';
  im.onload = () => res(im);
  im.onerror = rej;
  im.src = src;
});

function start() {
  Promise.all([load(base.currentSrc || base.src), load('assets/img/hero-gaze.webp'), load('assets/img/hero-gaze-flow.png')])
    .then(([side, front, flow]) => run(side, front, flow))
    .catch(() => {});
}

function run(side, front, flow) {
  /* silhouette of the figure, so only his body (not the empty corners of the box) reacts */
  const mask = document.createElement('canvas');
  mask.width = 90; mask.height = 125;
  const mctx = mask.getContext('2d', { willReadFrequently: true });
  mctx.drawImage(side, 0, 0, 90, 125);
  const alpha = mctx.getImageData(0, 0, 90, 125).data;
  const onFigure = (e) => {
    const r = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - r.left) / r.width * 90), y = Math.floor((e.clientY - r.top) / r.height * 125);
    return x >= 0 && y >= 0 && x < 90 && y < 125 && alpha[(y * 90 + x) * 4 + 3] > 40;
  };

  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, powerPreference: 'low-power' });
  let paint;
  if (gl) {
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const tex = (unit, img, mips, premultiply) => {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, premultiply);
      gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, premultiply ? gl.BROWSER_DEFAULT_WEBGL : gl.NONE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      if (mips) gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mips ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    };
    tex(0, side, true, true); tex(1, front, true, true); tex(2, flow, false, false);
    gl.uniform1i(gl.getUniformLocation(prog, 'uSide'), 0);
    gl.uniform1i(gl.getUniformLocation(prog, 'uFront'), 1);
    gl.uniform1i(gl.getUniformLocation(prog, 'uFlow'), 2);
    const uA = gl.getUniformLocation(prog, 'uA'), uB = gl.getUniformLocation(prog, 'uB'), uM = gl.getUniformLocation(prog, 'uM');
    paint = (t, calm = still.matches) => {
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      // each photo is warped toward the other; with reduced motion neither is, and it is a plain blend
      gl.uniform1f(uA, calm ? 0 : Math.min(t, 1.04));
      gl.uniform1f(uB, calm ? 0 : Math.max(0, 1 - t));
      gl.uniform1f(uM, calm ? Math.min(1, Math.max(0, t)) : ease(.18, .82, t));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); fig.classList.remove('gaze'); live = false; });
  } else {
    const ctx = canvas.getContext('2d');
    paint = (t) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = 1; ctx.drawImage(side, 0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = Math.min(1, Math.max(0, t)); ctx.drawImage(front, 0, 0, canvas.width, canvas.height);
    };
  }

  const size = () => {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const w = Math.max(2, Math.round(canvas.clientWidth * dpr)), h = Math.max(2, Math.round(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  };

  /* spring: x follows target. Looking at you is quick with a small settle; looking away is slower and calmer */
  let live = true, x = 0, v = 0, target = 0, raf = 0, prev = 0, held = false, timer = 0, revert = 0, pend = null;
  const frame = (now) => {
    raf = 0;
    if (!live || document.hidden) { prev = 0; return; }
    const dt = Math.min(0.033, prev ? (now - prev) / 1000 : 0.016);
    prev = now;
    const look = target > x;
    const k = still.matches ? 420 : look ? 150 : 52, zeta = still.matches ? 1 : look ? 0.74 : 1;
    v += (k * (target - x) - 2 * zeta * Math.sqrt(k) * v) * dt;
    x += v * dt;
    if (Math.abs(target - x) < 0.0015 && Math.abs(v) < 0.01) { x = target; v = 0; }
    paint(x);
    if (x === target && v === 0) {
      prev = 0;
      if (x === 0) fig.classList.remove('gaze');   // back at rest: the plain photo takes over again
    } else raf = requestAnimationFrame(frame);
  };
  const aim = (to) => {
    target = to;
    if (to && !fig.classList.contains('gaze')) { size(); paint(x); fig.classList.add('gaze'); }
    if (!raf) raf = requestAnimationFrame(frame);
  };
  /* a short pause before turning (a cursor that only crosses him shouldn't make him flinch) and before looking away */
  const want = (to, delay) => {
    if (to === pend) return;
    clearTimeout(timer); pend = null;
    if (to === target) return;
    pend = to;
    timer = setTimeout(() => { pend = null; aim(to); }, delay);
  };

  new ResizeObserver(() => { if (fig.classList.contains('gaze')) { size(); paint(x); } }).observe(canvas);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && !raf && x !== target) raf = requestAnimationFrame(frame); });

  const interactive = (e) => e.target.closest?.('a, button, input, [role=button]');
  hero.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || held) return;
    want(onFigure(e) && !interactive(e) ? 1 : 0, onFigure(e) && !interactive(e) ? 70 : 240);
  }, { passive: true });
  hero.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && !held) want(0, 240); });

  /* touch: a tap on him makes him look at you, and he looks away after a few seconds, or on the next tap */
  let down = null;
  hero.addEventListener('pointerdown', (e) => { down = e.pointerType === 'mouse' ? null : { x: e.clientX, y: e.clientY, t: performance.now() }; });
  hero.addEventListener('pointercancel', () => { down = null; });
  hero.addEventListener('pointerup', (e) => {
    const d = down; down = null;
    if (!d || interactive(e) || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 12 || performance.now() - d.t > 600) return;
    clearTimeout(revert); clearTimeout(timer); pend = null;
    if (onFigure(e) && !held) {
      held = true;
      aim(1);
      revert = setTimeout(() => { held = false; aim(0); }, 3600);
    } else if (held) {
      held = false;
      aim(0);
    }
  });
}
