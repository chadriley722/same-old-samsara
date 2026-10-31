/* same old samsara · the almanac
   sun + moon for central new york (no location beyond that), day/night theme, the turning ring,
   wheel of the year, the land map, click-to-play films, pattern search, reveal on scroll. */
(function () {
  "use strict";
  var LAT = 43.1, LON = -75.2;            // central new york, roughly. not the land.
  var DAY_ONE = Date.UTC(2026, 8, 4);      // sept 4, 2026: we got the keys
  var TZ = "America/New_York";
  var root = document.documentElement;
  var reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (_) { return null; } }

  /* ---------- sun (sunrise equation) ---------- */
  function sunTimes(date) {
    // use noon on the land's calendar day, so late evening doesn't jump to tomorrow
    var ymd = date.toLocaleDateString("en-CA", { timeZone: TZ }).split("-");
    var noon = Date.UTC(+ymd[0], +ymd[1] - 1, +ymd[2], 17);
    var rad = Math.PI / 180, J = noon / 864e5 + 2440587.5;
    var n = Math.round(J - 2451545.0 + 0.0008);
    var Js = n - LON / 360;
    var M = (357.5291 + 0.98560028 * Js) % 360;
    var C = 1.9148 * Math.sin(M * rad) + 0.02 * Math.sin(2 * M * rad) + 0.0003 * Math.sin(3 * M * rad);
    var L = (M + C + 180 + 102.9372) % 360;
    var Jt = 2451545.0 + Js + 0.0053 * Math.sin(M * rad) - 0.0069 * Math.sin(2 * L * rad);
    var dec = Math.asin(Math.sin(L * rad) * Math.sin(23.4397 * rad));
    var w = Math.acos((Math.sin(-0.833 * rad) - Math.sin(LAT * rad) * Math.sin(dec)) / (Math.cos(LAT * rad) * Math.cos(dec))) / rad;
    var ms = function (j) { return new Date((j - 2440587.5) * 864e5); };
    return { rise: ms(Jt - w / 360), set: ms(Jt + w / 360) };
  }
  function clock(d) { return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: TZ }).toLowerCase().replace(" ", ""); }
  var now = new Date(), sun = sunTimes(now);
  var darkOnLand = now < sun.rise || now > sun.set;

  /* ---------- theme: dark when it's dark on the land ---------- */
  var chosen = store("sos_theme"), forced = (location.search.match(/sky=(day|night)/) || [])[1];
  root.dataset.theme = forced || chosen || (darkOnLand ? "night" : "day");
  var sky = document.querySelector(".sky");
  if (sky) sky.addEventListener("click", function () {
    var next = root.dataset.theme === "night" ? "day" : "night";
    root.classList.add("fade");
    root.dataset.theme = next;
    // picking what the sun would pick anyway puts it back on auto
    store("sos_theme", next === (darkOnLand ? "night" : "day") ? null : next);
  });

  /* ---------- moon ---------- */
  var SYN = 29.530588853, REF = Date.UTC(2000, 0, 6, 18, 14);
  var age = (((now - REF) / 864e5) % SYN + SYN) % SYN;
  var phases = [[1.84, "new moon"], [5.53, "waxing crescent"], [9.22, "first quarter"], [12.91, "waxing gibbous"], [16.61, "full moon"],
                [20.30, "waning gibbous"], [23.99, "last quarter"], [27.68, "waning crescent"], [99, "new moon"]];
  var phaseName = phases.filter(function (p) { return age < p[0]; })[0][1];
  function moonSVG(a) {
    var p = a / SYN, r = 9, k = Math.cos(2 * Math.PI * p), rx = Math.abs(k) * r;
    var waxing = p < 0.5, gib = k < 0;
    var lit = waxing
      ? "M0," + -r + " A" + r + "," + r + " 0 0,1 0," + r + " A" + rx + "," + r + " 0 0," + (gib ? 1 : 0) + " 0," + -r
      : "M0," + -r + " A" + r + "," + r + " 0 0,0 0," + r + " A" + rx + "," + r + " 0 0," + (gib ? 0 : 1) + " 0," + -r;
    return '<svg viewBox="-10 -10 20 20" width="18" height="18"><circle r="9" fill="none" stroke="currentColor" stroke-width="1"/><path d="' + lit + '" fill="currentColor"/></svg>';
  }

  /* ---------- almanac strip ---------- */
  var day = Math.floor((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - DAY_ONE) / 864e5) + 1;
  document.querySelectorAll("[data-almanac]").forEach(function (a) {
    var set = function (k, html) { var el = a.querySelector('[data-a="' + k + '"]'); if (el) el.innerHTML = html; };
    set("day", day > 0 ? "day " + day + " on the land" : "not ours yet");
    set("moon", phaseName);
    set("moonicon", moonSVG(age));
    set("sun", clock(sun.rise) + " · " + clock(sun.set));
    set("season", ["deep winter", "deep winter", "mud season", "early spring", "spring", "early summer", "high summer", "late summer", "goldenrod season", now.getDate() < 20 ? "peak fall" : "late fall", "late fall", "early winter"][now.getMonth()]);
  });

  /* ---------- the ring turns as you scroll (and slowly on its own) ---------- */
  var rings = document.querySelectorAll(".ring");
  if (rings.length && !reduce) {
    var t0 = performance.now();
    (function turn(t) {
      var deg = (t - t0) * 0.003 + window.scrollY * 0.12;
      rings.forEach(function (r) { r.style.setProperty("--turn", deg.toFixed(2) + "deg"); });
      requestAnimationFrame(turn);
    })(t0);
  }

  /* ---------- wheel of the year ---------- */
  document.querySelectorAll(".wheel").forEach(function (w) {
    var months = JSON.parse(w.dataset.months), cur = now.getMonth();
    var NS = "http://www.w3.org/2000/svg", C = 200, R1 = 182, R0 = 100;
    var svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 400 400");
    var pt = function (r, a) { return [C + r * Math.sin(a), C - r * Math.cos(a)]; };
    var wrap = w.parentNode, label = wrap.querySelector("#wheel-m"), text = wrap.querySelector("#wheel-text");
    var snake = document.createElementNS(NS, "circle");
    snake.setAttribute("cx", C); snake.setAttribute("cy", C); snake.setAttribute("r", 194); snake.setAttribute("class", "snake");
    svg.appendChild(snake);
    var slices = [];
    months.forEach(function (m, i) {
      var a0 = (i / 12) * 2 * Math.PI - Math.PI / 12, a1 = a0 + Math.PI / 6;
      var p0 = pt(R1, a0), p1 = pt(R1, a1), p2 = pt(R0, a1), p3 = pt(R0, a0);
      var path = document.createElementNS(NS, "path");
      path.setAttribute("d", "M" + p0 + " A" + R1 + "," + R1 + " 0 0,1 " + p1 + " L" + p2 + " A" + R0 + "," + R0 + " 0 0,0 " + p3 + " Z");
      path.setAttribute("class", "slice" + (i === cur ? " now" : ""));
      path.setAttribute("tabindex", "0"); path.setAttribute("role", "button"); path.setAttribute("aria-label", m.m);
      var lp = pt((R1 + R0) / 2, (a0 + a1) / 2);
      var tx = document.createElementNS(NS, "text");
      tx.setAttribute("x", lp[0]); tx.setAttribute("y", lp[1]); tx.textContent = m.m;
      var pick = function () {
        slices.forEach(function (s) { s.classList.remove("sel"); }); path.classList.add("sel");
        label.textContent = (i === cur ? "this month · " : "") + m.m;
        text.textContent = m.note;
      };
      path.addEventListener("click", pick);
      path.addEventListener("keydown", function (ev) { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); pick(); } });
      svg.appendChild(path); svg.appendChild(tx); slices.push(path);
    });
    var orbit = document.createElementNS(NS, "circle");
    orbit.setAttribute("cx", C); orbit.setAttribute("cy", C); orbit.setAttribute("r", R0 - 14); orbit.setAttribute("class", "orbit");
    svg.appendChild(orbit);
    var hub = document.createElementNS(NS, "text");
    hub.setAttribute("x", C); hub.setAttribute("y", C); hub.setAttribute("style", "font:italic 30px Fraunces, serif");
    hub.textContent = "day " + Math.max(day, 1);
    svg.appendChild(hub);
    w.appendChild(svg);
    slices[cur].dispatchEvent(new Event("click"));
  });

  /* ---------- the land map ---------- */
  var card = document.getElementById("map-card");
  if (card) {
    var spots = JSON.parse(card.dataset.spots), img = document.getElementById("map-img");
    var pins = document.querySelectorAll(".pin");
    pins.forEach(function (b, i) {
      if (i === 0) b.setAttribute("aria-pressed", "true");
      b.addEventListener("click", function () {
        var s = spots[b.dataset.spot];
        pins.forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
        img.style.opacity = 0;
        setTimeout(function () { img.src = s.img; img.style.opacity = 1; }, 180);
        document.getElementById("map-name").textContent = s.name;
        document.getElementById("map-note").textContent = s.note;
        if (window.innerWidth < 860) card.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "nearest" });
      });
    });
  }

  /* ---------- films: load youtube only when someone presses play ---------- */
  document.querySelectorAll(".yt").forEach(function (b) {
    b.addEventListener("click", function () {
      var f = document.createElement("iframe");
      f.src = "https://www.youtube-nocookie.com/embed/" + b.dataset.id + "?autoplay=1&rel=0";
      f.allow = "accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen";
      f.title = b.getAttribute("aria-label");
      var box = document.createElement("div");   // same frame size as the thumbnail button
      box.className = "yt"; box.appendChild(f); b.replaceWith(box);
    });
  });

  /* ---------- patterns: filter chips + search ---------- */
  var grid = document.getElementById("pgrid");
  if (grid) {
    var chips = document.querySelectorAll(".chips button"), q = document.getElementById("psearch"), f = "all";
    var apply = function () {
      var s = (q && q.value || "").trim().toLowerCase();
      grid.querySelectorAll(".pcard").forEach(function (c) {
        var okF = f === "all" || c.dataset.tags.split(" ").indexOf(f) > -1;
        var okS = !s || (c.dataset.name + " " + c.dataset.tags).toLowerCase().indexOf(s) > -1;
        c.hidden = !(okF && okS);
      });
    };
    chips.forEach(function (b) { b.addEventListener("click", function () {
      f = b.dataset.f; chips.forEach(function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); }); apply();
    }); });
    if (q) q.addEventListener("input", apply);
  }

  /* ---------- reveal on scroll ---------- */
  var els = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && !reduce && location.search.indexOf("static") < 0) {
    var io = new IntersectionObserver(function (es) { es.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } }); }, { rootMargin: "0px 0px -8% 0px" });
    els.forEach(function (el) { io.observe(el); });
  } else { root.classList.add("static"); els.forEach(function (el) { el.classList.add("in"); }); }

  var y = document.getElementById("year"); if (y) y.textContent = now.getFullYear();
})();
