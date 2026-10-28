/* the bead lab: a brick stitch doodler.
   rows alternate between n and n-1 beads, centered, like real brick stitch, so mirror mode is exact.
   saves to localStorage, exports a png and a word chart. */
(function () {
  "use strict";
  var lab = document.getElementById("lab"); if (!lab) return;
  var PAL = JSON.parse(lab.dataset.palette);
  var NS = "http://www.w3.org/2000/svg", BW = 22, BH = 16;   // bead drawn wider than tall, like real 11/0 in brick stitch
  var svg = document.getElementById("board"), sizeSel = document.getElementById("labsize");
  var state, color = 11, tool = "paint", mirror = true, undo = [];

  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (_) { return null; } }
  function fresh(cols, rows) {
    var cells = [];
    for (var r = 0; r < rows; r++) { var row = []; for (var c = 0; c < (r % 2 ? cols - 1 : cols); c++) row.push(-1); cells.push(row); }
    return { cols: cols, rows: rows, cells: cells };
  }
  function load() {
    var s = null; try { s = JSON.parse(store("sos_lab") || "null"); } catch (_) {}
    if (s && s.cells) { state = s; sizeSel.value = s.cols + "x" + s.rows; }
    else { var p = sizeSel.value.split("x"); state = fresh(+p[0], +p[1]); }
  }
  function save() { store("sos_lab", JSON.stringify(state)); }

  /* ---------- drawing the board ---------- */
  var nodes = [];
  function render() {
    var cols = state.cols, rows = state.rows;
    svg.setAttribute("viewBox", "-4 -4 " + (cols * BW + 8) + " " + (rows * BH + 8));
    svg.innerHTML = ""; nodes = [];
    if (mirror) {
      var ax = document.createElementNS(NS, "line");
      ax.setAttribute("x1", cols * BW / 2); ax.setAttribute("x2", cols * BW / 2); ax.setAttribute("y1", -4); ax.setAttribute("y2", rows * BH + 4);
      ax.setAttribute("class", "axis"); svg.appendChild(ax);
    }
    state.cells.forEach(function (row, r) {
      var off = r % 2 ? BW / 2 : 0; nodes[r] = [];
      row.forEach(function (v, c) {
        var b = document.createElementNS(NS, "rect");
        b.setAttribute("x", off + c * BW + 1); b.setAttribute("y", r * BH + 1);
        b.setAttribute("width", BW - 2); b.setAttribute("height", BH - 2); b.setAttribute("rx", 5);
        b.dataset.r = r; b.dataset.c = c;
        paintNode(b, v); svg.appendChild(b); nodes[r][c] = b;
      });
    });
    count();
  }
  function paintNode(b, v) {
    if (v < 0) { b.setAttribute("class", "b empty"); b.removeAttribute("fill"); }
    else { b.setAttribute("class", "b"); b.setAttribute("fill", PAL[v].c); }
  }
  function count() {
    var n = 0; state.cells.forEach(function (row) { row.forEach(function (v) { if (v >= 0) n++; }); });
    document.getElementById("labcount").textContent = n + " beads" + (n ? " · about " + Math.max(1, Math.ceil(n * 2 / 110)) + " g for a pair" : "");
  }

  /* ---------- tools ---------- */
  function set(r, c, v) {
    if (state.cells[r][c] === v) return;
    state.cells[r][c] = v; paintNode(nodes[r][c], v);
    if (mirror) { var L = state.cells[r].length, m = L - 1 - c; if (m !== c) { state.cells[r][m] = v; paintNode(nodes[r][m], v); } }
  }
  function neighbors(r, c) {
    var out = [], s = r % 2 ? 0.5 : 0, x = c + s;
    [[r, c - 1], [r, c + 1]].forEach(function (p) { if (p[1] >= 0 && p[1] < state.cells[r].length) out.push(p); });
    [r - 1, r + 1].forEach(function (rr) {
      if (rr < 0 || rr >= state.rows) return;
      var s2 = rr % 2 ? 0.5 : 0;
      [x - 0.5 - s2, x + 0.5 - s2].forEach(function (cc) { if (cc >= 0 && cc < state.cells[rr].length) out.push([rr, cc]); });
    });
    return out;
  }
  function fill(r, c, v) {
    var from = state.cells[r][c]; if (from === v) return;
    var q = [[r, c]], seen = {};
    while (q.length) {
      var p = q.pop(), k = p[0] + "," + p[1];
      if (seen[k] || state.cells[p[0]][p[1]] !== from) continue;
      seen[k] = 1; set(p[0], p[1], v);
      neighbors(p[0], p[1]).forEach(function (n) { q.push(n); });
    }
  }
  function snapshot() { undo.push(JSON.stringify(state.cells)); if (undo.length > 60) undo.shift(); }
  function act(target) {
    if (!target || !target.dataset || target.dataset.r === undefined) return;
    var r = +target.dataset.r, c = +target.dataset.c, v = tool === "erase" ? -1 : color;
    if (tool === "fill") fill(r, c, v); else set(r, c, v);
  }
  var down = false;
  svg.addEventListener("pointerdown", function (ev) { down = true; snapshot(); svg.setPointerCapture(ev.pointerId); act(ev.target); ev.preventDefault(); });
  svg.addEventListener("pointermove", function (ev) { if (!down || tool === "fill") return; act(document.elementFromPoint(ev.clientX, ev.clientY)); });
  ["pointerup", "pointercancel"].forEach(function (t) { svg.addEventListener(t, function () { if (down) { down = false; save(); count(); } }); });

  /* ---------- palette + buttons ---------- */
  var pal = document.getElementById("palette");
  PAL.forEach(function (p, i) {
    var b = document.createElement("button");
    b.type = "button"; b.style.background = p.c; b.title = p.n; b.setAttribute("role", "radio");
    b.setAttribute("aria-label", p.n); b.setAttribute("aria-checked", i === color ? "true" : "false");
    b.addEventListener("click", function () {
      color = i; pal.querySelectorAll("button").forEach(function (x, j) { x.setAttribute("aria-checked", j === i ? "true" : "false"); });
      if (tool === "erase") setTool("paint");
    });
    pal.appendChild(b);
  });
  function setTool(t) { tool = t; document.querySelectorAll("[data-tool]").forEach(function (b) { b.setAttribute("aria-pressed", b.dataset.tool === t ? "true" : "false"); }); }
  document.querySelectorAll("[data-tool]").forEach(function (b) { b.addEventListener("click", function () { setTool(b.dataset.tool); }); });
  var mb = document.getElementById("mirror");
  mb.addEventListener("click", function () { mirror = !mirror; mb.setAttribute("aria-pressed", mirror); render(); });
  document.getElementById("undo").addEventListener("click", function () { if (!undo.length) return; state.cells = JSON.parse(undo.pop()); render(); save(); });
  document.getElementById("clear").addEventListener("click", function () { snapshot(); state = fresh(state.cols, state.rows); render(); save(); });
  sizeSel.addEventListener("change", function () {
    var p = sizeSel.value.split("x"); snapshot();
    state = fresh(+p[0], +p[1]); render(); save();
  });

  /* ---------- word chart ---------- */
  function runs(row) {
    var out = [];
    row.forEach(function (v) { if (out.length && out[out.length - 1][0] === v) out[out.length - 1][1]++; else out.push([v, 1]); });
    return out;
  }
  function chart() {
    var lines = [], k = 0, used = {};
    state.cells.forEach(function (row) {
      var first = row.findIndex(function (v) { return v >= 0; }); if (first < 0) return;
      var last = row.length - 1 - row.slice().reverse().findIndex(function (v) { return v >= 0; });
      var seq = row.slice(first, last + 1); k++;
      var fwd = k % 2 === 1; if (!fwd) seq = seq.reverse();
      var n = seq.filter(function (v) { return v >= 0; }).length;
      lines.push("row " + k + "  " + (fwd ? "→ " : "← ") + runs(seq).map(function (x) {
        if (x[0] < 0) return x[1] + " skip";
        used[x[0]] = 1; return x[1] + " " + PAL[x[0]].n;
      }).join(", ") + "  (" + n + ")");
    });
    if (!lines.length) return "color some beads first.";
    return lines.join("\n") + "\n\ncolors: " + Object.keys(used).map(function (i) { return PAL[i].n; }).join(", ") + " (toho 11/0 frosted)\nmade in the bead lab · sameoldsamsara.xyz";
  }
  document.getElementById("chartbtn").addEventListener("click", function () {
    document.getElementById("charttext").textContent = chart();
    var o = document.getElementById("chartout"); o.hidden = false; o.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  document.getElementById("copychart").addEventListener("click", function (ev) {
    var t = document.getElementById("charttext").textContent;
    if (navigator.clipboard) navigator.clipboard.writeText(t).then(function () { ev.target.textContent = "copied"; });
  });

  /* ---------- png ---------- */
  document.getElementById("png").addEventListener("click", function () {
    var s = 3, pad = 20, cv = document.createElement("canvas");
    cv.width = (state.cols * BW + pad * 2) * s; cv.height = (state.rows * BH + pad * 2 + 24) * s;
    var g = cv.getContext("2d"); g.scale(s, s);
    g.fillStyle = "#fff4d9"; g.fillRect(0, 0, cv.width, cv.height);
    state.cells.forEach(function (row, r) {
      row.forEach(function (v, c) {
        if (v < 0) return;
        var x = pad + (r % 2 ? BW / 2 : 0) + c * BW + 1, y = pad + r * BH + 1;
        g.fillStyle = PAL[v].c; g.strokeStyle = "rgba(51,53,31,.45)"; g.lineWidth = .6;
        g.beginPath(); if (g.roundRect) g.roundRect(x, y, BW - 2, BH - 2, 5); else g.rect(x, y, BW - 2, BH - 2); g.fill(); g.stroke();
      });
    });
    g.fillStyle = "#514f4c"; g.font = "11px Courier Prime, monospace";
    g.fillText("made in the bead lab · sameoldsamsara.xyz", pad, state.rows * BH + pad + 16);
    var a = document.createElement("a"); a.download = "my-brick-stitch.png"; a.href = cv.toDataURL("image/png"); a.click();
  });

  load(); render();
})();
