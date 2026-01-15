(() => {
  const canvas = document.getElementById('dragon-bg');
  if (!canvas) return;

  const ctx = canvas.getContext('2d', { alpha: true });
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rootStyle = getComputedStyle(document.documentElement);
  const colors = [
    rootStyle.getPropertyValue('--red').trim(),
    rootStyle.getPropertyValue('--orange').trim(),
    rootStyle.getPropertyValue('--gold').trim(),
    rootStyle.getPropertyValue('--green').trim(),
    rootStyle.getPropertyValue('--blue').trim(),
    rootStyle.getPropertyValue('--purple').trim()
  ].filter(Boolean);

  const dpr = window.devicePixelRatio || 1;
  let points = [];
  let bounds = null;
  let lastIter = 0;
  let lastBuild = 0;

  function buildTurns(iterations) {
    let turns = [];
    for (let i = 0; i < iterations; i += 1) {
      const reversed = turns.slice().reverse();
      const inverted = reversed.map(turn => (turn === 'L' ? 'R' : 'L'));
      turns = turns.concat('L', inverted);
    }
    return turns;
  }

  function buildPoints(turns) {
    const pts = [];
    const dx = [1, 0, -1, 0];
    const dy = [0, 1, 0, -1];
    let dir = 0;
    let x = 0;
    let y = 0;

    pts.push({ x, y });

    for (const turn of turns) {
      x += dx[dir];
      y += dy[dir];
      pts.push({ x, y });
      dir = (dir + (turn === 'L' ? 1 : 3)) & 3;
    }

    x += dx[dir];
    y += dy[dir];
    pts.push({ x, y });

    return pts;
  }

  function computeBounds(pts) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const p of pts) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }

    return {
      minX,
      minY,
      maxX,
      maxY,
      width: maxX - minX,
      height: maxY - minY,
      centerX: (minX + maxX) / 2,
      centerY: (minY + maxY) / 2
    };
  }

  function resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function prepareCurve(iterations) {
    const turns = buildTurns(iterations);
    points = buildPoints(turns);
    bounds = computeBounds(points);
    lastIter = iterations;
  }

  function draw(timestamp, revealProgress = 1) {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;

    ctx.clearRect(0, 0, width, height);

    if (!bounds || points.length < 2) return;
    const visibleCount = Math.max(2, Math.floor(points.length * revealProgress));

    const padding = 0;
    const scale = Math.min(
      (width - padding * 2) / bounds.width,
      (height - padding * 2) / bounds.height
    );
    const time = timestamp || 0;
    const angle = time * 0.00008;
    const pulse = 0.98 + Math.sin(time * 0.0007) * 0.02;
    const phase = Math.floor(time / 2000) % colors.length;

    function drawLayer(layerAngle, layerScale, layerAlpha, phaseOffset) {
      ctx.save();
      ctx.translate(width / 2, height / 2);
      ctx.rotate(layerAngle);
      ctx.scale(scale * pulse * layerScale, scale * pulse * layerScale);
      ctx.translate(-bounds.centerX, -bounds.centerY);
      ctx.lineWidth = 1.4 / scale;
      ctx.lineCap = 'round';
      ctx.globalAlpha = layerAlpha;

      for (let c = 0; c < colors.length; c += 1) {
        ctx.strokeStyle = colors[(c + phase + phaseOffset) % colors.length];
        ctx.beginPath();
        for (let i = 0; i < visibleCount - 1; i += 1) {
          if (i % colors.length !== c) continue;
          const p0 = points[i];
          const p1 = points[i + 1];
          ctx.moveTo(p0.x, p0.y);
          ctx.lineTo(p1.x, p1.y);
        }
        ctx.stroke();
      }

      ctx.restore();
    }

    drawLayer(angle, 1, 0.9, 0);
    drawLayer(-angle * 0.6, 0.92, 0.6, 2);
  }

  function animate(timestamp) {
    const now = timestamp || 0;
    const rampMs = 52000;
    const holdMs = 20000;
    const totalMs = rampMs + holdMs;
    const maxIter = 19;
    const minIter = 7;
    const progress = (now % totalMs) / totalMs;
    const rampProgress = Math.min(1, progress * (totalMs / rampMs));
    const targetIter = Math.round(minIter + rampProgress * (maxIter - minIter));

    if (targetIter !== lastIter && now - lastBuild > 120) {
      prepareCurve(targetIter);
      lastBuild = now;
    }

    const revealDuration = 2600;
    const revealProgress = Math.min(1, (now - lastBuild) / revealDuration);

    draw(timestamp, revealProgress);
    if (!prefersReduced) {
      window.requestAnimationFrame(animate);
    }
  }

  resize();
  prepareCurve(12);
  draw(0);

  window.addEventListener('resize', () => {
    resize();
    draw(0);
  });

  if (!prefersReduced) {
    window.requestAnimationFrame(animate);
  }
})();
