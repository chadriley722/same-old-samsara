#!/usr/bin/env python3
"""Builds sameoldsamsara.xyz, the almanac (v3, Oct 28 2026).

Run from anywhere: python3 _build/build.py   (Jekyll skips folders starting with _, so this never goes live)
Writes: index.html, land/, films/, patterns/ (+ one page per pattern), bead-lab/, about/, ig/ yt/ pin/ (link-in-bio
versions, noindex), 404.html, beadingpatterns.html (old url, points to patterns/), llms.txt, robots.txt, sitemap.xml.
Copies pattern images from Same Old Samsara/Patterns/<design>/UPLOAD TO ETSY/ when they exist.

To update: change EPISODES / FEATURED / PATTERNS / SPOTS below and rerun.
  - a pattern gets relisted on Etsy → set its "live" to True
  - rotate the seasonal freebie → move "free": True to another pattern (and make sure its PDF has the end page)
"""
import datetime, html, json, pathlib, shutil, subprocess

ROOT = pathlib.Path(__file__).resolve().parent.parent
COWORK = ROOT.parent.parent                       # Claude CoWork/
PATTERN_SRC = COWORK / "Same Old Samsara/Patterns"
SITE = "https://sameoldsamsara.xyz"

YT = "https://www.youtube.com/@sameoldsamsara"
SHOP = "https://sameoldsamsara.etsy.com"
DIGITALS = "https://samsaradigitals.etsy.com"
DEPOP = "https://depop.com/sameoldsamsara"
IG = "https://instagram.com/sameoldsamsara"
TT = "https://tiktok.com/@sameoldsamsara"
PIN = "https://pinterest.com/sameoldsamsara"
PN = "https://pneumanomads.xyz"
NEWSLETTER = "https://docs.google.com/forms/d/e/1FAIpQLScRgNsfZYcnLNtfIYfRxKKghsxMu-UJ_4P8csSh8ErWM_AfNA/viewform?usp=header"
LAND_DAY_ONE = "2026-09-04"

# newest first
EPISODES = [
    {"id": "YDUcJU_dp78", "title": "our first month on 34 acres.", "label": "season 1 · episode 2", "len": "23:33",
     "img": "images/ep2-month-one.jpg", "blurb": "no tractor. no brush hog. a scythe, a push mower and a lot of goldenrod. a path to the old shed, the rv moves onto the land, the first thunderstorm."},
    {"id": "xSpspkCw9og", "title": "we bought land.", "label": "season 1 · episode 1", "len": "41:24",
     "img": "images/ep1-we-bought-land.jpg", "blurb": "34 acres of goldenrod and woods in central new york. how we found it, the rough perc test, and the first walk as owners."},
]

FEATURED = [
    {"name": "opossum earrings", "price": "$49.99", "id": "4448169054", "img": "images/shop/opossum.jpg"},
    {"name": "jellyfish earrings", "price": "$39.99", "id": "4448186827", "img": "images/shop/jellyfish.jpg"},
    {"name": "cream + olive fringe", "price": "$29.99", "id": "4426089724", "img": "images/shop/cream-olive.jpg"},
    {"name": "green stone + hex nut bracelet", "price": "$19.99", "id": "4448132656", "img": "images/shop/green-stone.jpg"},
]

# file = old card image assets/<file>.jpg (and assets/<file>.pdf when free). design = folder in Patterns/ with the v2 chart.
# one entry per Etsy listing. live = listing is active right now. free = pdf on this site.
PATTERNS = [
    {"file": "pumpkin", "name": "pumpkin", "type": "brick stitch", "cats": ["halloween"], "free": True,
     "blurb": "a little round pumpkin with a curly stem. quick, cute and free."},
    {"file": "rainbowdiamonds", "name": "rainbow diamonds", "type": "loom", "cats": ["rainbow"], "free": True,
     "blurb": "a rainbow diamond band for the bead loom. free."},
    {"file": "ghost", "name": "ghost", "type": "brick stitch", "cats": ["halloween"], "free": True, "seasonal": True,
     "blurb": "a little floating ghost. this season's freebie."},
    {"file": "parrot", "design": "parrot", "slug": "rainbow-parrot", "name": "rainbow parrot", "type": "brick stitch", "cats": ["animals", "rainbow"],
     "etsy": "4456758738", "price": "2.99", "live": True,
     "blurb": "a scarlet macaw in nine colors: red, gold, green, cornflower and a long navy tail on a perch."},
    {"file": "squid", "design": "squid", "slug": "squid-wavy-fringe", "name": "squid (wavy fringe)", "type": "brick stitch", "cats": ["animals", "wavy fringe"],
     "etsy": "4604548842", "price": "3.99", "live": True,
     "blurb": "a little plum squid with big eyes and long wavy fringe tentacles. the wave comes from the thread, and the pattern shows you how."},
    {"file": "jellyfish", "design": "jellyfish", "slug": "jellyfish", "name": "jellyfish (3 sizes)", "type": "brick stitch", "cats": ["animals", "wavy fringe"],
     "etsy": "4604569492", "price": "4.99", "live": True,
     "blurb": "a round jellyfish bell with wavy fringe. small, medium and large, two colorways, all in one pdf."},
    {"file": "sillygoose", "design": "sillygoose", "slug": "silly-goose", "name": "silly goose", "type": "brick stitch", "cats": ["animals"],
     "etsy": "1784926935", "price": "2.99", "live": True,
     "blurb": "a white goose with an orange beak and feet, framed in black. for the silly geese."},
    {"file": "triceratops", "design": "triceratops", "slug": "triceratops", "name": "triceratops", "type": "brick stitch", "cats": ["animals"],
     "etsy": "1778070364", "price": "2.99", "live": True,
     "blurb": "a little green triceratops with terra cotta horns and a spotted back."},
    {"file": "omsymbolbrickstitch", "design": "omsymbolbrickstitch", "slug": "om-symbol", "name": "om symbol", "type": "brick stitch", "cats": ["symbols"],
     "etsy": "4456770826", "price": "2.99", "live": True,
     "blurb": "a black om on a soft beige ground. simple and steady."},
    {"file": "magicrainbowmushroom", "design": "magicrainbowmushroom", "slug": "magic-rainbow-mushroom", "name": "magic rainbow mushroom", "type": "brick stitch", "cats": ["rainbow"],
     "etsy": "1765666810", "price": "2.99", "live": True,
     "blurb": "a rainbow cap on a little beige stem. bright and a little trippy."},
    {"file": "ufo", "design": "ufo", "slug": "flying-saucer", "name": "flying saucer", "type": "brick stitch", "cats": ["space", "rainbow"],
     "etsy": "1777788647", "price": "2.99", "live": True,
     "blurb": "a gray saucer beaming down. yellow beam or rainbow beam, both in one pdf."},
    {"file": "aliens", "slug": "aliens-loom", "name": "aliens", "type": "loom", "cats": ["space"], "etsy": "1760591136", "price": "2.99", "live": True,
     "blurb": "a row of little alien heads for the bead loom. green or rainbow."},
    {"file": "dnarainbow", "slug": "dna-double-helix", "name": "dna double helix", "type": "loom", "cats": ["rainbow", "symbols"], "etsy": "1792298367", "price": "2.99", "live": True,
     "blurb": "a rainbow double helix bracelet for the bead loom."},
    {"file": "rainbowspirals", "slug": "rainbow-spirals", "name": "rainbow spirals", "type": "loom", "cats": ["rainbow"], "etsy": "1775314125", "price": "2.99", "live": True,
     "blurb": "rainbow spirals for the bead loom. bold and hypnotic."},
    {"file": "rainbowsnake", "slug": "rainbow-snake", "name": "rainbow snake", "type": "loom", "cats": ["rainbow", "animals"], "etsy": "1774234169", "price": "2.99", "live": True,
     "blurb": "a rainbow snake wave for the bead loom."},
    {"file": "witchhat", "slug": "witch-and-wizard-hats", "name": "witch hat + wizard hat", "type": "brick stitch", "cats": ["halloween"], "etsy": "1781552260", "price": "2.99", "live": True,
     "blurb": "two pointy hats, one listing. a witch hat and a starry wizard hat."},
    {"file": "ghostmoving", "slug": "spooky-ghost", "name": "spooky ghost", "type": "brick stitch", "cats": ["halloween"], "etsy": "1792859785", "price": "2.99", "live": True,
     "blurb": "a wavy little ghost mid float."},
    {"file": "jackolantern", "slug": "jack-o-lantern", "name": "jack o' lantern", "type": "brick stitch", "cats": ["halloween"], "etsy": "1788945937", "price": "2.99", "live": True,
     "blurb": "a grinning jack o' lantern."},
    {"file": "jackolanternwitchhat", "slug": "jack-o-lantern-witch-hat", "name": "jack o' lantern in a witch hat", "type": "brick stitch", "cats": ["halloween"], "etsy": "1781842810", "price": "2.99", "live": True,
     "blurb": "a jack o' lantern wearing a witch hat. both halloween classics at once."},
    {"file": "spookyseason", "slug": "spooky-season", "name": "spooky season", "type": "brick stitch", "cats": ["halloween"], "etsy": "1775414610", "price": "2.99", "live": True,
     "blurb": "a spooky season set for october."},
]

# the wheel of the year on the land (public version: nothing here gives away where the land is)
MONTHS = [  # year one. what the land does, plus our plans marked as plans. no chores we don't actually do.
    ("jan", "snow on the meadow. the land rests and we're south for the winter."),
    ("feb", "the deepest cold. somewhere out there the maples are getting ready."),
    ("mar", "mud season. the snow pulls back off the meadow."),
    ("apr", "peepers in the wet spots. first green under last year's grass."),
    ("may", "back on the land may 1. leaves out, black flies out."),
    ("jun", "long days. everything grows a foot overnight. the plan for 2027: the first garden beds."),
    ("jul", "fireflies over the meadow. the plan someday: a little farm stand."),
    ("aug", "hot and green. the goldenrod starts to turn."),
    ("sep", "goldenrod everywhere. september 4, 2026 is the day we got the keys."),
    ("oct", "peak color, then the leaves come down. mushrooms after every rain."),
    ("nov", "bare trees, first frost. we close up and head south for the winter."),
    ("dec", "first real snow. the land sleeps."),
]

# spots on the illustrated map. x, y in the 1000 x 640 drawing. not to scale, not the real layout.
SPOTS = [
    {"id": "meadow", "x": 520, "y": 250, "name": "the meadow", "img": "images/land/meadow.jpg",
     "note": "most of the land is open meadow. in september it's solid goldenrod, and we mow paths through it with a push mower and a scythe."},
    {"id": "woods", "x": 820, "y": 150, "name": "the woods", "img": "images/land/canopy.jpg",
     "note": "the back of the land is woods. old trees, fallen logs, mushrooms after every rain."},
    {"id": "creek", "x": 900, "y": 470, "name": "the creek", "img": "images/land/creek.jpg",
     "note": "the land runs down to the creek. this is the view from the bank in early october."},
    {"id": "track", "x": 150, "y": 520, "name": "the old track", "img": "images/land/track.jpg",
     "note": "one rough dirt track is the only way in. every load of gravel counts."},
    {"id": "beds", "x": 360, "y": 420, "name": "the garden beds", "img": "images/land/storm.jpg",
     "note": "where the garden beds go in 2027. right now it's goldenrod, and we're clearing it."},
    {"id": "mycelium", "x": 740, "y": 220, "name": "the mycelium bark", "img": "images/land/roots.jpg",
     "note": "a piece of bark we picked up in the woods. those white threads are mycelium, the part of a mushroom you never see."},
    {"id": "forest-floor", "x": 700, "y": 90, "name": "the mushroom spot", "img": "images/land/mushroom.jpg",
     "note": "after rain the forest floor puts up mushrooms we're still learning to name."},
    {"id": "house", "x": 270, "y": 230, "name": "the house site (someday)", "img": "images/land/lone-tree.jpg",
     "note": "the house comes later, 2028 or after. we already moved the spot once. that's how it goes."},
]

PHOTOS = [  # (image, caption, crop focus for the 4:5 strip)
    ("images/land/mist-sunrise.jpg", "fog on the low ground at sunrise.", "center"),
    ("images/land/meadow.jpg", "the meadow, late summer.", "center"),
    ("images/land/creek.jpg", "the creek in early october.", "center"),
    ("images/land/storm.jpg", "a storm rolling in over the field.", "center"),
    ("images/land/canopy.jpg", "looking up in the woods.", "center"),
    ("images/land/mushroom.jpg", "after the rain.", "center"),
    ("images/land/moon-dusk.jpg", "the moon over the meadow at dusk.", "8% 50%"),
    ("images/land/forest-floor.jpg", "the forest floor in october.", "center"),
    ("images/land/lone-tree.jpg", "the lone tree in the field.", "center"),
    ("images/land/roots.jpg", "mycelium on a piece of bark from the woods.", "center"),
]

# field guide: who lives here (zoom in, guess, tap to see it whole). focus = where the close-up starts.
# add trail cam photos here as they come in.
CRITTERS = [
    {"id": "garter", "img": "images/land/snake.jpg", "focus": "57% 60%", "name": "a garter snake",
     "note": "on the gravel. harmless, and fast."},
    {"id": "grub", "img": "images/land/grub.jpg", "focus": "44% 50%", "name": "a beetle grub",
     "note": "found on the land in october. it'll be a beetle someday."},
    {"id": "wasp", "img": "images/land/wasp.jpg", "focus": "64% 46%", "name": "a wasp",
     "note": "hanging off the truck mirror."},
]

# field guide: things to find. starts face down with a hint, tap to turn it over.
FINDS = [
    {"id": "goldenrod", "img": "images/land/meadow.jpg", "name": "goldenrod", "hint": "the whole meadow turns this color in september.",
     "note": "most of the land is goldenrod. it feeds the bees in fall, and it's what we're clearing for the garden."},
    {"id": "mycelium", "img": "images/land/roots.jpg", "name": "mycelium", "hint": "white threads on a piece of bark.",
     "note": "the part of a mushroom you never see. it runs through the dead wood and the soil and holds the woods together."},
    {"id": "white-mushroom", "img": "images/land/mushroom.jpg", "name": "a little white mushroom", "hint": "pops up in the leaves after rain.",
     "note": "we're not naming it, and we're definitely not eating it."},
    {"id": "moss", "img": "images/land/moss.jpg", "name": "moss on a fallen log", "hint": "soft and green, all over the fallen logs.",
     "note": "with a tiny mushroom growing out of it. the woods are full of these logs."},
    {"id": "gully", "img": "images/land/forest-floor.jpg", "name": "the gully", "hint": "fallen trees, rocks and water, deep in the woods.",
     "note": "a little stream cuts through the woods here. everything is covered in moss."},
    {"id": "canopy", "img": "images/land/canopy.jpg", "name": "the canopy", "hint": "you have to look up for this one.",
     "note": "tall trees in the back woods. lie down and look up."},
    {"id": "creek", "img": "images/land/creek.jpg", "name": "the creek", "hint": "where the land runs out.",
     "note": "the land runs down to the creek. this is early october from the bank."},
]

TOHO = [  # bead lab palette: Toho 11/0 frosted colors from the published patterns
    ("jet", "#262422"), ("white", "#f8f7f2"), ("light beige", "#e6d9bd"), ("egg shell", "#f1e6cf"), ("gray", "#b9b9b6"),
    ("dark gray", "#8f8f8d"), ("pepper red", "#b8342c"), ("oxblood", "#5b2a27"), ("terra cotta", "#b04a2c"),
    ("sunset orange", "#e5502a"), ("cantaloupe", "#ef7d22"), ("sunshine", "#f2c81f"), ("mint green", "#4bae57"),
    ("pine green", "#2f6f43"), ("cornflower", "#6f95d3"), ("navy", "#3b3ca0"), ("antique purple", "#6b4458"),
    ("soft mauve", "#b391a6"), ("shell pink", "#dcbdbd"),
]

e = html.escape
TODAY = datetime.date.today().isoformat()

def listing(id_):
    return f"https://www.etsy.com/listing/{id_}"

# ---------------- pattern data from the design files ----------------

def slug(p): return p.get("slug") or p["file"]

def design(p):
    if not p.get("design"): return None
    f = PATTERN_SRC / p["design"] / f'{p["design"]}.json'
    return json.loads(f.read_text()) if f.exists() else None

def pattern_img(p, kind="hero"):
    """site path of the pattern image. hero = 4:3 chart art, card = square."""
    if p.get("design") and (ROOT / f"images/patterns/{slug(p)}.jpg").exists():
        return f"images/patterns/{slug(p)}.jpg"
    return f"assets/{p['file']}.jpg"

def copy_pattern_images():
    out = ROOT / "images/patterns"; out.mkdir(parents=True, exist_ok=True)
    for p in PATTERNS:
        if not p.get("design"): continue
        src = PATTERN_SRC / p["design"] / "UPLOAD TO ETSY/1 hero.jpg"
        dst = out / f"{slug(p)}.jpg"
        if src.exists() and (not dst.exists() or src.stat().st_mtime > dst.stat().st_mtime):
            subprocess.run(["magick", str(src), "-resize", "1400x1050", "-strip", "-quality", "80", str(dst)], check=True)

def facts(p):
    d = design(p)
    rows = []
    rows.append(("stitch", p["type"]))
    rows.append(("beads", "size 11/0 round seed beads (toho codes in the legend)" if d else "size 11/0 seed beads"))
    if d:
        v = d["variants"]
        cols = d["colorways"][0]["colors"]
        rows.append(("colors", f"{len(cols)}"))
        if len(v) > 1: rows.append((d.get("variant_kind", "sizes"), ", ".join(x["label"] for x in v)))
        info = d.get("info", {})
        for k in ("size", "time", "level"):
            if info.get(k): rows.append((k, info[k]))
    rows.append(("format", "pdf, instant download" if not p.get("free") else "pdf, free download"))
    rows.append(("price", "free" if p.get("free") else f'${p["price"]}'))
    return rows

def color_names(p):
    d = design(p)
    if not d: return []
    return [c["name"] for c in d["colorways"][0]["colors"].values()]

# ---------------- page parts ----------------

def head(title, desc, base, path, noindex=False, jsonld=None, image=None):
    canonical = SITE + "/" + path
    robots = "noindex, follow" if noindex else "index, follow, max-image-preview:large"
    img = image or f"{SITE}/images/og-sameoldsamsara.jpg"
    ld = "".join(f'<script type="application/ld+json">{json.dumps(j, ensure_ascii=False)}</script>\n' for j in (jsonld or []))
    return f"""<!DOCTYPE html>
<html lang="en" data-theme="day">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<title>{e(title)}</title>
<meta name="description" content="{e(desc)}">
<meta name="robots" content="{robots}">
<link rel="canonical" href="{canonical}">
<meta name="theme-color" content="#4f5232">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Same Old Samsara">
<meta property="og:title" content="{e(title)}">
<meta property="og:description" content="{e(desc)}">
<meta property="og:url" content="{canonical}">
<meta property="og:image" content="{img}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" type="image/png" href="{base}favicon/favicon-96x96.png" sizes="96x96">
<link rel="icon" type="image/svg+xml" href="{base}favicon/favicon.svg">
<link rel="shortcut icon" href="{base}favicon/favicon.ico">
<link rel="apple-touch-icon" sizes="180x180" href="{base}favicon/apple-touch-icon.png">
<link rel="manifest" href="{base}favicon/site.webmanifest">
<link rel="alternate" type="text/plain" title="llms.txt" href="{base}llms.txt">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Courier+Prime:wght@400;700&family=Fraunces:ital,opsz,wght,SOFT@0,9..144,300..800,0..100;1,9..144,300..700,0..100&family=Work+Sans:wght@400;500;600&display=swap">
<link rel="stylesheet" href="{base}style.css">
<script>try{{var t=localStorage.getItem("sos_theme");if(t==="night"||t==="day")document.documentElement.dataset.theme=t;}}catch(_){{}}</script>
<style>:root{{--ring-url:url("{base}images/ring-norules-pepper.svg");--mark-url:url("{base}images/mark-pepper.svg");}}</style>
{ld}</head>
<body>
<a class="skip" href="#main">skip to the good part</a>
"""

NAV = [("the land", "land/"), ("films", "films/"), ("patterns", "patterns/"), ("field guide", "field-guide/"), ("jewelry", SHOP)]

def nav(base, here=""):
    def link(t, h):
        ext = h.startswith("http")
        href = h if ext else base + h
        cur = ' aria-current="page"' if h == here else ""
        tgt = ' target="_blank" rel="noopener"' if ext else ""
        return f'<a href="{href}"{cur}{tgt}>{t}</a>'
    items = "".join(link(t, h) for t, h in NAV)
    return f"""<header class="top"><div class="wrap top-in">
  <a class="brand" href="{base}index.html" aria-label="same old samsara, home"><i class="mark" aria-hidden="true"></i><span>same old samsara</span></a>
  <nav class="links" aria-label="sections">{items}</nav>
  <button class="sky" type="button" aria-label="switch day or night" title="day or night"><span class="sun" aria-hidden="true"></span></button>
</div></header>
"""

def almanac_strip():
    return """<div class="almanac" data-almanac>
  <div><span class="label">today on the land</span><strong data-a="day">day –</strong></div>
  <div><span class="label">the moon</span><strong><i class="moon" data-a="moonicon" aria-hidden="true"></i><span data-a="moon">–</span></strong></div>
  <div><span class="label">sunrise · sunset</span><strong data-a="sun">–</strong></div>
  <div><span class="label">the season</span><strong data-a="season">–</strong></div>
</div>"""

def section_head(no, title, sub=""):
    num = f'<span class="no label">no. {no}</span>' if no != "·" else '<span class="no label">·</span>'
    return f"""<div class="shead reveal">{num}<h2>{e(title)}</h2>{f'<span class="label sub">{e(sub)}</span>' if sub else ''}</div>"""

def yt_embed(ep, base):
    return f"""<button class="yt" type="button" data-id="{ep['id']}" aria-label="play {e(ep['title'])}">
  <img src="{base}{ep['img']}" alt="{e(ep['title'])}, thumbnail" width="1280" height="720" loading="lazy">
  <span class="play" aria-hidden="true"></span><span class="len label">{ep['len']}</span>
</button>"""

def films_block(base, all_eps=False, lede="a documentary about our first year on 34 acres in central new york. one season a year."):
    ep = EPISODES[0]
    rest = EPISODES if all_eps else EPISODES[1:]
    others = "".join(f"""<a class="ep reveal" href="https://www.youtube.com/watch?v={x['id']}" target="_blank" rel="noopener">
      <img src="{base}{x['img']}" alt="" width="640" height="360" loading="lazy">
      <div><span class="label">{e(x['label'])} · {x['len']}</span><h3>{e(x['title'])}</h3>{f'<p>{e(x["blurb"])}</p>' if all_eps else ''}</div></a>""" for x in rest)
    return f"""<div class="films">
  <div class="film-main reveal">{yt_embed(ep, base)}
    <div class="film-meta"><span class="label">newest · {e(ep['label'])}</span><h3>{e(ep['title'])}</h3><p>{e(ep['blurb'])}</p>
      <div class="btns"><a class="btn solid" href="https://www.youtube.com/watch?v={EPISODES[-1]['id']}" target="_blank" rel="noopener">start from episode 1</a>
      <a class="btn" href="{YT}?sub_confirmation=1" target="_blank" rel="noopener">subscribe</a></div></div>
  </div>
  <p class="lede reveal">{e(lede)}</p>
  <div class="eps">{others}</div>
</div>"""

def wheel_block():
    data = json.dumps([{"m": m, "note": n} for m, n in MONTHS])
    return f"""<div class="wheel-wrap reveal">
  <div class="wheel" id="wheel" data-months='{e(data)}' role="group" aria-label="the wheel of the year"></div>
  <div class="wheel-note"><span class="label" id="wheel-m">this month</span><p id="wheel-text"></p>
  <p class="label hint">tap a month. this is year one, so we're still learning what the land does.</p></div>
</div>"""

def map_block(base):
    pins = "".join(f"""<button class="pin" type="button" style="left:{s['x']/10}%;top:{s['y']/6.4}%" data-spot="{s['id']}" aria-label="{e(s['name'])}"><span></span></button>""" for s in SPOTS)
    panels = json.dumps({s["id"]: {"name": s["name"], "note": s["note"], "img": base + s["img"]} for s in SPOTS})
    return f"""<div class="map reveal">
  <div class="map-art">{land_svg()}{pins}</div>
  <aside class="map-card" id="map-card" data-spots='{e(panels)}' aria-live="polite">
    <img id="map-img" src="{base}{SPOTS[0]['img']}" alt="" width="800" height="600" loading="lazy">
    <span class="label">a spot on the land</span><h3 id="map-name">{e(SPOTS[0]['name'])}</h3><p id="map-note">{e(SPOTS[0]['note'])}</p>
  </aside>
  <p class="label map-foot">drawn from memory, not to scale. the real map stays with us.</p>
</div>"""

def land_svg():
    """a hand-drawn style map of the land. stylized on purpose."""
    trees = ""
    import random
    r = random.Random(4)
    for _ in range(70):
        x, y = r.uniform(640, 990), r.uniform(20, 300)
        if (x - 640) * 0.9 + (300 - y) < 60: continue
        s = r.uniform(14, 24)
        trees += f'<path d="M{x:.0f},{y:.0f} l{-s/2:.1f},{s:.1f} h{s:.1f} z M{x:.0f},{y+s:.0f} v6" class="tree"/>'
    grass = ""
    for _ in range(140):
        x, y = r.uniform(60, 760), r.uniform(120, 600)
        if x > 640 and y < 300: continue
        grass += f'<path d="M{x:.0f},{y:.0f} q2,-9 5,-12 M{x+4:.0f},{y:.0f} q1,-7 -2,-10" class="grass"/>'
    return f"""<svg class="land" viewBox="0 0 1000 640" role="img" aria-label="an illustrated map of the land: meadow, woods, a creek, the old track and the garden beds">
  <defs><pattern id="hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><line x1="0" y1="0" x2="0" y2="8" class="hatch"/></pattern></defs>
  <path class="edge" d="M40,80 C200,40 420,30 620,20 C760,14 900,30 970,60 L985,600 C760,625 420,630 60,612 C30,420 28,250 40,80 Z"/>
  <path class="woods" d="M620,24 C760,16 900,32 968,62 L978,330 C900,300 820,310 760,280 C700,250 660,180 640,120 Z" fill="url(#hatch)"/>
  {trees}{grass}
  <path class="creek" d="M940,40 C900,160 960,240 905,330 C850,420 950,500 900,620"/>
  <path class="creek thin" d="M952,44 C912,164 972,244 917,334 C862,424 962,504 912,624"/>
  <path class="track" d="M20,600 C120,560 160,520 220,470 C280,420 300,350 270,250"/>
  <rect class="bed" x="320" y="395" width="90" height="16" rx="3"/><rect class="bed" x="320" y="420" width="90" height="16" rx="3"/><rect class="bed" x="320" y="445" width="90" height="16" rx="3"/>
  
  <circle class="house" cx="270" cy="230" r="22"/>
  <g class="rose" transform="translate(110,130)"><circle r="34"/><path d="M0,-44 L7,0 L0,44 L-7,0 Z"/><text y="-50">n</text></g>
  <text class="mapword" x="420" y="190">goldenrod</text><text class="mapword" x="760" y="370">the woods end here</text>
</svg>"""

def patterns_grid(base, items, show_filters=True):
    cards = []
    for p in items:
        tags = " ".join(c.replace(" ", "-") for c in p["cats"]) + " " + p["type"].replace(" ", "-") + (" free" if p.get("free") else "")
        if p.get("free"):
            href, pill = f'{base}assets/{p["file"]}.pdf', '<span class="pill free">free pdf</span>'
            tgt = ' target="_blank" rel="noopener"'
        else:
            href, pill, tgt = f"{base}patterns/{slug(p)}/", f'<span class="pill">${p["price"]}</span>', ""
        cards.append(f"""<a class="pcard reveal" href="{href}"{tgt} data-tags="{tags}" data-name="{e(p['name'])}">
      <div class="pimg"><img src="{base}{pattern_img(p)}" alt="{e(p['name'])} {p['type']} beading pattern" loading="lazy"></div>
      <div class="pmeta"><h3>{e(p['name'])}</h3>{pill}</div><span class="label">{e(p['type'])}{" · free until halloween" if p.get("seasonal") else ""}</span>
    </a>""")
    filt = ""
    if show_filters:
        f = [("all", "all"), ("free", "free"), ("brick-stitch", "brick stitch"), ("loom", "loom"), ("animals", "animals"), ("rainbow", "rainbow"),
             ("wavy-fringe", "wavy fringe"), ("space", "space"), ("symbols", "symbols"), ("halloween", "halloween")]
        btns = "".join(f'<button type="button" data-f="{k}" aria-pressed="{"true" if k == "all" else "false"}">{t}</button>' for k, t in f)
        filt = f"""<div class="pfilters"><input type="search" id="psearch" placeholder="search patterns" aria-label="search patterns">
  <div class="chips" role="group" aria-label="filter patterns">{btns}</div></div>"""
    return filt + f'<div class="pgrid" id="pgrid">{"".join(cards)}</div>'

def follow_block(skip=()):
    items = [("youtube", YT, "the films"), ("instagram", IG, "the land + what i'm making"), ("tiktok", TT, "short clips"),
             ("pinterest", PIN, "jewelry + patterns"), ("etsy · jewelry", SHOP, "handmade pieces"), ("etsy · patterns", DIGITALS, "samsara digitals")]
    cards = "".join(f'<a href="{u}" target="_blank" rel="noopener"><strong>{n}</strong><span class="label">{d}</span></a>' for n, u, d in items if n not in skip)
    return f'<div class="follow reveal">{cards}</div>'

def footer(base):
    return f"""<footer class="foot"><div class="wrap">
  <div class="foot-ring" aria-hidden="true"></div>
  <p class="tagline">the same old cycle.</p>
  <p class="foot-links"><a href="{base}land/">the land</a> · <a href="{base}films/">films</a> · <a href="{base}patterns/">patterns</a> · <a href="{base}field-guide/">field guide</a> · <a href="{base}bead-lab/">bead lab</a> · <a href="{base}about/">about</a> · <a href="{NEWSLETTER}" target="_blank" rel="noopener">newsletter</a></p>
  <p class="label">winters we travel as <a href="{PN}" target="_blank" rel="noopener">pneuma nomads</a>. &copy; <span id="year">2026</span> same old samsara</p>
</div></footer>
<script src="{base}js/site.js" defer></script>
</body>
</html>
"""

def page(title, desc, base, path, body, here="", noindex=False, jsonld=None, image=None, extra_js=""):
    return (head(title, desc, base, path, noindex, jsonld, image) + nav(base, here)
            + f'<main id="main">{body}</main>' + extra_js + footer(base))

# ---------------- pages ----------------

ORG = {
    "@context": "https://schema.org", "@type": "Organization", "name": "Same Old Samsara", "url": SITE + "/",
    "logo": SITE + "/favicon/web-app-manifest-512x512.png",
    "description": "Same Old Samsara is the creative outlet of Chad and Daniel: a documentary about turning 34 acres in central New York into a small farm, handmade beaded jewelry, and brick stitch and bead loom patterns.",
    "sameAs": [YT, IG, TT, PIN, SHOP, DIGITALS],
}

def hero_block(base, kicker=""):
    return f"""<section class="hero">
  <div class="ring-wrap" aria-hidden="true"><div class="ring"></div></div>
  <div class="wrap hero-text">
    {f'<p class="label kicker">{e(kicker)}</p>' if kicker else ''}
    <h1>same old samsara</h1>
    <p class="tag">the same old cycle.</p>
    <p class="def">a creative outlet: films from the land, handmade jewelry, beading patterns, and whatever comes next. two guys, 34 acres in central new york, learning as we go.</p>
  </div>
  <div class="wrap">{almanac_strip()}</div>
</section>"""

def home(variant="home"):
    base = "" if variant == "home" else "../"
    free = [p for p in PATTERNS if p.get("free")]
    picks = [p for p in PATTERNS if p.get("design")][:5]
    wear = "".join(f"""<a class="wcard reveal" href="{listing(p['id'])}" target="_blank" rel="noopener">
      <img src="{base}{p['img']}" alt="{e(p['name'])}" width="600" height="600" loading="lazy"><div><h3>{e(p['name'])}</h3><span class="label">{p['price']}</span></div></a>""" for p in FEATURED)
    strip = "".join(f'<figure class="snap"><img src="{base}{src}" alt="{e(cap)}" loading="lazy" style="object-position:{pos}"><figcaption class="label">{e(cap)}</figcaption></figure>' for src, cap, pos in PHOTOS)
    s_land = f"""<section class="section" id="land"><div class="wrap">
  {section_head("01", "the land", "34 acres · central new york · since sept 4, 2026")}
  <p class="lede reveal">meadow, woods and a creek. right now it's goldenrod, mushrooms and a lot of figuring out. the plan is a small farm: a market garden, a farm stand, flowers.</p>
</div>
<div class="snaps" tabindex="0" aria-label="photos from the land">{strip}</div>
<div class="wrap"><div class="btns reveal"><a class="btn solid" href="{base}land/">walk the land</a><a class="btn" href="{base}field-guide/">the field guide</a></div></div></section>"""
    s_films = f"""<section class="section band" id="films"><div class="wrap">{section_head("02", "films", "season 1 · 2026")}{films_block(base)}</div></section>"""
    s_make = f"""<section class="section" id="patterns"><div class="wrap">{section_head("03", "make", "beading patterns + the bead lab")}
  <p class="lede reveal">brick stitch and bead loom patterns. every bead charted, a word chart you can tick off, toho colors listed. a few are free.</p>
  {patterns_grid(base, free + picks, show_filters=False)}
  <div class="btns reveal"><a class="btn solid" href="{base}patterns/">every pattern</a><a class="btn" href="{base}bead-lab/">play in the bead lab</a></div>
</div></section>"""
    s_wear = f"""<section class="section band soft" id="wear"><div class="wrap">{section_head("04", "wear", "handmade jewelry")}
  <p class="lede reveal">beaded by hand, one bead at a time. this is the shop that keeps the films going.</p>
  <div class="wgrid">{wear}</div>
  <div class="btns reveal"><a class="btn solid" href="{SHOP}" target="_blank" rel="noopener">the jewelry shop on etsy</a><a class="btn" href="{DEPOP}" target="_blank" rel="noopener">also on depop</a></div>
</div></section>"""
    s_wheel = f"""<section class="section" id="year"><div class="wrap">{section_head("05", "the wheel of the year", "what the land is doing, month by month")}{wheel_block()}</div></section>"""
    skip = {"ig": ("instagram",), "yt": ("youtube",), "pin": ("pinterest",)}.get(variant, ())
    s_follow = f"""<section class="section" id="follow"><div class="wrap">{section_head("06", "follow along", "@sameoldsamsara everywhere")}{follow_block(skip)}</div></section>"""
    kicker = {"ig": "everything from the bio", "yt": "thanks for watching", "pin": "handmade jewelry + beading patterns"}.get(variant, "")
    order = {"home": [s_land, s_films, s_make, s_wear, s_wheel, s_follow],
             "ig": [s_films, s_wear, s_make, s_land, s_wheel, s_follow],
             "yt": [s_films, s_land, s_wear, s_make, s_wheel, s_follow],
             "pin": [s_make, s_wear, s_land, s_films, s_wheel, s_follow]}[variant]
    body = hero_block(base, kicker) + "".join(order)
    path = "" if variant == "home" else f"{variant}/"
    return page("Same Old Samsara | Films From the Land, Handmade Jewelry, Beading Patterns",
                "Same Old Samsara: a documentary about turning 34 acres in central New York into a small farm, handmade beaded jewelry, and brick stitch and bead loom patterns.",
                base, path, body, noindex=variant != "home", jsonld=[ORG, {"@context": "https://schema.org", "@type": "WebSite", "name": "Same Old Samsara", "url": SITE + "/"}] if variant == "home" else None)

def land_page():
    base = "../"
    strip = "".join(f'<figure class="field reveal"><img src="{base}{src}" alt="{e(cap)}" loading="lazy"><figcaption><span class="label">field note</span> {e(cap)}</figcaption></figure>' for src, cap, _ in PHOTOS)
    body = f"""<section class="hero small"><div class="wrap hero-text">
  <p class="label kicker">no. 01</p><h1>the land</h1><p class="tag">34 acres. central new york.</p>
  <p class="def">we bought it on september 4, 2026. meadow, woods and a creek, one rough track in. no house yet, no barn, no tractor. the plan, someday, is a small farm: a market garden, a farm stand, flowers. the films are the record of figuring it out.</p>
</div><div class="wrap">{almanac_strip()}</div></section>
<section class="section"><div class="wrap">{section_head("·", "walk the land", "tap a spot")}{map_block(base)}</div></section>
<section class="section band soft"><div class="wrap">{section_head("·", "the wheel of the year", "the same old cycle, on the ground")}{wheel_block()}</div></section>
<section class="section"><div class="wrap">{section_head("·", "field notes", "photos from the land")}<div class="fieldgrid">{strip}</div>
<div class="btns reveal"><a class="btn solid" href="{base}field-guide/">play the field guide</a><a class="btn" href="{base}films/">watch the films</a></div></div></section>"""
    return page("The Land | 34 Acres in Central New York | Same Old Samsara",
                "34 acres of meadow, woods and creek in central New York that we're slowly turning into a small farm. A map, the wheel of the year, and field notes.",
                base, "land/", body, here="land/")

def films_page():
    base = "../"
    ld = [{"@context": "https://schema.org", "@type": "VideoObject", "name": f'{x["title"]} ({x["label"]})', "description": x["blurb"],
           "thumbnailUrl": f'{SITE}/{x["img"]}', "uploadDate": "2026-10-17" if x["id"] == "xSpspkCw9og" else "2026-10-24",
           "embedUrl": f'https://www.youtube-nocookie.com/embed/{x["id"]}', "url": f'https://www.youtube.com/watch?v={x["id"]}'} for x in EPISODES]
    body = f"""<section class="hero small"><div class="wrap hero-text">
  <p class="label kicker">no. 02</p><h1>films</h1><p class="tag">a season a year.</p>
  <p class="def">a documentary about our first years on 34 acres in central new york. two guys, no farming background, one camera. season 1 is 2026.</p>
</div></section>
<section class="section"><div class="wrap">{section_head("·", "season 1", "2026")}{films_block(base, all_eps=True, lede="new episodes as the year turns. start at episode 1, it's a story.")}</div></section>
<section class="section band soft"><div class="wrap">{section_head("·", "between episodes", "shorts + the rest")}{follow_block(("etsy · jewelry", "etsy · patterns"))}</div></section>"""
    return page("Films | A Documentary From Our Land | Same Old Samsara",
                "Same Old Samsara is a documentary series about our first years turning 34 acres in central New York into a small farm. Season 1, 2026.",
                base, "films/", body, here="films/", jsonld=ld)

def patterns_page():
    base = "../"
    order = sorted(PATTERNS, key=lambda p: (not p.get("free"), "halloween" in p["cats"], not p.get("design"), p["name"]))
    ld = [{"@context": "https://schema.org", "@type": "ItemList", "name": "Same Old Samsara beading patterns",
           "itemListElement": [{"@type": "ListItem", "position": i + 1, "name": p["name"],
                                "url": f'{SITE}/assets/{p["file"]}.pdf' if p.get("free") else f"{SITE}/patterns/{slug(p)}/"} for i, p in enumerate(order)]}]
    body = f"""<section class="hero small"><div class="wrap hero-text">
  <p class="label kicker">no. 03</p><h1>beading patterns</h1><p class="tag">a few free. the rest at samsara digitals.</p>
  <p class="def">brick stitch and bead loom patterns by same old samsara. every pdf has the bead diagram, a word chart you can tick off row by row, and the colors. instant download from etsy.</p>
  <div class="btns center"><a class="btn solid" href="{DIGITALS}" target="_blank" rel="noopener">samsara digitals on etsy</a><a class="btn" href="{base}bead-lab/">design your own</a></div>
</div></section>
<section class="section"><div class="wrap">{patterns_grid(base, order)}
  <div class="note reveal"><p><strong>don't bead?</strong> the finished pieces are in the <a href="{SHOP}" target="_blank" rel="noopener">jewelry shop</a>.</p></div>
</div></section>"""
    return page("Beading Patterns: Brick Stitch + Bead Loom PDFs | Same Old Samsara",
                "Brick stitch and bead loom beading patterns: rainbow parrot, squid and jellyfish wavy fringe, silly goose, triceratops, om, flying saucer and more. A few free PDFs, the rest $2.99 to $4.99 on Etsy.",
                base, "patterns/", body, here="patterns/", jsonld=ld)

def pattern_detail(p):
    base = "../../"
    url = f"{SITE}/patterns/{slug(p)}/"
    img_abs = f"{SITE}/{pattern_img(p)}"
    title_name = p["name"].replace(" (wavy fringe)", "").replace(" (3 sizes)", "")
    kind = "Bead Loom" if p["type"] == "loom" else "Brick Stitch"
    product = {"@context": "https://schema.org", "@type": "Product",
               "name": f"{title_name.title()} {kind} Beading Pattern (PDF)",
               "description": p["blurb"], "image": [img_abs], "sku": f'SD-{p["etsy"]}',
               "brand": {"@type": "Brand", "name": "Same Old Samsara"}, "category": "Arts & Crafts > Beading Patterns",
               "offers": {"@type": "Offer", "price": p["price"], "priceCurrency": "USD", "availability": "https://schema.org/InStock",
                          "url": listing(p["etsy"]), "seller": {"@type": "Organization", "name": "Samsara Digitals"}}}
    crumbs = {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "home", "item": SITE + "/"},
        {"@type": "ListItem", "position": 2, "name": "patterns", "item": SITE + "/patterns/"},
        {"@type": "ListItem", "position": 3, "name": p["name"], "item": url}]}
    rows = "".join(f"<tr><th>{e(k)}</th><td>{e(v)}</td></tr>" for k, v in facts(p))
    cols = color_names(p)
    swatches = ""
    d = design(p)
    if d:
        swatches = "".join(f'<li><i style="background:{c["hex"]}"></i>{e(c["name"])}</li>' for c in d["colorways"][0]["colors"].values())
        swatches = f'<h3 class="mini">the colors</h3><ul class="swatches">{swatches}</ul>'
    inside = ["bead diagram, every bead drawn", "word chart with a checkbox for every row", "color legend with toho codes + how many beads to buy",
              "stitch guide with thread paths", "step by step how-to"] if d else ["bead diagram", "word chart", "color legend"]
    if d and d.get("wave"): inside.insert(0, "the wave: how the wavy fringe works")
    related = [q for q in PATTERNS if q is not p and not q.get("free") and set(q["cats"]) & set(p["cats"])][:3]
    rel = patterns_grid(base, related, show_filters=False) if related else ""
    body = f"""<section class="section pdetail"><div class="wrap">
  <p class="label crumbs"><a href="{base}patterns/">patterns</a> / {e(p['type'])}</p>
  <div class="pd">
    <div class="pd-img reveal"><img src="{base}{pattern_img(p)}" alt="{e(p['name'])} {p['type']} beading pattern, every bead charted" width="1400" height="1050"></div>
    <div class="pd-info reveal">
      <h1>{e(title_name)}</h1><p class="label">{e(p['type'])} beading pattern · pdf</p>
      <p class="pd-blurb">{e(p['blurb'])}</p>
      <div class="btns"><a class="btn solid big" href="{listing(p['etsy'])}" target="_blank" rel="noopener">get it on etsy · ${p['price']}</a></div>
      <table class="facts">{rows}</table>
      {swatches}
      <h3 class="mini">what's inside</h3><ul class="inside">{''.join(f'<li>{e(x)}</li>' for x in inside)}</ul>
      <p class="label">sold through samsara digitals, our pattern shop on etsy. you can sell what you make from it.</p>
    </div>
  </div>
  {f'<div class="related">{section_head("·", "you might also like")}{rel}</div>' if rel else ''}
</div></section>"""
    desc = f"{title_name.title()} {kind.lower()} beading pattern PDF by Same Old Samsara. {p['blurb']} ${p['price']}, instant download."
    return page(f"{title_name.title()} {kind} Pattern (PDF) | Same Old Samsara", desc, base, f"patterns/{slug(p)}/", body,
                here="patterns/", jsonld=[product, crumbs], image=img_abs)

def beadlab_page():
    base = "../"
    pal = json.dumps([{"n": n, "c": c} for n, c in TOHO])
    body = f"""<section class="hero small"><div class="wrap hero-text">
  <p class="label kicker">no. 04</p><h1>the bead lab</h1><p class="tag">design your own brick stitch.</p>
  <p class="def">tap beads to color them. mirror mode keeps it symmetric. when you like it, grab the word chart and stitch it for real. it saves in your browser, so you can come back to it.</p>
</div></section>
<section class="section lab-section"><div class="wrap">
  <div class="lab" id="lab" data-palette='{e(pal)}'>
    <div class="lab-tools">
      <div class="palette" id="palette" role="radiogroup" aria-label="bead colors"></div>
      <div class="tool-row">
        <button type="button" data-tool="paint" aria-pressed="true">paint</button>
        <button type="button" data-tool="erase" aria-pressed="false">erase</button>
        <button type="button" data-tool="fill" aria-pressed="false">fill</button>
        <button type="button" id="mirror" aria-pressed="true">mirror</button>
      </div>
      <div class="tool-row">
        <button type="button" id="undo">undo</button><button type="button" id="clear">clear</button>
        <label class="size">size <select id="labsize"><option value="14x18">small</option><option value="18x26" selected>medium</option><option value="24x34">large</option></select></label>
      </div>
      <div class="tool-row">
        <button type="button" class="solid" id="chartbtn">word chart</button><button type="button" id="png">save image</button>
      </div>
      <p class="label" id="labcount">0 beads</p>
    </div>
    <div class="lab-board"><svg id="board" role="img" aria-label="brick stitch grid"></svg></div>
  </div>
  <div class="chart-out" id="chartout" hidden><h3 class="mini">your word chart</h3><p class="label">rows top to bottom. → left to right, ← right to left. start with a ladder of your widest row.</p><pre id="charttext"></pre>
    <button type="button" class="btn" id="copychart">copy it</button></div>
  <div class="note reveal"><p>made something? tag <strong>@sameoldsamsara</strong>. want a finished pattern instead? <a href="{base}patterns/">the pattern library</a>.</p></div>
</div></section>"""
    return page("The Bead Lab: Design Your Own Brick Stitch Pattern | Same Old Samsara",
                "A free brick stitch pattern maker. Color beads on a real offset brick grid with Toho colors, mirror for symmetry, and get a word chart to stitch from.",
                base, "bead-lab/", body, here="bead-lab/", extra_js=f'<script src="{base}js/beadlab.js" defer></script>')

def fieldguide_page():
    base = "../"
    crit = "".join(f"""<button class="critter reveal" type="button" data-id="{c['id']}" aria-label="who's this? tap to see">
  <span class="cframe"><img src="{base}{c['img']}" alt="{e(c['name'])}" loading="lazy" style="transform-origin:{c['focus']}"></span>
  <span class="label q">who's this?</span><span class="ans"><strong>{e(c['name'])}</strong><span>{e(c['note'])}</span></span></button>""" for c in CRITTERS)
    crit += """<div class="critter soon reveal"><span class="cframe"><span class="cam" aria-hidden="true"></span></span>
  <span class="ans show"><strong>coming soon</strong><span>a trail cam is going up on the land. whoever walks past ends up here.</span></span></div>"""
    finds = "".join(f"""<button class="find reveal" type="button" data-id="{f['id']}" aria-label="turn over: {e(f['hint'])}">
  <span class="face back"><span class="label">find no. {i:02d}</span><span class="hint">{e(f['hint'])}</span><span class="label tap">tap to turn over</span></span>
  <span class="face front"><img src="{base}{f['img']}" alt="{e(f['name'])}" loading="lazy"><strong>{e(f['name'])}</strong><span>{e(f['note'])}</span></span></button>""" for i, f in enumerate(FINDS, 1))
    body = f"""<section class="hero small"><div class="wrap hero-text">
  <p class="label kicker">the land</p><h1>the field guide</h1><p class="tag">who lives here, and what we've found.</p>
  <p class="def">everything here was found on our land in central new york. we're not experts. we're learning it one walk at a time, and this guide grows as we do.</p>
</div></section>
<section class="section"><div class="wrap">{section_head("·", "who lives here", "guess first, then tap")}
  <p class="lede reveal">each one starts zoomed way in. take a guess, then tap to see the whole thing.</p>
  <div class="critters" id="critters">{crit}</div>
  <p class="label tally" id="met"></p>
</div></section>
<section class="section band soft"><div class="wrap">{section_head("·", "things to find", "read the hint, then turn it over")}
  <div class="finds" id="finds">{finds}</div>
  <p class="label tally" id="found"></p>
  <div class="btns reveal"><button type="button" class="btn" id="resetfg">start over</button><a class="btn solid" href="{base}land/">walk the land</a></div>
</div></section>"""
    return page("The Field Guide: Who Lives on the Land | Same Old Samsara",
                "A little interactive field guide to our 34 acres in central New York: guess the animals from a close-up, and turn over the mushrooms, moss and plants we've found.",
                base, "field-guide/", body, here="field-guide/", extra_js=f'<script src="{base}js/fieldguide.js" defer></script>')

def about_page():
    base = "../"
    body = f"""<section class="hero small"><div class="wrap hero-text">
  <p class="label kicker">about</p><h1>who's behind this</h1><p class="tag">chad + daniel.</p>
</div></section>
<section class="section"><div class="wrap prose reveal">
  <p><strong>same old samsara</strong> is chad's creative outlet. it started with memes, then beads and patterns, and now it's mostly film. later maybe screen prints, or things made from what grows on the land.</p>
  <p>samsara is the wheel: birth, death, coming back around. the raven sits on the ouroboros, the snake eating its tail. seasons come back. projects get set down and picked back up. the same old cycle.</p>
  <p>in september 2026 we (chad and daniel) bought 34 acres in central new york: meadow, woods and a creek. we're turning it into a small farm, one bed at a time, and filming all of it. summers on the land, winters on the road in our rv as <a href="{PN}" target="_blank" rel="noopener">pneuma nomads</a>.</p>
  <h2>what's here</h2>
  <ul>
    <li><a href="{base}films/">films</a>: the documentary, a season a year on <a href="{YT}" target="_blank" rel="noopener">youtube</a>.</li>
    <li><a href="{base}patterns/">beading patterns</a>: brick stitch and bead loom pdfs on <a href="{DIGITALS}" target="_blank" rel="noopener">samsara digitals</a>. a few free.</li>
    <li><a href="{SHOP}" target="_blank" rel="noopener">handmade jewelry</a>: beaded earrings, bracelets and necklaces on etsy.</li>
    <li><a href="{base}bead-lab/">the bead lab</a>: a free tool to design your own brick stitch.</li>
  </ul>
  <h2>say hi</h2><p>the easiest way is a message on <a href="{SHOP}" target="_blank" rel="noopener">etsy</a> or <a href="{IG}" target="_blank" rel="noopener">instagram</a>.</p>
</div></section>"""
    return page("About | Same Old Samsara", "Same Old Samsara is the creative outlet of Chad and Daniel: films from their land in central New York, handmade beaded jewelry and beading patterns.",
                base, "about/", body, here="about/", jsonld=[ORG])

def notfound():
    base = "/"
    body = f"""<section class="hero"><div class="ring-wrap" aria-hidden="true"><div class="ring"></div></div>
<div class="wrap hero-text"><p class="label kicker">404</p><h1>back around again.</h1><p class="tag">this page isn't here.</p>
<p class="def">you went all the way around the wheel and ended up where you started. same old cycle.</p>
<div class="btns center"><a class="btn solid" href="/">home</a><a class="btn" href="/patterns/">patterns</a><a class="btn" href="/land/">the land</a></div></div></section>"""
    return page("Not Here | Same Old Samsara", "This page isn't here.", base, "404.html", body, noindex=True)

def old_patterns_redirect():
    return f"""<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Beading Patterns | Same Old Samsara</title>
<link rel="canonical" href="{SITE}/patterns/"><meta name="robots" content="noindex, follow"><meta http-equiv="refresh" content="0; url=patterns/"></head>
<body><p>the patterns moved to <a href="patterns/">sameoldsamsara.xyz/patterns</a>.</p></body></html>
"""

def llms_txt():
    lines = ["# Same Old Samsara", "",
             "> The creative outlet of Chad and Daniel: a documentary series about turning 34 acres in central New York into a small farm, handmade beaded jewelry (Etsy: sameoldsamsara), and brick stitch and bead loom beading patterns (Etsy: samsaradigitals). Motto: the same old cycle.", "",
             "Everything on this site is lowercase on purpose. Prices are in USD.", "",
             "## Films", f"- [YouTube channel]({YT}): Same Old Samsara, a season a year. Season 1 is 2026."]
    lines += [f"- [{x['label'].title()}: {x['title']}](https://www.youtube.com/watch?v={x['id']}) ({x['len']}): {x['blurb']}" for x in reversed(EPISODES)]
    lines += ["", "## Beading patterns", f"PDF patterns. Paid ones are instant downloads from [Samsara Digitals on Etsy]({DIGITALS}). Full library: {SITE}/patterns/", ""]
    for p in PATTERNS:
        if p.get("free"):
            lines.append(f"- [{p['name']}]({SITE}/assets/{p['file']}.pdf): free {p['type']} pattern. {p['blurb']}")
        elif p.get("live"):
            lines.append(f"- [{p['name']}]({SITE}/patterns/{slug(p)}/): {p['type']} pattern, ${p['price']}. {p['blurb']} Buy: {listing(p['etsy'])}")
    lines += ["", "## Tools", f"- [The field guide]({SITE}/field-guide/): the animals, plants and fungi found on the land so far, as a small guessing game.", f"- [The bead lab]({SITE}/bead-lab/): free in-browser brick stitch designer. Toho 11/0 colors, mirror mode, exports a word chart.", "",
              "## Jewelry", f"- [Same Old Samsara on Etsy]({SHOP}): handmade beaded earrings, bracelets and necklaces. Many are made to order.", f"- [Depop]({DEPOP})", "",
              "## About", f"- [About]({SITE}/about/)", f"- [The land]({SITE}/land/): 34 acres of meadow, woods and creek in central New York, bought September 4, 2026. The exact location is private.",
              f"- Winter travel channel: [Pneuma Nomads]({PN})", "",
              "## Social", f"- YouTube: {YT}", f"- Instagram: {IG}", f"- TikTok: {TT}", f"- Pinterest: {PIN}", ""]
    return "\n".join(lines)

def robots_txt():
    return f"""# everyone's welcome, people and AI agents. the same old cycle.
User-agent: *
Allow: /

User-agent: GPTBot
Allow: /
User-agent: OAI-SearchBot
Allow: /
User-agent: ChatGPT-User
Allow: /
User-agent: ClaudeBot
Allow: /
User-agent: Claude-User
Allow: /
User-agent: Claude-SearchBot
Allow: /
User-agent: PerplexityBot
Allow: /
User-agent: Google-Extended
Allow: /
User-agent: Applebot-Extended
Allow: /

Sitemap: {SITE}/sitemap.xml
"""

def sitemap(paths):
    urls = "".join(f"<url><loc>{SITE}/{p}</loc><lastmod>{TODAY}</lastmod></url>" for p in paths)
    return f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{urls}</urlset>\n'

def write(rel, text):
    f = ROOT / rel; f.parent.mkdir(parents=True, exist_ok=True); f.write_text(text)

if __name__ == "__main__":
    copy_pattern_images()
    write("index.html", home())
    for v in ("ig", "yt", "pin"): write(f"{v}/index.html", home(v))
    write("land/index.html", land_page())
    write("films/index.html", films_page())
    write("patterns/index.html", patterns_page())
    paid = [p for p in PATTERNS if not p.get("free") and p.get("live")]
    for p in paid: write(f"patterns/{slug(p)}/index.html", pattern_detail(p))
    write("bead-lab/index.html", beadlab_page())
    write("field-guide/index.html", fieldguide_page())
    write("about/index.html", about_page())
    write("404.html", notfound())
    write("beadingpatterns.html", old_patterns_redirect())
    write("llms.txt", llms_txt())
    write("robots.txt", robots_txt())
    write("sitemap.xml", sitemap(["", "land/", "field-guide/", "films/", "patterns/", "bead-lab/", "about/"] + [f"patterns/{slug(p)}/" for p in paid]))
    print("built", 9 + len(paid), "pages")
