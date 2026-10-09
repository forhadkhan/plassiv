/* Hero: live dark red / bright red satin mesh with golden sparkle noise (WebGL) and the PLASSIV wordmark as white gel with drifting gold flecks (2D canvas). */

import { afterPaint } from './silk.js';

const header = document.getElementById('top');
const meshCanvas = document.getElementById('hero-mesh');
const wordWrap = document.getElementById('hero-word');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

let inView = true;
const tickers = new Set();
let raf = 0;

// reduced-motion visitors still get the hero, just at a much slower drift
let clock = performance.now() / 1000, prev = 0;
function loop(now) {
  raf = 0;
  if (!inView || document.hidden) { prev = 0; return; }
  const t = now / 1000;
  clock += (prev ? Math.min(0.05, t - prev) : 0) * (reduceMotion.matches ? 0.6 : 1);
  prev = t;
  tickers.forEach((fn) => fn(clock));
  raf = requestAnimationFrame(loop);
}
function kick() {
  if (!raf && inView && !document.hidden) raf = requestAnimationFrame(loop);
}
if ('IntersectionObserver' in window) {
  new IntersectionObserver(([e]) => { inView = e.isIntersecting; kick(); }).observe(header);
}
document.addEventListener('visibilitychange', kick);


const VERT = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;

float hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }

// flowing cloth: a few warped sine swells make a smooth height field
float cloth(vec2 p, float t){
  p += .55 * vec2(sin(p.y * 1.3 + t * .9) + .5 * sin(p.y * 2.9 - t * 1.3), cos(p.x * 1.1 - t * .8) + .5 * cos(p.x * 2.3 + t * 1.1));
  float h = sin(p.x * 1.9 + p.y * .9 + t) * .55;
  h += sin(p.x * 1.1 - p.y * 1.7 - t * .8 + h * 1.6) * .35;
  h += sin(p.x * 3.1 + p.y * 2.3 + t * .6 + h * 2.) * .14;
  return h;
}

void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 p = uv * vec2(uRes.x / uRes.y, 1.) * 1.7;
  float t = uTime * .35;

  float e = .012;
  float h  = cloth(p, t);
  float hx = cloth(p + vec2(e, 0.), t);
  float hy = cloth(p + vec2(0., e), t);
  vec3 n = normalize(vec3((h - hx) / e * .5, (h - hy) / e * .5, 1.));

  vec3 L = normalize(vec3(-.45, .6, .75));
  vec3 V = vec3(0., 0., 1.);
  vec3 H = normalize(L + V);
  float diff = clamp(dot(n, L), 0., 1.);
  float spec = pow(clamp(dot(n, H), 0., 1.), 110.);       // tight satin glint
  float sheen = pow(clamp(dot(n, H), 0., 1.), 8.);       // broad soft sheen

  vec3 deep   = vec3(.42, .02, .06);
  vec3 mid    = vec3(.78, .05, .09);
  vec3 bright = vec3(1.0, .15, .19);
  vec3 gold   = vec3(.92, .62, .16);

  vec3 c = mix(deep, mid, smoothstep(.1, .85, diff));
  c = mix(c, bright, sheen * .7);
  c += gold * (sheen * .05 + spec * .6);

  // light vignette keeps the bottom copy readable
  float v = smoothstep(1.35, .3, distance(uv, vec2(.5, .6)));
  c *= mix(.9, 1., v);

  // golden noise: tiny sparkles that twinkle, brighter where the cloth catches the light
  float r = hash(floor(gl_FragCoord.xy));
  float tw = .5 + .5 * sin(uTime * 2.4 + r * 40.);
  c += gold * step(.992, r) * tw * (.2 + sheen * 1.3) * .8;

  c += vec3(1., .78, .45) * (hash(gl_FragCoord.xy + fract(uTime) * 61.7) - .5) * .05;
  gl_FragColor = vec4(c, 1.);
}`;

function startMesh(canvas) {
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
  if (!gl) return;
  const sh = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
  };
  const vs = sh(gl.VERTEX_SHADER, VERT), fs = sh(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return;
  const prog = gl.createProgram();
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const uRes = gl.getUniformLocation(prog, 'uRes'), uTime = gl.getUniformLocation(prog, 'uTime');

  // the mesh is smooth, so half resolution is plenty and keeps the GPU cost low
  const SCALE = 0.5;
  const size = () => {
    canvas.width = Math.max(2, Math.round(canvas.clientWidth * SCALE));
    canvas.height = Math.max(2, Math.round(canvas.clientHeight * SCALE));
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(uRes, canvas.width, canvas.height);
  };
  const draw = (t) => { gl.uniform1f(uTime, t); gl.drawArrays(gl.TRIANGLES, 0, 3); };

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); tickers.delete(draw); canvas.hidden = true; });
  size();
  draw(clock);
  tickers.add(draw);
  new ResizeObserver(() => { size(); draw(clock); }).observe(canvas);
  kick();
}


const WORD = 'PLASSIV';
const LIGHT = (() => { const l = [-0.5, -0.62, 0.6]; const n = Math.hypot(...l); return l.map((v) => v / n); })();
const HALF = (() => { const h = [LIGHT[0], LIGHT[1], LIGHT[2] + 1]; const n = Math.hypot(...h); return h.map((v) => v / n); })();

function boxBlur(src, w, h, r, out) {
  // separable running-sum blur, edges clamped; src and out are Float32Array(w*h)
  const tmp = new Float32Array(w * h);
  const norm = 1 / (2 * r + 1);
  for (let y = 0; y < h; y++) {
    const o = y * w;
    let sum = src[o] * (r + 1);
    for (let i = 0; i < r; i++) sum += src[o + Math.min(i, w - 1)];
    for (let x = 0; x < w; x++) {
      sum += src[o + Math.min(x + r, w - 1)] - src[o + Math.max(x - r - 1, 0)];
      tmp[o + x] = sum * norm;
    }
  }
  for (let x = 0; x < w; x++) {
    let sum = tmp[x] * (r + 1);
    for (let i = 0; i < r; i++) sum += tmp[Math.min(i, h - 1) * w + x];
    for (let y = 0; y < h; y++) {
      sum += tmp[Math.min(y + r, h - 1) * w + x] - tmp[Math.max(y - r - 1, 0) * w + x];
      out[y * w + x] = sum * norm;
    }
  }
}

function smooth(src, w, h, r) {
  const a = new Float32Array(w * h), b = new Float32Array(w * h);
  boxBlur(src, w, h, r, a); boxBlur(a, w, h, r, b); boxBlur(b, w, h, r, a);
  return a;
}

/* Renders the gel letters once (mask → height map → lit pixels) and returns what the animation needs. */
function buildGel(cssWidth) {
  const dpr = Math.min(devicePixelRatio || 1, 1.5);
  const W = Math.min(Math.round(cssWidth * dpr), 1800);
  const pad = Math.round(W * 0.02);

  const probe = document.createElement('canvas').getContext('2d');
  probe.font = '400 100px Regione';
  const m = probe.measureText(WORD);
  const fs = (100 * (W - 2 * pad)) / m.width;
  const SY = 1;
  const asc = m.actualBoundingBoxAscent * fs / 100, desc = m.actualBoundingBoxDescent * fs / 100;
  const H = Math.round((asc + desc) * SY + 2 * pad);

  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = W; maskCanvas.height = H;
  const mctx = maskCanvas.getContext('2d', { willReadFrequently: true });
  mctx.fillStyle = '#fff';
  mctx.font = `400 ${fs}px Regione`;
  mctx.textBaseline = 'alphabetic';
  mctx.setTransform(1, 0, 0, SY, pad, pad + asc * SY);
  mctx.fillText(WORD, 0, 0);
  const md = mctx.getImageData(0, 0, W, H).data;

  const alpha = new Float32Array(W * H);
  for (let i = 0; i < alpha.length; i++) alpha[i] = md[i * 4 + 3] / 255;

  // pillow-shaped height map: tight blur for the bevel plus a wide one for the swell
  const rTight = Math.max(2, Math.round(fs * 0.018)), rWide = Math.max(4, Math.round(fs * 0.045));
  const h1 = smooth(alpha, W, H, rTight), h2 = smooth(alpha, W, H, rWide);
  const height = new Float32Array(W * H);
  for (let i = 0; i < height.length; i++) height[i] = (0.45 * h1[i] + 0.55 * h2[i]) * alpha[i];

  const strength = fs * 0.03;
  const out = new ImageData(W, H);
  const px = out.data;
  const top = [255, 255, 255], bottom = [255, 250, 242], edgeRed = [190, 28, 40];
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      const a = alpha[i];
      if (a === 0) continue;
      const dx = (height[i + 1] - height[i - 1]) * strength;
      const dy = (height[i + W] - height[i - W]) * strength;
      const inv = 1 / Math.hypot(dx, dy, 1);
      const nx = -dx * inv, ny = -dy * inv, nz = inv;
      const diff = Math.max(0, nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]);
      const spec = Math.pow(Math.max(0, nx * HALF[0] + ny * HALF[1] + nz * HALF[2]), 70);
      const back = Math.max(0, -(nx * LIGHT[0] + ny * LIGHT[1])) ;      // light bleeding through the gel toward the far edge
      const rim = Math.pow(1 - nz, 1.6);
      const gy = Math.min(1, Math.max(0, (y - pad) / (H - 2 * pad)));
      const shade = 1.0 + 0.1 * diff;
      for (let c = 0; c < 3; c++) {
        let v = (top[c] + (bottom[c] - top[c]) * gy) * shade;
        v += back * 5 + spec * 255 * 0.3;
        v = v * (1 - rim * 0.04) + edgeRed[c] * rim * 0.04;
        px[i * 4 + c] = Math.min(255, v);
      }
      px[i * 4 + 3] = Math.round(a * 255);
    }
  }
  const base = document.createElement('canvas');
  base.width = W; base.height = H;
  base.getContext('2d').putImageData(out, 0, 0);

  // places inside the letters where a fleck may be born
  const spots = [];
  for (let tries = 0; spots.length < 1500 && tries < 60000; tries++) {
    const x = (Math.random() * W) | 0, y = (Math.random() * H) | 0;
    if (height[y * W + x] > 0.35) spots.push(x, y);
  }
  return { base, W, H, spots, dpr };
}

function makeFleck(size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255,244,196,1)');
  grad.addColorStop(0.25, 'rgba(236,190,84,1)');
  grad.addColorStop(0.6, 'rgba(196,146,42,.55)');
  grad.addColorStop(1, 'rgba(196,146,42,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return c;
}

function startGel(wrap) {
  const canvas = wrap.querySelector('canvas');
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext('2d');
  const fleck = makeFleck(32);
  let gel = null, flecks = [], sweepT0 = 0, last = 0;

  const spawn = (f, now, first) => {
    const s = gel.spots, k = ((Math.random() * (s.length / 2)) | 0) * 2;
    f.x = s[k]; f.y = s[k + 1];
    f.size = (0.4 + Math.pow(Math.random(), 2) * 1.1) * gel.dpr;
    f.life = 3 + Math.random() * 6;
    f.born = now - (first ? Math.random() * f.life : 0);
    f.phase = Math.random() * 6.28;
    f.speed = (20 + Math.random() * 44) * gel.dpr * (0.7 + f.size / (3 * gel.dpr));
  };

  const frame = (now) => {
    if (!gel) return;
    const { W, H } = gel;
    const dt = last ? Math.min(0.05, now - last) : 1 / 60;
    last = now;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(gel.base, 0, 0);
    ctx.globalCompositeOperation = 'source-atop';

    for (const f of flecks) {
      let age = (now - f.born) / f.life;
      if (age >= 1) { spawn(f, now, false); age = 0; }
      const ang = Math.sin(f.x * 0.006 + now * 0.7 + f.phase) * 2.6 + Math.cos(f.y * 0.008 - now * 0.55) * 2.6;
      f.x += Math.cos(ang) * f.speed * dt;
      f.y += Math.sin(ang) * f.speed * dt;
      const fade = Math.sin(Math.PI * age);
      const twinkle = 0.45 + 0.55 * Math.sin(now * 4.2 + f.phase * 3);
      ctx.globalAlpha = Math.min(1, fade * twinkle * 1.15);
      const s = f.size * 2.4;
      ctx.drawImage(fleck, f.x - s / 2, f.y - s / 2, s, s);
    }

    // slow diagonal sheen
    const cycle = 6, p = ((now - sweepT0) % cycle) / cycle;
    if (p < 0.38) {
      const k = p / 0.38, bw = W * 0.16, x0 = -bw + (W + bw * 2 + H * 0.4) * k;
      ctx.save();
      ctx.transform(1, 0, -0.4, 1, 0, 0);
      const g = ctx.createLinearGradient(x0, 0, x0 + bw, 0);
      g.addColorStop(0, 'rgba(255,248,226,0)');
      g.addColorStop(0.5, 'rgba(255,248,226,.5)');
      g.addColorStop(1, 'rgba(255,248,226,0)');
      ctx.globalAlpha = 1;
      ctx.fillStyle = g;
      ctx.fillRect(x0, 0, bw, H);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  };

  const build = () => {
    const w = wrap.clientWidth;
    if (w < 50) return;
    gel = buildGel(w);
    canvas.width = gel.W; canvas.height = gel.H;
    const count = Math.round(Math.min(480, 220 + gel.W / 4));
    flecks = Array.from({ length: count }, () => { const f = {}; spawn(f, clock, true); return f; });
    wrap.dataset.ready = '';
    frame(clock);
  };

  tickers.add(frame);
  let timer = 0, lastW = 0;
  new ResizeObserver(() => {
    const w = wrap.clientWidth;
    if (w === lastW) return;
    lastW = w;
    clearTimeout(timer);
    timer = setTimeout(build, gel ? 180 : 0);
  }).observe(wrap);
  kick();
}

afterPaint(() => {
  startMesh(meshCanvas);
  Promise.race([document.fonts.load('400 100px Regione'), new Promise((r) => setTimeout(r, 2500))])
    .then(() => startGel(wordWrap));
});

/* pointer parallax: --px/--py in -1..1 on the hero, eased, only while the pointer is over it */
const heroEl = document.getElementById('top');
if (heroEl && matchMedia('(hover: hover) and (prefers-reduced-motion: no-preference)').matches) {
  let tx = 0, ty = 0, x = 0, y = 0, raf = 0;
  const step = () => {
    x += (tx - x) * 0.06;
    y += (ty - y) * 0.06;
    heroEl.style.setProperty('--px', x.toFixed(3));
    heroEl.style.setProperty('--py', y.toFixed(3));
    raf = Math.abs(tx - x) + Math.abs(ty - y) > 0.002 ? requestAnimationFrame(step) : 0;
  };
  const go = () => { if (!raf) raf = requestAnimationFrame(step); };
  heroEl.addEventListener('pointermove', (e) => {
    const r = heroEl.getBoundingClientRect();
    tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
    ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
    go();
  }, { passive: true });
  heroEl.addEventListener('pointerleave', () => { tx = ty = 0; go(); });
}
