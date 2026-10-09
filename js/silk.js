/* Shared WebGL helper: draws one full-canvas fragment shader at half resolution, only while isOn() says so.
   The GL context is created lazily, on the first kick() that finds isOn() true, so nothing competes with first paint. */

const VERT = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

export function afterPaint(fn) {
  const run = () => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 1500 }) : setTimeout(fn, 200));
  if (document.readyState === 'complete') run(); else addEventListener('load', run, { once: true });
}

export function silk(canvas, frag, isOn, onSize) {
  if (!canvas) return () => {};
  let started = false, loopKick = () => {};

  const init = () => {
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
    if (!gl) return;
    const sh = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
    };
    const vs = sh(gl.VERTEX_SHADER, VERT), fs = sh(gl.FRAGMENT_SHADER, frag);
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

    const SCALE = 0.5;
    const size = () => {
      canvas.width = Math.max(2, Math.round(canvas.clientWidth * SCALE));
      canvas.height = Math.max(2, Math.round(canvas.clientHeight * SCALE));
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uRes, canvas.width, canvas.height);
      if (onSize) onSize(gl, prog, SCALE);
    };

    let raf = 0, prev = 0, clock = performance.now() / 1000;
    const draw = () => { gl.uniform1f(uTime, clock); gl.drawArrays(gl.TRIANGLES, 0, 3); };
    const loop = (now) => {
      raf = 0;
      if (!isOn() || document.hidden) { prev = 0; return; }
      const t = now / 1000;
      clock += (prev ? Math.min(0.05, t - prev) : 0) * (reduceMotion.matches ? 0.6 : 1);
      prev = t;
      draw();
      raf = requestAnimationFrame(loop);
    };
    loopKick = () => { if (!raf && isOn() && !document.hidden) raf = requestAnimationFrame(loop); };

    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); canvas.hidden = true; });
    size();
    draw();
    new ResizeObserver(() => { size(); draw(); }).observe(canvas);
    document.addEventListener('visibilitychange', loopKick);
    loopKick();
  };

  return () => {
    if (!started && isOn()) { started = true; init(); }
    loopKick();
  };
}
