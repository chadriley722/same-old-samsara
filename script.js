(() => {
  const canvas = document.getElementById('dragon-bg');
  if (!canvas) return;

  const ctx = canvas.getContext('2d', { alpha: true });

  const COLORS = [
    '#f82553', // red
    '#fb6640', // orange
    '#f8c421', // gold
    '#49cc5c', // green
    '#2c7ce5', // blue
    '#6434e9', // purple
  ];

  const DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));

  function hexToRgb(hex) {
    const normalized = hex.replace('#', '').trim();
    const value = parseInt(normalized, 16);
    return {
      r: (value >> 16) & 255,
      g: (value >> 8) & 255,
      b: value & 255,
    };
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function lerpColor(aHex, bHex, t) {
    const a = hexToRgb(aHex);
    const b = hexToRgb(bHex);
    const r = Math.round(lerp(a.r, b.r, t));
    const g = Math.round(lerp(a.g, b.g, t));
    const bch = Math.round(lerp(a.b, b.b, t));
    return `rgb(${r}, ${g}, ${bch})`;
  }

  function rainbowAt(t01) {
    const t = ((t01 % 1) + 1) % 1;
    const n = COLORS.length;
    const scaled = t * n;
    const i = Math.floor(scaled);
    const frac = scaled - i;
    const a = COLORS[i % n];
    const b = COLORS[(i + 1) % n];
    return lerpColor(a, b, frac);
  }

  let w = 0;
  let h = 0;

  function resize() {
    w = Math.floor(window.innerWidth);
    h = Math.floor(window.innerHeight);

    canvas.width = Math.floor(w * DPR);
    canvas.height = Math.floor(h * DPR);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;

    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Recenter on resize
    resetView();
    restart();
  }

  // Dragon curve is represented by a list of left/right turns (0/1).
  // Each iteration: newSeq = seq + [1] + reverse(invert(seq))
  let turns = [];
  let order = 0;

  // Rendering state
  let drawIndex = 0;
  let dir = 0; // 0:right, 1:down, 2:left, 3:up

  // We'll compute path points incrementally for efficiency.
  // points are in "grid" coordinates then projected to screen.
  let gridX = 0;
  let gridY = 0;

  // View transform
  let originX = 0;
  let originY = 0;
  let step = 6; // pixels per segment (adjusted by fit)

  // Bounds tracking (grid space)
  let minX = 0;
  let maxX = 0;
  let minY = 0;
  let maxY = 0;

  function resetBounds() {
    minX = maxX = 0;
    minY = maxY = 0;
  }

  function updateBounds(x, y) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  function resetView() {
    step = Math.max(2, Math.min(10, Math.floor(Math.min(w, h) / 180)));
    originX = Math.round(w / 2);
    originY = Math.round(h / 2);
  }

  function estimateBounds(seq) {
    let x = 0;
    let y = 0;
    let d = 0;
    let mnX = 0;
    let mxX = 0;
    let mnY = 0;
    let mxY = 0;

    function stepForward() {
      if (d === 0) x += 1;
      else if (d === 1) y += 1;
      else if (d === 2) x -= 1;
      else y -= 1;

      if (x < mnX) mnX = x;
      if (x > mxX) mxX = x;
      if (y < mnY) mnY = y;
      if (y > mxY) mxY = y;
    }

    // Start as a point, then one forward move.
    stepForward();

    for (let i = 0; i < seq.length; i += 1) {
      // turn: 1 = right, 0 = left (conventional choice)
      d = (d + (seq[i] ? 1 : 3)) & 3;
      stepForward();
    }

    return { minX: mnX, maxX: mxX, minY: mnY, maxY: mxY };
  }

  let segmentsTotal = 1;

  function advanceOrder() {
    // Build next dragon turn sequence.
    // new = old + [1] + reverse(invert(old))
    const n = turns.length;
    const next = new Array(n * 2 + 1);

    for (let i = 0; i < n; i += 1) next[i] = turns[i];
    next[n] = 1;
    for (let i = 0; i < n; i += 1) {
      next[n + 1 + i] = turns[n - 1 - i] ? 0 : 1;
    }

    turns = next;
    order += 1;
    segmentsTotal *= 2;
  }

  function restart() {
    // Start at order 0 (exactly one segment), then grow 1,2,4,8,16...
    ctx.clearRect(0, 0, w, h);
    turns = [];
    order = 0;
    segmentsTotal = 1;

    drawIndex = 0;
    dir = 0;
    gridX = 0;
    gridY = 0;
    resetBounds();
    updateBounds(0, 0);
  }

  function drawSegment(fromX, fromY, toX, toY, t01) {
    ctx.strokeStyle = rainbowAt(t01);
    ctx.beginPath();
    ctx.moveTo(originX + fromX * step, originY + fromY * step);
    ctx.lineTo(originX + toX * step, originY + toY * step);
    ctx.stroke();
  }

  function stepForward() {
    const x0 = gridX;
    const y0 = gridY;

    if (dir === 0) gridX += 1;
    else if (dir === 1) gridY += 1;
    else if (dir === 2) gridX -= 1;
    else gridY -= 1;

    updateBounds(gridX, gridY);

    const t01 = segmentsTotal <= 1 ? 0 : drawIndex / segmentsTotal;

    drawSegment(x0, y0, gridX, gridY, t01);
  }

  // Animation tuning
  const MAX_ORDER = 18; // 2^18 segments (~262k) is heavy; we’ll scale as we go
  let lastTs = 0;
  let segsPerSecond = 4000;

  function setStrokeWidthForOrder() {
    // Thinner as it gets more complex.
    const base = 2.0;
    const thin = Math.max(0.7, base - order * 0.08);
    ctx.lineWidth = thin;
  }

  function animate(ts) {
    const dt = Math.min(0.05, (ts - lastTs) / 1000 || 0);
    lastTs = ts;

    setStrokeWidthForOrder();

    // Draw a batch of segments this frame based on dt.
    const batch = Math.max(1, Math.floor(segsPerSecond * dt));

    for (let i = 0; i < batch; i += 1) {
      // Completed current stage => double complexity and keep drawing.
      if (drawIndex >= segmentsTotal) {
        if (order >= MAX_ORDER) {
          restart();
          break;
        }
        advanceOrder();
      }

      // Segment 0: just draw the first line.
      if (drawIndex === 0) {
        stepForward();
        drawIndex += 1;
        continue;
      }

      // Apply turn then step forward.
      const t = turns[drawIndex - 1];
      dir = (dir + (t ? 1 : 3)) & 3;
      stepForward();
      drawIndex += 1;
    }

    requestAnimationFrame(animate);
  }

  // Init
  function init() {
    resize();

    requestAnimationFrame(animate);
  }

  window.addEventListener('resize', () => {
    resize();
  });

  init();
})();
