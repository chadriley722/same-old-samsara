/* same old samsara · the walk · the page side
   Scrolling the page is walking the trail. This file reads the scroll, tells the world where you are,
   keeps the trail list and the little buttons on things in step, and backs off to the plain page if anything goes wrong.
   The html for every stop is already on the page (see _build/build.py), so nothing here is needed to reach a link.
   It drives the road trip too (/road): that page names its own scene in data-scene, and the scene brings its own buttons. */

const root = document.documentElement;
const walk = document.getElementById("walk");
const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);

window.SOS_WALK = true;            // tells the page this script arrived (the head gives up and shows the plain page if it never does)
if (walk) {
  everyMode();
  if (root.classList.contains("walk-on")) start().catch(goPlain);
}

function goPlain(err) {
  if (err) console.warn("the walk fell back to the plain page:", err.message || err);
  root.classList.remove("walk-on", "walk-ready"); root.classList.add("walk-plain");
}

/* the buttons that should work whether or not the world is drawn */
function everyMode() {
  const again = walk.querySelector("[data-again]");
  if (again) again.addEventListener("click", (e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" }); });
  const play = walk.querySelector("[data-walk-play]");
  if (play) play.addEventListener("click", (e) => {
    const stop = document.getElementById("stop-films"), btn = stop && stop.querySelector("button.yt");
    if (!stop) return;
    e.preventDefault();
    const go = walk.goTo ? walk.goTo(1) : (stop.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" }), 700);
    if (btn) setTimeout(() => btn.click(), go);
  });
}

async function start() {
  const scene = await import(walk.dataset.scene || "./world.js"), { World, STOP_IDS } = scene;
  const view = walk.querySelector(".walk-view"), canvas = walk.querySelector(".walk-gl");
  const stops = [...walk.querySelectorAll(".stop[data-stop]")];
  const q = new URLSearchParams(location.search);

  /* how much this device can take */
  const coarse = matchMedia("(pointer: coarse)").matches, small = Math.min(screen.width, screen.height) < 820;
  let tier = coarse && small ? 1 : 2;
  if ((navigator.deviceMemory || 4) <= 2 || (navigator.hardwareConcurrency || 4) <= 2) tier = 0;
  if (q.has("tier")) tier = clamp(+q.get("tier") | 0, 0, 2);
  const dpr = window.devicePixelRatio || 1;
  const baseScale = tier === 2 ? (dpr < 1.5 ? 1.5 : Math.min(dpr, 2)) : tier === 1 ? Math.min(dpr, 1.6) : Math.min(dpr, 1.1);
  let governor = 1;
  // never draw more pixels than this, however big or sharp the screen is. the print look does not need them.
  const BUDGET = [0.8e6, 1.7e6, 3.4e6][tier];
  const fit = () => {
    const w = view.clientWidth, h = view.clientHeight;
    let scale = baseScale * governor;
    if (w * h * scale * scale > BUDGET) scale = Math.sqrt(BUDGET / (w * h));
    world.resize(w, h, scale);
  };

  const world = new World(canvas, { tier, capture: q.has("keep") });       // throws when there is no WebGL2, and we fall back
  const dbg = world.gl.getExtension("WEBGL_debug_renderer_info");
  if (dbg && /swiftshader|llvmpipe|software/i.test(String(world.gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL))) && !q.has("walk")) throw new Error("software renderer");
  let lost = false;
  if (walk.dataset.film) { const im = new Image(); im.onload = () => { world.setFilm(im); wake(); }; im.src = walk.dataset.film; }
  canvas.addEventListener("webglcontextlost", (e) => { e.preventDefault(); lost = true; });
  canvas.addEventListener("webglcontextrestored", () => { try { world.build(); lost = false; wake(); } catch (err) { goPlain(err); } });

  /* ---------- where each stop sits in the scroll ---------- */
  let anchors = [0], narrow = false;
  function measure() {
    const vh = window.innerHeight;
    narrow = window.innerWidth < 761;
    anchors = stops.map((el, i) => {
      if (i === 0) return 0;
      const r = el.querySelector(".card").getBoundingClientRect();
      // wide: you arrive when the card is half way up the window. narrow: when its top edge is, so the thing you came
      // to see is still in view above it, and the card slides up over it as you keep going.
      return Math.max(0, r.top + window.scrollY - (narrow ? vh * 0.5 : vh * 0.52 - r.height / 2));
    });
    for (let i = 1; i < anchors.length; i++) anchors[i] = Math.max(anchors[i], anchors[i - 1] + 1);
    const head = document.querySelector("header.top");
    walk.style.setProperty("--top-h", (head ? head.offsetHeight : 60) + "px");
    fit();
    wake();
  }
  const uAt = (y) => {
    for (let k = 0; k < anchors.length - 1; k++) if (y < anchors[k + 1]) return k + clamp((y - anchors[k]) / (anchors[k + 1] - anchors[k]), 0, 1);
    return anchors.length - 1;
  };
  /** scroll to a stop. returns roughly how long the trip takes, in ms. */
  walk.goTo = (k) => {
    const far = Math.abs(uAt(window.scrollY) - k);
    window.scrollTo({ top: anchors[k], behavior: "smooth" });
    return 500 + Math.min(far, 4) * 350;
  };

  /* ---------- the trail list ---------- */
  const links = [...walk.querySelectorAll(".trail a[data-go]")], nowLabel = document.createElement("p");
  nowLabel.className = "trail-now label"; nowLabel.setAttribute("aria-hidden", "true");
  walk.querySelector(".trail-in").prepend(nowLabel);
  links.forEach((a) => a.addEventListener("click", (e) => {
    e.preventDefault();
    const k = +a.dataset.go, ms = walk.goTo(k), h = stops[k].querySelector("h1, h2");
    if (h) { h.tabIndex = -1; setTimeout(() => h.focus({ preventScroll: true }), ms); }
  }));
  let shown = -1;
  function markTrail(k) {
    if (k === shown) return; shown = k;
    links.forEach((a) => { const i = +a.dataset.go; if (i === k) a.setAttribute("aria-current", "step"); else a.removeAttribute("aria-current"); a.classList.toggle("done", i < k); });
    nowLabel.textContent = links[k].textContent.trim();          // the dots beside it already say how far along you are
    walk.dataset.at = STOP_IDS[k];
  }

  /* ---------- little buttons on things in the world ---------- */
  const hotBox = walk.querySelector(".walk-hot"), sayEl = walk.querySelector(".walk-say");
  const RAVEN = ["you made it. i'll show you around.", "they point that thing at everything.", "beads. thousands of them. i counted.", "shiny. i approve.",
    "the river was here before any of us.", "the raccoon thinks nobody can see him.", "pull up a chair. not that one.", "they do read the mail.", "they leave every winter. i stay."];
  let sayTimer = 0, sayAt = null;
  function say(text, at) {
    sayEl.textContent = text; sayAt = at; sayEl.classList.add("on");
    clearTimeout(sayTimer); sayTimer = setTimeout(() => sayEl.classList.remove("on"), 3600);
    wake();
  }
  const HOT = scene.hot ? scene.hot({ world, say, flash, u: () => uS }) : [
    { id: "raven", label: "the raven", range: 60, when: () => true, act: () => { world.ravenHop = 1; say(RAVEN[clamp(Math.round(uS), 0, RAVEN.length - 1)], "raven"); if (sound && soundOn) sound.caw(); } },
    { id: "fire", label: "poke the fire", range: 30, when: () => world.fire > 0.3, act: () => { world.fireKick = 0.9; say("sparks.", "fire"); } },
    { id: "apple", label: "shake the apple tree", range: 26, when: () => Math.abs(uS - 3) < 0.7, act: () => { world.beadKick = 1; say("they don't fall off. we tried.", "apple"); } },
    { id: "cam", label: "the trail cam", range: 22, when: () => Math.abs(uS - 5) < 0.6, act: () => { flash(); say("the trail cam got you. now you're in the field guide.", "cam"); } },
    { id: "mailbox", label: "the mailbox", range: 16, when: () => Math.abs(uS - 7) < 0.7, act: () => say("flag's up. that means there's mail going out.", "mailbox") },
  ];
  HOT.forEach((h) => {
    const b = (h.el = document.createElement("button"));
    b.type = "button"; b.className = "hot"; b.setAttribute("aria-label", h.label); b.title = h.label; b.hidden = true;
    b.addEventListener("click", h.act); hotBox.appendChild(b);
  });
  const flashEl = document.createElement("div"); flashEl.className = "walk-flash"; view.appendChild(flashEl);
  function flash() { flashEl.classList.remove("go"); void flashEl.offsetWidth; flashEl.classList.add("go"); }
  function placeHot() {
    for (const h of HOT) {
      const p = world.hot[h.id] && h.when() ? world.project(world.hot[h.id], -10) : null;
      const on = !!p && p[2] < h.range && p[1] > 70;
      if (h.el.hidden === on) h.el.hidden = !on;
      if (on) h.el.style.transform = `translate(${p[0].toFixed(1)}px, ${p[1].toFixed(1)}px)`;
    }
    if (sayAt && sayEl.classList.contains("on")) {
      const p = world.project(world.hot[sayAt], 200);
      if (p) sayEl.style.transform = `translate(${clamp(p[0], 110, world.cssW - 110).toFixed(1)}px, ${Math.max(p[1] - 34, 90).toFixed(1)}px) translate(-50%, -100%)`;
    }
  }

  /* ---------- sound: off until asked for, and made on the spot (walk/sound.js) ---------- */
  const soundBtn = walk.querySelector(".walk-sound");
  let sound = null, soundOn = false, soundTimer = 0;
  if (soundBtn && (window.AudioContext || window.webkitAudioContext)) {
    soundBtn.hidden = false;
    soundBtn.addEventListener("click", async () => {
      if (!sound) { try { sound = (await import("./sound.js")).startSound(); } catch (_) { sound = null; } if (!sound) { soundBtn.hidden = true; return; } }
      soundOn = !soundOn;
      soundBtn.setAttribute("aria-pressed", soundOn ? "true" : "false");
      soundBtn.firstElementChild.textContent = soundOn ? "sound: on" : "sound: off";
      clearInterval(soundTimer);
      if (soundOn) { sound.on(); hear(); soundTimer = setInterval(() => { hear(); sound.tick(); }, 300); } else sound.off();
    });
    document.addEventListener("visibilitychange", () => { if (sound && soundOn) (document.hidden ? sound.off() : sound.on()); });
  }
  function hear() { if (sound && soundOn && world.cam) sound.set({ ...world.ears(), walking: Math.min(gust, 1) }); }

  /* ---------- looking around a little ---------- */
  const head = [0, 0], headTo = [0, 0];
  let drag = null;
  view.addEventListener("pointermove", (e) => {
    if (e.pointerType === "mouse") { const r = view.getBoundingClientRect(); headTo[0] = ((e.clientX - r.left) / r.width - 0.5) * 0.17; headTo[1] = -((e.clientY - r.top) / r.height - 0.5) * 0.07; }
    else if (drag) headTo[0] = clamp(drag.yaw - (e.clientX - drag.x) * 0.0042, -0.7, 0.7);
    wake();
  }, { passive: true });
  canvas.addEventListener("pointerdown", (e) => { if (e.pointerType !== "mouse") drag = { x: e.clientX, yaw: headTo[0] }; }, { passive: true });
  const drop = () => { if (drag) { drag = null; headTo[0] = 0; wake(); } };
  addEventListener("pointerup", drop, { passive: true }); addEventListener("pointercancel", drop, { passive: true });
  view.addEventListener("pointerleave", () => { headTo[0] = headTo[1] = 0; wake(); }, { passive: true });

  /* ---------- day or night: the walk starts in whichever the site is in ---------- */
  const isNight = () => root.dataset.theme === "night";
  let nS = isNight() ? 1 : 0, nT = nS;
  const born = performance.now();
  new MutationObserver(() => {
    nT = isNight() ? 1 : 0;
    if (performance.now() - born < 900 || reduce) nS = nT;       // the site picks its theme right after load: no need to make a show of it
    world.pull += 1; wake();
  }).observe(root, { attributes: true, attributeFilter: ["data-theme"] });

  const SYN = 29.530588853, moonPhase = ((((Date.now() - Date.UTC(2000, 0, 6, 18, 14)) / 864e5) % SYN) + SYN) % SYN / SYN;

  /* ---------- the loop ---------- */
  let uS = 0, gust = 0, last = 0, lastTick = -1, raf = 0, onScreen = true, awakeUntil = 0, slow = 0, first = true, dirty = true;
  function wake() { awakeUntil = performance.now() + 45000; dirty = true; if (!raf && onScreen && !document.hidden) { last = 0; raf = requestAnimationFrame(frame); } }
  function frame(now) {
    raf = 0;
    if (!onScreen || document.hidden || lost || !root.classList.contains("walk-on")) return;     // the last one: we fell back to the plain page
    const dt = last ? Math.min((now - last) / 1000, 0.1) : 0.016; last = now;
    const target = uAt(window.scrollY), prev = uS;
    uS += (target - uS) * (first ? 1 : 1 - Math.exp(-dt * 9));
    if (Math.abs(target - uS) < 0.0005) uS = target;
    const speed = Math.abs(uS - prev) / dt;
    gust += (clamp(speed * 1.7, 0, 1.4) - gust) * (1 - Math.exp(-dt * 5));
    const pn = nS; nS += (nT - nS) * (1 - Math.exp(-dt * 2.4)); if (Math.abs(nT - nS) < 0.002) nS = nT;
    const ph0 = head[0], ph1 = head[1];
    head[0] += (headTo[0] - head[0]) * (1 - Math.exp(-dt * 6)); head[1] += (headTo[1] - head[1]) * (1 - Math.exp(-dt * 6));
    const moving = uS !== prev || nS !== pn || Math.abs(head[0] - ph0) + Math.abs(head[1] - ph1) > 1e-5 || world.fireKick > 0.02 || world.beadKick > 0.02 || world.ravenHop > 0.02 || world.honk > 0.02 || gust > 0.02;
    const tick = Math.floor(now / 1000 * 12);                     // things that sway are redrawn 12 times a second
    if (moving || dirty || tick !== lastTick) {
      world.render({ u: uS, time: now / 1000, head, night: nS, gust, moonPhase, seen: clamp(window.innerHeight / (view.clientHeight || 1), 0.6, 1) });
      placeHot();
      lastTick = tick; dirty = false;
      // if this device can't keep up while you're walking, soften the picture a step
      if (moving && !first) {
        slow = dt > 0.034 ? slow + dt : Math.max(0, slow - dt * 0.5);
        if (slow > 1.2 && governor > 0.56) { governor *= 0.82; slow = 0; fit(); }
        else if (slow > 4 && dt > 0.09) return goPlain(new Error("too slow on this device"));
      }
      if (first) { first = false; root.classList.add("walk-ready"); }
    }
    const k = Math.round(uS);
    markTrail(k);
    if (moving) awakeUntil = now + 45000;
    if (now < awakeUntil) raf = requestAnimationFrame(frame);     // after a while with nobody there, stop and hold the picture
  }

  new IntersectionObserver((es) => { onScreen = es[es.length - 1].isIntersecting; if (onScreen) wake(); }, { rootMargin: "100px" }).observe(walk);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) wake(); });
  addEventListener("scroll", wake, { passive: true });
  addEventListener("resize", measure, { passive: true });
  if (window.ResizeObserver) new ResizeObserver(measure).observe(view);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
  addEventListener("load", measure);

  measure();
  // arriving on a link like /#stop-films (or an old one like /#make): stand at that stop, not half way to it
  let aim = null; try { aim = location.hash.length > 1 ? walk.querySelector(location.hash) : null; } catch (_) {}
  const hi = aim ? stops.indexOf(aim.closest(".stop[data-stop]")) : -1;
  if (hi > 0) requestAnimationFrame(() => window.scrollTo(0, anchors[hi]));
  // ?u=4.5 puts you half way between stop 4 and stop 5 (handy for checking a spot)
  if (q.has("u")) { const v = clamp(+q.get("u") || 0, 0, anchors.length - 1), k = Math.min(Math.floor(v), anchors.length - 2); root.style.scrollBehavior = "auto"; requestAnimationFrame(() => window.scrollTo(0, anchors[k] + (anchors[k + 1] - anchors[k]) * (v - k))); }
  window.__walk = { world, get u() { return uS; }, anchors: () => anchors };
}
