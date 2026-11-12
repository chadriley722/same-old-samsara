#!/usr/bin/env python3
"""Builds sameoldsamsara.xyz, the almanac (v3, Oct 28 2026).

Run from anywhere: python3 _build/build.py   (Jekyll skips folders starting with _, so this never goes live)
Writes: index.html, land/, films/, wear/, say-hi/, patterns/ (+ one page per pattern), bead-lab/, about/, road/ (pneuma nomads, PN look), ig/ yt/ pin/
(link-in-bio versions, noindex), jewelry/ shop/ and contact/ (addresses people guess, they point at wear/ and say-hi/), 404.html,
beadingpatterns.html (old url, points to patterns/), llms.txt, robots.txt, sitemap.xml.
Copies pattern images from Same Old Samsara/Patterns/<design>/UPLOAD TO ETSY/ when they exist.
Makes the phone sized copies of every picture in images/r/ (see pic() below). Commit that folder with the rest.

To update: change EPISODES / JEWELRY / PATTERNS / SPOTS below and rerun.
  - a new episode → one dict at the top of EPISODES. While you're there, check the JEWELRY pieces are still for sale and bump JEWELRY_CHECKED
  - a pattern gets relisted on Etsy → set its "live" to True
  - rotate the free pattern → move "featured": True to another free pattern (every free one has its own page, pdf at assets/<file>.pdf)
"""
import datetime, html, json, pathlib, shutil, struct, subprocess

ROOT = pathlib.Path(__file__).resolve().parent.parent
COWORK = ROOT.parent.parent                       # Claude CoWork/
PATTERN_SRC = COWORK / "Same Old Samsara/Patterns"
SITE = "https://sameoldsamsara.xyz"
GOOGLE_VERIFY = "y7ndACI0Ppc_jZEAmxNFMrK5n-c8N7hskw8efVKoxJQ"  # Search Console token: paste only the content="..." value from the HTML tag, then rebuild + push

YT = "https://www.youtube.com/@sameoldsamsara"
SHOP = "https://sameoldsamsara.etsy.com"
DIGITALS = "https://samsaradigitals.etsy.com"
DEPOP = "https://depop.com/sameoldsamsara"
IG = "https://instagram.com/sameoldsamsara"
TT = "https://tiktok.com/@sameoldsamsara"
PIN = "https://pinterest.com/sameoldsamsara"
PN = SITE + "/road/"
NEWSLETTER = "https://docs.google.com/forms/d/e/1FAIpQLScRgNsfZYcnLNtfIYfRxKKghsxMu-UJ_4P8csSh8ErWM_AfNA/viewform?usp=header"
COFFEE = "https://buymeacoffee.com/sameoldsamsara"
LAND_DAY_ONE = "2026-09"  # month only in public, never the exact day

# /road = pneuma nomads (winter travel), in the PN look, not the almanac. pneumanomads.xyz points here.
PN_YT = "https://youtube.com/@pneumanomads"
PN_IG = "https://instagram.com/pneumanomads"
PN_TT = "https://tiktok.com/@pneumanomads"
# this is the profile, not one playlist. it has six public playlists and none is named for the road, so Chad has to say which
# one is "what we play in the truck" (asked Nov 12). then this becomes https://open.spotify.com/playlist/<id>
PN_SPOTIFY = "https://open.spotify.com/user/chadriley722"
PN_SPOTIFY_TEXT = "spotify"
PN_COFFEE = "https://buymeacoffee.com/sameoldsamsara"
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

# the jewelry page, in page order. the first four are also the little row at the jewelry stop on the home page.
# No prices here on purpose: they change on Etsy and nobody remembers to change them here. Each piece links to its own listing.
# id = the Etsy listing number. img = a square photo in images/shop/. alt = what's in the photo.
# When a piece sells out for good, take its line out. JEWELRY_CHECKED = the last day someone looked: the build nags when it's old.
# Nov 12, 2026: all twelve opened on Etsy, each still listed with an "add to cart" button.
JEWELRY_CHECKED = "2026-11-12"
JEWELRY = [
    {"name": "opossum earrings", "kind": "earrings", "id": "4448169054", "img": "images/shop/opossum.jpg",
     "alt": "a pair of beaded opossum earrings hanging from a plant stem"},
    {"name": "jellyfish earrings", "kind": "earrings", "id": "4448186827", "img": "images/shop/jellyfish.jpg",
     "alt": "turquoise beaded jellyfish earrings with long wavy fringe"},
    {"name": "cream + olive fringe", "kind": "earrings", "id": "4426089724", "img": "images/shop/cream-olive.jpg",
     "alt": "long cream and olive beaded fringe earrings"},
    {"name": "green stone + hex nut bracelet", "kind": "bracelet", "id": "4448132656", "img": "images/shop/green-stone.jpg",
     "alt": "a bracelet of green stone beads and steel hex nuts on a wrist"},
    {"name": "squid earrings", "kind": "earrings", "id": "4446242488", "img": "images/shop/squid.jpg",
     "alt": "turquoise beaded squid earrings with wavy fringe on a kraft card"},
    {"name": "rainbow fringe earrings", "kind": "earrings", "id": "4441796123", "img": "images/shop/rainbow-fringe.jpg",
     "alt": "a long white and rainbow beaded fringe earring, worn"},
    {"name": "alien head earrings", "kind": "earrings", "id": "4446213329", "img": "images/shop/alien-head.jpg",
     "alt": "green beaded alien head earrings on a kraft card"},
    {"name": "monstera leaf huggies", "kind": "earrings", "id": "4438493438", "img": "images/shop/monstera.jpg",
     "alt": "three monstera leaf charm huggie earrings in an open hand"},
    {"name": "key huggie", "kind": "earrings", "id": "4440654558", "img": "images/shop/key-huggie.jpg",
     "alt": "a small antique bronze key charm on a huggie hoop, in an open hand"},
    {"name": "cream spiral rope bracelet", "kind": "bracelet", "id": "4445038667", "img": "images/shop/cream-spiral.jpg",
     "alt": "a cream spiral rope beaded bracelet in an open hand"},
    {"name": "wavy rainbow loom bracelet", "kind": "bracelet", "id": "1698489768", "img": "images/shop/wavy-rainbow.jpg",
     "alt": "a black bead loom bracelet with a wavy rainbow pattern, in an open hand"},
    {"name": "matte black bracelet", "kind": "bracelet", "id": "4444516925", "img": "images/shop/matte-black.jpg",
     "alt": "a matte black seed bead bracelet with a few strands, in an open hand"},
]
FEATURED = JEWELRY[:4]

# file = old card image assets/<file>.jpg (and assets/<file>.pdf when free). design = folder in Patterns/ with the v2 chart.
# one entry per Etsy listing. live = listing is active right now. free = pdf on this site.
PATTERNS = [
    {"file": "christmastree", "design": "christmastree", "slug": "christmas-tree", "name": "christmas tree", "type": "brick stitch", "cats": ["christmas"],
     "free": True, "hold": True,       # v1 hasn't been test stitched and the ornaments need a redo (Chad, Nov 12). don't feature it till then
     "blurb": "A three tier pine with a gold star and a few lights. One piece worked up from the widest row, so it's a good first pattern. Free for the holidays."},
    {"file": "pumpkin", "slug": "pumpkin", "name": "pumpkin", "type": "brick stitch", "cats": ["halloween"], "free": True, "featured": True,
     "blurb": "A little round pumpkin with a curly stem. Quick, cute and free."},
    {"file": "rainbowdiamonds", "slug": "rainbow-diamonds", "name": "rainbow diamonds", "type": "loom", "cats": ["rainbow"], "free": True,
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
# add trail cam photos here as they come in. clip = a short silent loop that plays once the card is open (keep the place out of frame).
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
    {"id": "raccoon", "img": "images/land/raccoon.jpg", "clip": "images/land/raccoon.mp4", "focus": "75% 43%", "zoom": 5, "name": "a raccoon",
     "note": "The trail cam's first night. It stared at the camera, then ducked under the gate. Whoever walks past next ends up here too."},
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

# ---------------- pictures: phone sized copies, made when the site is built ----------------
# A phone shows most photos 165 to 350 pixels wide, so it has no use for a 1280 wide file. Every picture gets smaller WebP copies in
# images/r/ and pic() writes the <picture> tag that offers them. The original stays as the fallback for a browser with no WebP.
# Where the page shows a picture cut to a shape (a square card, a 4:5 strip), the copy is cut to that shape first, so no bytes
# are spent on the part that's cropped away, and a wide photo in a tall frame still comes out sharp.
LADDER = (240, 360, 480, 600, 720)     # copy widths. past these, the picture's own full width is offered, as a WebP

def image_size(rel, _seen={}):
    """(width, height) of a jpg, png or webp in the site folder, read from the file's header"""
    if rel in _seen: return _seen[rel]
    b = (ROOT / rel).read_bytes()
    size = None
    if b[:8] == b"\x89PNG\r\n\x1a\n":
        size = struct.unpack(">II", b[16:24])
    elif b[:4] == b"RIFF" and b[8:12] == b"WEBP":
        kind = b[12:16]
        if kind == b"VP8 ": size = tuple(v & 0x3fff for v in struct.unpack("<HH", b[26:30]))
        elif kind == b"VP8L": n = struct.unpack("<I", b[21:25])[0]; size = ((n & 0x3fff) + 1, ((n >> 14) & 0x3fff) + 1)
        elif kind == b"VP8X": size = (int.from_bytes(b[24:27], "little") + 1, int.from_bytes(b[27:30], "little") + 1)
    elif b[:2] == b"\xff\xd8":
        i = 2
        while i + 9 < len(b):
            if b[i] != 0xFF: i += 1; continue
            m = b[i + 1]
            if 0xC0 <= m <= 0xCF and m not in (0xC4, 0xC8, 0xCC):       # a start of frame marker: height, then width
                h, w = struct.unpack(">HH", b[i + 5:i + 9]); size = (w, h); break
            if m == 0xFF: i += 1; continue
            if m in (0x00, 0x01, 0xD8) or 0xD0 <= m <= 0xD7: i += 2; continue
            i += 2 + struct.unpack(">H", b[i + 2:i + 4])[0]
    if not size: raise ValueError(f"can't read the size of {rel}")
    _seen[rel] = size
    return size

def crop_box(rel, shape, pos=(50, 50)):
    """(x, y, w, h) of the part of a picture that css `object-fit: cover` shows in a frame of that shape. shape = (wide, tall), pos = object-position in percent."""
    w0, h0 = image_size(rel)
    if not shape: return 0, 0, w0, h0
    r = shape[0] / shape[1]
    if w0 / h0 > r: w = round(h0 * r); return round((w0 - w) * pos[0] / 100), 0, w, h0
    h = round(w0 / r); return 0, round((h0 - h) * pos[1] / 100), w0, h

def variant(rel, w, shape=None, pos=(50, 50)):
    """site path of the w pixel wide WebP copy of a picture (cut to `shape` first, if given). made on first use, and again when the original changes."""
    src = ROOT / rel
    x, y, cw, ch = crop_box(rel, shape, pos)
    whole = (cw, ch) == image_size(rel)
    if rel.endswith(".webp") and whole and w >= cw: return rel             # already a WebP, and no smaller copy is wanted
    stem = pathlib.Path(rel).with_suffix("")
    stem = stem.relative_to("images") if stem.parts[0] == "images" else stem
    cut = "" if whole else f"-{shape[0]}x{shape[1]}" + ("" if tuple(pos) == (50, 50) else f"-at{pos[0]}-{pos[1]}")
    out_rel = f"images/r/{stem.as_posix()}-{w}{cut}.webp"
    out = ROOT / out_rel
    if not out.exists() or src.stat().st_mtime > out.stat().st_mtime:
        out.parent.mkdir(parents=True, exist_ok=True)
        crop = [] if whole else ["-crop", str(x), str(y), str(cw), str(ch)]
        size = ["-resize", str(w), "0"] if w < cw else []
        subprocess.run(["nice", "-n", "15", "cwebp", "-quiet", "-q", "78" if w <= 240 else "72", "-m", "6", "-sharp_yuv", "-metadata", "none",
                        *crop, *size, str(src), "-o", str(out)], check=True)
    return out_rel

def widths(rel, slot, shape=None, pos=(50, 50)):
    """the copy widths worth offering for a picture shown `slot` css pixels wide: the one that's sharp on a good screen, and the one below it"""
    cw = crop_box(rel, shape, pos)[2]
    have = [w for w in LADDER if w < cw] + [cw]
    top = next((i for i, w in enumerate(have) if w >= slot * 1.8), len(have) - 1)       # 1.8 dots per css pixel is sharp to the eye on a phone held in a hand
    return have[max(top - 1, 0):top + 1]

def pic(base, rel, alt, slot=360, cls="", lazy=True, style="", extra="", shape=None, pos=(50, 50), hold=False):
    """<picture> for a photo. slot = how wide it's shown in css pixels: one number, or (on a phone, on a computer).
    shape = (wide, tall) when the css cuts it to a frame of that shape with object-fit: cover, pos = its object-position in percent.
    hold = don't fetch anything yet: the addresses go in data- attributes and a script fills them in when the picture is wanted.
    The <img> inside keeps its class, so the css that styles an img still applies (style.css sets picture to display: contents)."""
    phone, desk = slot if isinstance(slot, tuple) else (slot, slot)
    w0, h0 = image_size(rel)
    srcset = lambda ws: ", ".join(f"{base}{variant(rel, w, shape, pos)} {w}w" for w in ws)
    wp, wd = widths(rel, phone, shape, pos), widths(rel, desk, shape, pos)
    d = "data-" if hold else ""
    if wp == wd:
        sources = f'<source type="image/webp" {d}srcset="{srcset(wp)}" sizes="(max-width: 760px) {phone}px, {desk}px">'
    else:
        sources = (f'<source type="image/webp" media="(max-width: 760px)" {d}srcset="{srcset(wp)}" sizes="{phone}px">'
                   f'<source type="image/webp" {d}srcset="{srcset(wd)}" sizes="{desk}px">')
    attrs = (f' class="{cls}"' if cls else "") + f' {d}src="{base}{rel}" alt="{e(alt)}" width="{w0}" height="{h0}"'
    attrs += (' loading="lazy"' if lazy else ' fetchpriority="high"') + ' decoding="async"' + (f' style="{style}"' if style else "") + extra
    return f"<picture>{sources}<img{attrs}></picture>"

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

# ---------------- page parts ----------------

# The italic is only ever used at one weight with no softness, so it's asked for that way: 42 KB instead of 149.
# (Asking for a narrower range of the upright one doesn't make its file any smaller. Pinning an axis to one value does.)
FONTS = ("https://fonts.googleapis.com/css2?family=Courier+Prime:wght@400;700"
         "&family=Fraunces:ital,opsz,wght,SOFT@0,9..144,300..800,0..100;1,9..144,400,0&family=Work+Sans:wght@400;500;600&display=swap")
# Runs in the head, before anything is drawn. data-app = this page is open inside an app's own little browser (the tip about that shows).
# data-from="pin" = they came from Pinterest, so the first screen offers the jewelry and the patterns instead of the films.
WHO_JS = ('var U=navigator.userAgent,A=/Instagram/.test(U)?"instagram":/FBAN|FBAV/.test(U)?"facebook":/musical_ly|Bytedance|TikTok/i.test(U)?"tiktok":'
          '/Pinterest/.test(U)?"pinterest":"";if(A)R.dataset.app=A;if(A==="pinterest"||/pinterest\\./i.test(document.referrer))R.dataset.from="pin";')

def head(title, desc, base, path, noindex=False, jsonld=None, image=None, extra_head="", body_class=""):
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
<link rel="stylesheet" href="{FONTS}">
<link rel="stylesheet" href="{base}style.css?v={ver('style.css')}">
<script>var R=document.documentElement;R.classList.add("js");setTimeout(function(){{if(!window.SOS_READY)R.classList.remove("js");}},3000);try{{var t=localStorage.getItem("sos_theme");if(t==="night"||t==="day")R.dataset.theme=t;}}catch(_){{}}{WHO_JS}</script>
<style>:root{{--ring-url:url("{base}images/ring-norules-pepper.svg");--mark-url:url("{base}images/mark-pepper.svg");}}</style>
{extra_head}{ld}</head>
<body{f' class="{body_class}"' if body_class else ''}>
<a class="skip" href="#main">skip to the good part</a>
"""

# the menu is the walk's stops, in the walk's order. follow along is left out (it's in every footer).
# the road goes last: it leads out to the pneuma nomads page, the way the walk's last stop does.
NAV = [("films", "films/"), ("make", "make/"), ("wear", "wear/"), ("the land", "land/"), ("field guide", "field-guide/"), ("say hi", "say-hi/"), ("the road", "road/")]

def nav(base, here=""):
    def link(t, h):
        ext = h.startswith("http")
        href = h if ext else base + h
        cur = ' aria-current="page"' if h == here else ""
        tgt = ' target="_blank" rel="noopener"' if ext else ""
        if t.startswith("the "): t = f'<span class="the">the </span>{t[4:]}'       # on a phone "the land" is "land", so seven words fit on one line
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
  <div><span class="label">today on the land</span><strong data-a="day">&nbsp;</strong></div>
  <div><span class="label">the moon</span><strong><i class="moon" data-a="moonicon" aria-hidden="true"></i><span data-a="moon">&nbsp;</span></strong></div>
  <div><span class="label">sunrise · sunset</span><strong data-a="sun">&nbsp;</strong></div>
  <div><span class="label">the season</span><strong data-a="season">&nbsp;</strong></div>
</div>"""

def section_head(title, sub=""):
    return f"""<div class="shead reveal"><h2>{e(title)}</h2>{f'<span class="label sub">{e(sub)}</span>' if sub else ''}</div>"""

def inapp_tip():
    """one line that only shows inside the Instagram, TikTok, Facebook or Pinterest app, where YouTube and Etsy don't know who you are"""
    return '<p class="label inapp">inside an app? youtube and etsy work better in your own browser. tap the ⋯ menu, then "open in browser".</p>'

def yt_embed(ep, base, slot=(330, 640), lazy=True):
    """an episode's picture with a play button. youtube itself only loads when someone presses play (js/site.js)."""
    return f"""<button class="yt" type="button" data-id="{ep['id']}" aria-label="play {e(ep['title'])}">
  {pic(base, ep['img'], f"{ep['title']}, thumbnail", slot, lazy=lazy)}
  <span class="play" aria-hidden="true"></span><span class="len label">{ep['len']}</span>
</button>"""

# the one way the series is described, everywhere
DOC_LINE = "A documentary about our first year out here. Episode 1 starts at the very beginning, when we first stepped onto the land."
FILMS_NEXT = "New episodes through the winter. Season 2 starts spring 2027."     # nothing here goes stale before spring
MONTH_NAMES = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"]

def month_of(iso):
    y, m, _ = iso.split("-")
    return f"{MONTH_NAMES[int(m) - 1]} {y}"

def ep_no(x): return x["label"].split(" · ")[-1]          # "episode 4"
def watch(x): return f"https://www.youtube.com/watch?v={x['id']}"

def episode_list(base, eps, blurbs=False):
    """a row per episode: little picture, number and length, title, the month it came out"""
    rows = "".join(f"""<a class="ep reveal" href="{watch(x)}" target="_blank" rel="noopener">
      {pic(base, x['img'], "", 120)}
      <div><span class="label">{e(ep_no(x))} · {x['len']}</span><h3>{e(x['title'])}</h3><span class="label when">{month_of(x['date'])}</span>{f'<p>{e(x["blurb"])}</p>' if blurbs else ''}</div></a>""" for x in eps)
    return f'<div class="eps">{rows}</div>'

def film_main(base, lazy=True):
    """the newest episode, big, with the way in for someone new right beside it"""
    ep = EPISODES[0]
    return f"""<div class="film-main">{yt_embed(ep, base, lazy=lazy)}
    <div class="film-meta"><span class="label">newest · {e(ep_no(ep))} · {month_of(ep['date'])}</span><h3>{e(ep['title'])}</h3><p>{e(ep['blurb'])}</p>
      <div class="btns"><a class="btn solid" href="{watch(EPISODES[-1])}" target="_blank" rel="noopener">start at episode 1</a>
      <a class="btn" href="{YT}?sub_confirmation=1" target="_blank" rel="noopener">subscribe</a></div>
      {inapp_tip()}</div>
  </div>"""

def wheel_block():
    data = json.dumps([{"m": m, "note": n} for m, n in MONTHS])
    return f"""<div class="wheel-wrap reveal">
  <div class="wheel" id="wheel" data-months='{e(data)}' role="group" aria-label="the wheel of the year"></div>
  <div class="wheel-note"><span class="label" id="wheel-m">this month</span><p id="wheel-text"></p>
  <p class="label hint">tap a month to see what the land is doing. this is year one, so we're still learning.</p></div>
</div>"""

def map_block(base):
    pins = "".join(f"""<button class="pin" type="button" style="left:{s['x']/10}%;top:{s['y']/9}%" data-spot="{s['id']}" aria-label="{e(s['name'])}"><span></span></button>""" for s in SPOTS)
    small = lambda rel: ", ".join(f"{base}{variant(rel, w, (4, 3))} {w}w" for w in widths(rel, 330, (4, 3)))
    panels = json.dumps({s["id"]: {"name": s["name"], "note": s["note"], "img": base + s["img"], "set": small(s["img"])} for s in SPOTS})
    return f"""<div class="map reveal">
  <div class="map-art">{land_svg()}{pins}</div>
  <aside class="map-card" id="map-card" data-spots='{e(panels)}' aria-live="polite">
    {pic(base, SPOTS[0]['img'], "", 330, shape=(4, 3), extra=' id="map-img"')}
    <span class="label">a spot on the land</span><h3 id="map-name">{e(SPOTS[0]['name'])}</h3><p id="map-note">{e(SPOTS[0]['note'])}</p>
  </aside>
  <p class="label map-foot">a cartoon, not to scale.</p>
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

def has_page(p): return bool(p.get("free") or p.get("live"))

def patterns_grid(base, items, show_filters=True):
    cards = []
    for p in items:
        tags = " ".join(c.replace(" ", "-") for c in p["cats"]) + " " + p["type"].replace(" ", "-") + (" free" if p.get("free") else "")
        pill = '<span class="pill free">free pdf</span>' if p.get("free") else f'<span class="pill">${p["price"]}</span>'
        cards.append(f"""<a class="pcard reveal" href="{base}patterns/{slug(p)}/" data-tags="{tags}" data-name="{e(p['name'])}">
      <div class="pimg">{pic(base, pattern_img(p), f"{p['name']} {p['type']} beading pattern", (170, 260))}</div>
      <div class="pmeta"><h3>{e(p['name'])}</h3>{pill}</div><span class="label">{e(p['type'])}</span>
    </a>""")
    filt = ""
    if show_filters:
        f = [("all", "all"), ("free", "free"), ("brick-stitch", "brick stitch"), ("loom", "loom"), ("animals", "animals"), ("rainbow", "rainbow"),
             ("wavy-fringe", "wavy fringe"), ("space", "space"), ("symbols", "symbols"), ("christmas", "christmas"), ("halloween", "halloween")]
        btns = "".join(f'<button type="button" data-f="{k}" aria-pressed="{"true" if k == "all" else "false"}">{t}</button>' for k, t in f)
        filt = f"""<div class="pfilters"><input type="search" id="psearch" placeholder="search patterns" aria-label="search patterns">
  <div class="chips" role="group" aria-label="filter patterns">{btns}</div></div>"""
    return filt + f'<div class="pgrid" id="pgrid">{"".join(cards)}</div>'

FOLLOW = [("youtube", YT, "the films"), ("instagram", IG, "the land + what we're making"), ("tiktok", TT, "short clips"), ("pinterest", PIN, "jewelry + patterns")]

def follow_block():
    cards = "".join(f'<a href="{u}" target="_blank" rel="noopener"><strong>{n}</strong><span class="label">{d}</span></a>' for n, u, d in FOLLOW)
    return f'<div class="follow reveal">{cards}</div>'

def footer(base):
    follow = "".join(f'<a href="{u}" target="_blank" rel="noopener">{n}</a>' for n, u, _ in FOLLOW)
    links = [("films", "films/"), ("make", "make/"), ("patterns", "patterns/"), ("design your own", "bead-lab/")]
    if len(RECIPES) >= 3: links.append(("recipes", "recipes/"))          # one recipe isn't a section yet. it's still on the make page
    links += [("wear", "wear/"), ("the land", "land/"), ("field guide", "field-guide/"), ("the road", "road/"), ("about", "about/"), ("say hi", "say-hi/")]
    site = "".join(f'<a href="{base}{h}">{t}</a>' for t, h in links)
    return f"""<footer class="foot"><div class="wrap">
  <div class="foot-ring" aria-hidden="true"></div>
  <p class="tagline">the same old cycle.</p>
  <nav class="foot-follow" aria-label="follow along"><span class="label">follow along</span>{follow}</nav>
  <nav class="foot-links" aria-label="every page">{site}<a href="{NEWSLETTER}" target="_blank" rel="noopener">newsletter</a></nav>
  <p class="label">winters we travel as <a href="{PN}">pneuma nomads</a>. &copy; <span id="foot-year">2026</span> same old samsara</p>
</div></footer>
<script src="{base}js/site.js?v={ver('js/site.js')}" defer></script>
</body>
</html>
"""

def page(title, desc, base, path, body, here="", noindex=False, jsonld=None, image=None, extra_js="", extra_head="", body_class=""):
    return (head(title, desc, base, path, noindex, jsonld, image, extra_head, body_class) + nav(base, here)
            + f'<main id="main">{body}</main>' + extra_js + footer(base))

# ---------------- pages ----------------

ORG = {
    "@context": "https://schema.org", "@type": "Organization", "name": "Same Old Samsara", "url": SITE + "/",
    "logo": SITE + "/favicon/web-app-manifest-512x512.png",
    "description": "Same Old Samsara is the creative outlet of Chad and Daniel: a documentary about building a homestead on 34 acres in Central New York, handmade beaded jewelry, and brick stitch and bead loom patterns.",
    "sameAs": [YT, IG, TT, PIN, SHOP, DIGITALS],
}

# ---------------- the walk: the home page as a loop trail (walk/, made up ground) ----------------
# One stop per part of the site. Order = the order you meet them on the trail. The 3D picture is drawn by walk/walk.js.
# Every stop is real html, so the links work with scripts off, in a screen reader, and when a browser can't draw the world.

# decides, before anything is painted, whether this device gets the moving world or the plain page (the road page uses it too)
WALK_SWITCH = """<script>(function(){{var d=document.documentElement,q=location.search,gl=false,calm=false;try{{gl=!!document.createElement("canvas").getContext("webgl2");calm=matchMedia("(prefers-reduced-motion: reduce)").matches;}}catch(_){{}}var on=gl&&!/[?&]plain\\b/.test(q)&&(!calm||/[?&]walk\\b/.test(q));d.classList.add(on?"walk-on":"walk-plain");if(gl&&!on)d.classList.add("walk-can");if(on)setTimeout(function(){{if(!window.SOS_WALK){{d.classList.remove("walk-on");d.classList.add("walk-plain");}}}},8000);}})();</script>
"""
WALK_HEAD = """<link rel="stylesheet" href="{base}walk/walk.css?v={v}">
""" + WALK_SWITCH

# the first thing a stranger reads. one plain line, then who we are.
WHAT_LINE = "two guys, 34 acres and a camera."
WHO_LINE = ("We're Chad and Daniel, a couple who bought 34 acres in Central New York with no idea what we were doing. "
            "We're building a homestead and filming all of it. Your support and our Etsy shop help turn our plans for the land into reality.")
US_PHOTO = "images/daniel_and_chad.webp"
US_ALT = "Chad and Daniel, side by side in front of a wooden fence"
MAKE_INTRO = "We make things. This is where we share them, and help you make your own. It'll grow as we build things for our 34 acres."

# the address people can write to, scrambled, so it isn't sitting in the page (or in this file) for the robots that collect addresses.
# js/site.js puts it back together when a person taps the button. to change it, run scramble("the new address") and paste the result.
def scramble(addr): return "".join(f"{ord(c) + 7 + i % 5:02x}" for i, c in enumerate(reversed(addr)))
HI = "74776c3877706976714b7a6c6a777a7569767f707578"

def hi_button(base, text="email us", solid=True):
    """the say hi button. with scripts off it goes to the say hi page, which says how else to reach us."""
    return f'<a class="btn{" solid" if solid else ""}" href="{base}say-hi/" data-hi="{HI}">{e(text)}</a>'

def walk_stops(base):
    """the stops, in the order you meet them. the ids are the 3D world's stop ids (walk/world.js STOP_IDS), so keep the two in step."""
    ep, first = EPISODES[0], EPISODES[-1]
    free = next(p for p in PATTERNS if p.get("featured"))
    ext = lambda t, u, solid=False: f'<a class="btn{" solid" if solid else ""}" href="{u}" target="_blank" rel="noopener">{e(t)}</a>'
    loc = lambda t, u, solid=False: f'<a class="btn{" solid" if solid else ""}" href="{base}{u}">{e(t)}</a>'
    wear = "".join(f"""<a href="{listing(p['id'])}" target="_blank" rel="noopener" title="{e(p['name'])}">{pic(base, p['img'], p['name'], 84)}</a>""" for p in FEATURED)
    return [
        {"id": "films", "name": "films", "light": "morning", "side": "left",
         "alt": "A print of a bedsheet strung between two poles as a movie screen in a goldenrod meadow. A camera on a tripod faces the sheet and throws a picture on it, and a raven sits on one of the poles.",
         "body": f"""<p>{e(DOC_LINE)}</p>
      {yt_embed(ep, base, (330, 370))}
      <p class="label ep-line">newest · {e(ep_no(ep))} · {month_of(ep['date'])} · {e(ep['title'])}</p>""",
         "links": ext("start at episode 1", watch(first), True) + loc("all the films", "films/") + ext("subscribe", f"{YT}?sub_confirmation=1"),
         "after": inapp_tip()},
        {"id": "make", "name": "make", "light": "late morning", "side": "right", "was": "make",
         "alt": "A print of a white camper in a meadow with its awning out, a table and two chairs under the awning, and a raven on the roof.",
         "body": f"<p>{e(MAKE_INTRO)}</p>",
         "links": loc("see what we make", "make/", True) + loc(f"free pattern: {free['name']}", f"patterns/{slug(free)}/") + loc("design your own", "bead-lab/")
                  + (loc("recipes", "recipes/") if len(RECIPES) >= 3 else "")},
        {"id": "wear", "name": "wear", "light": "noon", "side": "left", "was": "wear",
         "alt": "A print of an old apple tree in a meadow with strands of bright beads hanging from its branches, and a raven on top.",
         "body": f"""<p>We have an Etsy shop with the jewelry we make by hand. Apparel we designed is coming soon. The earrings don't really grow on the apple tree. We checked.</p>
      <div class="wear-row">{wear}</div>""",
         "links": loc("see the jewelry", "wear/", True) + ext("our etsy shop", SHOP) + ext("also on depop", DEPOP)},
        {"id": "land", "name": "the land", "light": "golden hour", "side": "left",
         "alt": "A print of a river at golden hour with tall hemlocks on both banks, rocks in the water, a raven on a rock, and geese flying over.",
         "body": "<p>34 acres in Central New York. Meadow, woods and a river, and a lot of figuring out. The plan is a homestead: a food forest, fruit trees, a garden and a lot of plants.</p>",
         "links": loc("about the land", "land/", True) + '<a class="btn" href="#year">the land, month by month</a>'},
        {"id": "field-guide", "name": "the field guide", "light": "sunset", "side": "right",
         "alt": "A print of the woods at sunset: a mossy log with mushrooms on it, a raven on the log, and a raccoon looking around a tree trunk at a trail camera.",
         "body": "<p>Who lives here, and what we've found so far. We're not experts, so it's part guessing game. The trail cam got a raccoon on its first night.</p>",
         "links": loc("open the field guide", "field-guide/", True)},
        {"id": "follow", "name": "follow along", "light": "dusk", "side": "right", "was": "follow",
         "alt": "A print of a campfire at nightfall with two camp chairs pulled up to it, a raven on the back of one, and a camper with its windows lit in the distance.",
         "body": "<p>Pull up a chair. New films go up on YouTube first. The small stuff in between goes everywhere else.</p>",
         "links": ext("youtube", YT, True) + ext("instagram", IG) + ext("tiktok", TT) + ext("pinterest", PIN)},
        {"id": "say-hi", "name": "say hi", "light": "night", "side": "left",
         "alt": "A print of a mailbox at night with a little lantern hanging on its post, a raven sitting on the mailbox, and the moon over the trees.",
         "body": f"""<div class="us">{pic(base, US_PHOTO, US_ALT, 96)}<p>That's us. Write to us, we read everything. Or sign up for the newsletter and we'll write when there's something worth saying.</p></div>""",
         "links": hi_button(base) + ext("message us on instagram", IG) + ext("the newsletter", NEWSLETTER) + ext("buy us a coffee", COFFEE) + loc("who we are", "about/")},
        {"id": "road", "name": "the road", "light": "first light", "side": "left",
         "alt": "A print of a country road at first light, seen from the middle of it. It runs east past a goldenrod meadow toward the sunrise, and a raven flies off ahead.",
         "body": "<p>When the cold comes we hitch up and head south. Winters we travel as Pneuma Nomads, and the road has a page of its own.</p>",
         "links": loc("keep going down the road", "road/", True) + ext("pneuma nomads on youtube", PN_YT) + ext("instagram", PN_IG) + ext("tiktok", PN_TT) + ext(PN_SPOTIFY_TEXT, PN_SPOTIFY)},
    ]

def gate_buttons(base, variant):
    """the two buttons on the first screen. someone new should start at episode 1, so that's the main one.
    people who came from Pinterest came for the jewelry and the patterns, so they get those instead (the head script sets data-from)."""
    ep, first = EPISODES[0], EPISODES[-1]
    films = f"""<div class="btns hero-btns for-all"><a class="btn solid" href="{watch(first)}" target="_blank" rel="noopener">start at episode 1</a>
        <a class="btn" href="#stop-films" data-walk-play="{ep['id']}">watch the newest episode</a></div>"""
    pins = f"""<div class="btns hero-btns for-pin"><a class="btn solid" href="{base}wear/">the jewelry</a>
        <a class="btn" href="{base}patterns/#free">free patterns</a></div>"""
    return pins.replace(" for-pin", "") if variant == "pin" else films + pins if variant == "home" else films.replace(" for-all", "")

def walk_block(base, variant="home"):
    kicker = {"ig": "everything from the bio", "yt": "thanks for watching", "pin": "handmade jewelry + beading patterns"}.get(variant, "")
    ep = EPISODES[0]
    stops = walk_stops(base)
    still = lambda n, sid, alt, lazy=True: pic(base, f"images/walk/{n}-{sid}.webp", alt, (330, 620), cls="still", lazy=lazy)
    trail = "".join(f'<li><a href="#stop-{st["id"]}" data-go="{i}"><i aria-hidden="true"></i><span>{e(st["name"])}</span></a></li>' for i, st in enumerate(stops, 1))
    # the old home page had #make, #wear and #follow. those addresses still land on the right stop.
    was = lambda st: f'<span class="was" id="{st["was"]}"></span>' if st.get("was") else ""
    cards = "".join(f"""
  <article class="stop {st['side']}" id="stop-{st['id']}" data-stop="{i}">
    {still(i, st['id'], st['alt'])}
    <div class="card">{was(st)}
      <p class="label where"><span>stop {i} of {len(stops)}</span><span class="light">{e(st['light'])}</span></p>
      <h2>{e(st['name'])}</h2>
      {st['body']}
      <div class="btns">{st['links']}</div>{st.get('after', '')}
    </div>
  </article>""" for i, st in enumerate(stops, 1))
    return f"""<section class="walk" id="walk" aria-label="a walk around the land" data-film="{base}{variant_for_film(ep['img'])}">
<nav class="trail" aria-label="stops on the walk"><div class="trail-in">
  <ol id="trail-list">
    <li><a href="#walk" data-go="0"><i aria-hidden="true"></i><span>the gate</span></a></li>
    {trail}
    <li class="plain"><a href="#more">skip to the photos and episodes</a></li>
  </ol>
</div></nav>
<div class="walk-view">
  <canvas class="walk-gl" aria-hidden="true"></canvas>
  <div class="walk-hot"></div>
  <p class="walk-say label" role="status"></p>
  <button class="walk-sound" type="button" aria-pressed="false" hidden><span>sound: off</span></button>
</div>
<div class="walk-stops">
  <header class="stop gate" id="stop-gate" data-stop="0">
    {still(0, "gate", "A print of an open gate at sunrise. A raven sits on the gate post, goldenrod grows on both sides of the track, and a camper is parked far off in the meadow.", lazy=False)}
    <div class="gate-text">
      {f'<p class="label kicker">{e(kicker)}</p>' if kicker else ''}
      <p class="label now" data-now="{base}road/" hidden><i aria-hidden="true"></i><span data-now-text></span></p>
      <h1>same old samsara</h1>
      <p class="tag">the same old cycle.</p>
      <p class="what">{e(WHAT_LINE)}</p>
      <p class="def">{e(WHO_LINE)}</p>
      {gate_buttons(base, variant)}
    </div>
    <p class="label walk-hint"><span class="on">scroll to walk the land</span><span class="off">the land, stop by stop</span> <a href="#more"><span class="on">skip the walk</span><span class="off">skip to the photos</span></a>
      <span class="try">this is the still version, because your device asks for less motion. <a href="?walk">show the moving one</a></span></p>
  </header>{cards}
  <div class="stop end" id="stop-end">
    <div class="end-text">
      <p class="tag">the same old cycle.</p>
      <p class="def">That's the walk. The road goes on from here.</p>
      <div class="btns center"><a class="btn solid" href="#walk" data-again>walk it again</a><a class="btn" href="{base}road/">keep going down the road</a><a class="btn" href="#more">more from the land</a></div>
    </div>
  </div>
</div>
</section>"""

def variant_for_film(rel):
    """the newest episode's picture, as the walk paints it on the bedsheet screen: 480 wide is plenty for that"""
    return variant(rel, 480)

def make_shelves(base):
    """everything we make, one shelf per kind, on the make page. list order is page order.
    a new kind (how-to guides, say) is one more dict here, once it has a page to link to."""
    free = [p for p in PATTERNS if p.get("featured")]
    picks = [p for p in PATTERNS if p.get("design") and not p.get("free") and p.get("live")][:3]
    return [
        {"id": "patterns", "name": "beading patterns", "count": f"{len(PATTERNS)} patterns", "feature": True,
         "note": "Brick stitch and bead loom patterns with every bead charted, a word chart you can tick off and the Toho colors listed. A few are free.",
         "items": patterns_grid(base, free + picks, show_filters=False),
         "links": [(f"every pattern ({len(PATTERNS)})", "patterns/"), ("design your own", "bead-lab/")]},
        {"id": "recipes", "name": "recipes", "count": f"{len(RECIPES)} so far",
         "note": "Nothing fancy, mostly made by feel.",
         "items": f"""<div class="rcards">{"".join(recipe_card(r, f"{base}recipes/{r['slug']}/") for r in RECIPES)}</div>""",
         "links": [("all recipes", "recipes/")] if len(RECIPES) > 1 else []},
    ]

def make_block(base):
    out = ""
    for sh in make_shelves(base):
        btns = "".join(f"""<a class="btn{' solid' if i == 0 else ''}" href="{base}{href}">{e(t)}</a>""" for i, (t, href) in enumerate(sh["links"]))
        out += f"""<div class="shelf{' big' if sh.get("feature") else ''}" id="{sh['id']}"><div class="shelf-head reveal"><h2>{e(sh['name'])}</h2><span class="label">{e(sh["count"])}</span></div><p class="lede reveal">{e(sh['note'])}</p>
  {sh['items']}
  {f'<div class="btns reveal">{btns}</div>' if btns else ''}</div>"""
    return out

def make_page():
    base = "../"
    jump = " · ".join(f"""<a href="#{sh['id']}">{e(sh['name'])}</a>""" for sh in make_shelves(base))
    body = f"""<section class="hero small"><div class="wrap hero-text">
  <h1>make</h1><p class="tag">what we make, and how.</p>
  <p class="def">{e(MAKE_INTRO)}</p>
  <p class="label shelf-jump">{jump}</p>
</div></section>
<section class="section"><div class="wrap">{make_block(base)}</div></section>"""
    return page("Make: Beading Patterns + Recipes | Same Old Samsara",
                "Everything we make and how we made it: brick stitch and bead loom beading patterns, recipes, and more as we go.",
                base, "make/", body, here="make/")

def home(variant="home"):
    """the walk, and under it only what the walk doesn't have: today on the land, the photos, every episode, the wheel of the year.
    (the make, jewelry and follow sections that used to repeat down here are stops on the walk, and pages in the menu.)"""
    base = "" if variant == "home" else "../"
    first = EPISODES[-1]
    spot = lambda p: (50, 50) if p == "center" else tuple(int(v.rstrip("%")) for v in p.split())
    strip = "".join(f'<figure class="snap">{pic(base, src, cap, 260, shape=(4, 5), pos=spot(pos), style=f"object-position:{pos}")}<figcaption class="label">{e(cap)}</figcaption></figure>' for src, cap, pos in PHOTOS)
    intro = f"""<section class="section after-walk" id="more"><div class="wrap">
  <p class="label after-label">more from the land</p>
  {almanac_strip()}
</div></section>"""
    s_land = f"""<section class="section" id="land"><div class="wrap">
  {section_head("photos from the land", "34 acres · central new york · since fall 2026")}
</div>
<div class="snaps" tabindex="0" aria-label="photos from the land">{strip}</div>
<div class="wrap"><div class="btns reveal"><a class="btn solid" href="{base}land/">about the land</a><a class="btn" href="{base}field-guide/">open the field guide</a></div></div></section>"""
    s_films = f"""<section class="section band" id="films"><div class="wrap">{section_head("every episode", "season 1 · 2026")}
  <p class="lede reveal">{e(FILMS_NEXT)}</p>
  {episode_list(base, EPISODES)}
  <div class="btns reveal"><a class="btn solid" href="{watch(first)}" target="_blank" rel="noopener">start at episode 1</a><a class="btn" href="{base}films/">all the films</a><a class="btn" href="{YT}?sub_confirmation=1" target="_blank" rel="noopener">subscribe</a></div>
</div></section>"""
    s_wheel = f"""<section class="section" id="year"><div class="wrap">{section_head("the wheel of the year", "what the land is doing, month by month")}{wheel_block()}</div></section>"""
    body = walk_block(base, variant) + intro + s_land + s_films + s_wheel
    path = "" if variant == "home" else f"{variant}/"
    return page("Same Old Samsara | Films From the Land, Handmade Jewelry, Beading Patterns",
                "Same Old Samsara: a documentary about building a homestead on 34 acres in Central New York, handmade beaded jewelry, and brick stitch and bead loom patterns.",
                base, path, body, noindex=variant != "home", jsonld=[ORG, {"@context": "https://schema.org", "@type": "WebSite", "name": "Same Old Samsara", "url": SITE + "/"}] if variant == "home" else None,
                image=f"{SITE}/images/og-walk.jpg" if (ROOT / "images/og-walk.jpg").exists() else None,
                extra_head=WALK_HEAD.format(base=base, v=ver("walk/walk.css")), body_class="has-walk",
                extra_js=f'<script type="module" src="{base}walk/walk.js?v={ver("walk/walk.js")}"></script>')

def land_page():
    base = "../"
    strip = "".join(f'<figure class="field reveal">{pic(base, src, cap, 330)}<figcaption><span class="label">field note</span> {e(cap)}</figcaption></figure>' for src, cap, _ in PHOTOS)
    body = f"""<section class="hero small"><div class="wrap hero-text">
  <h1>the land</h1><p class="tag">34 acres. central new york.</p>
  <p class="def">We bought it in September 2026: meadow, woods and a river, with one rough track in. No house yet, no barn, no tractor. Slowly we're building it into a homestead, with a food forest, fruit trees and a garden, and the films are the record of figuring it out.</p>
</div><div class="wrap">{almanac_strip()}</div></section>
<section class="section"><div class="wrap">{section_head("the map", "tap a spot")}{map_block(base)}</div></section>
<section class="section band soft"><div class="wrap">{section_head("the wheel of the year", "what the land is doing, month by month")}{wheel_block()}</div></section>
<section class="section"><div class="wrap">{section_head("photos from the land", "field notes")}<div class="fieldgrid">{strip}</div>
<div class="btns reveal"><a class="btn solid" href="{base}field-guide/">open the field guide</a><a class="btn" href="{base}films/">watch the films</a></div></div></section>"""
    return page("The Land | 34 Acres in Central New York | Same Old Samsara",
                "34 acres of meadow, woods and river in Central New York that we're slowly building into a homestead. A map, the wheel of the year, and field notes.",
                base, "land/", body, here="land/", image=f"{SITE}/images/land/mist-sunrise.jpg")

def films_page():
    base = "../"
    ld = [{"@context": "https://schema.org", "@type": "VideoObject", "name": f'{x["title"]} ({x["label"]})', "description": x["blurb"],
           "thumbnailUrl": f'{SITE}/{x["img"]}', "uploadDate": x["date"],
           "embedUrl": f'https://www.youtube-nocookie.com/embed/{x["id"]}', "url": watch(x)} for x in EPISODES]
    first_line, rest = DOC_LINE.split(". ", 1)
    n = len(EPISODES)
    body = f"""<section class="hero small"><div class="wrap hero-text">
  <h1>films</h1><p class="tag">{e(first_line.lower())}.</p>
  <p class="def">{e(rest)} We're Chad and Daniel, a couple with no homesteading background and one camera.</p>
  <p class="label status">season 1 · {n} episodes so far · {e(FILMS_NEXT.lower().replace(". ", " · ").rstrip("."))}</p>
</div></section>
<section class="section"><div class="wrap">{section_head("season 1", "2026")}{film_main(base, lazy=False)}
  <p class="lede reveal films-lede">New here? Start at episode 1. It's one story, told in order.</p>
  {episode_list(base, EPISODES[1:], blurbs=True)}
</div></section>
<section class="section band soft"><div class="wrap">{section_head("between episodes", "shorts + the rest")}{follow_block()}</div></section>"""
    return page("Films | A Documentary From Our Land | Same Old Samsara",
                "Same Old Samsara is a documentary series about our first year building a homestead on 34 acres in Central New York. Season 1, 2026.",
                base, "films/", body, here="films/", jsonld=ld, image=f"{SITE}/{EPISODES[0]['img']}")

def pattern_order():
    """the featured free one, the other free ones (one we're holding back goes last of those), then the paid ones"""
    shown = [p for p in PATTERNS if has_page(p)]
    return sorted(shown, key=lambda p: (not p.get("featured"), not p.get("free"), bool(p.get("hold")), "halloween" in p["cats"], not p.get("design"), p["name"]))

def patterns_page():
    base = "../"
    order = pattern_order()
    ld = [{"@context": "https://schema.org", "@type": "ItemList", "name": "Same Old Samsara beading patterns",
           "itemListElement": [{"@type": "ListItem", "position": i + 1, "name": p["name"], "url": f"{SITE}/patterns/{slug(p)}/"} for i, p in enumerate(order)]}]
    body = f"""<section class="hero small"><div class="wrap hero-text">
  <p class="label kicker"><a href="{base}make/">make</a> · patterns</p><h1>beading patterns</h1><p class="tag">a few free. the rest in our pattern shop.</p>
  <p class="def">Brick stitch and bead loom patterns by Same Old Samsara. Every PDF has the bead diagram, a word chart you can tick off row by row, and the colors. The paid ones are instant downloads from Samsara Digitals, our pattern shop on Etsy.</p>
  <div class="btns center"><a class="btn solid" href="{DIGITALS}" target="_blank" rel="noopener">our pattern shop on etsy</a><a class="btn" href="{base}bead-lab/">design your own</a></div>
</div></section>
<section class="section"><div class="wrap">{patterns_grid(base, order)}
  <div class="note reveal"><p><strong>Don't bead?</strong> See <a href="{base}wear/">the finished pieces</a>.</p></div>
</div></section>"""
    return page("Beading Patterns: Brick Stitch + Bead Loom PDFs | Same Old Samsara",
                "Brick stitch and bead loom beading patterns: rainbow parrot, squid and jellyfish wavy fringe, silly goose, triceratops, om, flying saucer and more. A few free PDFs, the rest $2.99 to $4.99 on Etsy.",
                base, "patterns/", body, here="make/", jsonld=ld, image=f"{SITE}/{pattern_img(next(p for p in order if p.get('design') and not p.get('free')))}")

def pdf_size(p):
    """ '0.7 MB', so nobody on phone data is surprised by the download """
    return f'{(ROOT / "assets" / (p["file"] + ".pdf")).stat().st_size / 1e6:.1f} MB'

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
    d = design(p)
    swatches = ""
    if d:
        swatches = "".join(f'<li><i style="background:{c["hex"]}"></i>{e(c["name"])}</li>' for c in d["colorways"][0]["colors"].values())
        swatches = f'<h3 class="mini">the colors</h3><ul class="swatches">{swatches}</ul>'
    inside = ["Bead diagram, every bead drawn", "Word chart with a checkbox for every row", "Color legend with Toho codes + how many beads to buy",
              "Stitch guide with thread paths", "Step by step how-to"] if d else ["Bead diagram", "Word chart", "Color legend"]
    if d and d.get("wave"): inside.insert(0, "The wave: how the wavy fringe works")
    related = [q for q in PATTERNS if q is not p and not q.get("free") and set(q["cats"]) & set(p["cats"])][:3]
    related = related or [q for q in PATTERNS if not q.get("free") and q.get("design") and q.get("live")][:3]
    rel = patterns_grid(base, related, show_filters=False) if related else ""
    if free:
        get = f"""<div class="btns"><a class="btn solid big" href="{base}assets/{p["file"]}.pdf" target="_blank" rel="noopener" download>download the free pdf</a></div>
      <p class="label dl-help">a pdf, {pdf_size(p)}. if it doesn't save, open this page in your own browser first.</p>
      <p class="label dl-help">want the next free one? <a href="{NEWSLETTER}" target="_blank" rel="noopener">join the newsletter</a>.</p>"""
    else:
        get = f"""<div class="btns"><a class="btn solid big" href="{listing(p["etsy"])}" target="_blank" rel="noopener">get it on etsy · ${p["price"]}</a></div>
      {inapp_tip()}"""
    body = f"""<section class="section pdetail"><div class="wrap">
  <p class="label crumbs"><a href="{base}patterns/">patterns</a> / {e(p['type'])}</p>
  <div class="pd">
    <div class="pd-img">{pic(base, pattern_img(p), f"{p['name']} {p['type']} beading pattern" + (", every bead charted" if d else ""), (358, 620), lazy=False)}</div>
    <div class="pd-info">
      <h1>{e(title_name)}</h1><p class="label">{e(p['type'])} beading pattern · pdf</p>
      <p class="pd-blurb">{e(p['blurb'])}</p>
      {get}
      <table class="facts">{rows}</table>
      {swatches}
      <h3 class="mini">what's inside</h3><ul class="inside">{''.join(f'<li>{e(x)}</li>' for x in inside)}</ul>
      <p class="label">{"free to download and stitch. it works as earrings, a pendant, a keychain, a pin or a sew-on patch. you can sell what you make from it." if free else "sold through samsara digitals, our pattern shop on etsy. you can sell what you make from it."}</p>
    </div>
  </div>
  {f'<div class="related">{section_head("you might also like")}{rel}</div>' if rel else ''}
</div></section>"""
    desc = f"{title_name.title()} {kind.lower()} beading pattern PDF by Same Old Samsara. {p['blurb']} {'Free download.' if free else '$' + p['price'] + ', instant download.'}"
    return page(f"{'Free ' if free else ''}{title_name.title()} {kind} Pattern (PDF) | Same Old Samsara", desc, base, f"patterns/{slug(p)}/", body,
                here="make/", jsonld=[product, crumbs], image=img_abs)

def beadlab_page():
    base = "../"
    pal = json.dumps([{"n": n, "c": c} for n, c in TOHO])
    body = f"""<section class="hero small"><div class="wrap hero-text">
  <p class="label kicker"><a href="{base}make/">make</a> · design your own</p><h1>the bead lab</h1><p class="tag">design your own brick stitch pattern.</p>
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
      <p class="label touch-tip">one finger paints. pinch with two to zoom in.</p>
    </div>
    <div class="lab-board"><svg id="board" role="img" aria-label="brick stitch grid. tap or drag across the beads to color them."></svg></div>
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
    def critter(c):
        clip = f' data-clip="{base}{c["clip"]}"' if c.get("clip") else ""
        return f"""<button class="critter reveal" type="button" id="{c['id']}" data-id="{c['id']}"{clip} aria-label="who's this? tap to see">
  <span class="cframe">{pic(base, c['img'], c['name'], (260, 390), shape=(1, 1), style=f"transform-origin:{c['focus']};--zoom:{c.get('zoom', 4.5)}")}</span>
  <span class="label q">who's this?</span><span class="ans"><strong>{e(c['name'])}</strong><span>{e(c['note'])}</span></span></button>"""
    crit = "".join(critter(c) for c in CRITTERS)
    finds = "".join(f"""<button class="find reveal" type="button" id="{f['id']}" data-id="{f['id']}" aria-label="turn over: {e(f['hint'])}">
  <span class="face back"><span class="label">find no. {i:02d}</span><span class="hint">{e(f['hint'])}</span><span class="label tap">tap to turn over</span></span>
  <span class="face front">{pic(base, f['img'], f['name'], (170, 260), shape=(4, 3), hold=True)}<strong>{e(f['name'])}</strong><span>{e(f['note'])}</span></span></button>""" for i, f in enumerate(FINDS, 1))
    # someone who taps a pin lands on one card, half way down this page, knowing nothing about us. js/fieldguide.js puts this under that card.
    hello = f"""<aside class="fg-hello" id="fg-hello" hidden>
  {pic(base, US_PHOTO, US_ALT, 64)}
  <div><p>This is from our 34 acres in Central New York. We're Chad and Daniel, and we're filming all of it.</p>
  <div class="btns"><a class="btn solid" href="{base}films/">watch the films</a><a class="btn" href="{base}wear/">see the jewelry</a><a class="btn" href="{base}about/">who we are</a></div></div>
</aside>"""
    body = f"""<section class="hero small"><div class="wrap hero-text">
  <p class="label kicker"><a href="{base}land/">the land</a> · the field guide</p><h1>the field guide</h1><p class="tag">who lives here, and what we've found.</p>
  <p class="def">Everything here was found on our land in Central New York. We're not experts. We're learning it one walk at a time, and this guide grows as we do.</p>
  <p class="label newhere">new here? we're chad and daniel, and we film all of this. <a href="{base}films/">watch the films</a> · <a href="{base}wear/">see the jewelry</a></p>
</div></section>
<section class="section"><div class="wrap">{section_head("who lives here", "guess first, then tap")}
  <p class="lede reveal">Each one starts zoomed way in. Take a guess, then tap to see the whole thing.</p>
  <div class="critters" id="critters">{crit}</div>
  <p class="label tally" id="met"></p>
</div></section>
<section class="section band soft"><div class="wrap">{section_head("things to find", "read the hint, then turn it over")}
  <div class="finds" id="finds">{finds}</div>
  <p class="label tally" id="found"></p>
  <div class="btns reveal"><button type="button" class="btn" id="resetfg">start over</button><a class="btn solid" href="{base}land/">see the map of the land</a><a class="btn" href="{base}films/">watch the films</a></div>
</div></section>
{hello}"""
    return page("The Field Guide: Who Lives on the Land | Same Old Samsara",
                "A little interactive field guide to our 34 acres in Central New York: guess the animals from a close-up, and turn over the mushrooms, moss and plants we've found.",
                base, "field-guide/", body, here="field-guide/", image=f"{SITE}/images/land/grasshopper.jpg",
                extra_js=f'<script src="{base}js/fieldguide.js?v={ver("js/fieldguide.js")}" defer></script>')

def wear_page():
    """the wear stop's page: the jewelry. each piece opens its own Etsy listing.
    no apparel is listed yet (Nov 12: a shirt is coming with the Etsy overhaul), so the page says "coming soon" and claims nothing more.
    when it is listed: add it to JEWELRY and take the "coming soon" lines out here, in walk_stops() and in about_page()."""
    base = "../"
    cards = "".join(f"""<a class="wcard reveal" href="{listing(p['id'])}" target="_blank" rel="noopener">
      {pic(base, p['img'], p['alt'], (170, 260))}<div><h3>{e(p['name'])}</h3><span class="label">{e(p['kind'])}</span></div></a>""" for p in JEWELRY)
    ld = [{"@context": "https://schema.org", "@type": "CollectionPage", "name": "Handmade jewelry by Same Old Samsara", "url": SITE + "/wear/",
           "isPartOf": {"@type": "WebSite", "name": "Same Old Samsara", "url": SITE + "/"},
           "mainEntity": {"@type": "ItemList", "itemListElement": [{"@type": "ListItem", "position": i + 1, "name": p["name"], "url": listing(p["id"])} for i, p in enumerate(JEWELRY)]}}]
    body = f"""<section class="hero small"><div class="wrap hero-text">
  <h1>wear</h1><p class="tag">jewelry made by hand. apparel coming soon.</p>
  <p class="def">Earrings and bracelets Chad makes by hand, most of them one seed bead at a time. They live in our Etsy shop, where the prices, the sizes and the checkout are. Apparel we designed is coming soon.</p>
  <div class="btns center"><a class="btn solid" href="{SHOP}" target="_blank" rel="noopener">our etsy shop</a><a class="btn" href="{DEPOP}" target="_blank" rel="noopener">also on depop</a></div>
  {inapp_tip()}
</div></section>
<section class="section"><div class="wrap">{section_head("a few pieces", "tap one to see it on etsy")}
  <div class="wgrid">{cards}</div>
  <div class="note reveal"><p><strong>Rather make your own?</strong> The <a href="{base}patterns/">beading patterns</a> are here too, and a few are free.</p></div>
</div></section>"""
    return page("Wear: Handmade Jewelry | Same Old Samsara",
                "Handmade beaded earrings and bracelets by Same Old Samsara. Each piece is sold through our Etsy shop. Apparel we designed is coming soon.",
                base, "wear/", body, here="wear/", jsonld=ld, image=f"{SITE}/{JEWELRY[0]['img']}")

def say_hi_page():
    """the mailbox stop's page: write to us, or sign up for the newsletter."""
    base = "../"
    body = f"""<section class="hero small"><div class="wrap hero-text">
  <div class="us-big">{pic(base, US_PHOTO, US_ALT, 220, lazy=False)}</div>
  <h1>say hi</h1><p class="tag">we read everything.</p>
</div></section>
<section class="section"><div class="wrap prose reveal">
  <p>Write to us about the land, the films, a pattern that won't behave, or anything else. A message on <a href="{IG}" target="_blank" rel="noopener">Instagram</a> works too.</p>
  <div class="btns">{hi_button(base)}<a class="btn" href="{IG}" target="_blank" rel="noopener">message us on instagram</a></div>
  <h2>the newsletter</h2>
  <p>Sign up and we'll write when there's something worth saying.</p>
  <div class="btns"><a class="btn solid" href="{NEWSLETTER}" target="_blank" rel="noopener">sign up for the newsletter</a><a class="btn" href="{base}about/">who we are</a></div>
</div></section>"""
    return page("Say Hi | Same Old Samsara", "Write to Chad and Daniel of Same Old Samsara, or sign up for the newsletter.",
                base, "say-hi/", body, here="say-hi/")

def moved(title, to, canonical):
    """a tiny page for an address people guess (/shop, /contact). it sends them on, and tells search engines where the real page is."""
    return f"""<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>{e(title)} | Same Old Samsara</title>
<link rel="canonical" href="{SITE}/{canonical}"><meta name="robots" content="noindex, follow"><link rel="icon" type="image/svg+xml" href="../favicon/favicon.svg"><meta http-equiv="refresh" content="0; url={to}"></head>
<body><p>this way: <a href="{to}">sameoldsamsara.xyz/{canonical}</a></p></body></html>
"""

def about_page():
    base = "../"
    body = f"""<section class="hero small"><div class="wrap hero-text">
  <div class="us-big">{pic(base, US_PHOTO, US_ALT, 220, lazy=False)}</div>
  <h1>who's behind this</h1><p class="tag">chad + daniel.</p>
</div></section>
<section class="section"><div class="wrap prose reveal">
  <p>We're Chad and Daniel, a couple who'd never homesteaded a day in our lives. In September 2026 we bought 34 acres in Central New York: meadow, woods and a river. We're building a homestead there, one tree at a time, with a food forest, a garden and more plants than we can name. We joke that it's our compound. And we're filming all of it. Summers on the land, winters on the road in our RV as <a href="{PN}">Pneuma Nomads</a>.</p>
  <p><strong>Same Old Samsara</strong> is Chad's creative outlet. It started with memes, then beads and patterns, and now it's mostly film. Later maybe screen prints, or things made from what grows on the land.</p>
  <p>Samsara is the wheel: birth, death, coming back around. The raven sits on the ouroboros, the snake eating its tail. Seasons come back. Projects get set down and picked back up. The same old cycle.</p>
  <h2>what's here</h2>
  <ul>
    <li><a href="{base}films/">Films</a>: the documentary, a season a year on <a href="{YT}" target="_blank" rel="noopener">YouTube</a>.</li>
    <li><a href="{base}wear/">Wear</a>: beaded earrings and bracelets made by hand, sold through our Etsy shop. Apparel we designed is coming soon.</li>
    <li><a href="{base}patterns/">Beading patterns</a>: brick stitch and bead loom PDFs. A few are free, the rest are in Samsara Digitals, our pattern shop on Etsy.</li>
    <li><a href="{base}bead-lab/">The bead lab</a>: a free tool to design your own brick stitch pattern.</li>
    <li><a href="{base}field-guide/">The field guide</a>: the animals, plants and mushrooms we've found on the land so far.</li>
  </ul>
  <h2 id="say-hi">say hi</h2>
  <p>Write to us, we read everything. A message on <a href="{IG}" target="_blank" rel="noopener">Instagram</a> or <a href="{SHOP}" target="_blank" rel="noopener">Etsy</a> works too.</p>
  <div class="btns">{hi_button(base)}<a class="btn" href="{IG}" target="_blank" rel="noopener">message us on instagram</a><a class="btn" href="{NEWSLETTER}" target="_blank" rel="noopener">the newsletter</a></div>
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
    """pneuma nomads, in its own look (brand sheet: Pneuma Nomads/Brand/brand-sheet.html): a drive you scroll. You ride along with
    the truck and the fifth wheel: out of the gate, south to the water, and home again to the same gate, where the last card
    leads into the walk (the home page). The walk's last stop leads here, so the two pages make one loop.
    The 3D picture is road/roadworld.js, drawn by the walk's print engine and driven by walk/walk.js. The look is road/road.css.
    Every stop is real html, so the links work with scripts off and when a browser can't draw the world.
    The stop ids are the world's stop ids (road/roadworld.js STOP_IDS), so keep the two in step."""
    base = "../"; v = ROAD_LATEST
    title = "Pneuma Nomads | Chad & Daniel on the Road"
    desc = "Chad and Daniel's winter travel videos. Summers on our land in Central New York, winters in the fifth wheel following the warm air south."
    vlog_url = f"https://www.youtube.com/watch?v={v['id']}"
    ext = lambda t, u, solid=False: f'<a class="btn{" solid" if solid else ""}" href="{u}" target="_blank" rel="noopener">{e(t)}</a>'
    loc = lambda t, u, solid=False: f'<a class="btn{" solid" if solid else ""}" href="{base}{u}">{e(t)}</a>'
    # four boards on the signpost, four ways to follow. each row carries its board's colour.
    follow = [("youtube", PN_YT, "the road videos", "brick"), ("instagram", PN_IG, "photos from the road", "mustard"),
              ("tiktok", PN_TT, "short clips", "sage"), (PN_SPOTIFY_TEXT, PN_SPOTIFY, "what we play in the truck", "denim")]
    rows = "".join(f'<a class="lnk" style="--c:var(--{c})" href="{u}" target="_blank" rel="noopener"><b>{e(n)}</b><span>{e(d)}</span><i aria-hidden="true">&gt;</i></a>' for n, u, d, c in follow)
    stops = [
        {"id": "vlog", "name": "the latest vlog", "where": "the hills · morning", "side": "left",
         "alt": "A print of a pickup truck and fifth wheel camper pulled over under a big roadside movie screen on a hilltop in fall colour, with a map pin floating over the screen.",
         "body": f"""<p>Our newest video from the road. Pull over and watch.</p>
        <a class="vlog" href="{vlog_url}" target="_blank" rel="noopener">
          <span class="thumb">{pic(base, v['img'], v['title'], (330, 390))}<span class="play" aria-hidden="true"></span></span>
          <span class="meta"><span class="place">{pn_pin()}{e(v['place'])}</span><span class="sub">{e(v['label'])} · {e(v['len'])} · {e(v['title'])}</span></span>
        </a>""",
         "links": ext("watch it on youtube", vlog_url, True) + ext("all the road videos", PN_YT)},
        {"id": "follow", "name": "follow along", "where": "the pines · midday", "side": "left",
         "alt": "A print of the truck and camper pulled up at a wooden signpost with four coloured boards pointing four ways, on a road through pine woods.",
         "body": f"""<p>Four signs, four ways to come along. The long videos go up on YouTube first.</p>
        <div class="links">{rows}</div>""",
         "links": ""},
        {"id": "gas", "name": "gas", "where": "last gas · afternoon", "side": "left",
         "alt": "A print of the truck and camper pulled in at an old red gas pump with a lit globe, under a giant coffee cup on a pole, with the afternoon sun behind them.",
         "body": "<p>The truck runs on gas. We run on coffee. If the videos are worth a cup to you, here's the jar.</p>",
         "links": ext("buy us a coffee", PN_COFFEE, True)},
        {"id": "winter", "name": "winter", "where": "the water · sunset", "side": "left",
         "alt": "A print of the truck and camper parked by the water at sunset, with two camp chairs facing the sun, palm trees, and a small road sign with a house on it.",
         "body": "<p>This is the warm air we were following. We park by the water, film all winter and post as we go.</p>",
         # the main button is the newest vlog (the same ROAD_LATEST link as the vlog stop), with a smaller subscribe button under it
         "stack": True,
         "links": ext("watch the latest vlog", vlog_url, True)
                  + f'<a class="btn small" href="{PN_YT}?sub_confirmation=1" target="_blank" rel="noopener">subscribe on youtube</a>'},
        {"id": "home", "name": "home again", "where": "the gate · first light", "side": "left",
         "alt": "A print of the truck and camper turning in at an open wooden gate at first light in spring, with a mailbox by the road and a map pin floating over the gate.",
         "body": "<p>Come spring we drive it all back. Summers we're home on 34 acres in Central New York, building a homestead and filming it. That half is called Same Old Samsara, and it starts right here at the gate.</p>",
         "links": loc("walk the land", "", True) + loc("watch the land", "films/") + loc("jewelry", "wear/") + loc("patterns", "patterns/")},
    ]
    still = lambda n, sid, alt, lazy=True: pic(base, f"images/road/{n}-{sid}.webp", alt, (330, 620), cls="still", lazy=lazy)
    trail = "".join(f'<li><a href="#stop-{st["id"]}" data-go="{i}"><i aria-hidden="true"></i><span>{e(st["name"])}</span></a></li>' for i, st in enumerate(stops, 1))
    # a stop's buttons. "stack" puts them one under the other (the winter stop: the vlog, then a smaller subscribe button)
    btns = lambda st: ('<div class="btns' + (" stack" if st.get("stack") else "") + '">' + st["links"] + "</div>") if st["links"] else ""
    cards = "".join(f"""
  <article class="stop {st['side']}" id="stop-{st['id']}" data-stop="{i}">
    {still(i, st['id'], st['alt'])}
    <div class="card">
      <div class="bar"><span>log {i} of {len(stops)}</span><span>{e(st['where'])}</span></div>
      <div class="in">
        <h2>{e(st['name'])}</h2>
        {st['body']}
        {btns(st)}
      </div>
    </div>
  </article>""" for i, st in enumerate(stops, 1))
    six = '<div class="stripe" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div>'
    ld = {"@context": "https://schema.org", "@type": "WebPage", "name": "Pneuma Nomads", "url": SITE + "/road/", "description": desc,
          "isPartOf": {"@type": "WebSite", "name": "Same Old Samsara", "url": SITE + "/"}, "sameAs": [PN_YT, PN_IG, PN_TT]}
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
<link rel="stylesheet" href="{base}road/road.css?v={ver('road/road.css')}">
{WALK_SWITCH.format()}<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>
</head>
<body>
<a class="skip" href="#main">skip to the links</a>
<header class="top">
  <a class="brand" href="{base}road/" aria-label="Pneuma Nomads">{pn_pin()}<span>pneuma nomads</span></a>
  <nav aria-label="more"><a href="{PN_YT}" target="_blank" rel="noopener">youtube</a><a href="{base}">the land</a></nav>
</header>
<main id="main">
<section class="walk" id="walk" aria-label="the road south, and home again" data-scene="../road/roadworld.js" data-film="{base}{variant(v['img'], 480)}">
<nav class="trail" aria-label="stops on the road"><div class="trail-in">
  <ol id="trail-list">
    <li><a href="#walk" data-go="0"><i aria-hidden="true"></i><span>leaving</span></a></li>
    {trail}
  </ol>
</div></nav>
<div class="walk-view">
  <canvas class="walk-gl" aria-hidden="true"></canvas>
  <div class="walk-hot"></div>
  <p class="walk-say" role="status"></p>
</div>
<div class="walk-stops">
  <header class="stop gate" id="stop-leave" data-stop="0">
    {still(0, "leave", "A print of a pickup truck pulling a fifth wheel camper out of a gate and onto a country road at first light. Bare trees, frost on the grass, and hills far off.", lazy=False)}
    <div class="gate-text">
      <div class="bar" aria-hidden="true"><span>travel log</span><span>heading: south</span></div>
      <div class="in">
        <span class="mark">{PN_MARK}</span>
        <h1 aria-label="Pneuma Nomads"><span id="word" aria-hidden="true">Pneuma Nomads</span><span class="cur" aria-hidden="true"></span></h1>
        {six}
        <p class="tag">following the warm air.</p>
        <p class="def">We're Chad and Daniel. Summers we live on our land in Central New York, and winters we hitch up the fifth wheel with our cat Lucy and our dog Miley and head south. This is where the road videos live.</p>
        <div class="btns">{ext("watch the latest vlog", vlog_url, True)}{ext("all the road videos", PN_YT)}</div>
      </div>
    </div>
    <p class="walk-hint"><span class="on">scroll to drive south</span><span class="off">the road, stop by stop</span>
      <span class="try">this is the still version, because your device asks for less motion. <a href="?walk">show the moving one</a></span></p>
  </header>{cards}
  <div class="stop end" id="stop-end">
    <div class="end-text">
      <p class="tag">the same old cycle.</p>
      <p>Out in the fall, home in the spring.</p>
      <div class="btns"><a class="btn solid" href="{base}">walk the land</a><a class="btn" href="#walk" data-again>drive it again</a></div>
    </div>
  </div>
</div>
</section>
</main>
<footer>
  {six}
  <p>Pneuma Nomads is part of the <a href="{base}">Same Old Samsara</a> family. &copy; <span id="y">2026</span></p>
</footer>
<script>
(function(){{
  document.getElementById('y').textContent = new Date().getFullYear();
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  var el = document.getElementById('word'), t = el.textContent, i = 0; el.textContent = '';
  (function step(){{ if (i >= t.length) return; el.textContent += t[i++]; setTimeout(step, (1000/14) * (0.7 + Math.random()*0.6)); }})();
}})();
</script>
<script type="module" src="{base}walk/walk.js?v={ver('walk/walk.js')}"></script>
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
<section class="section"><div class="wrap">{section_head("the recipe box", f"{len(RECIPES)} so far")}
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
             "## Films", f"- [Films]({SITE}/films/): {DOC_LINE} {FILMS_NEXT}", f"- [YouTube channel]({YT}): Same Old Samsara, a season a year. Season 1 is 2026."]
    lines += [f"- [{x['label'].title()}: {x['title']}](https://www.youtube.com/watch?v={x['id']}) ({x['len']}): {x['blurb']}" for x in reversed(EPISODES)]
    lines += ["", "## Make", f"- [Make]({SITE}/make/): everything we make in one place, beading patterns and recipes so far.", "", "## Beading patterns", f"PDF patterns. Paid ones are instant downloads from [Samsara Digitals on Etsy]({DIGITALS}). Full library: {SITE}/patterns/", ""]
    for p in pattern_order():
        if p.get("free"):
            lines.append(f"- [{p['name']}]({SITE}/patterns/{slug(p)}/): free {p['type']} pattern. {p['blurb']} PDF: {SITE}/assets/{p['file']}.pdf")
        elif p.get("live"):
            lines.append(f"- [{p['name']}]({SITE}/patterns/{slug(p)}/): {p['type']} pattern, ${p['price']}. {p['blurb']} Buy: {listing(p['etsy'])}")
    lines += ["", "## Tools", f"- [The field guide]({SITE}/field-guide/): the animals, plants and fungi found on the land so far, as a small guessing game.", f"- [The bead lab]({SITE}/bead-lab/): free in-browser brick stitch designer. Toho 11/0 colors, mirror mode, exports a word chart.", "",
              "## Recipes"] + [f"- [{r['name'].title()}]({SITE}/recipes/{r['slug']}/): {r['blurb']}" for r in RECIPES] + ["",
              "## Wear", f"- [Wear]({SITE}/wear/): a dozen pieces of handmade jewelry with photos, each linking to its Etsy listing.",
              f"- [Same Old Samsara on Etsy]({SHOP}): handmade beaded earrings, bracelets and necklaces. Many are made to order.", f"- [Depop]({DEPOP})", "",
              "## About", f"- [About]({SITE}/about/): who we are.", f"- [Say hi]({SITE}/say-hi/): how to write to us, and the newsletter.", f"- [The land]({SITE}/land/): 34 acres of meadow, woods and river in Central New York, bought in September 2026. The exact location is private.",
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

def check_jewelry():
    """prices and stock live on Etsy, so the only thing that can go stale here is a piece that's gone. say so when it's been a while."""
    age = (datetime.date.today() - datetime.date.fromisoformat(JEWELRY_CHECKED)).days
    if age > 45:
        print(f"!! the jewelry pieces were last checked {age} days ago ({JEWELRY_CHECKED}). open each one on Etsy, take out any that are gone, and bump JEWELRY_CHECKED.")

if __name__ == "__main__":
    copy_pattern_images()
    write("index.html", home())
    for v in ("ig", "yt", "pin"): write(f"{v}/index.html", home(v))
    write("land/index.html", land_page())
    write("films/index.html", films_page())
    write("wear/index.html", wear_page())
    write("say-hi/index.html", say_hi_page())
    write("jewelry/index.html", moved("Jewelry", "../wear/", "wear/"))
    write("shop/index.html", moved("Shop", "../wear/", "wear/"))
    write("contact/index.html", moved("Say Hi", "../say-hi/", "say-hi/"))
    write("make/index.html", make_page())
    write("patterns/index.html", patterns_page())
    paged = [p for p in PATTERNS if has_page(p)]
    for p in paged: write(f"patterns/{slug(p)}/index.html", pattern_detail(p))
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
    write("sitemap.xml", sitemap(["", "films/", "make/", "wear/", "land/", "field-guide/", "road/", "say-hi/", "patterns/", "bead-lab/", "about/", "recipes/"] + [f"patterns/{slug(p)}/" for p in paged] + [f"recipes/{r['slug']}/" for r in RECIPES]))
    for night in ("", "-night"): variant(f"images/walk/0-gate{night}.webp", 720)      # walk.css paints these behind the walk on a phone
    variant("images/road/0-leave.webp", 720)                                         # and road.css paints this one behind the road
    check_jewelry()
    print("built", 17 + len(paged) + len(RECIPES), "pages")
