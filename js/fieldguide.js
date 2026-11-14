/* the field guide, on the land page: who lives here (zoomed-in guess, tap to reveal) + things to find (hint cards you turn over).
   a row of buttons shows one kind at a time. a link to a card (#goldenrod, from a pin, the map or the wheel) opens it,
   scrolls to it and marks it for a moment. progress stays in this browser only. */
(function () {
  var KEY = "sos_fieldguide";
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  var state = { met: {}, found: {} };
  try { state = Object.assign(state, JSON.parse(localStorage.getItem(KEY) || "{}")); } catch (e) {}
  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }

  var critters = document.querySelectorAll(".critter[data-id]");
  var finds = document.querySelectorAll(".find[data-id]");
  var met = document.getElementById("met"), found = document.getElementById("found");

  function tally() {
    var m = 0, f = 0;
    critters.forEach(function (c) { if (state.met[c.dataset.id]) m++; });
    finds.forEach(function (c) { if (state.found[c.dataset.id]) f++; });
    if (met) met.textContent = "you've met " + m + " of " + critters.length + (m === critters.length ? ". that's everyone so far. the trail cam is watching for more." : ".");
    if (found) found.textContent = "you've found " + f + " of " + finds.length + (f === finds.length ? ". that's everything so far. the woods will have more next year." : ".");
  }

  function setCritter(c, on) {
    c.classList.toggle("open", on);
    c.setAttribute("aria-label", on ? c.querySelector("strong").textContent : "who's this? tap to see");
    if (c.dataset.clip) clip(c, on);
  }
  /* a trail cam card plays its few silent seconds, over the still, while it's open and on screen */
  var watcher = "IntersectionObserver" in window ? new IntersectionObserver(function (es) {
    es.forEach(function (en) {
      var v = en.target.querySelector("video");
      if (!v) return;
      if (en.isIntersecting) { var p = v.play(); if (p && p.catch) p.catch(function () { v.classList.remove("on"); }); } else v.pause();
    });
  }) : null;
  function clip(c, on) {
    var frame = c.querySelector(".cframe"), v = frame.querySelector("video");
    if (!on) { if (v) v.remove(); if (watcher) watcher.unobserve(c); return; }
    if (v || reduce) return;
    v = document.createElement("video");
    v.muted = true; v.loop = true; v.playsInline = true; v.preload = "metadata";
    v.setAttribute("muted", ""); v.setAttribute("playsinline", ""); v.setAttribute("aria-hidden", "true"); v.tabIndex = -1;
    v.style.pointerEvents = "none";
    v.addEventListener("playing", function () { v.classList.add("on"); });
    v.src = c.dataset.clip;
    frame.appendChild(v);
    if (watcher) watcher.observe(c); else v.play();
  }
  /* the picture on the back of a find card isn't fetched until someone reaches for the card (the page holds its address in data- attributes) */
  function wake(c) {
    c.querySelectorAll("[data-srcset]").forEach(function (el) { el.srcset = el.dataset.srcset; el.removeAttribute("data-srcset"); });
    c.querySelectorAll("img[data-src]").forEach(function (el) { el.src = el.dataset.src; el.removeAttribute("data-src"); });
  }
  function setFind(c, on) { if (on) wake(c); c.classList.toggle("flipped", on); }

  critters.forEach(function (c) {
    if (state.met[c.dataset.id]) setCritter(c, true);
    c.addEventListener("click", function () {
      var on = !c.classList.contains("open");
      setCritter(c, on);
      if (on) { state.met[c.dataset.id] = 1; save(); tally(); }
    });
  });
  finds.forEach(function (c) {
    if (state.found[c.dataset.id]) setFind(c, true);
    ["pointerdown", "touchstart", "mouseenter", "focus"].forEach(function (t) { c.addEventListener(t, function () { wake(c); }, { passive: true }); });
    c.addEventListener("click", function () {
      var on = !c.classList.contains("flipped");
      setFind(c, on);
      if (on) { state.found[c.dataset.id] = 1; save(); tally(); }
    });
  });

  /* ---------- show everything, or one kind ---------- */
  var chips = document.querySelectorAll("#fg-chips button"), groups = document.querySelectorAll(".fg-group"), kinds = {};
  var guide = document.getElementById("field-guide"), hello = document.getElementById("fg-hello");
  function show(kind) {
    chips.forEach(function (b) { b.setAttribute("aria-pressed", b.dataset.kind === kind ? "true" : "false"); });
    finds.forEach(function (c) { c.hidden = !(kind === "all" || c.dataset.kind === kind); });
    groups.forEach(function (g) { g.hidden = !(kind === "all" || (g.dataset.group === "critters") === (kind === "critters")); });
    if (hello && !hello.hidden && hello.previousElementSibling && hello.previousElementSibling.hidden) hello.hidden = true;   // its card went away
  }
  chips.forEach(function (b) { kinds[b.dataset.kind] = 1; b.addEventListener("click", function () { show(b.dataset.kind); }); });

  var reset = document.getElementById("resetfg");
  if (reset) reset.addEventListener("click", function () {
    state = { met: {}, found: {} }; save();
    critters.forEach(function (c) { setCritter(c, false); });
    finds.forEach(function (c) { setFind(c, false); });
    show("all"); tally();
    if (guide) guide.scrollIntoView({ block: "start" });
  });

  /* ---------- a link to a card, or to a kind ----------
     #goldenrod (every pin on Pinterest, by way of the old field-guide/ address) opens that card and scrolls to it.
     #critters, #plants, #trees, #mushrooms, #signs show that kind (the walk's raccoon log links to #critters). */
  function go(h, arrived) {
    if (!h) return;
    if (kinds[h] && h !== "all") { show(h); if (guide) setTimeout(function () { guide.scrollIntoView({ block: "start" }); }, 50); return; }
    var hit = document.querySelector('.critter[data-id="' + h.replace(/"/g, "") + '"], .find[data-id="' + h.replace(/"/g, "") + '"]');
    if (!hit) return;
    if (hit.hidden || hit.closest("[hidden]")) show("all");
    if (hit.classList.contains("find")) setFind(hit, true); else setCritter(hit, true);
    // they came for this one card and know nothing else about us: say who we are right under it, with somewhere to go next
    if (arrived && hello) {
      var last = hit;                                    // the last card in the same row, so the strip doesn't leave a hole beside it
      while (last.nextElementSibling && last.nextElementSibling.offsetTop === hit.offsetTop) last = last.nextElementSibling;
      last.after(hello); hello.hidden = false;
    }
    hit.classList.remove("hit"); void hit.offsetWidth; hit.classList.add("hit");         // a gold ring that fades: this is the one
    // the card goes to the top of the window (under the header) when the strip is below it, so both are in view
    setTimeout(function () { hit.scrollIntoView({ block: arrived && hello ? "start" : "center" }); }, 50);
  }
  var hash = function () { try { return decodeURIComponent(location.hash.slice(1)); } catch (e) { return ""; } };
  go(hash(), true);
  window.addEventListener("hashchange", function () { go(hash(), false); });
  tally();
})();
