(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  /* mobile menu */
  const menuBtn = $('#menu-btn'), menu = $('#mobile-menu');
  const setMenu = (open) => {
    menu.classList.toggle('hidden', !open);
    $('[data-open]', menuBtn).classList.toggle('hidden', open);
    $('[data-close]', menuBtn).classList.toggle('hidden', !open);
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  };
  menuBtn.addEventListener('click', () => setMenu(menu.classList.contains('hidden')));
  $$('a', menu).forEach((a) => a.addEventListener('click', () => setMenu(false)));
  addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });

  /* scroll reveal */
  const revealEls = $$('.reveal');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add('in'));
  }

  /* wishlist hearts */
  $$('.wish').forEach((b) => b.addEventListener('click', () => {
    b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true'));
  }));

  /* product track arrows (the track only scrolls below the lg grid) */
  const track = $('#prod-track'), prev = $('#prod-prev'), next = $('#prod-next');
  const syncArrows = () => {
    const max = track.scrollWidth - track.clientWidth - 2;
    prev.disabled = track.scrollLeft <= 2;
    next.disabled = max <= 0 || track.scrollLeft >= max;
  };
  const step = () => (track.firstElementChild?.getBoundingClientRect().width ?? 300) + 18;
  prev.addEventListener('click', () => track.scrollBy({ left: -step(), behavior: 'smooth' }));
  next.addEventListener('click', () => track.scrollBy({ left: step(), behavior: 'smooth' }));
  track.addEventListener('scroll', syncArrows, { passive: true });
  addEventListener('resize', syncArrows);
  syncArrows();

  /* testimonials */
  const T = [
    { name: 'Daniel Brooks', img: 'assets/img/t1.jpg', quote: '“The blazer fits like it was tailored for me. I wore it to a wedding and got compliments all night. Easily my best purchase this year.”' },
    { name: 'James Carter', img: 'assets/img/t2.jpg', quote: '“I’m truly impressed with the quality and perfect fit. The fabric feels premium, and I’ve received countless compliments wearing it. Amazing value for the price — I’ll definitely shop here again.”' },
    { name: 'Ryan Mitchell', img: 'assets/img/t3.jpg', quote: '“Fast delivery, great packaging, and the denim jacket feels even better in person. Plassiv is now my go-to for everyday style.”' },
  ];
  const slot = { prev: $('[data-t-slot=prev]'), current: $('[data-t-slot=current]'), next: $('[data-t-slot=next]') };
  const quote = $('#t-quote'), nameEl = $('#t-name');
  let i = 1;
  const wrap = (n) => (n + T.length) % T.length;
  const paint = (el, t) => { const im = $('img', el); im.src = t.img; im.alt = t.name; };
  const render = () => {
    paint(slot.prev, T[wrap(i - 1)]); paint(slot.current, T[i]); paint(slot.next, T[wrap(i + 1)]);
    quote.textContent = T[i].quote; nameEl.textContent = T[i].name;
  };
  const go = (n) => {
    i = wrap(n);
    const fig = $('#t-figure');
    fig.style.transition = 'opacity .2s'; fig.style.opacity = '0';
    setTimeout(() => { render(); fig.style.opacity = '1'; }, 200);
  };
  $('#t-prev').addEventListener('click', () => go(i - 1));
  $('#t-next').addEventListener('click', () => go(i + 1));
  slot.prev.addEventListener('click', () => go(i - 1));
  slot.next.addEventListener('click', () => go(i + 1));
  render();
})();
