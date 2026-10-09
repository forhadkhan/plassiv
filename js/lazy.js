/* Lazy, sequential images. Below-the-fold <img>s carry data-src / data-srcset (scripts/build-html.py swaps them in) and
   start from a blank pixel. They load as they near the viewport, nearest first, a few at a time. How many depends on
   how fast loads really are (the connection API is not in every browser), so a slow link finishes the picture being
   looked at before it starts on one further away. */
(() => {
  const conn = navigator.connection;
  const lean = conn?.saveData || /^(slow-)?2g$/.test(conn?.effectiveType ?? '');
  let limit = lean ? 1 : 2;                       // how many load at once; widened or narrowed by how fast loads actually are
  const margin = lean ? 150 : 400;               // px beyond the viewport at which an image joins the queue
  const reach = margin * 2;                      // px from the viewport (either axis) up to which a queued image may start
  const pending = new Set();
  const rails = new Map();                       // sideways scrollers waiting to come into view -> their images
  let active = 0;

  /* px between the viewport and the image (0 when any part is visible) */
  const away = (img) => {
    const r = img.getBoundingClientRect();
    return Math.max(0, -r.right, r.left - innerWidth) + Math.max(0, -r.bottom, r.top - innerHeight);
  };

  /* An observer cannot see past the edge of a scroller, so for images inside a sideways one (a swipeable track) the
     scroller is what gets watched, and the images behind its edge are queued by distance instead. */
  const railOf = (img) => {
    for (let el = img.parentElement; el && el !== document.body; el = el.parentElement) {
      if (/auto|scroll/.test(getComputedStyle(el).overflowX) && el.scrollWidth > el.clientWidth + 1) return el;
    }
    return null;
  };

  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      io.unobserve(e.target);
      if (rails.has(e.target)) {
        rails.get(e.target).forEach((img) => pending.add(img));
        rails.delete(e.target);
        e.target.dataset.railLive = '1';
      }
      else pending.add(e.target);
    }
    pump();
  }, { rootMargin: `${margin}px` });

  function pump() {
    if (active >= limit || !pending.size) return;
    const near = [...pending].map((img) => [img, away(img)]).filter(([, d]) => d <= reach)
      .sort((a, b) => a[1] - b[1] || (a[0].compareDocumentPosition(b[0]) & 4 ? -1 : 1));
    for (const [img] of near) {
      if (active >= limit) break;
      pending.delete(img);
      fetchImage(img);
    }
  }

  function fetchImage(img) {
    const { src, srcset } = img.dataset;
    if (!src) return;
    active++;
    const began = performance.now();
    const end = (ok) => {
      img.onload = img.onerror = null;
      active--;
      if (!lean) {                                     // go by what loads really cost
        const took = performance.now() - began;
        limit = !ok || took > 1500 ? 1 : took < 500 ? Math.min(4, limit + 1) : limit;
      }
      if (ok) {
        img.dataset.loaded = src;
        if (img.dataset.src === src) { delete img.dataset.src; delete img.dataset.srcset; }
        img.classList.add('is-loaded');
      } else if ((img._tries = (img._tries ?? 0) + 1) <= 2) {
        setTimeout(() => { pending.add(img); pump(); }, 2000 * img._tries);      // flaky link: try again, a little later each time
      }
      pump();
    };
    img.onload = () => end(true);
    img.onerror = () => end(false);
    if (srcset) img.srcset = srcset;
    img.src = src;
  }

  function watch(img) {
    const rail = railOf(img);
    if (!rail) { io.observe(img); return; }
    if (rails.has(rail)) rails.get(rail).add(img);
    else if (!rail.dataset.railLive) { rails.set(rail, new Set([img])); io.observe(rail); }
    else { pending.add(img); pump(); }
  }

  /* images wait for the reader to get near: re-check as the page or any scroller moves */
  let frame = 0;
  addEventListener('scroll', () => {
    if (!pending.size || frame) return;
    frame = requestAnimationFrame(() => { frame = 0; pump(); });
  }, { capture: true, passive: true });

  /* for images that scripts create or re-point after the page has loaded */
  window.seqImg = (img, src, srcset) => {
    if (img.dataset.loaded === src) return;
    img.dataset.src = src;
    if (srcset) img.dataset.srcset = srcset; else delete img.dataset.srcset;
    watch(img);
  };

  document.querySelectorAll('img[data-src]').forEach(watch);
})();
