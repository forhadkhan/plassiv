(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const menuBtn = $('#menu-btn'), menu = $('#mobile-menu');
  const setMenu = (open) => {
    menu.classList.toggle('hidden', !open);
    document.documentElement.classList.toggle('overflow-hidden', open);
    $('[data-open]', menuBtn).classList.toggle('hidden', open);
    $('[data-close]', menuBtn).classList.toggle('hidden', !open);
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  };
  menuBtn.addEventListener('click', () => setMenu(menu.classList.contains('hidden')));
  $$('a', menu).forEach((a) => a.addEventListener('click', () => setMenu(false)));
  addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });
  matchMedia('(min-width: 48rem)').addEventListener('change', (e) => { if (e.matches) setMenu(false); });

  const revealEls = $$('.reveal');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add('in'));
  }

  $$('.wish').forEach((b) => b.addEventListener('click', () => {
    b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true'));
  }));

  /* product track: arrows scroll it; "View all" lays every product out as a grid instead */
  if ($('#prod-track')) {
    const track = $('#prod-track'), prev = $('#prod-prev'), next = $('#prod-next'), all = $('#prod-all');
    const syncArrows = () => {
      const max = track.scrollWidth - track.clientWidth - 2;
      const flat = track.classList.contains('is-all');
      prev.disabled = flat || track.scrollLeft <= 2;
      next.disabled = flat || max <= 0 || track.scrollLeft >= max;
    };
    const step = () => (track.firstElementChild?.getBoundingClientRect().width ?? 300) + 24;
    prev.addEventListener('click', () => track.scrollBy({ left: -step(), behavior: 'smooth' }));
    next.addEventListener('click', () => track.scrollBy({ left: step(), behavior: 'smooth' }));
    all.addEventListener('click', () => {
      const open = track.classList.toggle('is-all');
      track.scrollLeft = 0;
      all.setAttribute('aria-expanded', String(open));
      all.textContent = open ? 'Show less' : 'View all';
      $$('.reveal', track).forEach((el) => el.classList.add('in'));
      syncArrows();
    });
    track.addEventListener('scroll', syncArrows, { passive: true });
    addEventListener('resize', syncArrows);
    syncArrows();
  }

  /* testimonials (index only) */
  if ($('#t-figure')) {
    const T = [
      { name: 'Daniel Brooks', img: 'assets/img/t1.jpg', quote: '“The blazer fits like it was tailored for me. I wore it to a wedding and got compliments all night. Easily my best purchase this year.”' },
      { name: 'James Carter', img: 'assets/img/t2.jpg', quote: '“I’m truly impressed with the quality and perfect fit. The fabric feels premium, and I’ve received countless compliments wearing it. Amazing value for the price — I’ll definitely shop here again.”' },
      { name: 'Ryan Mitchell', img: 'assets/img/t3.jpg', quote: '“Fast delivery, great packaging, and the denim jacket feels even better in person. Plassiv is now my go-to for everyday style.”' },
    ];
    const slot = { prev: $('[data-t-slot=prev]'), current: $('[data-t-slot=current]'), next: $('[data-t-slot=next]') };
    const fig = $('#t-figure');
    const proto = $('[data-t-slide]', fig);
    const slides = T.map((t) => {
      const el = proto.cloneNode(true);
      // the big gold mark above the quote stands in for the quotation marks
      $('[data-t-quote]', el).textContent = t.quote.replace(/^[“"]|[”"]$/g, '');
      $('[data-t-name]', el).textContent = t.name;
      return el;
    });
    proto.replaceWith(...slides);
    let i = 1;
    const wrap = (n) => (n + T.length) % T.length;
    const paint = (el, t) => { const im = $('img', el); im.src = t.img; im.alt = t.name; };
    const render = () => {
      paint(slot.prev, T[wrap(i - 1)]); paint(slot.current, T[i]); paint(slot.next, T[wrap(i + 1)]);
      slides.forEach((el, n) => {
        const on = n === i;
        el.classList.toggle('opacity-0', !on); el.classList.toggle('invisible', !on); el.setAttribute('aria-hidden', String(!on));
      });
    };
    /* autoplay: the gold ring around the next button is the timer (CSS animation), and its end advances the slide.
       It pauses while the pointer or focus is in the section, or the section / tab is out of view. */
    const nextBtn = $('#t-next');
    const ring = $('.t-ring rect', nextBtn);
    const section = $('#reviews');
    const still = matchMedia('(prefers-reduced-motion: reduce)');
    const hold = { pointer: false, focus: false, offscreen: true, hidden: document.hidden };
    const syncHold = () => nextBtn.classList.toggle('t-paused', Object.values(hold).some(Boolean));
    const restart = () => {
      nextBtn.classList.remove('t-auto');
      if (still.matches) return;
      void ring.getBoundingClientRect();   // reflow so the ring animation starts over
      nextBtn.classList.add('t-auto');
    };
    const go = (n) => {
      i = wrap(n);
      render();
      restart();
    };
    ring.addEventListener('animationend', () => go(i + 1));
    section.addEventListener('pointerenter', () => { hold.pointer = true; syncHold(); });
    section.addEventListener('pointerleave', () => { hold.pointer = false; syncHold(); });
    section.addEventListener('focusin', () => { hold.focus = true; syncHold(); });
    section.addEventListener('focusout', () => { hold.focus = false; syncHold(); });
    document.addEventListener('visibilitychange', () => { hold.hidden = document.hidden; syncHold(); });
    new IntersectionObserver(([e]) => { hold.offscreen = !e.isIntersecting; syncHold(); }).observe(section);
    still.addEventListener('change', restart);
    $('#t-prev').addEventListener('click', () => go(i - 1));
    $('#t-next').addEventListener('click', () => go(i + 1));
    slot.prev.addEventListener('click', () => go(i - 1));
    slot.next.addEventListener('click', () => go(i + 1));
    render();
    restart();
    syncHold();
  }
})();
