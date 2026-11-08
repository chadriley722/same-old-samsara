#!/usr/bin/env python3
"""Builds sameoldsamsara.xyz, the almanac (v3, Oct 28 2026).

Run from anywhere: python3 _build/build.py   (Jekyll skips folders starting with _, so this never goes live)
Writes: index.html, land/, films/, patterns/ (+ one page per pattern), bead-lab/, about/, road/ (pneuma nomads, PN look), ig/ yt/ pin/ (link-in-bio
versions, noindex), 404.html, beadingpatterns.html (old url, points to patterns/), llms.txt, robots.txt, sitemap.xml.
Copies pattern images from Same Old Samsara/Patterns/<design>/UPLOAD TO ETSY/ when they exist.

To update: change EPISODES / FEATURED / PATTERNS / SPOTS below and rerun.
  - a pattern gets relisted on Etsy → set its "live" to True
  - rotate the seasonal freebie → move "featured": True to another free pattern (free ones with a design get their own page, pdf at assets/<file>.pdf)
"""
import datetime, html, json, pathlib, shutil, subprocess

ROOT = pathlib.Path(__file__).resolve().parent.parent
COWORK = ROOT.parent.parent                       # Claude CoWork/
PATTERN_SRC = COWORK / "Same Old Samsara/Patterns"
SITE = "https://sameoldsamsara.xyz"
GOOGLE_VERIFY = ""  # Search Console token: paste only the content="..." value from the HTML tag, then rebuild + push

YT = "https://www.youtube.com/@sameoldsamsara"
SHOP = "https://sameoldsamsara.etsy.com"
DIGITALS = "https://samsaradigitals.etsy.com"
DEPOP = "https://depop.com/sameoldsamsara"
IG = "https://instagram.com/sameoldsamsara"
TT = "https://tiktok.com/@sameoldsamsara"
PIN = "https://pinterest.com/sameoldsamsara"
PN = SITE + "/road/"
NEWSLETTER = "https://docs.google.com/forms/d/e/1FAIpQLScRgNsfZYcnLNtfIYfRxKKghsxMu-UJ_4P8csSh8ErWM_AfNA/viewform?usp=header"
LAND_DAY_ONE = "2026-09"  # month only in public, never the exact day

# /road = pneuma nomads (winter travel), in the PN look, not the almanac. pneumanomads.xyz points here.
PN_YT = "https://youtube.com/@pneumanomads"
PN_IG = "https://instagram.com/pneumanomads"
PN_TT = "https://tiktok.com/@pneumanomads"
PN_SPOTIFY = "https://open.spotify.com/user/chadriley722"
PN_COFFEE = "https://buymeacoffee.com/pneumanomads"
ROAD_LATEST = {"id": "NMxLh7pHhDY", "title": "salem in october.", "place": "Salem, Massachusetts", "label": "vlog 18", "len": "8:20",
               "img": "images/road/latest-vlog.jpg"}

# newest first. a new episode = one dict here + its thumbnail at images/epN-name.jpg (1280x720). date = the day it went live.
EPISODES = [
    {"id": "UhMJZrZttDI", "title": "hunting for a lost well.", "label": "season 1 · episode 4", "len": "26:41", "date": "2026-11-07",
     "img": "images/ep4-lost-well.jpg", "blurb": "A neighbor says there's an old well somewhere on the land, so Chad builds a contraption out of a pipe and some wire and goes looking. We move the house site, find a giant sycamore leaf on an island in the river, and the trail cam catches its first raccoon."},
    {"id": "SDIN5Jiadio", "title": "peak fall. then the cold came.", "label": "season 1 · episode 3", "len": "25:51", "date": "2026-10-31",
     "img": "images/ep3-peak-fall.jpg", "blurb": "Red maples, gold goldenrod, then frost and the first snow. Four RV tires changed on soft ground, two bear stories, one tree that had to come down, and a few 28 degree nights that made the call for us."},
    {"id": "YDUcJU_dp78", "title": "our first month on 34 acres.", "label": "season 1 · episode 2", "len": "23:33", "date": "2026-10-26",
     "img": "images/ep2-month-one.jpg", "blurb": "No tractor and no brush hog, just a scythe, a push mower and a lot of goldenrod. We cut a path to the old shed, move the RV onto the land and ride out the first thunderstorm."},
    {"id": "xSpspkCw9og", "title": "we bought land.", "label": "season 1 · episode 1", "len": "41:24", "date": "2026-10-17",
     "img": "images/ep1-we-bought-land.jpg", "blurb": "34 acres of goldenrod and woods in Central New York. How we found it, the rough perc test, and the first walk as owners."},
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
    {"file": "christmastree", "design": "christmastree", "slug": "christmas-tree", "name": "christmas tree", "type": "brick stitch", "cats": ["christmas"],
     "free": True, "featured": True,
     "blurb": "A three tier pine with a gold star and a few lights. One piece worked up from the widest row, so it's a good first pattern. Free for the holidays."},
    {"file": "pumpkin", "name": "pumpkin", "type": "brick stitch", "cats": ["halloween"], "free": True,
     "blurb": "A little round pumpkin with a curly stem. Quick, cute and free."},
    {"file": "rainbowdiamonds", "name": "rainbow diamonds", "type": "loom", "cats": ["rainbow"], "free": True,
     "blurb": "A rainbow diamond band for the bead loom. Free."},
    {"file": "parrot", "design": "parrot", "slug": "rainbow-parrot", "name": "rainbow parrot", "type": "brick stitch", "cats": ["animals", "rainbow"],
     "etsy": "4456758738", "price": "2.99", "live": True,
     "blurb": "A scarlet macaw in nine colors: red, gold, green, cornflower and a long navy tail on a perch."},
    {"file": "squid", "design": "squid", "slug": "squid-wavy-fringe", "name": "squid (wavy fringe)", "type": "brick stitch", "cats": ["animals", "wavy fringe"],
     "etsy": "4604548842", "price": "3.99", "live": True,
     "blurb": "A little plum squid with big eyes and long wavy fringe tentacles. The wave comes from the thread, and the pattern shows you how."},
    {"file": "jellyfish", "design": "jellyfish", "slug": "jellyfish", "name": "jellyfish (3 sizes)", "type": "brick stitch", "cats": ["animals", "wavy fringe"],
     "etsy": "4604569492", "price": "4.99", "live": True,
     "blurb": "A round jellyfish bell with wavy fringe. Small, medium and large, two colorways, all in one PDF."},
    {"file": "sillygoose", "design": "sillygoose", "slug": "silly-goose", "name": "silly goose", "type": "brick stitch", "cats": ["animals"],
     "etsy": "1784926935", "price": "2.99", "live": True,
     "blurb": "A white goose with an orange beak and feet, framed in black. For the silly geese."},
    {"file": "triceratops", "design": "triceratops", "slug": "triceratops", "name": "triceratops", "type": "brick stitch", "cats": ["animals"],
     "etsy": "1778070364", "price": "2.99", "live": True,
     "blurb": "A little green triceratops with terra cotta horns and a spotted back."},
    {"file": "omsymbolbrickstitch", "design": "omsymbolbrickstitch", "slug": "om-symbol", "name": "om symbol", "type": "brick stitch", "cats": ["symbols"],
     "etsy": "4456770826", "price": "2.99", "live": True,
     "blurb": "A black Om on a soft beige ground. Simple and steady."},
    {"file": "magicrainbowmushroom", "design": "magicrainbowmushroom", "slug": "magic-rainbow-mushroom", "name": "magic rainbow mushroom", "type": "brick stitch", "cats": ["rainbow"],
     "etsy": "1765666810", "price": "2.99", "live": True,
     "blurb": "A rainbow cap on a little beige stem. Bright and a little trippy."},
    {"file": "ufo", "design": "ufo", "slug": "flying-saucer", "name": "flying saucer", "type": "brick stitch", "cats": ["space", "rainbow"],
     "etsy": "1777788647", "price": "2.99", "live": True,
     "blurb": "A gray saucer beaming down. Yellow beam or rainbow beam, both in one PDF."},
    {"file": "aliens", "slug": "aliens-loom", "name": "aliens", "type": "loom", "cats": ["space"], "etsy": "1760591136", "price": "2.99", "live": True,
     "blurb": "A row of little alien heads for the bead loom. Green or rainbow."},
    {"file": "dnarainbow", "slug": "dna-double-helix", "name": "dna double helix", "type": "loom", "cats": ["rainbow", "symbols"], "etsy": "1792298367", "price": "2.99", "live": True,
     "blurb": "A rainbow double helix bracelet for the bead loom."},
    {"file": "rainbowspirals", "slug": "rainbow-spirals", "name": "rainbow spirals", "type": "loom", "cats": ["rainbow"], "etsy": "1775314125", "price": "2.99", "live": True,
     "blurb": "Rainbow spirals for the bead loom. Bold and hypnotic."},
    {"file": "rainbowsnake", "slug": "rainbow-snake", "name": "rainbow snake", "type": "loom", "cats": ["rainbow", "animals"], "etsy": "1774234169", "price": "2.99", "live": True,
     "blurb": "A rainbow snake wave for the bead loom."},
    {"file": "witchhat", "slug": "witch-and-wizard-hats", "name": "witch hat + wizard hat", "type": "brick stitch", "cats": ["halloween"], "etsy": "1781552260", "price": "2.99", "live": True,
     "blurb": "Two pointy hats, one listing. A witch hat and a starry wizard hat."},
    {"file": "ghostmoving", "slug": "spooky-ghost", "name": "spooky ghost", "type": "brick stitch", "cats": ["halloween"], "etsy": "1792859785", "price": "2.99", "live": True,
     "blurb": "A wavy little ghost mid float."},
    {"file": "jackolantern", "slug": "jack-o-lantern", "name": "jack o' lantern", "type": "brick stitch", "cats": ["halloween"], "etsy": "1788945937", "price": "2.99", "live": True,
     "blurb": "A grinning jack o' lantern."},
    {"file": "jackolanternwitchhat", "slug": "jack-o-lantern-witch-hat", "name": "jack o' lantern in a witch hat", "type": "brick stitch", "cats": ["halloween"], "etsy": "1781842810", "price": "2.99", "live": True,
     "blurb": "A jack o' lantern wearing a witch hat. Both Halloween classics at once."},
    {"file": "spookyseason", "slug": "spooky-season", "name": "spooky season", "type": "brick stitch", "cats": ["halloween"], "etsy": "1775414610", "price": "2.99", "live": True,
     "blurb": "A spooky season set for October."},
]

# the wheel of the year on the land (public version: nothing here gives away where the land is)
MONTHS = [  # year one. what the land does, plus our plans marked as plans. no chores we don't actually do.
    ("jan", "Snow on the meadow. The land rests and we're south for the winter."),
    ("feb", "The deepest cold. Somewhere out there the maples are getting ready."),
    ("mar", "Mud season. The snow pulls back off the meadow."),
    ("apr", "Peepers in the wet spots. First green under last year's grass."),
    ("may", "Back on the land May 1. Leaves out, black flies out."),
    ("jun", "Long days. Everything grows a foot overnight. The plan for 2027: the first garden beds."),
    ("jul", "Fireflies over the meadow. The plan someday: fruit off our own food forest."),
    ("aug", "Hot and green. The goldenrod starts to turn."),
    ("sep", "Goldenrod everywhere. September 2026 is when we got the keys."),
    ("oct", "Peak color, then the leaves come down. Mushrooms after every rain."),
    ("nov", "Bare trees, first frost. We close up and head south for the winter."),
    ("dec", "First real snow. The land sleeps."),
]

# spots on the illustrated map. x, y in the 1000 x 900 drawing. a cartoon, not to scale.
SPOTS = [
    {"id": "meadow", "x": 250, "y": 465, "name": "the meadow", "img": "images/land/meadow.jpg",
     "note": "About half the land is open meadow. In September it's solid goldenrod, and we mow paths through it with a push mower and a scythe."},
    {"id": "woods", "x": 640, "y": 300, "name": "the woods", "img": "images/land/canopy.jpg",
     "note": "The woods run the whole length of the river, so you walk through trees before you ever see water. Old trees, fallen logs, mushrooms after every rain."},
    {"id": "river", "x": 690, "y": 118, "name": "the river", "img": "images/land/creek.jpg",
     "note": "Past the woods, the land runs out at the river. This is the view from the bank in early October."},
    {"id": "track", "x": 468, "y": 510, "name": "the old track", "img": "images/land/track.jpg",
     "note": "One rough dirt track is the only way in. It swings up the side of the meadow to the shed, then turns into a footpath through the woods to the water. Every load of gravel counts."},
    {"id": "beds", "x": 300, "y": 640, "name": "the garden beds", "img": "images/land/storm.jpg",
     "note": "Where the garden beds go in 2027. Right now it's goldenrod, and we're clearing it."},
    {"id": "mycelium", "x": 545, "y": 205, "name": "the mycelium bark", "img": "images/land/roots.jpg",
     "note": "A piece of bark we picked up in the woods. Those white threads are mycelium, the part of a mushroom you never see."},
    {"id": "forest-floor", "x": 395, "y": 190, "name": "the mushroom spot", "img": "images/land/mushroom.jpg",
     "note": "After rain the forest floor puts up mushrooms we're still learning to name."},
    {"id": "house", "x": 340, "y": 380, "name": "the house site (someday)", "img": "images/land/lone-tree.jpg",
     "note": "The house comes later, 2028 or after. We already moved the spot once. That's how it goes."},
]

PHOTOS = [  # (image, caption, crop focus for the 4:5 strip)
    ("images/land/mist-sunrise.jpg", "Fog on the low ground at sunrise.", "center"),
    ("images/land/meadow.jpg", "The meadow, late summer.", "center"),
    ("images/land/creek.jpg", "The river in early October.", "center"),
    ("images/land/storm.jpg", "A storm rolling in over the field.", "center"),
    ("images/land/canopy.jpg", "Looking up in the woods.", "center"),
    ("images/land/mushroom.jpg", "After the rain.", "center"),
    ("images/land/moon-dusk.jpg", "The moon over the meadow at dusk.", "8% 50%"),
    ("images/land/forest-floor.jpg", "The forest floor in October.", "center"),
    ("images/land/lone-tree.jpg", "The lone tree in the field.", "center"),
    ("images/land/roots.jpg", "Mycelium on a piece of bark from the woods.", "center"),
]

# field guide: who lives here (zoom in, guess, tap to see it whole). focus = where the close-up starts.
# add trail cam photos here as they come in.
CRITTERS = [
    {"id": "grasshopper", "img": "images/land/grasshopper.jpg", "focus": "70% 42%", "name": "a grasshopper",
     "note": "Posing on the RV hitch like it owned the place."},
    {"id": "garter", "img": "images/land/snake.jpg", "focus": "57% 60%", "name": "a garter snake",
     "note": "On the gravel. Harmless, and fast."},
    {"id": "monarch", "img": "images/land/monarch.jpg", "focus": "68% 59%", "zoom": 11, "name": "a monarch",
     "note": "On the purple asters in the meadow, in September."},
    {"id": "wasp", "img": "images/land/wasp.jpg", "focus": "64% 46%", "name": "a wasp",
     "note": "Hanging off the RV window."},
    {"id": "toad", "img": "images/land/toad.jpg", "focus": "57% 58%", "name": "a big toad",
     "note": "Sitting still in the grass, sure we couldn't see it."},
    {"id": "caterpillar", "img": "images/land/caterpillar.jpg", "focus": "45% 52%", "name": "a yellow caterpillar",
     "note": "Walking a railing in October. No idea what it turns into."},
    {"id": "woolly-bear", "img": "images/land/woolly-bear.jpg", "focus": "50% 77%", "zoom": 5, "name": "a woolly bear",
     "note": "A present for Daniel in October. It spends the winter frozen solid, then turns into an Isabella tiger moth."},
    {"id": "geese", "img": "images/land/geese.jpg", "focus": "50% 45%", "zoom": 2.5, "name": "canada geese",
     "note": "A V of them heading south in late September. We followed in November."},
]

# field guide: things to find. starts face down with a hint, tap to turn it over.
FINDS = [
    {"id": "goldenrod", "img": "images/land/meadow.jpg", "name": "goldenrod", "hint": "The whole meadow turns this color in September.",
     "note": "Most of the land is goldenrod. It feeds the bees in fall, and it's what we're clearing for the garden."},
    {"id": "mycelium", "img": "images/land/roots.jpg", "name": "mycelium", "hint": "White threads on a piece of bark.",
     "note": "The part of a mushroom you never see. It runs through the dead wood and the soil and holds the woods together."},
    {"id": "white-mushroom", "img": "images/land/mushroom.jpg", "name": "a little white mushroom", "hint": "Pops up in the leaves after rain.",
     "note": "We're not naming it, and we're definitely not eating it."},
    {"id": "moss", "img": "images/land/moss.jpg", "name": "moss on a fallen log", "hint": "Soft and green, all over the fallen logs.",
     "note": "With a tiny mushroom growing out of it. The woods are full of these logs."},
    {"id": "gully", "img": "images/land/forest-floor.jpg", "name": "the gully", "hint": "Fallen trees, rocks and water, deep in the woods.",
     "note": "A little stream cuts through the woods here. Everything is covered in moss."},
    {"id": "canopy", "img": "images/land/canopy.jpg", "name": "the canopy", "hint": "You have to look up for this one.",
     "note": "Tall trees in the back woods. Lie down and look up."},
    {"id": "river", "img": "images/land/creek.jpg", "name": "the river", "hint": "Keep walking through the woods until the trees stop.",
     "note": "The land runs down to the river. This is early October from the bank."},
    {"id": "asters", "img": "images/land/asters.jpg", "name": "new england asters", "hint": "Purple in the meadow, right when the goldenrod is going.",
     "note": "The monarchs stop on these in September to fuel up for the trip south."},
    {"id": "milkweed", "img": "images/land/milkweed.jpg", "name": "common milkweed", "hint": "Pods that split open into white silk in the fall.",
     "note": "The only plant monarch caterpillars eat. We saved a plate of the seeds and threw the rest to the wind."},
    {"id": "turkey-tail", "img": "images/land/turkey-tail.jpg", "name": "turkey tail, we think", "hint": "Thin striped shelves on a mossy log.",
     "note": "A bracket fungus that breaks dead wood back down into soil. We're not experts, so we only look."},
    {"id": "sycamore", "img": "images/land/sycamore.jpg", "name": "a sycamore leaf", "hint": "A leaf bigger than your hand, down by the water.",
     "note": "Sycamores like wet ground by the river. Their leaves get huge."},
    {"id": "bear-sign", "img": "images/land/bear-tree.jpg", "name": "bear sign", "hint": "Torn bark on a dead tree in the woods.",
     "note": "We think a young bear climbed this one. So far we've seen more bear than deer."},
    {"id": "red-maple", "img": "images/land/red-maple.jpg", "name": "red maple", "hint": "The first tree to go red in the fall.",
     "note": "This leaf still had frost on it. Red maples turn early and they turn loud."},
    {"id": "honey-mushroom", "img": "images/land/honey-mushroom.jpg", "name": "honey mushrooms, we think", "hint": "Tan clusters on an old stump in October.",
     "note": "They spread under the bark in black cords. They have poisonous lookalikes, so we leave them be."},
    {"id": "wild-apple", "img": "images/land/wild-apple.jpg", "name": "wild apples", "hint": "Small sour apples on an old tree nobody prunes.",
     "note": "Better than the store, Chad says. The deer get whatever falls."},
    {"id": "red-belted-conk", "img": "images/land/red-belted-conk.jpg", "name": "red belted conk", "hint": "A hard shelf with a red band, on a hemlock.",
     "note": "It adds a new layer every year and slowly turns the tree back into soil."},
    {"id": "sumac", "img": "images/land/sumac.jpg", "name": "staghorn sumac", "hint": "Fuzzy red seed heads that hang on all winter.",
     "note": "Birds eat them late in winter. We picked some in September for sumac lemonade."},
    {"id": "antler-shed", "img": "images/land/antler-shed.jpg", "name": "an antler shed", "hint": "Bone white, half hidden in the brush.",
     "note": "Bucks drop them every winter. Mice chew the old ones, so a whole one is lucky."},
    {"id": "puffballs", "img": "images/land/puffballs.jpg", "name": "little puffballs, we think", "hint": "Little round mushrooms lined up on a log.",
     "note": "When they're ripe, a tap sends up a puff of spores. We only poke them."},
    {"id": "highbush-cranberry", "img": "images/land/highbush-cranberry.jpg", "name": "highbush cranberry", "hint": "Red berry clusters that hang on into winter.",
     "note": "A viburnum, not a real cranberry. We still need to work out if it's the native one."},
    {"id": "aspen", "img": "images/land/aspen.jpg", "name": "an aspen leaf", "hint": "A round yellow leaf that shakes in any breeze.",
     "note": "Flat stems make them quake. Quaking or bigtooth, we'll check in spring."},
    {"id": "hemlock", "img": "images/land/hemlock.jpg", "name": "eastern hemlock", "hint": "Look straight up in the dark part of the woods.",
     "note": "Short flat needles with two white stripes underneath. Most of our evergreens are these, not pine."},
    {"id": "lichen", "img": "images/land/lichen.jpg", "name": "lichen", "hint": "Pale and crinkly, all over an old log.",
     "note": "A fungus and an alga living together. They grow slowly and like clean air."},
    {"id": "frost", "img": "images/land/frost.jpg", "name": "frost on the goldenrod", "hint": "The meadow turns white on a cold morning.",
     "note": "The first hard frost turned the goldenrod white. We started calling it icerod."},
    {"id": "blackberry", "img": "images/land/blackberry.jpg", "name": "wild blackberries", "hint": "The prickers. You find them with your legs first.",
     "note": "Ripe in late summer, if the birds don't get there first."},
    {"id": "fern", "img": "images/land/fern.jpg", "name": "a fern gone gold", "hint": "An orange clump growing out of a stump.",
     "note": "Ferns are older than flowers. This one turns gold in late October and comes back green in spring."},
    {"id": "dames-rocket", "img": "images/land/dames-rocket.jpg", "name": "dame's rocket", "hint": "Purple flowers in the fern field in May.",
     "note": "Pretty and sweet at night, but not native. Four petals, so it isn't phlox."},
    {"id": "gilled-shelf", "img": "images/land/gilled-shelf.jpg", "name": "a shelf fungus with gills", "hint": "Look up a dead tree in the woods.",
     "note": "Most shelf fungi have pores underneath. This one has gills, so we're still working on a name."},
    {"id": "hornet-nest", "img": "images/land/hornet-nest.jpg", "name": "an old hornet nest", "hint": "Gray paper comb, empty by fall.",
     "note": "Chewed wood, built in layers. Only the new queens make it through winter, and never in the old nest."},
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

def ver(rel):
    """short content hash, so browsers pick up a changed style.css or script right away"""
    import hashlib
    return hashlib.md5((ROOT / rel).read_bytes()).hexdigest()[:8]

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
    if (ROOT / f"images/patterns/{slug(p)}.jpg").exists():
        return f"images/patterns/{slug(p)}.jpg"
    return f"assets/{p['file']}.jpg"

def old_card(p, dst):
    """4:3 stand-in for patterns not redone yet: the old square picture framed on wavy cream + name label,
    so it matches the v2 heroes. replaced automatically once the pattern gets a design + hero."""
    import base64, tempfile
    W, H, S = 1400, 1050, 740
    b64 = lambda f, t: f"data:{t};base64," + base64.b64encode(pathlib.Path(f).read_bytes()).decode()
    waves = "".join(f'<path d="M0 {y} C350 {y-28} 700 {y+28} 1050 {y} S1400 {y-20} 1400 {y-20}" fill="none" stroke="#514f4c" stroke-opacity="0.09" stroke-width="2"/>'
                    for y in range(60, H, 115))
    x, y = (W - S) / 2, 52
    pic = b64(ROOT / f"assets/{p['file']}.jpg", "image/jpeg")
    name, sub = f'{p["name"]} pattern', f'{p["type"]} · {"free pdf" if p.get("free") else "pdf"}'
    font = pathlib.Path.home() / "Library/Fonts/FrauncesSOS-SemiBold.ttf"
    tw = int(subprocess.run(["magick", "-font", str(font), "-pointsize", "38", f"label:{name}", "-format", "%w", "info:"],
                            capture_output=True, text=True).stdout or len(name) * 17)
    pw = max(tw, len(sub) * 10.5) + 140
    px, py = (W - pw) / 2, 852
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="{W}" height="{H}">'
           '<defs><filter id="sh" x="-10%" y="-10%" width="120%" height="125%"><feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#33351f" flood-opacity="0.25"/></filter>'
           f'<clipPath id="r"><rect x="{x}" y="{y}" width="{S}" height="{S}" rx="14"/></clipPath></defs>'
           f'<rect width="{W}" height="{H}" fill="#fff3d9"/>{waves}'
           f'<rect x="{x-12}" y="{y-12}" width="{S+24}" height="{S+24}" rx="20" fill="#fffaf0" filter="url(#sh)"/>'
           f'<image xlink:href="{pic}" x="{x}" y="{y}" width="{S}" height="{S}" clip-path="url(#r)"/>'
           f'<rect x="{px}" y="{py}" width="{pw}" height="106" rx="16" fill="#33351f" filter="url(#sh)"/>'
           f'<image xlink:href="{b64(ROOT / "images/mark-cream.svg", "image/svg+xml")}" x="{px+24}" y="{py+14}" width="64" height="78"/>'
           f'<text x="{px+108}" y="{py+56}" font-family="Fraunces SOS" font-weight="600" font-size="38" fill="#fff4d9">{html.escape(name)}</text>'
           f'<text x="{px+110}" y="{py+86}" font-family="Courier Prime" font-weight="700" font-size="17" letter-spacing="1" fill="#d4a12a">{html.escape(sub)}</text></svg>')
    with tempfile.TemporaryDirectory() as t:
        pathlib.Path(f"{t}/c.svg").write_text(svg)
        subprocess.run(["rsvg-convert", f"{t}/c.svg", "-o", f"{t}/c.png"], check=True)
        subprocess.run(["magick", f"{t}/c.png", "-strip", "-quality", "82", str(dst)], check=True)

def copy_pattern_images():
    out = ROOT / "images/patterns"; out.mkdir(parents=True, exist_ok=True)
    for p in PATTERNS:
        dst = out / f"{slug(p)}.jpg"
        if not p.get("design"):
            src = ROOT / f"assets/{p['file']}.jpg"
            if src.exists() and (not dst.exists() or src.stat().st_mtime > dst.stat().st_mtime):
                old_card(p, dst)
            continue
        src = PATTERN_SRC / p["design"] / "UPLOAD TO ETSY/1 hero.jpg"
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
    gverify = f'<meta name="google-site-verification" content="{e(GOOGLE_VERIFY)}">\n' if GOOGLE_VERIFY else ""
    ld = "".join(f'<script type="application/ld+json">{json.dumps(j, ensure_ascii=False)}</script>\n' for j in (jsonld or []))
    return f"""<!DOCTYPE html>
<html lang="en" data-theme="day">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<title>{e(title)}</title>
<meta name="description" content="{e(desc)}">
<meta name="robots" content="{robots}">
{gverify}<link rel="canonical" href="{canonical}">
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
<link rel="stylesheet" href="{base}style.css?v={ver('style.css')}">
<script>var R=document.documentElement;R.classList.add("js");setTimeout(function(){{if(!window.SOS_READY)R.classList.remove("js");}},3000);try{{var t=localStorage.getItem("sos_theme");if(t==="night"||t==="day")R.dataset.theme=t;}}catch(_){{}}</script>
<style>:root{{--ring-url:url("{base}images/ring-norules-pepper.svg");--mark-url:url("{base}images/mark-pepper.svg");}}</style>
{ld}</head>
<body>
<a class="skip" href="#main">skip to the good part</a>
"""

NAV = [("the land", "land/"), ("films", "films/"), ("make", "make/"), ("field guide", "field-guide/"), ("jewelry", SHOP)]

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
  <div><span class="label">today on the land</span><strong data-a="day">year –</strong></div>
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

def films_block(base, all_eps=False, lede="A documentary about our first year on 34 acres in Central New York. One season a year."):
    ep = EPISODES[0]
    rest = EPISODES if all_eps else EPISODES[1:]
    others = "".join(f"""<a class="ep reveal" href="https://www.youtube.com/watch?v={x['id']}" target="_blank" rel="noopener">
      <img src="{base}{x['img']}" alt="" width="640" height="360" loading="lazy">
      <div><span class="label">{e(x['label'].split(' · ')[-1])} · {x['len']}</span><h3>{e(x['title'])}</h3>{f'<p>{e(x["blurb"])}</p>' if all_eps else ''}</div></a>""" for x in rest)
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
    pins = "".join(f"""<button class="pin" type="button" style="left:{s['x']/10}%;top:{s['y']/9}%" data-spot="{s['id']}" aria-label="{e(s['name'])}"><span></span></button>""" for s in SPOTS)
    panels = json.dumps({s["id"]: {"name": s["name"], "note": s["note"], "img": base + s["img"]} for s in SPOTS})
    return f"""<div class="map reveal">
  <div class="map-art">{land_svg()}{pins}</div>
  <aside class="map-card" id="map-card" data-spots='{e(panels)}' aria-live="polite">
    <img id="map-img" src="{base}{SPOTS[0]['img']}" alt="" width="800" height="600" loading="lazy">
    <span class="label">a spot on the land</span><h3 id="map-name">{e(SPOTS[0]['name'])}</h3><p id="map-note">{e(SPOTS[0]['note'])}</p>
  </aside>
  <p class="label map-foot">a cartoon, not to scale. the real map stays with us.</p>
</div>"""

def land_svg():
    """a hand-drawn style map of the land: an L, woods along the river, the track up the meadow. a cartoon, not to scale."""
    import random
    r = random.Random(4)
    # rough outlines, only used to scatter trees and grass
    land = [(70, 540), (395, 70), (770, 185), (450, 610), (630, 730), (450, 870)]
    woods = [(215, 330), (395, 70), (770, 185), (450, 610), (470, 590), (510, 500), (530, 420), (470, 320), (400, 300), (300, 290)]
    path = [(495, 245), (540, 190), (590, 135)]  # keep the footpath and the shed clear of trees
    spots = [(s["x"], s["y"]) for s in SPOTS]
    def inside(poly, x, y):
        hit = False
        for (x1, y1), (x2, y2) in zip(poly, poly[1:] + poly[:1]):
            if (y1 > y) != (y2 > y) and x < x1 + (y - y1) * (x2 - x1) / (y2 - y1): hit = not hit
        return hit
    def near(pts, x, y, d): return any((x - a) ** 2 + (y - b) ** 2 < d * d for a, b in pts)
    def tree(x, y, s, cls="tree"):
        return f'<path d="M{x:.0f},{y:.0f} l{-s/2:.1f},{s:.1f} h{s:.1f} z M{x:.0f},{y+s:.0f} v6" class="{cls}"/>'
    trees = ""
    for _ in range(420):
        x, y = r.uniform(200, 780), r.uniform(70, 610)
        if not inside(woods, x, y) or near(path + spots, x, y + 10, 26): continue
        trees += tree(x, y, r.uniform(14, 24))
    # the woods carry on past our lines, on both sides of us along the water
    for _ in range(90):
        x, y = r.uniform(120, 1000), r.uniform(60, 560)
        if inside(land, x, y) or y < 40 + (x - 300) * 0.32 + 30 or (x > 780 and y < 340 + (x - 780) * 0.05 and y < 170 + (x - 780) * 0.8): continue
        if x > 560 and y > 430: continue
        if x < 300 and y > 320: continue
        if near([(860, 470)], x, y, 75): continue
        trees += tree(x, y, r.uniform(12, 18), "tree far")
    grass = ""
    for _ in range(190):
        x, y = r.uniform(70, 630), r.uniform(280, 870)
        if not inside(land, x, y) or inside(woods, x, y) or near(spots, x, y, 22) or near([(165, 515), (205, 515), (245, 515)], x, y, 34): continue
        grass += f'<path d="M{x:.0f},{y:.0f} q2,-9 5,-12 M{x+4:.0f},{y:.0f} q1,-7 -2,-10" class="grass"/>'
    return f"""<svg class="land" viewBox="0 0 1000 900" role="img" aria-label="an illustrated map of the land, shaped like a rough L: meadow at the bottom, woods running along the river at the top, and the old track coming in off the road and up the side of the meadow">
  <defs><pattern id="hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><line x1="0" y1="0" x2="0" y2="8" class="hatch"/></pattern></defs>
  <path class="road" d="M380,910 C420,900 450,890 480,870 C540,825 600,785 655,745 C720,700 850,625 1005,590"/>
  <path class="edge" d="M70,540 C160,420 290,210 395,70 C520,95 650,135 770,185 C660,330 560,470 450,610 C510,650 570,690 630,730 C570,780 510,825 450,870 C320,760 190,650 70,540 Z"/>
  <path class="woods-tint" d="M215,330 C260,270 340,160 395,70 C520,95 650,135 770,185 C660,330 560,470 450,610 C458,604 465,596 470,590 C490,560 505,530 510,500 C520,470 532,445 530,420 C515,380 495,345 470,320 C445,303 420,298 400,300 C365,288 330,285 300,290 C270,300 240,315 215,330 Z"/>
  <path class="woods" d="M215,330 C260,270 340,160 395,70 C520,95 650,135 770,185 C660,330 560,470 450,610 C458,604 465,596 470,590 C490,560 505,530 510,500 C520,470 532,445 530,420 C515,380 495,345 470,320 C445,303 420,298 400,300 C365,288 330,285 300,290 C270,300 240,315 215,330 Z" fill="url(#hatch)"/>
  {trees}{grass}
  <path class="river" d="M262,-10 C310,30 355,45 395,58 C520,85 660,120 775,172 C850,205 905,265 1010,285"/>
  <path class="river thin" d="M262,-10 C310,30 355,45 395,58 C520,85 660,120 775,172 C850,205 905,265 1010,285"/>
  <path class="track" d="M607,778 C560,750 470,730 425,695 C405,675 420,625 440,570 C455,530 480,490 490,450 C495,410 490,380 480,350 C470,320 458,300 450,285 C460,262 475,250 495,245"/>
  <path class="trail" d="M495,245 C510,225 525,205 540,190 C560,170 575,152 590,135"/>
  <g class="shed" transform="translate(495,236)"><path d="M-13,0 L0,-12 L13,0 V13 H-13 Z"/></g>
  <rect class="bed" x="255" y="600" width="90" height="16" rx="3"/><rect class="bed" x="255" y="625" width="90" height="16" rx="3"/><rect class="bed" x="255" y="650" width="90" height="16" rx="3"/>
  <circle class="house" cx="340" cy="380" r="22"/>
  <g class="rose" transform="translate(860,470)"><circle r="34"/><path d="M0,-44 L7,0 L0,44 L-7,0 Z"/><text y="-50">n</text></g>
  <text class="mapword" x="205" y="520">goldenrod</text><text class="mapword" x="860" y="150">the river</text><text class="mapword" x="830" y="670">the road</text>
</svg>"""

def patterns_grid(base, items, show_filters=True):
    cards = []
    for p in items:
        tags = " ".join(c.replace(" ", "-") for c in p["cats"]) + " " + p["type"].replace(" ", "-") + (" free" if p.get("free") else "")
        if p.get("free") and p.get("design"):
            href, pill, tgt = f"{base}patterns/{slug(p)}/", '<span class="pill free">free pdf</span>', ""
        elif p.get("free"):
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
             ("wavy-fringe", "wavy fringe"), ("space", "space"), ("symbols", "symbols"), ("christmas", "christmas"), ("halloween", "halloween")]
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
  <p class="foot-links"><a href="{base}land/">the land</a> · <a href="{base}films/">films</a> · <a href="{base}make/">make</a> · <a href="{base}patterns/">patterns</a> · <a href="{base}field-guide/">field guide</a> · <a href="{base}recipes/">recipes</a> · <a href="{base}bead-lab/">bead lab</a> · <a href="{base}about/">about</a> · <a href="{NEWSLETTER}" target="_blank" rel="noopener">newsletter</a></p>
  <p class="label">winters we travel as <a href="{PN}">pneuma nomads</a>. &copy; <span id="foot-year">2026</span> same old samsara</p>
</div></footer>
<script src="{base}js/site.js?v={ver('js/site.js')}" defer></script>
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
    "description": "Same Old Samsara is the creative outlet of Chad and Daniel: a documentary about building a homestead on 34 acres in Central New York, handmade beaded jewelry, and brick stitch and bead loom patterns.",
    "sameAs": [YT, IG, TT, PIN, SHOP, DIGITALS],
}

def hero_block(base, kicker=""):
    return f"""<section class="hero">
  <div class="ring-wrap" aria-hidden="true"><div class="ring"></div></div>
  <div class="wrap hero-text">
    {f'<p class="label kicker">{e(kicker)}</p>' if kicker else ''}
    <h1>same old samsara</h1>
    <p class="tag">the same old cycle.</p>
    <p class="def">A creative outlet: films from the land, homesteading, jewelry, beading patterns, recipes, and whatever comes next. We're Chad and Daniel, a couple who'd never homesteaded a day in our lives, learning it on 34 acres in Central New York.</p>
    <div class="btns center hero-btns"><a class="btn solid" href="#films" data-newest="{EPISODES[0]['id']}">watch the newest episode</a>
      <a class="btn" href="https://www.youtube.com/watch?v={EPISODES[-1]['id']}" target="_blank" rel="noopener">start at episode 1</a></div>
    <p class="label now" data-now="{base}road/" hidden><i aria-hidden="true"></i><span data-now-text></span></p>
  </div>
  <div class="wrap">{almanac_strip()}</div>
</section>"""

MAKE_INTRO = "Beadwork, food, and whatever else we're making at the time. When something turns out good, we share how we made it so you can try it too."

def make_shelves(base, full=False):
    """everything we make, one shelf per kind, on the home page and the make page. list order is page order.
    a new kind (how-to guides, say) is one more dict here, once it has a page to link to. full = the make page, which shows more of each."""
    free = sorted([p for p in PATTERNS if p.get("free") and (p.get("featured") or "halloween" not in p["cats"])], key=lambda p: not p.get("featured"))
    picks = [p for p in PATTERNS if p.get("design") and not p.get("free")][:10 if full else 5]
    return [
        {"id": "patterns", "name": "beading patterns", "count": f"{len(PATTERNS)} patterns", "feature": True,
         "note": "Brick stitch and bead loom patterns with every bead charted, a word chart you can tick off and the Toho colors listed. A few are free.",
         "items": patterns_grid(base, free + picks, show_filters=False),
         "links": [("every pattern", "patterns/"), ("play in the bead lab", "bead-lab/")]},
        {"id": "recipes", "name": "recipes", "count": f"{len(RECIPES)} so far",
         "note": "Nothing fancy, mostly made by feel.",
         "items": f"""<div class="rcards">{"".join(recipe_card(r, f"{base}recipes/{r['slug']}/") for r in (RECIPES if full else RECIPES[:3]))}</div>""",
         "links": [("all recipes", "recipes/")]},
    ]

def make_block(base, full=False):
    out = ""
    for sh in make_shelves(base, full):
        btns = "".join(f"""<a class="btn{' solid' if i == 0 else ''}" href="{base}{href}">{e(t)}</a>""" for i, (t, href) in enumerate(sh["links"]))
        big = full and sh.get("feature")
        tag = "h2" if full else "h3"
        count = f'<span class="label">{e(sh["count"])}</span>' if full else ""
        out += f"""<div class="shelf{' big' if big else ''}" id="{sh['id']}"><div class="shelf-head reveal"><{tag}>{e(sh['name'])}</{tag}>{count}</div><p class="lede reveal">{e(sh['note'])}</p>
  {sh['items']}
  <div class="btns reveal">{btns}</div></div>"""
    return out

def make_page():
    base = "../"
    jump = " · ".join(f"""<a href="#{sh['id']}">{e(sh['name'])}</a>""" for sh in make_shelves(base, True))
    body = f"""<section class="hero small"><div class="wrap hero-text">
  <p class="label kicker">no. 03</p><h1>make</h1><p class="tag">what we make, and how.</p>
  <p class="def">{e(MAKE_INTRO)}</p>
  <p class="label shelf-jump">{jump}</p>
</div></section>
<section class="section"><div class="wrap">{make_block(base, full=True)}</div></section>"""
    return page("Make: Beading Patterns + Recipes | Same Old Samsara",
                "Everything we make and how we made it: brick stitch and bead loom beading patterns, recipes, and more as we go.",
                base, "make/", body, here="make/")

def home(variant="home"):
    base = "" if variant == "home" else "../"
    wear = "".join(f"""<a class="wcard reveal" href="{listing(p['id'])}" target="_blank" rel="noopener">
      <img src="{base}{p['img']}" alt="{e(p['name'])}" width="600" height="600" loading="lazy"><div><h3>{e(p['name'])}</h3><span class="label">{p['price']}</span></div></a>""" for p in FEATURED)
    strip = "".join(f'<figure class="snap"><img src="{base}{src}" alt="{e(cap)}" loading="lazy" style="object-position:{pos}"><figcaption class="label">{e(cap)}</figcaption></figure>' for src, cap, pos in PHOTOS)
    s_land = f"""<section class="section" id="land"><div class="wrap">
  {section_head("01", "the land", "34 acres · central new york · since fall 2026")}
  <p class="lede reveal">Meadow, woods and a river, and a lot of figuring out. The plan is a homestead: a food forest, fruit trees, a garden and a lot of plants.</p>
</div>
<div class="snaps" tabindex="0" aria-label="photos from the land">{strip}</div>
<div class="wrap"><div class="btns reveal"><a class="btn solid" href="{base}land/">walk the land</a><a class="btn" href="{base}field-guide/">the field guide</a></div></div></section>"""
    s_films = f"""<section class="section band" id="films"><div class="wrap">{section_head("02", "films", "season 1 · 2026")}{films_block(base)}</div></section>"""
    s_make = f"""<section class="section" id="make"><div class="wrap">{section_head("03", "make", "patterns, recipes + whatever's next")}
  <p class="lede reveal">{e(MAKE_INTRO)}</p>
  {make_block(base)}
  <div class="btns reveal shelf-all"><a class="btn" href="{base}make/">everything we make</a></div>
</div></section>"""
    s_wear = f"""<section class="section band soft" id="wear"><div class="wrap">{section_head("04", "wear", "handmade jewelry")}
  <p class="lede reveal">Beaded by hand, one bead at a time. This is the shop that keeps the films going.</p>
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
                "Same Old Samsara: a documentary about building a homestead on 34 acres in Central New York, handmade beaded jewelry, and brick stitch and bead loom patterns.",
                base, path, body, noindex=variant != "home", jsonld=[ORG, {"@context": "https://schema.org", "@type": "WebSite", "name": "Same Old Samsara", "url": SITE + "/"}] if variant == "home" else None)

def land_page():
    base = "../"
    strip = "".join(f'<figure class="field reveal"><img src="{base}{src}" alt="{e(cap)}" loading="lazy"><figcaption><span class="label">field note</span> {e(cap)}</figcaption></figure>' for src, cap, _ in PHOTOS)
    body = f"""<section class="hero small"><div class="wrap hero-text">
  <p class="label kicker">no. 01</p><h1>the land</h1><p class="tag">34 acres. central new york.</p>
  <p class="def">We bought it in September 2026: meadow, woods and a river, with one rough track in. No house yet, no barn, no tractor. Slowly we're building it into a homestead, with a food forest, fruit trees and a garden, and the films are the record of figuring it out.</p>
</div><div class="wrap">{almanac_strip()}</div></section>
<section class="section"><div class="wrap">{section_head("·", "walk the land", "tap a spot")}{map_block(base)}</div></section>
<section class="section band soft"><div class="wrap">{section_head("·", "the wheel of the year", "the same old cycle, on the ground")}{wheel_block()}</div></section>
<section class="section"><div class="wrap">{section_head("·", "field notes", "photos from the land")}<div class="fieldgrid">{strip}</div>
<div class="btns reveal"><a class="btn solid" href="{base}field-guide/">play the field guide</a><a class="btn" href="{base}films/">watch the films</a></div></div></section>"""
    return page("The Land | 34 Acres in Central New York | Same Old Samsara",
                "34 acres of meadow, woods and river in Central New York that we're slowly building into a homestead. A map, the wheel of the year, and field notes.",
                base, "land/", body, here="land/")

def films_page():
    base = "../"
    ld = [{"@context": "https://schema.org", "@type": "VideoObject", "name": f'{x["title"]} ({x["label"]})', "description": x["blurb"],
           "thumbnailUrl": f'{SITE}/{x["img"]}', "uploadDate": x["date"],
           "embedUrl": f'https://www.youtube-nocookie.com/embed/{x["id"]}', "url": f'https://www.youtube.com/watch?v={x["id"]}'} for x in EPISODES]
    body = f"""<section class="hero small"><div class="wrap hero-text">
  <p class="label kicker">no. 02</p><h1>films</h1><p class="tag">a season a year.</p>
  <p class="def">A documentary about our first years on 34 acres in Central New York. Chad and Daniel, a couple with no homesteading background and one camera. Season 1 is 2026.</p>
</div></section>
<section class="section"><div class="wrap">{section_head("·", "season 1", "2026")}{films_block(base, all_eps=True, lede="new episodes as the year turns. start at episode 1, it's a story.")}</div></section>
<section class="section band soft"><div class="wrap">{section_head("·", "between episodes", "shorts + the rest")}{follow_block(("etsy · jewelry", "etsy · patterns"))}</div></section>"""
    return page("Films | A Documentary From Our Land | Same Old Samsara",
                "Same Old Samsara is a documentary series about our first years building a homestead on 34 acres in Central New York. Season 1, 2026.",
                base, "films/", body, here="films/", jsonld=ld)

def patterns_page():
    base = "../"
    order = sorted(PATTERNS, key=lambda p: (not p.get("featured"), not p.get("free"), "halloween" in p["cats"], not p.get("design"), p["name"]))
    ld = [{"@context": "https://schema.org", "@type": "ItemList", "name": "Same Old Samsara beading patterns",
           "itemListElement": [{"@type": "ListItem", "position": i + 1, "name": p["name"],
                                "url": f'{SITE}/assets/{p["file"]}.pdf' if p.get("free") and not p.get("design") else f"{SITE}/patterns/{slug(p)}/"} for i, p in enumerate(order)]}]
    body = f"""<section class="hero small"><div class="wrap hero-text">
  <p class="label kicker"><a href="{base}make/">make</a> · patterns</p><h1>beading patterns</h1><p class="tag">a few free. the rest at samsara digitals.</p>
  <p class="def">Brick stitch and bead loom patterns by Same Old Samsara. Every PDF has the bead diagram, a word chart you can tick off row by row, and the colors. Instant download from Etsy.</p>
  <div class="btns center"><a class="btn solid" href="{DIGITALS}" target="_blank" rel="noopener">samsara digitals on etsy</a><a class="btn" href="{base}bead-lab/">design your own</a></div>
</div></section>
<section class="section"><div class="wrap">{patterns_grid(base, order)}
  <div class="note reveal"><p><strong>Don't bead?</strong> The finished pieces are in the <a href="{SHOP}" target="_blank" rel="noopener">jewelry shop</a>.</p></div>
</div></section>"""
    return page("Beading Patterns: Brick Stitch + Bead Loom PDFs | Same Old Samsara",
                "Brick stitch and bead loom beading patterns: rainbow parrot, squid and jellyfish wavy fringe, silly goose, triceratops, om, flying saucer and more. A few free PDFs, the rest $2.99 to $4.99 on Etsy.",
                base, "patterns/", body, here="make/", jsonld=ld)

def pattern_detail(p):
    base = "../../"
    url = f"{SITE}/patterns/{slug(p)}/"
    img_abs = f"{SITE}/{pattern_img(p)}"
    title_name = p["name"].replace(" (wavy fringe)", "").replace(" (3 sizes)", "")
    kind = "Bead Loom" if p["type"] == "loom" else "Brick Stitch"
    free = bool(p.get("free"))
    pdf_abs = f'{SITE}/assets/{p["file"]}.pdf'
    product = {"@context": "https://schema.org", "@type": "Product",
               "name": f"{title_name.title()} {kind} Beading Pattern (PDF)",
               "description": p["blurb"], "image": [img_abs], "sku": f'SD-{p.get("etsy") or p["file"]}',
               "brand": {"@type": "Brand", "name": "Same Old Samsara"}, "category": "Arts & Crafts > Beading Patterns",
               "offers": {"@type": "Offer", "price": "0" if free else p["price"], "priceCurrency": "USD", "availability": "https://schema.org/InStock",
                          "url": pdf_abs if free else listing(p["etsy"]), "seller": {"@type": "Organization", "name": "Samsara Digitals"}}}
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
    inside = ["Bead diagram, every bead drawn", "Word chart with a checkbox for every row", "Color legend with Toho codes + how many beads to buy",
              "Stitch guide with thread paths", "Step by step how-to"] if d else ["Bead diagram", "Word chart", "Color legend"]
    if d and d.get("wave"): inside.insert(0, "The wave: how the wavy fringe works")
    related = [q for q in PATTERNS if q is not p and not q.get("free") and set(q["cats"]) & set(p["cats"])][:3]
    related = related or [q for q in PATTERNS if not q.get("free") and q.get("design") and q.get("live")][:3]
    rel = patterns_grid(base, related, show_filters=False) if related else ""
    body = f"""<section class="section pdetail"><div class="wrap">
  <p class="label crumbs"><a href="{base}patterns/">patterns</a> / {e(p['type'])}</p>
  <div class="pd">
    <div class="pd-img"><img src="{base}{pattern_img(p)}" alt="{e(p['name'])} {p['type']} beading pattern, every bead charted" width="1400" height="1050"></div>
    <div class="pd-info">
      <h1>{e(title_name)}</h1><p class="label">{e(p['type'])} beading pattern · pdf</p>
      <p class="pd-blurb">{e(p['blurb'])}</p>
      <div class="btns">{f'<a class="btn solid big" href="{base}assets/{p["file"]}.pdf" target="_blank" rel="noopener" download>download the free pdf</a>' if free else f'<a class="btn solid big" href="{listing(p["etsy"])}" target="_blank" rel="noopener">get it on etsy · ${p["price"]}</a>'}</div>
      <table class="facts">{rows}</table>
      {swatches}
      <h3 class="mini">what's inside</h3><ul class="inside">{''.join(f'<li>{e(x)}</li>' for x in inside)}</ul>
      <p class="label">{"free to download and stitch. it works as earrings, a pendant, a keychain, a pin or a sew-on patch. you can sell what you make from it." if free else "sold through samsara digitals, our pattern shop on etsy. you can sell what you make from it."}</p>
    </div>
  </div>
  {f'<div class="related">{section_head("·", "you might also like")}{rel}</div>' if rel else ''}
</div></section>"""
    desc = f"{title_name.title()} {kind.lower()} beading pattern PDF by Same Old Samsara. {p['blurb']} {'Free download.' if free else '$' + p['price'] + ', instant download.'}"
    return page(f"{'Free ' if free else ''}{title_name.title()} {kind} Pattern (PDF) | Same Old Samsara", desc, base, f"patterns/{slug(p)}/", body,
                here="make/", jsonld=[product, crumbs], image=img_abs)

def beadlab_page():
    base = "../"
    pal = json.dumps([{"n": n, "c": c} for n, c in TOHO])
    body = f"""<section class="hero small"><div class="wrap hero-text">
  <p class="label kicker">no. 04</p><h1>the bead lab</h1><p class="tag">design your own brick stitch.</p>
  <p class="def">Tap beads to color them. Mirror mode keeps it symmetric. When you like it, grab the word chart and stitch it for real. It saves in your browser, so you can come back to it.</p>
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
  <div class="note reveal"><p>Made something? Tag <strong>@sameoldsamsara</strong>. Want a finished pattern instead? <a href="{base}patterns/">The pattern library</a>.</p></div>
</div></section>"""
    return page("The Bead Lab: Design Your Own Brick Stitch Pattern | Same Old Samsara",
                "A free brick stitch pattern maker. Color beads on a real offset brick grid with Toho colors, mirror for symmetry, and get a word chart to stitch from.",
                base, "bead-lab/", body, here="bead-lab/", extra_js=f'<script src="{base}js/beadlab.js" defer></script>')

def fieldguide_page():
    base = "../"
    crit = "".join(f"""<button class="critter reveal" type="button" id="{c['id']}" data-id="{c['id']}" aria-label="who's this? tap to see">
  <span class="cframe"><img src="{base}{c['img']}" alt="{e(c['name'])}" loading="lazy" style="transform-origin:{c['focus']};--zoom:{c.get('zoom', 4.5)}"></span>
  <span class="label q">who's this?</span><span class="ans"><strong>{e(c['name'])}</strong><span>{e(c['note'])}</span></span></button>""" for c in CRITTERS)
    crit += """<div class="critter soon reveal"><span class="cframe"><span class="cam" aria-hidden="true"></span></span>
  <span class="ans show"><strong>on the trail cam</strong><span>The trail cam is up. First night, a raccoon. Whoever walks past next ends up here.</span></span></div>"""
    finds = "".join(f"""<button class="find reveal" type="button" id="{f['id']}" data-id="{f['id']}" aria-label="turn over: {e(f['hint'])}">
  <span class="face back"><span class="label">find no. {i:02d}</span><span class="hint">{e(f['hint'])}</span><span class="label tap">tap to turn over</span></span>
  <span class="face front"><img src="{base}{f['img']}" alt="{e(f['name'])}" loading="lazy"><strong>{e(f['name'])}</strong><span>{e(f['note'])}</span></span></button>""" for i, f in enumerate(FINDS, 1))
    body = f"""<section class="hero small"><div class="wrap hero-text">
  <p class="label kicker">the land</p><h1>the field guide</h1><p class="tag">who lives here, and what we've found.</p>
  <p class="def">Everything here was found on our land in Central New York. We're not experts. We're learning it one walk at a time, and this guide grows as we do.</p>
</div></section>
<section class="section"><div class="wrap">{section_head("·", "who lives here", "guess first, then tap")}
  <p class="lede reveal">Each one starts zoomed way in. Take a guess, then tap to see the whole thing.</p>
  <div class="critters" id="critters">{crit}</div>
  <p class="label tally" id="met"></p>
</div></section>
<section class="section band soft"><div class="wrap">{section_head("·", "things to find", "read the hint, then turn it over")}
  <div class="finds" id="finds">{finds}</div>
  <p class="label tally" id="found"></p>
  <div class="btns reveal"><button type="button" class="btn" id="resetfg">start over</button><a class="btn solid" href="{base}land/">walk the land</a></div>
</div></section>"""
    return page("The Field Guide: Who Lives on the Land | Same Old Samsara",
                "A little interactive field guide to our 34 acres in Central New York: guess the animals from a close-up, and turn over the mushrooms, moss and plants we've found.",
                base, "field-guide/", body, here="field-guide/", extra_js=f'<script src="{base}js/fieldguide.js" defer></script>')

def about_page():
    base = "../"
    body = f"""<section class="hero small"><div class="wrap hero-text">
  <p class="label kicker">about</p><h1>who's behind this</h1><p class="tag">chad + daniel.</p>
</div></section>
<section class="section"><div class="wrap prose reveal">
  <p><strong>Same Old Samsara</strong> is Chad's creative outlet. It started with memes, then beads and patterns, and now it's mostly film. Later maybe screen prints, or things made from what grows on the land.</p>
  <p>Samsara is the wheel: birth, death, coming back around. The raven sits on the ouroboros, the snake eating its tail. Seasons come back. Projects get set down and picked back up. The same old cycle.</p>
  <p>We're Chad and Daniel, a couple who'd never homesteaded a day in our lives. In September 2026 we bought 34 acres in Central New York: meadow, woods and a river. We're building a homestead there, one tree at a time, with a food forest, a garden and more plants than we can name. We joke that it's our compound. And we're filming all of it. Summers on the land, winters on the road in our RV as <a href="{PN}">Pneuma Nomads</a>.</p>
  <h2>what's here</h2>
  <ul>
    <li><a href="{base}films/">Films</a>: the documentary, a season a year on <a href="{YT}" target="_blank" rel="noopener">YouTube</a>.</li>
    <li><a href="{base}patterns/">Beading patterns</a>: brick stitch and bead loom PDFs on <a href="{DIGITALS}" target="_blank" rel="noopener">Samsara Digitals</a>. A few free.</li>
    <li><a href="{SHOP}" target="_blank" rel="noopener">Handmade jewelry</a>: beaded earrings, bracelets and necklaces on Etsy.</li>
    <li><a href="{base}bead-lab/">The bead lab</a>: a free tool to design your own brick stitch.</li>
  </ul>
  <h2>say hi</h2><p>The easiest way is a message on <a href="{SHOP}" target="_blank" rel="noopener">Etsy</a> or <a href="{IG}" target="_blank" rel="noopener">Instagram</a>.</p>
</div></section>"""
    return page("About | Same Old Samsara", "Same Old Samsara is the creative outlet of Chad and Daniel: films from their land in Central New York, handmade beaded jewelry and beading patterns.",
                base, "about/", body, here="about/", jsonld=[ORG])

PN_MARK = ('<svg viewBox="0 99 375 198" aria-hidden="true"><g fill="currentColor" transform="translate(1,99)">'
           '<path transform="translate(7.66,197.47)" d="M0-23.83V-190.67H143v23.83h23.84v71.5H143V-71.5H47.67v47.67ZM47.67-95.34h71.5v-71.5h-71.5Z"/>'
           '<path transform="translate(198.31,197.47)" d="M0-23.83V-190.67H47.67v23.83H71.5V-143H95.34v23.83h23.83v-71.5h47.67v166.84H119.17V-71.5H95.34V-95.34H71.5v-23.83H47.67v95.34Z"/></g></svg>')

def pn_pin():
    """the locked PN pixel map marker (Pneuma Nomads/Brand/Graphics/pixel pin/)"""
    rows = ['...#####...', '.##h#####d.', '##h######dd', '##h#ooo##dd', '###ooooo#dd', '###ooooo#dd', '###ooooo#dd',
            '####ooo##dd', '.########d.', '.#######dd.', '..######d..', '...####d...', '....##d....', '.....d.....']
    col = {'#': '#b8645a', 'h': '#d48a7f', 'd': '#8f4a42', 'o': '#fff4d9'}
    r = "".join(f'<rect x="{x}" y="{y}" width="1" height="1" fill="{col[c]}"/>' for y, row in enumerate(rows) for x, c in enumerate(row) if c in col)
    return f'<svg class="pin" viewBox="0 0 11 14" shape-rendering="crispEdges" aria-hidden="true">{r}</svg>'

def road_page():
    """pneuma nomads, in its own look (brand sheet: Pneuma Nomads/Brand/brand-sheet.html). self-contained css."""
    base = "../"; v = ROAD_LATEST
    title = "Pneuma Nomads | Chad & Daniel on the Road"
    desc = "Chad and Daniel's winter travel videos. Summers on our land in Central New York, winters in the fifth wheel following the warm air south."
    links = [("youtube", PN_YT, "the road videos"), ("instagram", PN_IG, "photos from the road"), ("tiktok", PN_TT, "short clips"),
             ("spotify", PN_SPOTIFY, "what we play in the truck"), ("buy us a coffee", PN_COFFEE, "fuel for the truck")]
    btns = "".join(f'<a class="lnk" href="{u}" target="_blank" rel="noopener"><b>{e(n)}</b><span>{e(d)}</span><i aria-hidden="true">&gt;</i></a>' for n, u, d in links)
    ld = [{"@context": "https://schema.org", "@type": "WebPage", "name": "Pneuma Nomads", "url": SITE + "/road/", "description": desc,
           "isPartOf": {"@type": "WebSite", "name": "Same Old Samsara", "url": SITE + "/"}, "sameAs": [PN_YT, PN_IG, PN_TT]}]
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<title>{e(title)}</title>
<meta name="description" content="{e(desc)}">
<meta name="robots" content="index, follow, max-image-preview:large">
<link rel="canonical" href="{SITE}/road/">
<meta name="theme-color" content="#2e2d2b">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Pneuma Nomads">
<meta property="og:title" content="{e(title)}">
<meta property="og:description" content="{e(desc)}">
<meta property="og:url" content="{SITE}/road/">
<meta property="og:image" content="{SITE}/{v['img']}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" type="image/svg+xml" href="{base}images/road/pn-favicon.svg">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&family=Work+Sans:wght@400;500;600&display=swap">
<script type="application/ld+json">{json.dumps(ld[0], ensure_ascii=False)}</script>
<style>
:root {{ --cream:#fff4d9; --sand:#ecdcb8; --pepper:#514f4c; --night:#2e2d2b;
  --brick:#b8645a; --clay:#c97b4a; --mustard:#d8ae55; --sage:#7f9a6a; --denim:#5f84a0; --plum:#87709b;
  --pixel:'Press Start 2P','Courier New',monospace; --term:'VT323','Courier New',monospace; --body:'Work Sans','Helvetica Neue',sans-serif; }}
* {{ box-sizing:border-box; }}
html {{ background:var(--night); }}
body {{ margin:0; background:var(--cream); color:var(--pepper); font-family:var(--body); font-size:16px; line-height:1.55; -webkit-font-smoothing:antialiased; }}
a {{ color:inherit; }}
.wrap {{ max-width:560px; margin:0 auto; padding-left:max(18px, env(safe-area-inset-left, 0px)); padding-right:max(18px, env(safe-area-inset-right, 0px)); }}
.screen {{ background:var(--night); color:var(--cream); padding-block:max(34px, env(safe-area-inset-top, 0px)) 30px; }}
.mark {{ width:64px; display:block; color:var(--cream); }}
.mark svg {{ width:100%; height:auto; display:block; }}
h1 {{ font-family:var(--pixel); font-weight:400; font-size:clamp(19px, 6vw, 28px); line-height:1.5; margin:22px 0 6px; white-space:nowrap; min-height:1.5em; }}
.cur {{ display:inline-block; width:.62em; height:1em; vertical-align:-.12em; margin-left:.12em; background:var(--clay); animation:blink 1.06s steps(1) infinite; }}
@keyframes blink {{ 50% {{ opacity:0; }} }}
.stripe {{ display:flex; width:104px; height:4px; }}
.stripe i {{ flex:1; }}
.stripe i:nth-child(1){{background:var(--brick)}} .stripe i:nth-child(2){{background:var(--clay)}} .stripe i:nth-child(3){{background:var(--mustard)}}
.stripe i:nth-child(4){{background:var(--sage)}} .stripe i:nth-child(5){{background:var(--denim)}} .stripe i:nth-child(6){{background:var(--plum)}}
.tag {{ font-family:var(--term); font-size:26px; line-height:1.1; color:var(--sand); margin:14px 0 18px; }}
.bio {{ margin:0; max-width:34em; color:var(--cream); opacity:.92; }}
.label {{ font-family:var(--pixel); font-size:10px; line-height:1.7; margin:0 0 12px; }}
.label::before {{ content:"> "; color:var(--clay); }}
section {{ padding-block:30px 6px; }}
.vlog {{ display:block; text-decoration:none; border:3px solid var(--night); background:var(--night); box-shadow:6px 6px 0 var(--sand); }}
.vlog .thumb {{ position:relative; aspect-ratio:16/9; overflow:hidden; }}
.vlog img {{ width:100%; height:100%; object-fit:cover; display:block; }}
.play {{ position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); width:58px; height:58px; background:var(--night); display:grid; place-items:center; }}
.play::after {{ content:""; border-left:18px solid var(--cream); border-top:11px solid transparent; border-bottom:11px solid transparent; margin-left:5px; }}
.vlog .meta {{ color:var(--cream); padding:12px 14px 14px; display:grid; gap:4px; }}
.vlog .place {{ font-family:var(--pixel); font-size:11px; line-height:1.8; display:flex; align-items:center; gap:8px; }}
.pin {{ height:15px; width:auto; flex-shrink:0; }}
.vlog .sub {{ font-family:var(--term); font-size:21px; line-height:1; color:var(--sand); }}
.links {{ display:grid; gap:10px; }}
.lnk {{ display:grid; grid-template-columns:1fr auto; align-items:center; gap:2px 10px; text-decoration:none; background:#fffaf0; border:2px solid var(--pepper); padding:12px 14px; }}
.lnk b {{ font-family:var(--pixel); font-weight:400; font-size:10px; line-height:1.7; }}
.lnk span {{ grid-row:2; font-size:14px; opacity:.8; }}
.lnk i {{ grid-row:1 / 3; grid-column:2; font-style:normal; font-family:var(--pixel); font-size:12px; color:var(--clay); }}
.lnk:hover, .lnk:focus-visible {{ background:var(--sand); }}
a:focus-visible {{ outline:3px solid var(--mustard); outline-offset:2px; }}
.land {{ border:2px dashed var(--pepper); padding:16px; display:grid; gap:10px; }}
.land p {{ margin:0; }}
.land .row {{ display:flex; flex-wrap:wrap; gap:8px; }}
.btn {{ font-family:var(--pixel); font-size:9px; line-height:1.6; padding:10px 12px; text-decoration:none; background:var(--pepper); color:var(--cream); border:2px solid var(--pepper); }}
.btn.ghost {{ background:transparent; color:var(--pepper); }}
footer {{ padding-block:34px max(34px, env(safe-area-inset-bottom, 0px)); font-size:13px; opacity:.75; }}
footer .stripe {{ margin-bottom:14px; }}
@media (prefers-reduced-motion: reduce) {{ .cur {{ animation:none; }} }}
</style>
</head>
<body>
<header class="screen"><div class="wrap">
  <span class="mark">{PN_MARK}</span>
  <h1 aria-label="Pneuma Nomads"><span id="word" aria-hidden="true">Pneuma Nomads</span><span class="cur" aria-hidden="true"></span></h1>
  <div class="stripe" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div>
  <p class="tag">following the warm air.</p>
  <p class="bio">We're Chad and Daniel. Summers we live on our land in Central New York, and winters we hitch up the fifth wheel with Lucy and Miley and head south. This is where the road videos live.</p>
</div></header>
<main id="main" class="wrap">
  <section>
    <p class="label">latest vlog</p>
    <a class="vlog" href="https://www.youtube.com/watch?v={v['id']}" target="_blank" rel="noopener">
      <span class="thumb"><img src="{base}{v['img']}" alt="{e(v['title'])}" width="960" height="540" fetchpriority="high"><span class="play" aria-hidden="true"></span></span>
      <span class="meta"><span class="place">{pn_pin()}{e(v['place'])}</span><span class="sub">{e(v['label'])} · {e(v['len'])} · {e(v['title'])}</span></span>
    </a>
  </section>
  <section>
    <p class="label">follow along</p>
    <div class="links">{btns}</div>
  </section>
  <section>
    <p class="label">the rest of the year</p>
    <div class="land">
      <p>Summers we're home on 34 acres, building a homestead. That story lives on Same Old Samsara, along with Chad's handmade jewelry and beading patterns.</p>
      <div class="row"><a class="btn" href="{base}films/">watch the land</a><a class="btn ghost" href="{SHOP}" target="_blank" rel="noopener">jewelry</a><a class="btn ghost" href="{base}patterns/">patterns</a></div>
    </div>
  </section>
</main>
<footer><div class="wrap">
  <div class="stripe" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div>
  <p>Pneuma Nomads is part of the <a href="{base}index.html">Same Old Samsara</a> family. &copy; <span id="y">2026</span></p>
</div></footer>
<script>
(function(){{
  document.getElementById('y').textContent = new Date().getFullYear();
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var el = document.getElementById('word'), t = el.textContent, i = 0; el.textContent = '';
  (function step(){{ if (i >= t.length) return; el.textContent += t[i++]; setTimeout(step, (1000/14) * (0.7 + Math.random()*0.6)); }})();
}})();
</script>
</body>
</html>
"""

# ---------------- recipes ----------------
# what we cook. one dict per recipe, newest first. amounts are written the way you'd say them (fractions, not decimals).
RECIPES = [
    {"slug": "maple-pecan-sweet-potato-mash", "name": "maple pecan sweet potato mash", "date": "2026-11-03",
     "blurb": "Creamy sweet potatoes baked under toasted pecans and a drizzle of maple syrup.",
     "story": "I made this for a friend and they asked for the recipe. There wasn't one. I just went by feel, so this is my best guess at what I did. Taste as you go and make it yours.",
     "serves": 6, "prep": 20, "cook": 40, "season": "fall",
     "ingredients": ["3 lb sweet potatoes, peeled and cut into chunks", "4 tbsp butter, softened", "⅓ cup maple syrup",
                     "⅓ cup heavy cream or milk", "1 tsp cinnamon", "¼ tsp nutmeg", "½ tsp salt", "¾ cup pecans",
                     "2 tbsp maple syrup, for drizzling"],
     "steps": ["Preheat the oven to 350°F and butter an 8x8 or 9x9 baking dish.",
               "Boil the sweet potatoes in salted water until fork tender, about 15 minutes.",
               "Drain well and let them steam dry in the pot for a couple of minutes, so the mash isn't watery.",
               "Mash with the butter, maple syrup, cream, cinnamon, nutmeg and salt. Taste and adjust.",
               "Spread it into the dish. Scatter the pecans on top and drizzle with the rest of the maple syrup.",
               "Bake about 25 minutes, until it's hot and the pecans are toasted."],
     "notes": ["Make ahead: put it together a day early, keep it in the fridge, and add 10 minutes to the bake.",
               "No nutmeg? 1½ tsp pumpkin pie spice works in place of both spices."]},
]

def recipe_ld(r):
    return {"@context": "https://schema.org", "@type": "Recipe", "name": r["name"].title(), "description": r["blurb"],
            "author": {"@type": "Person", "name": "Chad Riley"}, "datePublished": r["date"],
            "recipeYield": f"{r['serves']} servings", "prepTime": f"PT{r['prep']}M", "cookTime": f"PT{r['cook']}M",
            "totalTime": f"PT{r['prep'] + r['cook']}M", "recipeCategory": "Side dish", "keywords": f"{r['season']}, sweet potato, maple",
            "recipeIngredient": r["ingredients"],
            "recipeInstructions": [{"@type": "HowToStep", "text": t} for t in r["steps"]],
            "url": f"{SITE}/recipes/{r['slug']}/"}

def recipe_card(r, href):
    return f"""<a class="rcard reveal" href="{href}">
  <span class="label">{e(r['season'])} · serves {r['serves']} · {r['prep'] + r['cook']} min</span>
  <strong>{e(r['name'])}</strong><span>{e(r['blurb'])}</span></a>"""

def recipes_page():
    base = "../"
    cards = "".join(recipe_card(r, f"{r['slug']}/") for r in RECIPES)
    body = f"""<section class="hero small"><div class="wrap hero-text">
  <p class="label kicker"><a href="{base}make/">make</a> · the kitchen</p><h1>recipes</h1><p class="tag">what we're cooking.</p>
  <p class="def">Nothing fancy. Mostly made by feel, then written down after so friends can make it too.</p>
</div></section>
<section class="section"><div class="wrap">{section_head("·", "the recipe box", f"{len(RECIPES)} so far")}
  <div class="rcards">{cards}</div>
</div></section>"""
    return page("Recipes | Same Old Samsara", "Simple, cozy recipes from Chad and Daniel, mostly made by feel and written down after.",
                base, "recipes/", body, here="make/")

def recipe_detail(r):
    base = "../../"
    ings = "".join(f'<li><label><input type="checkbox"><span>{e(i)}</span></label></li>' for i in r["ingredients"])
    steps = "".join(f"<li>{e(t)}</li>" for t in r["steps"])
    notes = "".join(f"<p>{e(n)}</p>" for n in r["notes"])
    body = f"""<section class="hero small"><div class="wrap hero-text">
  <p class="label kicker"><a href="{base}recipes/">recipes</a> · {e(r['season'])}</p><h1>{e(r['name'])}</h1><p class="tag">{e(r['blurb'])}</p>
  <div class="rfacts"><span><b>{r['serves']}</b><i class="label">servings</i></span><span><b>{r['prep']}</b><i class="label">min prep</i></span><span><b>{r['cook']}</b><i class="label">min cook</i></span></div>
</div></section>
<section class="section recipe"><div class="wrap">
  <p class="lede reveal">{e(r['story'])}</p>
  <div class="rgrid">
    <div class="ring-card reveal"><h2>ingredients</h2><p class="label">tap to check off as you go</p><ul class="ings">{ings}</ul></div>
    <div class="reveal"><h2>steps</h2><ol class="steps">{steps}</ol>
      <div class="note"><span class="label">notes</span>{notes}</div>
      <div class="btns"><button type="button" class="btn" onclick="window.print()">print it</button><a class="btn" href="{base}recipes/">all recipes</a></div></div>
  </div>
</div></section>"""
    return page(f"{r['name'].title()} | Same Old Samsara Recipes", r["blurb"].capitalize(), base, f"recipes/{r['slug']}/", body,
                here="make/", jsonld=[recipe_ld(r)])

def notfound():
    base = "/"
    body = f"""<section class="hero"><div class="ring-wrap" aria-hidden="true"><div class="ring"></div></div>
<div class="wrap hero-text"><p class="label kicker">404</p><h1>back around again.</h1><p class="tag">this page isn't here.</p>
<p class="def">You went all the way around the wheel and ended up where you started. Same old cycle.</p>
<div class="btns center"><a class="btn solid" href="/">home</a><a class="btn" href="/patterns/">patterns</a><a class="btn" href="/land/">the land</a></div></div></section>"""
    return page("Not Here | Same Old Samsara", "This page isn't here.", base, "404.html", body, noindex=True)

def old_patterns_redirect():
    return f"""<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Beading Patterns | Same Old Samsara</title>
<link rel="canonical" href="{SITE}/patterns/"><meta name="robots" content="noindex, follow"><meta http-equiv="refresh" content="0; url=patterns/"></head>
<body><p>the patterns moved to <a href="patterns/">sameoldsamsara.xyz/patterns</a>.</p></body></html>
"""

def llms_txt():
    lines = ["# Same Old Samsara", "",
             "> The creative outlet of Chad and Daniel: a documentary series about building a homestead on 34 acres in Central New York, handmade beaded jewelry (Etsy: sameoldsamsara), and brick stitch and bead loom beading patterns (Etsy: samsaradigitals). Motto: the same old cycle.", "",
             "Headings on this site are lowercase on purpose. Prices are in USD.", "",
             "## Films", f"- [YouTube channel]({YT}): Same Old Samsara, a season a year. Season 1 is 2026."]
    lines += [f"- [{x['label'].title()}: {x['title']}](https://www.youtube.com/watch?v={x['id']}) ({x['len']}): {x['blurb']}" for x in reversed(EPISODES)]
    lines += ["", "## Make", f"- [Make]({SITE}/make/): everything we make in one place, beading patterns and recipes so far.", "", "## Beading patterns", f"PDF patterns. Paid ones are instant downloads from [Samsara Digitals on Etsy]({DIGITALS}). Full library: {SITE}/patterns/", ""]
    for p in PATTERNS:
        if p.get("free"):
            lines.append(f"- [{p['name']}]({SITE}/assets/{p['file']}.pdf): free {p['type']} pattern. {p['blurb']}")
        elif p.get("live"):
            lines.append(f"- [{p['name']}]({SITE}/patterns/{slug(p)}/): {p['type']} pattern, ${p['price']}. {p['blurb']} Buy: {listing(p['etsy'])}")
    lines += ["", "## Tools", f"- [The field guide]({SITE}/field-guide/): the animals, plants and fungi found on the land so far, as a small guessing game.", f"- [The bead lab]({SITE}/bead-lab/): free in-browser brick stitch designer. Toho 11/0 colors, mirror mode, exports a word chart.", "",
              "## Recipes"] + [f"- [{r['name'].title()}]({SITE}/recipes/{r['slug']}/): {r['blurb']}" for r in RECIPES] + ["",
              "## Jewelry", f"- [Same Old Samsara on Etsy]({SHOP}): handmade beaded earrings, bracelets and necklaces. Many are made to order.", f"- [Depop]({DEPOP})", "",
              "## About", f"- [About]({SITE}/about/)", f"- [The land]({SITE}/land/): 34 acres of meadow, woods and river in Central New York, bought in September 2026. The exact location is private.",
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
    write("make/index.html", make_page())
    write("patterns/index.html", patterns_page())
    paid = [p for p in PATTERNS if (not p.get("free") and p.get("live")) or (p.get("free") and p.get("design"))]
    for p in paid: write(f"patterns/{slug(p)}/index.html", pattern_detail(p))
    write("bead-lab/index.html", beadlab_page())
    write("field-guide/index.html", fieldguide_page())
    write("about/index.html", about_page())
    write("recipes/index.html", recipes_page())
    for r in RECIPES: write(f"recipes/{r['slug']}/index.html", recipe_detail(r))
    write("road/index.html", road_page())
    write("404.html", notfound())
    write("beadingpatterns.html", old_patterns_redirect())
    write("llms.txt", llms_txt())
    write("robots.txt", robots_txt())
    write("sitemap.xml", sitemap(["", "land/", "field-guide/", "films/", "make/", "patterns/", "bead-lab/", "about/", "road/", "recipes/"] + [f"patterns/{slug(p)}/" for p in paid] + [f"recipes/{r['slug']}/" for r in RECIPES]))
    print("built", 12 + len(paid) + len(RECIPES), "pages")
