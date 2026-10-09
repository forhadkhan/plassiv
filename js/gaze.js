/* Hero model: hover him (mouse), or tap him (touch), and he turns to look at you, Thanos-snap style: the photo breaks
   into dust that blows away while the camera-facing photo forms out of dust flying in. Each ~3px cell of the photo is one
   grain, drawn on the GPU. The grains are the photo's own pixels, so both ends are exactly the two photos. A timeline
   value t (0 = original, 1 = camera-facing) drives everything, so he can change his mind half-way and the dust flows back.
   Without WebGL2, or with reduced motion, it is a plain cross-fade. */

import { afterPaint } from './silk.js';

const hero = document.getElementById('top');
const fig = hero?.querySelector('.hero-float');
const canvas = document.getElementById('hero-gaze');
const base = fig?.querySelector('img');
if (hero && fig && canvas && base && !navigator.connection?.saveData) afterPaint(start);

const W = 900, H = 1254, CELL = 3;   // photo space (the two photos are registered in it), and the size of one grain
const COLS = Math.ceil(W / CELL), ROWS = Math.ceil(H / CELL);
const still = matchMedia('(prefers-reduced-motion: reduce)');

const COMMON = `#version 300 es
precision highp float;
const vec2 PH = vec2(${W}., ${H}.);
const float CELL = ${CELL}., FLY = .34;
float hash(vec2 p){ vec3 q = fract(vec3(p.xyx) * .1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
vec3 rnd(vec2 c){ return vec3(hash(c), hash(c + 17.3), hash(c + 53.1)); }
// the old photo goes first on the right and top and the new one forms first on the left and bottom, so the dust
// streams across him rather than everything happening at once
float sweep(vec2 uv){ return clamp((1. - uv.x) * .78 + uv.y * .22, 0., 1.); }
float leaves(vec2 uv, float h){ return sweep(uv) * .42 + h * .16; }            // when a grain of the old photo lets go
float settles(vec2 uv, float h){ return .42 + (1. - sweep(uv)) * .4 + h * .16; } // when a grain of the new photo lands
const vec2 WIND = vec2(1., -.38);`;

const QUAD_VERT = `#version 300 es
in vec2 p; out vec2 vUv;
void main(){ vUv = vec2(p.x * .5 + .5, .5 - p.y * .5); gl_Position = vec4(p, 0., 1.); }`;

/* the parts of each photo that have not broken up yet, or have already settled */
const QUAD_FRAG = `${COMMON}
uniform sampler2D uTex; uniform float uT, uCalm; uniform int uLayer;
in vec2 vUv; out vec4 o;
void main(){
  vec2 c = floor(vUv * PH / CELL), uvc = (c + .5) * CELL / PH;
  float h = hash(c), vis;
  if (uCalm > .5) vis = uLayer == 0 ? step(uT, .9999) : uT;
  else vis = uLayer == 0 ? step(uT, leaves(uvc, h)) : step(settles(uvc, h), uT);
  o = texture(uTex, vUv) * vis;
}`;

const DUST_VERT = `${COMMON}
uniform sampler2D uTex; uniform float uT, uScale; uniform int uLayer;
out vec4 vCol; out float vDust;
void main(){
  vec2 c = vec2(float(gl_VertexID % ${COLS}), float(gl_VertexID / ${COLS}));
  vec2 uvc = (c + .5) * CELL / PH;
  vec4 s = textureLod(uTex, uvc, 1.5);                                         // premultiplied
  vCol = vec4(0.); vDust = 0.; gl_PointSize = 0.; gl_Position = vec4(2., 2., 2., 1.);
  if (s.a < .35) return;
  vec3 r = rnd(c);
  float d, a, k;                                                               // dust amount, opacity, path position
  if (uLayer == 0) {
    k = clamp((uT - leaves(uvc, r.x)) / FLY, 0., 1.);
    if (k <= 0. || k >= 1.) return;
    d = k; a = 1. - smoothstep(.45, 1., k); k = pow(k, 1.7);
  } else {
    float l = clamp((uT - (settles(uvc, r.x) - FLY)) / FLY, 0., 1.);
    if (l <= 0. || l >= 1.) return;
    d = 1. - l; a = smoothstep(0., .45, l); k = -pow(1. - l, 1.7);              // flies in along the same wind, backwards
  }
  float reach = 120. + 360. * r.y;
  vec2 side = vec2(-WIND.y, WIND.x);
  vec2 off = WIND * reach * k + side * sin(abs(k) * 5. + r.z * 6.283) * 46. * abs(k) + (r.xz - .5) * 36. * abs(k);
  vec2 q = uvc + off / PH;
  gl_Position = vec4(q.x * 2. - 1., 1. - q.y * 2., 0., 1.);
  gl_PointSize = max(1.5, CELL * uScale * (1.4 - .65 * d));
  vec3 col = s.rgb / s.a;
  col = mix(col, vec3(.93, .72, .36), .5 * step(.87, r.z) * d);                // a few grains catch the gold
  vCol = vec4(col, a); vDust = d;
}`;
const DUST_FRAG = `#version 300 es
precision highp float;
in vec4 vCol; in float vDust; out vec4 o;
void main(){
  vec2 q = gl_PointCoord - .5;
  float shape = mix(max(abs(q.x), abs(q.y)) * 2., length(q) * 2., vDust);     // square grains turn into round specks
  float a = vCol.a * (1. - smoothstep(.7, 1., shape));
  o = vec4(vCol.rgb * a, a);
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
    const r = canvas.getBoundingClientRect();
    const x = Math.floor((e.clientX - r.left) / r.width * 90), y = Math.floor((e.clientY - r.top) / r.height * 125);
    return x >= 0 && y >= 0 && x < 90 && y < 125 && alpha[(y * 90 + x) * 4 + 3] > 40;
  };

  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, powerPreference: 'low-power' });
  let paint, live = true;
  if (gl) {
    const program = (vs, fs) => {
      const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
      const pr = gl.createProgram();
      gl.attachShader(pr, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, fs));
      gl.linkProgram(pr);
      return gl.getProgramParameter(pr, gl.LINK_STATUS) ? pr : null;
    };
    const quad = program(QUAD_VERT, QUAD_FRAG), dust = program(DUST_VERT, DUST_FRAG);
    if (!quad || !dust) return;

    const vaoQuad = gl.createVertexArray(), vaoDust = gl.createVertexArray();   // the dust has no attributes: grains come from gl_VertexID
    gl.bindVertexArray(vaoQuad);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(quad, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

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
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    const U = (pr, n) => gl.getUniformLocation(pr, n);
    const qu = { tex: U(quad, 'uTex'), t: U(quad, 'uT'), calm: U(quad, 'uCalm'), layer: U(quad, 'uLayer') };
    const du = { tex: U(dust, 'uTex'), t: U(dust, 'uT'), scale: U(dust, 'uScale'), layer: U(dust, 'uLayer') };
    paint = (t, calm = still.matches) => {
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(quad); gl.bindVertexArray(vaoQuad);
      gl.uniform1f(qu.t, t); gl.uniform1f(qu.calm, calm ? 1 : 0);
      for (let l = 0; l < 2; l++) { gl.uniform1i(qu.tex, l); gl.uniform1i(qu.layer, l); gl.drawArrays(gl.TRIANGLES, 0, 3); }
      if (calm || t <= 0 || t >= 1) return;                                    // at either end it is just the photo
      gl.useProgram(dust); gl.bindVertexArray(vaoDust);
      gl.uniform1f(du.t, t); gl.uniform1f(du.scale, canvas.width / W);
      for (let l = 0; l < 2; l++) { gl.uniform1i(du.tex, l); gl.uniform1i(du.layer, l); gl.drawArrays(gl.POINTS, 0, COLS * ROWS); }
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

  /* the timeline runs at a steady pace towards the target (a gentle ease at each end), so reversing half-way sends the
     dust back the way it came. Becoming the camera-facing photo takes longer than turning back. */
  let x = 0, target = 0, raf = 0, prev = 0, held = false, timer = 0, revert = 0, pend = null;
  const eased = (u) => u * u * (3 - 2 * u) * .55 + u * .45;
  const frame = (now) => {
    raf = 0;
    if (!live || document.hidden) { prev = 0; return; }
    const dt = Math.min(0.05, prev ? (now - prev) / 1000 : 0.016);
    prev = now;
    const dur = still.matches ? .4 : target > x ? 2.1 : 1.5;
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
  new ResizeObserver(() => { if (fig.classList.contains('gaze')) { size(); paint(eased(x)); } }).observe(canvas);
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
      revert = setTimeout(() => { held = false; aim(0); }, 5200);
    } else if (held) {
      held = false;
      aim(0);
    }
  });
}
