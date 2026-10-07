#!/usr/bin/env python3
"""Assemble index.html from src/index.template.html + src/sprite.html + the product list below."""
from pathlib import Path
from html import escape

ROOT = Path(__file__).resolve().parent.parent
# (image, name, price, alt)
PRODUCTS = [
    ("p1", "Elegant Peach Blazer", "150.80", "Man in a cream blazer and trousers against a peach studio backdrop"),
    ("p2", "Classic Light Denim Jacket", "120.80", "Man in a light-wash denim jacket"),
    ("p3", "Premium Black Leather Jacket", "160.55", "Bearded man in a black leather biker jacket and sunglasses"),
    ("p4", "Olive Green Premium Casual Shirt", "100.20", "Man in a relaxed sage green linen shirt"),
    ("p5", "Urban Check Flannel Shirt", "100.66", "Young man in a green and tan check overshirt over a black tee"),
    ("p6", "Summer Beige Smart Blazer Set", "150.80", "Man in a beige blazer set, navy knit and sunglasses"),
]

def card(i, p):
    key, name, price, alt = p
    h = 1192 if i < 3 else 1424
    ratio = "lg:aspect-[139/149]" if i < 3 else "lg:aspect-[139/178]"
    return f'''    <li class="reveal snap-start" style="--d:{(i % 3) * 80}ms">
      <article class="group">
        <div class="relative overflow-hidden rounded-2xl">
          <img src="assets/img/{key}.jpg" width="1112" height="{h}" alt="{escape(alt)}" class="aspect-[3/4] {ratio} w-full object-cover transition duration-700 group-hover:scale-105">
          <span class="absolute left-3 top-3 rounded-full bg-ink/55 px-3 py-1.5 text-[0.6875rem] font-medium leading-none text-white backdrop-blur-sm sm:text-xs">New Collection</span>
          <button type="button" class="wish absolute right-3 top-3 grid size-8 place-items-center rounded-full bg-ink/25 text-white backdrop-blur-sm transition hover:scale-110" aria-pressed="false" aria-label="Add {escape(name)} to wishlist"><svg class="icon size-[1.125rem] transition"><use href="#i-heart"/></svg></button>
        </div>
        <h3 class="mt-3.5 text-[0.8125rem] text-muted">{escape(name)}</h3>
        <p class="mt-1 text-base font-bold">${price}</p>
      </article>
    </li>'''

tpl = (ROOT / "src/index.template.html").read_text()
out = tpl.replace("<!--SPRITE-->", (ROOT / "src/sprite.html").read_text()) \
         .replace("    <!--PRODUCTS-->", "\n".join(card(i, p) for i, p in enumerate(PRODUCTS)))
(ROOT / "index.html").write_text(out)
print("index.html written", len(out), "bytes")
