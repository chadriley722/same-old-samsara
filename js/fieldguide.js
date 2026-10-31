/* the field guide: who lives here (zoomed-in guess, tap to reveal) + things to find (hint cards you turn over).
   progress stays in this browser only. */
(function () {
  var KEY = "sos_fieldguide";
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
    if (met) met.textContent = "you've met " + m + " of " + critters.length + (m === critters.length ? ". more coming when the trail cam is up." : ".");
    if (found) found.textContent = "you've found " + f + " of " + finds.length + (f === finds.length ? ". that's everything so far. the woods will have more next year." : ".");
  }

  function setCritter(c, on) {
    c.classList.toggle("open", on);
    c.setAttribute("aria-label", on ? c.querySelector("strong").textContent : "who's this? tap to see");
  }
  function setFind(c, on) { c.classList.toggle("flipped", on); }

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
    c.addEventListener("click", function () {
      var on = !c.classList.contains("flipped");
      setFind(c, on);
      if (on) { state.found[c.dataset.id] = 1; save(); tally(); }
    });
  });

  var reset = document.getElementById("resetfg");
  if (reset) reset.addEventListener("click", function () {
    state = { met: {}, found: {} }; save();
    critters.forEach(function (c) { setCritter(c, false); });
    finds.forEach(function (c) { setFind(c, false); });
    tally();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  tally();
})();
