#!/usr/bin/env python3
"""Builds the Same Old Samsara site from the data below.
Writes: index.html (home), ig/, yt/, pin/ (same content, ordered for where people come from), beadingpatterns.html.
Run from anywhere: python3 _build/build.py   (Jekyll skips folders starting with _, so this never goes live)

To update: change EPISODES / FEATURED / PATTERNS below and rerun.
  - a pattern gets relisted on Etsy → set its "live" to True
  - rotate the seasonal freebie → move "free": True to another pattern (and make sure its PDF has the end page)
"""
import html, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent

YT = "https://www.youtube.com/@sameoldsamsara"
SHOP = "https://sameoldsamsara.etsy.com"
DIGITALS = "https://samsaradigitals.etsy.com"
DEPOP = "https://depop.com/sameoldsamsara"
IG = "https://instagram.com/sameoldsamsara"
TT = "https://tiktok.com/@sameoldsamsara"
PIN = "https://pinterest.com/sameoldsamsara"
PN = "https://pneumanomads.xyz"
NEWSLETTER = "https://docs.google.com/forms/d/e/1FAIpQLScRgNsfZYcnLNtfIYfRxKKghsxMu-UJ_4P8csSh8ErWM_AfNA/viewform?usp=header"

# newest first. the first one is "latest", the last one is "start here"
EPISODES = [
    {"title": "we bought land.", "label": "season 1 · episode 1", "url": "https://www.youtube.com/watch?v=xSpspkCw9og",
     "img": "images/ep1-we-bought-land.jpg", "alt": "Chad and Daniel in the goldenrod field on their land"},
]

FEATURED = [
    {"name": "opossum earrings", "price": "$49.99", "id": "4448169054", "img": "images/shop/opossum.jpg"},
    {"name": "jellyfish earrings", "price": "$39.99", "id": "4448186827", "img": "images/shop/jellyfish.jpg"},
    {"name": "cream + olive fringe", "price": "$29.99", "id": "4426089724", "img": "images/shop/cream-olive.jpg"},
    {"name": "green stone + hex nut bracelet", "price": "$19.99", "id": "4448132656", "img": "images/shop/green-stone.jpg"},
]

# file = assets/<file>.jpg/.pdf. etsy = listing id on Samsara Digitals. live = listing is active right now
PATTERNS = [
    {"file": "pumpkin", "name": "pumpkin", "type": "brick stitch", "cats": ["halloween"], "free": True},
    {"file": "rainbowdiamonds", "name": "rainbow diamonds", "type": "loom", "cats": ["rainbow"], "free": True},
    {"file": "ghost", "name": "ghost", "type": "brick stitch", "cats": ["halloween"], "free": True, "seasonal": True},
    {"file": "parrot", "name": "rainbow parrot", "type": "brick stitch", "cats": ["animals", "rainbow"], "etsy": "4456758738", "live": True},
    {"file": "sillygoose", "name": "silly goose", "type": "brick stitch", "cats": ["animals"], "etsy": "1784926935", "live": True},
    {"file": "triceratops", "name": "triceratops", "type": "brick stitch", "cats": ["animals"], "etsy": "1778070364", "live": True},
    {"file": "omsymbolbrickstitch", "name": "om symbol", "type": "brick stitch", "cats": ["symbols"], "etsy": "4456770826", "live": True},
    {"file": "aliens", "name": "aliens", "type": "loom", "cats": ["space"], "etsy": "1760591136", "live": True},
    {"file": "aliensrainbow", "name": "aliens rainbow", "type": "loom", "cats": ["space", "rainbow"], "etsy": "1760591136", "live": True},
    {"file": "dnarainbow", "name": "dna double helix", "type": "loom", "cats": ["rainbow", "symbols"], "etsy": "1792298367", "live": True},
    {"file": "rainbowspirals", "name": "rainbow spirals", "type": "loom", "cats": ["rainbow"], "etsy": "1775314125", "live": True},
    {"file": "rainbowsnake", "name": "rainbow snake", "type": "loom", "cats": ["rainbow", "animals"], "etsy": "1774234169", "live": False},
    {"file": "ufo", "name": "flying saucer", "type": "brick stitch", "cats": ["space"], "etsy": "1777788647", "live": False},
    {"file": "uforainbow", "name": "flying saucer rainbow", "type": "brick stitch", "cats": ["space", "rainbow"], "etsy": "1777788647", "live": False},
    {"file": "witchhat", "name": "witch hat", "type": "brick stitch", "cats": ["halloween"], "etsy": "1781552260", "live": False},
    {"file": "wizardhat", "name": "wizard hat", "type": "brick stitch", "cats": ["halloween"], "etsy": "1781552260", "live": False},
    {"file": "ghostmoving", "name": "ghost (moving)", "type": "brick stitch", "cats": ["halloween"], "etsy": "1792859785", "live": False},
    {"file": "jackolantern", "name": "jack o' lantern", "type": "brick stitch", "cats": ["halloween"]},
    {"file": "jackolanternwitchhat", "name": "jack o' lantern in a witch hat", "type": "brick stitch", "cats": ["halloween"]},
    {"file": "spookyseason", "name": "spooky season", "type": "brick stitch", "cats": ["halloween"]},
    {"file": "magicrainbowmushroom", "name": "magic rainbow mushroom", "type": "brick stitch", "cats": ["rainbow"]},
]

e = html.escape

def listing(id_, shop=SHOP):
    return f"https://www.etsy.com/listing/{id_}"

def head(title, desc, base, canonical, noindex=False):
    robots = '<meta name="robots" content="noindex, follow">' if noindex else '<meta name="robots" content="index, follow">'
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<title>{e(title)}</title>
<meta name="description" content="{e(desc)}">
{robots}
<link rel="canonical" href="{canonical}">
<meta name="theme-color" content="#4f5232">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Same Old Samsara">
<meta property="og:title" content="{e(title)}">
<meta property="og:description" content="{e(desc)}">
<meta property="og:url" content="{canonical}">
<meta property="og:image" content="https://sameoldsamsara.xyz/images/og-sameoldsamsara.jpg">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" type="image/png" href="{base}favicon/favicon-96x96.png" sizes="96x96">
<link rel="icon" type="image/svg+xml" href="{base}favicon/favicon.svg">
<link rel="shortcut icon" href="{base}favicon/favicon.ico">
<link rel="apple-touch-icon" sizes="180x180" href="{base}favicon/apple-touch-icon.png">
<link rel="manifest" href="{base}favicon/site.webmanifest">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Courier+Prime:wght@400;700&family=Fraunces:ital,opsz,wght,SOFT@0,9..144,400..700,0..100;1,9..144,400,0..100&family=Work+Sans:wght@400;500;600&display=swap">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
<link rel="stylesheet" href="{base}style.css">
<style>:root {{ --mark-url: url("{base}images/mark-pepper.svg"); }}</style>
</head>
<body>
"""

def nav(base, links):
    items = "".join(f'<a href="{h}">{e(t)}</a>' for t, h in links)
    return f"""<header class="nav"><div class="wrap">
  <a class="brand" href="{base}index.html"><i class="mark" aria-hidden="true"></i><span>same old samsara</span></a>
  <nav class="nav-links" aria-label="sections">{items}</nav>
</div></header>
"""

def hero(base, kicker, h1="same old samsara"):
    return f"""<section class="hero"><div class="wrap">
  <i class="mark" role="img" aria-label="raven on an ouroboros, the same old samsara logo"></i>
  {f'<p class="kicker label">{e(kicker)}</p>' if kicker else ''}
  <h1>{e(h1)}</h1>
  <p class="tag">the same old cycle.</p>
  <p class="def">a creative outlet. films from the land, handmade jewelry, beading patterns, and whatever comes next.</p>
</div></section>
"""

def watch(base, lede="a documentary about our first year on 34 acres in central new york. one season a year.", subscribe=False):
    ep = EPISODES[0]
    first = EPISODES[-1]
    btns = f'<a class="btn solid" href="{first["url"]}" target="_blank" rel="noopener">start from episode 1</a>'
    btns += f'<a class="btn" href="{YT}/videos" target="_blank" rel="noopener">all episodes</a>'
    if subscribe:
        btns += f'<a class="btn" href="{YT}?sub_confirmation=1" target="_blank" rel="noopener">subscribe</a>'
    return f"""<section class="section band" id="watch"><div class="wrap">
  <div class="section-head"><h2>watch</h2><span class="label">films from the land</span></div>
  <div class="watch">
    <a class="frame" href="{ep["url"]}" target="_blank" rel="noopener" aria-label="watch {e(ep["title"])} on youtube">
      <img src="{base}{ep["img"]}" alt="{e(ep["alt"])}" width="1280" height="720" loading="lazy">
      <span class="play" aria-hidden="true"></span>
    </a>
    <div>
      <span class="label">{e(ep["label"])}</span>
      <h3>{e(ep["title"])}</h3>
      <p>{e(lede)}</p>
      <div class="btns">{btns}</div>
    </div>
  </div>
</div></section>
"""

def wear(base, lede="beaded by hand, one bead at a time. earrings, bracelets, and other wearable things."):
    cards = "".join(f"""<a class="card" href="{listing(p["id"])}" target="_blank" rel="noopener">
      <img src="{base}{p["img"]}" alt="{e(p["name"])}" width="600" height="600" loading="lazy">
      <div class="meta"><h3>{e(p["name"])}</h3></div><span class="label">{p["price"]} · free shipping</span>
    </a>""" for p in FEATURED)
    return f"""<section class="section" id="wear"><div class="wrap">
  <div class="section-head"><h2>wear</h2><span class="label">handmade jewelry</span></div>
  <p class="lede">{e(lede)}</p>
  <div class="grid">{cards}</div>
  <div class="btns">
    <a class="btn solid" href="{SHOP}" target="_blank" rel="noopener"><i class="fab fa-etsy" aria-hidden="true"></i>the jewelry shop on etsy</a>
    <a class="btn" href="{DEPOP}" target="_blank" rel="noopener">also on depop</a>
  </div>
</div></section>
"""

def pattern_img(base, p):
    return f'<img src="{base}assets/{p["file"]}.jpg" alt="{e(p["name"])} beading pattern" width="640" height="640" loading="lazy">'

def make(base):
    free = [p for p in PATTERNS if p.get("free")]
    cards = "".join(f"""<div class="card">
      {pattern_img(base, p)}
      <div class="meta"><h3>{e(p["name"])}</h3><span class="tagpill free">free</span></div>
      <span class="label">{e(p["type"])}{" · this season's freebie" if p.get("seasonal") else ""}</span>
      <div class="actions"><a class="btn" href="{base}assets/{p["file"]}.pdf" target="_blank" rel="noopener">get the pdf</a></div>
    </div>""" for p in free)
    return f"""<section class="section" id="make"><div class="wrap">
  <div class="section-head"><h2>make</h2><span class="label">beading patterns</span></div>
  <p class="lede">for beaders. a few patterns are free. the rest live at samsara digitals.</p>
  <div class="grid three">{cards}</div>
  <div class="btns">
    <a class="btn solid" href="{DIGITALS}" target="_blank" rel="noopener"><i class="fab fa-etsy" aria-hidden="true"></i>samsara digitals</a>
    <a class="btn" href="{base}beadingpatterns.html">see every pattern</a>
  </div>
</div></section>
"""

def follow(skip=()):
    items = [("instagram", IG, "fab fa-instagram", "the land + what i'm making"),
             ("youtube", YT, "fab fa-youtube", "the films"),
             ("tiktok", TT, "fab fa-tiktok", "short clips from the land"),
             ("pinterest", PIN, "fab fa-pinterest", "jewelry + patterns")]
    cards = "".join(f"""<a href="{u}" target="_blank" rel="noopener"><i class="{i}" aria-hidden="true"></i>
      <strong>{n}</strong><span class="label">{d}</span></a>""" for n, u, i, d in items if n not in skip)
    return f"""<section class="section" id="follow"><div class="wrap">
  <div class="section-head"><h2>follow</h2><span class="label">@sameoldsamsara everywhere</span></div>
  <div class="follow">{cards}</div>
</div></section>
"""

def footer():
    return f"""<footer><div class="wrap">
  <div class="row">
    <i class="mark" aria-hidden="true"></i>
    <span class="label">same old samsara · the same old cycle.</span>
  </div>
  <div class="row">
    <span>also: <a href="{PN}" target="_blank" rel="noopener">pneuma nomads</a>, our winter travel channel.</span>
    <a href="{NEWSLETTER}" target="_blank" rel="noopener">join the newsletter</a>
  </div>
  <p class="label">&copy; <span id="year">2026</span> same old samsara</p>
</div></footer>
<script>document.getElementById("year").textContent = new Date().getFullYear();</script>
</body>
</html>
"""

def page(variant):
    base = "" if variant == "home" else "../"
    canonical = "https://sameoldsamsara.xyz/"
    noindex = variant != "home"
    title = "Same Old Samsara | Films From the Land, Handmade Jewelry, Beading Patterns"
    desc = "Same Old Samsara is Chad's creative outlet: a documentary about our land in central New York, handmade beaded jewelry, and beading patterns."
    links = [("watch", "#watch"), ("wear", "#wear"), ("make", "#make"), ("follow", "#follow")]
    if variant == "home":
        body = hero(base, "") + watch(base) + wear(base) + make(base) + follow()
    elif variant == "ig":
        body = hero(base, "everything from the bio") + watch(base) + wear(base) + make(base) + follow(skip=("instagram",))
    elif variant == "yt":
        body = (hero(base, "thanks for watching") + watch(base, "new episodes from the land. start at the beginning, it's a story.", subscribe=True)
                + wear(base, "between episodes i make jewelry. this is the shop that keeps the films going.")
                + make(base) + follow(skip=("youtube",)))
    elif variant == "pin":
        links = [("wear", "#wear"), ("make", "#make"), ("watch", "#watch")]
        body = (hero(base, "handmade jewelry + beading patterns")
                + wear(base) + make(base) + watch(base) + follow(skip=("pinterest",)))
    return head(title, desc, base, canonical, noindex) + nav(base, links) + "<main>" + body + "</main>" + footer()

def patterns_page():
    base = ""
    def card(p):
        cats = " ".join(p["cats"] + [p["type"].replace(" ", "-")])
        if p.get("free"):
            tag, act = '<span class="tagpill free">free</span>', f'<a class="btn" href="assets/{p["file"]}.pdf" target="_blank" rel="noopener">get the pdf</a>'
        elif p.get("live"):
            tag, act = '<span class="tagpill paid">$2.99</span>', f'<a class="btn solid" href="{listing(p["etsy"])}" target="_blank" rel="noopener">get it on etsy</a>'
        else:
            tag, act = '<span class="tagpill soon">soon</span>', f'<a class="btn" href="{DIGITALS}" target="_blank" rel="noopener">back in the shop soon</a>'
        return f"""<div class="card pcard" data-tags="{cats}{' free' if p.get('free') else ''}">
      {pattern_img(base, p)}
      <div class="meta"><h3>{e(p["name"])}</h3>{tag}</div>
      <span class="label">{e(p["type"])}</span>
      <div class="actions">{act}</div>
    </div>"""
    order = sorted(PATTERNS, key=lambda p: (not p.get("free"), not p.get("live"), p["name"]))
    filters = [("all", "all"), ("free", "free"), ("brick-stitch", "brick stitch"), ("loom", "loom"),
               ("halloween", "halloween"), ("rainbow", "rainbow"), ("animals", "animals"), ("space", "space"), ("symbols", "symbols")]
    fbtns = "".join(f'<button type="button" data-f="{k}" aria-pressed="{"true" if k == "all" else "false"}">{t}</button>' for k, t in filters)
    title = "Beading Patterns | Same Old Samsara"
    desc = "Brick stitch and bead loom patterns by Same Old Samsara. A few free PDFs, the rest on Samsara Digitals."
    body = f"""<section class="hero"><div class="wrap">
  <i class="mark" role="img" aria-label="same old samsara logo"></i>
  <h1>beading patterns</h1>
  <p class="tag">a few free. the rest at samsara digitals.</p>
  <p class="def">brick stitch and bead loom patterns for toho or miyuki seed beads. every pdf has the grid, a word chart and a color key.</p>
  <div class="btns" style="justify-content:center"><a class="btn solid" href="{DIGITALS}" target="_blank" rel="noopener"><i class="fab fa-etsy" aria-hidden="true"></i>samsara digitals</a></div>
</div></section>
<section class="section"><div class="wrap">
  <div class="filters" role="group" aria-label="filter patterns">{fbtns}</div>
  <div class="grid" id="patterns">{"".join(card(p) for p in order)}</div>
  <div class="note"><p><strong>don't bead?</strong> the finished pieces are in the <a href="{SHOP}" target="_blank" rel="noopener">jewelry shop</a>.</p></div>
</div></section>
<script>
const btns = document.querySelectorAll(".filters button");
btns.forEach(b => b.addEventListener("click", () => {{
  btns.forEach(x => x.setAttribute("aria-pressed", x === b ? "true" : "false"));
  const f = b.dataset.f;
  document.querySelectorAll("#patterns .pcard").forEach(c => {{
    c.hidden = !(f === "all" || c.dataset.tags.split(" ").includes(f));
  }});
}}));
</script>
"""
    links = [("home", "index.html"), ("jewelry", SHOP), ("patterns shop", DIGITALS)]
    return (head(title, desc, base, "https://sameoldsamsara.xyz/beadingpatterns.html") + nav(base, links)
            + "<main>" + body + "</main>" + footer())

if __name__ == "__main__":
    (ROOT / "index.html").write_text(page("home"))
    for v in ("ig", "yt", "pin"):
        d = ROOT / v
        d.mkdir(exist_ok=True)
        (d / "index.html").write_text(page(v))
    (ROOT / "beadingpatterns.html").write_text(patterns_page())
    print("built: index.html, ig/, yt/, pin/, beadingpatterns.html")
