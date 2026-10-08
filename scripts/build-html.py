#!/usr/bin/env python3
"""Assemble the root HTML pages from src/*.template.html, the shared partials and data/products.json."""
import json
from pathlib import Path
from html import escape

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src"
PRODUCTS = json.loads((ROOT / "data/products.json").read_text())


def money(cents):
    return f"${cents // 100:,}.{cents % 100:02d}"


def card(i, p):
    ratio = "lg:aspect-[139/149]" if i < 3 else "lg:aspect-[139/178]"
    name = escape(p["name"])
    # the name link stretches over the whole card; the wishlist button sits above it (z-10) so it stays separate
    return f'''    <li class="reveal snap-start" style="--d:{(i % 3) * 80}ms">
      <article class="group relative">
        <div class="relative overflow-hidden rounded-2xl">
          <img src="{escape(p["image"])}" width="{p["width"]}" height="{p["height"]}" alt="{escape(p["alt"])}" class="aspect-[3/4] {ratio} w-full object-cover transition duration-700 group-hover:scale-105">
          <span class="absolute left-3 top-3 rounded-full bg-ink/55 px-3 py-1.5 text-[0.6875rem] font-medium leading-none text-white backdrop-blur-sm sm:text-xs">New Collection</span>
          <button type="button" class="wish absolute right-3 top-3 z-10 grid size-8 place-items-center rounded-full bg-ink/25 text-white backdrop-blur-sm transition hover:scale-110" aria-pressed="false" aria-label="Add {name} to wishlist"><svg class="icon size-[1.125rem] transition"><use href="#i-heart"/></svg></button>
        </div>
        <h3 class="mt-3.5 text-[0.8125rem] text-muted"><a href="product.html?p={escape(p["id"])}" class="after:absolute after:inset-0 after:rounded-2xl hover:text-ink">{name}</a></h3>
        <p class="mt-1 text-base font-bold">{money(p["priceCents"])}</p>
      </article>
    </li>'''


# page -> (link base for other-page anchors, home link, nav attribute: the home bar is see-through over the hero)
PAGES = {
    "index": ("", "#top", "data-clear-top"),
    "product": ("index.html", "index.html", ""),
    "checkout": ("index.html", "index.html", ""),
    "order": ("index.html", "index.html", ""),
}
partial = {name: (SRC / f"partials/{name}.html").read_text() for name in ("head", "nav", "footer", "cart")}

for page, (base, home, navtop) in PAGES.items():
    out = (SRC / f"{page}.template.html").read_text()
    for name, text in partial.items():
        out = out.replace(f"<!--{name.upper()}-->", text.rstrip("\n"))
    out = out.replace("<!--SPRITE-->", (SRC / "sprite.html").read_text()) \
             .replace("    <!--PRODUCTS-->", "\n".join(card(i, p) for i, p in enumerate(PRODUCTS))) \
             .replace("%BASE%", base).replace("%HOME%", home).replace("%NAVTOP%", navtop)
    (ROOT / f"{page}.html").write_text(out)
    print(f"{page}.html written", len(out), "bytes")
