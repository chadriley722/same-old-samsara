# sameoldsamsara.xyz review, Nov 7 2026

Looked at every page as a first time visitor (YouTube viewer, Etsy buyer, beader), on desktop (1024 wide) and phone (375), mostly in night mode since it was after sunset on the land. Branch: `site-review-2026-11-07`. Nothing pushed or published.

## top 10 (ranked by impact)

1. **The films are two episodes behind.** Home and /films said episode 2 was the newest. E3 (peak fall) and E4 (the lost well, out today) were missing. A YouTube viewer who clicks the link in the channel lands on old news. FIXED: all four episodes are in, newest first, with the real thumbnails, and each has its own upload date in the video schema.
2. **The first screen on a phone has no way in.** It's the logo ring, the name, the tagline and a paragraph. No video, no button, no picture of the land. The name shows up three times (header, ring, headline) before anything else. FIXED: the ring now sizes to the screen height (it was 440px on every laptop), and the hero has "watch the newest episode" (jumps to the films and starts playing it) and "start at episode 1" right under the intro. Both show on the first screen on a phone and a laptop.
3. **Photos were way too heavy.** The land strip alone pulled about 3.3 MB on the home page. Single photos were 600 to 800 KB (creek 791 KB, canopy 640 KB, toad 636 KB, monarch 2160x3840). FIXED: every land photo resized to 1280 max and recompressed. images/land went from 8.3 MB to 4.1 MB, same look.
4. **Nothing says where Chad + Daniel are right now.** The site is built around the land, but from Nov 15 you're on the road until May 1, and the almanac still says "day 80 on the land". FIXED: a small line under the hero buttons: "on the land now" in season, "on the land till mid november" in early November, and "on the road now. the road videos" (links /road) from Nov 15 to May 1. It flips on its own, no rebuild.
5. **If the JavaScript fails or loads slow, most of the page is invisible.** Everything with the scroll fade starts at opacity 0 and only shows once site.js runs. Bad for slow phone connections and for anything that reads the page without running scripts. FIXED: the fade only arms once the script marks the page as ready. Without JS, everything just shows.
6. **Phone nav is cut off.** "jewel" hangs off the right edge and there's no hint it scrolls. FIXED: the links fit on one line at 375 wide.
7. **Episode updates are manual in three places** (EPISODES list, the thumbnail file, the hardcoded upload dates). That's why the site fell behind. FIXED: one EPISODES entry per episode now carries its own date. Adding E5 = one dict + one thumbnail. Added a note to the Video Editor workflow suggestion below.
8. **Free pattern is off season.** The pumpkin (Halloween) is the first thing in the make section in November. NOT CHANGED, Chad's call: swap the freebie to something winter or neutral (needs a PDF with the end page). Until then it's fine, it's just a little stale.
9. **Who you are is buried.** Research says nobody owns gay homestead YouTube, but the site never says you're a couple. Home says "two guys", about says "Chad and Daniel". NOT CHANGED, Chad's call. Suggestion: one plain line on home and about, like "We're Chad and Daniel, a couple who'd never homesteaded a day in our lives." Same words as the YouTube about, which already works.
10. **Lowercase place names in reading text.** Meta descriptions, the organization schema, llms.txt and the road page said "central New York". Reading text is sentence case, so FIXED to "Central New York" everywhere.

## everything else, by page

### home (the almanac)
- Good: day/night by the real sun, the almanac strip, the wheel, the photo strip. It feels like a place, not a shop. Keep that.
- The ring + headline + tagline say the same thing three times. Smaller ring on phones helps (done). On desktop it's fine, it's the brand moment.
- "wear" says "This is the shop that keeps the films going." Nice line. But Etsy is parked until after Nov 15. If any featured pieces sell out, the cards will point to dead listings. Check the 4 FEATURED ids when the shop reopens.
- The newsletter is only a tiny footer link to a Google Form. Either give it a real block (if Chad will actually send letters) or drop it. A link that leads nowhere active hurts. Chad's call.
- "follow along" cards are good. TikTok + IG copy fine.

### /films
- Fixed the missing episodes and dates (top 10 #1).
- Suggestion: link the Season 1 playlist once there's a public playlist URL (add `PLAYLIST =` in build.py).
- Suggestion: a "short version" row of 3 or 4 land shorts between episodes for people who won't sit through 40 minutes.

### /make, /patterns, /patterns/<slug>
- Strong. Product schema, breadcrumbs, swatches, "what's inside", related patterns. This is the best part of the site for an Etsy buyer.
- The pattern image and title fade in on load (the scroll fade), which delays the biggest image on the page. Fixed by #5 for no-JS; the fade itself is short.
- Squid + jellyfish pages could link the wavy fringe tutorial short on YouTube. Needs the short's URL.
- The old square cards (loom patterns etc.) look fine framed on cream. Redo heroes as patterns get redone.

### /recipes
- One recipe. The shelf reads "1 so far" which is honest and fine. The recipe page is good (checkboxes, print, schema).
- Next recipe ideas: anything cooked in the RV this winter. A "road kitchen" angle fits both brands.

### /bead-lab
- Works, fun, saves locally. Fine on phone. Could add a "start from a pattern" button later (load the squid outline). Not urgent.

### /field-guide
- The zoom-guess game is charming. The trail cam "coming soon" card can now become real: the cam caught a raccoon (E4). Add the raccoon still as a critter when Chad pulls the frame.

### /about
- Clear and short. Missing a photo of the two of you. Even one frame from an episode would do a lot for trust. Chad's pick.
- "say hi" sends people to Etsy messages or IG. Fine. No email shown on purpose, keep it that way.

### /road (Pneuma Nomads)
- The PN look is spot on. Latest vlog is Salem (vlog 18). Update ROAD_LATEST when the first winter vlog drops.
- Fixed "central New York" casing.

### /ig, /yt, /pin
- Same page reordered per platform, noindex. Smart. /yt now leads with E4 since it reads EPISODES[0].

## SEO + speed
- Titles, descriptions, canonicals, OG images, schema, sitemap, llms.txt, robots: all present and good.
- Speed: photos fixed (#3). Fonts load from Google with display=swap, fine. Fraunces is a big variable font; could subset later.
- VideoObject upload dates were wrong for E2 (and missing E3, E4). Fixed.
- sitemap lastmod is "today" for every URL on every build. Harmless, but Google learns to ignore it. Low priority.

## accessibility
- Skip link, aria labels on map pins and wheel, reduced motion respected. Good.
- Content hidden without JS (fixed, #5).
- One image on home has an empty alt (the episode thumbnails in the list, on purpose since the title is next to it). Fine.

## voice check (CLAUDE.md rules)
- No dashes found in copy. Display text lowercase, reading text sentence case. No "farm". No place names. No charity claims. Good.
- "A creative outlet:" hero line kept as is.

## also changed
- style.css and site.js links carry a short version stamp (`?v=`), so returning visitors get new styles right away instead of a cached old copy.
- The field guide's trail cam card now says the cam is up and caught a raccoon (E4), instead of "coming soon". It was also lowercase reading text, now sentence case.
- Home land blurb no longer says "right now it's goldenrod" (it's November). It's season neutral now.
- Small episode cards say "episode 3 · 25:51" instead of the full "season 1 · episode 3 · 25:51", which wrapped.
- Screenshots: `_build/review-shots/` (before + after).

## second pass (not done tonight)
- Swap the seasonal freebie (needs a winter PDF with the end page).
- One line about being a couple, and a photo of you two on about (Chad's call).
- Raccoon from the trail cam into the field guide.
- Season 1 playlist link, wavy fringe tutorial link on squid/jellyfish.
- Newsletter: real block or remove.
- Check FEATURED jewelry ids still live when Etsy reopens.
- Workflow: when an episode goes live, the Video Editor upload step should also add it to EPISODES in build.py (copy the thumbnail to images/epN-*.jpg, 1280x720). That's what kept this behind.
