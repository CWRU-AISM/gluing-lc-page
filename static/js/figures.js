// Interactive figures. Every number drawn here is read from ./data/*.json;
// the sheaf-pair figure is a labelled schematic with no data values.
const C = { ink: '#1a1a1a', grey: '#696969', light: '#bdbdbd', rule: '#d9d9d9', slab: '#f2f2f2', h0: '#0072b2', h1: '#c8102e' };
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const T = (sel, ms = 400) => sel.transition().duration(REDUCED ? 0 : ms).ease(d3.easeCubicOut);
const TOPO = [  // edge lists mirror experiments/run_cycle_h0_matched.py
  { key: 'pair_only', name: 'pair', edges: [[0,1],[1,2],[2,3]] },
  { key: 'acyclic_matched', name: 'path', edges: [[0,1],[1,2],[2,3],[3,4],[4,5]] },
  { key: 'ring', name: 'ring', edges: [[0,1],[1,2],[2,3],[3,4],[4,0]] },
  { key: 'clique', name: 'clique', edges: [0,1,2,3,4].flatMap(a => [0,1,2,3,4].filter(b => b > a).map(b => [a, b])) },
];
const fmt1 = d3.format('.1f'), fmtS = d3.format('+.1f');
const fmtMass = v => +(+v.toFixed(3) || +v.toFixed(4)) + '';  // as tabulated in the paper: 3 decimals, 4 below 0.0005
const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const width = el => Math.max(300, Math.min(el.clientWidth || 720, 760));
const svgIn = (el, W, H, label) => d3.select(el).selectAll('svg').data([0]).join('svg')
  .attr('viewBox', `0 0 ${W} ${H}`).attr('role', 'img').attr('aria-label', label);
function onResize(fn) { let t, w = innerWidth; addEventListener('resize', () => { if (innerWidth === w) return; w = innerWidth; clearTimeout(t); t = setTimeout(fn, 150); }); }
function tweenText(sel, to, fmt) {  // counts from the displayed value to `to`
  sel.each(function () {
    const from = +this.dataset.v || 0; this.dataset.v = to;
    T(d3.select(this), 500).tween('text', () => { const i = d3.interpolateNumber(from, to); return t => { this.textContent = fmt(i(t)); }; });
  });
}
// One tooltip for every figure: pointer hover, touch and keyboard focus.
const tip = d3.select('body').append('div').attr('class', 'fig-tip').attr('role', 'tooltip').style('opacity', 0);
function placeTip(x, y) {
  const r = tip.node().getBoundingClientRect();
  let left = x + 12, top = y - r.height - 10;
  if (left + r.width > scrollX + innerWidth - 8) left = x - r.width - 12;
  if (top < scrollY + 4) top = y + 16;
  tip.style('left', `${Math.max(scrollX + 4, left)}px`).style('top', `${top}px`);
}
function tipOn(sel, html) {
  sel.on('pointerenter.tip pointermove.tip', (e, d) => { tip.html(html(d)).style('opacity', 1); placeTip(e.pageX, e.pageY); })
    .on('pointerleave.tip blur.tip', () => tip.style('opacity', 0))
    .on('focus.tip', function (e, d) { const b = this.getBoundingClientRect(); tip.html(html(d)).style('opacity', 1); placeTip(b.right + scrollX, b.top + scrollY); });
}
function arrowDefs(svg) {
  svg.selectAll('defs').data([0]).join('defs').selectAll('marker').data(Object.entries({ ink: C.ink, h0: C.h0, h1: C.h1, grey: C.grey }))
    .join('marker').attr('id', d => 'ah-' + d[0]).attr('viewBox', '0 0 10 10').attr('refX', 9).attr('refY', 5)
    .attr('markerWidth', 7).attr('markerHeight', 7).attr('orient', 'auto-start-reverse')
    .selectAll('path').data(d => [d]).join('path').attr('d', 'M0,0L10,5L0,10z').attr('fill', d => d[1]);
}
function spearman(x, y) {
  const rank = v => {  // average ranks for ties
    const o = v.map((_, i) => i).sort((a, b) => v[a] - v[b]), r = [];
    for (let i = 0; i < o.length;) { let j = i; while (j + 1 < o.length && v[o[j + 1]] === v[o[i]]) j++; for (let k = i; k <= j; k++) r[o[k]] = (i + j) / 2; i = j + 1; }
    return r;
  };
  const rx = rank(x), ry = rank(y), n = x.length, m = (n - 1) / 2;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) { num += (rx[i] - m) * (ry[i] - m); dx += (rx[i] - m) ** 2; dy += (ry[i] - m) ** 2; }
  return num / Math.sqrt(dx * dy);
}

// ---------- Figure 2: schematic sheaf pair ----------
function pairFigure() {
  const slider = document.getElementById('pair-angle'), play = document.getElementById('pair-play');
  const rot = Math.PI / 6, sc = 0.9;                       // P^T for the schematic: rotate 30 degrees, scale 0.9
  const PT = ([x, y]) => [sc * (x * Math.cos(rot) - y * Math.sin(rot)), sc * (x * Math.sin(rot) + y * Math.cos(rot))];
  const PTinv = ([x, y]) => [(x * Math.cos(rot) + y * Math.sin(rot)) / sc, (-x * Math.sin(rot) + y * Math.cos(rot)) / sc];
  const ha = [70, 30], r = 62;
  let timer = null;
  slider.addEventListener('input', () => draw());
  play.addEventListener('click', () => {
    if (timer) return stop();
    play.textContent = 'Stop'; let k = 0; const seq = [90, 0, 90, 45];
    const step = () => { slider.value = seq[k]; draw(900); if (++k < seq.length) timer = setTimeout(step, 1400); else timer = setTimeout(stop, 900); };
    step();
  });
  function stop() { clearTimeout(timer); timer = null; play.textContent = 'Play'; }

  function draw(ms = 400) {
    const phi = +slider.value * Math.PI / 180;
    const d = [r * Math.cos(phi), -r * Math.sin(phi)];      // edge-space difference at angle phi from the H0 axis
    const pa = PT(ha), pb = [pa[0] + d[0], pa[1] + d[1]], hb = PTinv(pb);
    const el = document.getElementById('pair-svg'), W = width(el), H = 262;
    const L = { x: W * 0.2, y: 160 }, R = { x: W * 0.62, y: 160 }, s = W < 520 ? 0.65 : 1;
    const svg = svgIn(el, W, H, 'Schematic: two hidden states, their projections and the coboundary split into H0 and H1 components');
    arrowDefs(svg);
    const P = (o, p) => [o.x + s * p[0], o.y - s * p[1]];
    const lines = [
      { id: 'hx', o: L, a: [-60, 0], b: [110, 0], c: C.rule, w: 1 }, { id: 'hy', o: L, a: [0, -60], b: [0, 110], c: C.rule, w: 1 },
      { id: 'ha', o: L, a: [0, 0], b: ha, c: C.h0, w: 2, m: 'h0' }, { id: 'hb', o: L, a: [0, 0], b: hb, c: C.h0, w: 2, m: 'h0' },
      { id: 'e0', o: R, a: [-40, 0], b: [150, 0], c: C.h0, w: 1.5, m: 'h0' }, { id: 'e1', o: R, a: [0, -30], b: [0, 100], c: C.h1, w: 1.5, m: 'h1' },
      { id: 'c0', o: R, a: pa, b: [pb[0], pa[1]], c: C.h0, w: 3, dash: '5 3' }, { id: 'c1', o: R, a: [pb[0], pa[1]], b: pb, c: C.h1, w: 3, dash: '5 3' },
      { id: 'd', o: R, a: pa, b: pb, c: C.ink, w: 2, m: 'ink' },
      { id: 'map', o: { x: (L.x + R.x) / 2, y: 80 }, a: [-30, 0], b: [30, 0], c: C.grey, w: 1.2, m: 'grey' },
    ];
    const ln = svg.selectAll('line.v').data(lines, d => d.id).join(en => en.append('line').attr('class', 'v')
      .attr('x1', d => P(d.o, d.a)[0]).attr('y1', d => P(d.o, d.a)[1]).attr('x2', d => P(d.o, d.b)[0]).attr('y2', d => P(d.o, d.b)[1]))
      .attr('stroke', d => d.c).attr('stroke-width', d => d.w).attr('stroke-dasharray', d => d.dash || null)
      .attr('marker-end', d => d.m ? `url(#ah-${d.m})` : null);
    T(ln, ms).attr('x1', d => P(d.o, d.a)[0]).attr('y1', d => P(d.o, d.a)[1]).attr('x2', d => P(d.o, d.b)[0]).attr('y2', d => P(d.o, d.b)[1]);
    const dots = svg.selectAll('circle.p').data([pa, pb]).join('circle').attr('class', 'p').attr('r', 4).attr('fill', C.ink);
    T(dots, ms).attr('cx', p => P(R, p)[0]).attr('cy', p => P(R, p)[1]);
    const lab = [
      { id: 'la', t: 'h_a', p: P(L, [ha[0] + 8, ha[1] + 4]) }, { id: 'lb', t: 'h_b', p: P(L, [hb[0] + 8, hb[1] + 4]) },
      { id: 'l0', t: 'H⁰', p: P(R, [154, -4]), c: C.h0 }, { id: 'l1', t: 'H¹', p: P(R, [10, 88]), c: C.h1 },
      { id: 'ld', t: 'δ⁰', p: P(R, [(pa[0] + pb[0]) / 2 + 18 * Math.sin(phi) / s, (pa[1] + pb[1]) / 2 + 18 * Math.cos(phi) / s - 4 / s]), a: 'middle' },
      { id: 'tL', t: 'hidden space ℝᵈ', p: [L.x - 60 * s, 16], c: C.grey }, { id: 'tR', t: 'edge space ℝᵏ', p: [R.x - 40 * s, 16], c: C.grey },
      { id: 'tP', t: 'Pᵀ', p: [(L.x + R.x) / 2 - 6, 72], c: C.grey },
      { id: 'pa', t: 'Pᵀh_a', p: P(R, [pa[0] - 6, pa[1] + 10]), a: 'end', c: C.grey }, { id: 'pb', t: 'Pᵀh_b', p: P(R, [pb[0] + 8, pb[1] - 12]), c: C.grey },
    ];
    const tx = svg.selectAll('text.l').data(lab, d => d.id).join(en => en.append('text').attr('class', 'l').attr('x', d => d.p[0]).attr('y', d => d.p[1]))
      .attr('font-size', s < 1 ? 12 : 14).attr('fill', d => d.c || C.ink).attr('text-anchor', d => d.a || 'start').text(d => d.t);
    T(tx, ms).attr('x', d => d.p[0]).attr('y', d => d.p[1]);
    // share of delta^0 along each direction
    const bars = [{ id: 'b0', t: 'along H⁰', v: Math.abs(Math.cos(phi)), c: C.h0 }, { id: 'b1', t: 'along H¹', v: Math.abs(Math.sin(phi)), c: C.h1 }];
    const bx = W - (s < 1 ? 110 : 150), bw = s < 1 ? 90 : 120;
    const g = svg.selectAll('g.cb').data(bars, d => d.id).join(en => { const g = en.append('g').attr('class', 'cb'); g.append('rect').attr('class', 'track'); g.append('rect').attr('class', 'fill'); g.append('text'); return g; })
      .attr('transform', (d, i) => `translate(${bx},${H - 44 + i * 22})`);
    g.select('.track').attr('width', bw).attr('height', 8).attr('y', 6).attr('fill', 'none').attr('stroke', C.rule);
    T(g.select('.fill').attr('height', 8).attr('y', 6).attr('fill', d => d.c), ms).attr('width', d => d.v * bw);
    g.select('text').attr('x', -6).attr('y', 14).attr('text-anchor', 'end').attr('font-size', 12).attr('fill', C.ink).text(d => d.t);
    svg.selectAll('text.bh').data(['component of δ⁰']).join('text').attr('class', 'bh').attr('font-size', 11).attr('fill', C.grey)
      .attr('x', bx).attr('y', H - 48).text(d => d);
  }
  draw(0); onResize(() => draw(0));
}

// ---------- Figure 3: paraphrase graph ----------
function graphFigure(models, para, ret) {
  const st = { fact: 0, topo: 2 }, rows = models.filter(m => ret[m.id] && ret[m.id].topology);
  const W = 280, H = 240, cx = W / 2, cy = H / 2, R0 = 92;
  const hex = d3.range(6).map(i => { const a = -Math.PI / 2 + i * Math.PI / 3; return [cx + R0 * Math.cos(a), cy + R0 * Math.sin(a)]; });
  const nodes = hex.map(([x, y], i) => ({ i, x, y }));
  let sim = null, timer = null;
  const sel = d3.select('#graph-fact');
  sel.selectAll('option').data(para.facts).join('option').attr('value', (d, i) => i).text(d => `${d.subject} (${d.entity})`);
  sel.on('change', function () { st.fact = +this.value; draw(); });
  d3.select('#graph-topo').selectAll('button').data(TOPO).join('button').attr('class', 'button is-small').attr('type', 'button').text(d => d.name)
    .on('click', (e, d) => { stop(); st.topo = TOPO.indexOf(d); draw(); });
  const play = document.getElementById('graph-play');
  play.addEventListener('click', () => {
    if (timer) return stop();
    play.textContent = 'Stop'; st.topo = 0; draw();
    const step = () => { if (st.topo === TOPO.length - 1) return stop(); st.topo++; draw(); timer = setTimeout(step, 1500); };
    timer = setTimeout(step, 1500);
  });
  function stop() { clearTimeout(timer); timer = null; play.textContent = 'Play'; }

  const svg = svgIn(document.getElementById('graph-svg'), W, H, 'Paraphrase graph');
  const gE = svg.append('g'), gN = svg.append('g');
  function place() {
    gE.selectAll('line').attr('x1', d => nodes[d[0]].x).attr('y1', d => nodes[d[0]].y).attr('x2', d => nodes[d[1]].x).attr('y2', d => nodes[d[1]].y);
    gN.selectAll('g').attr('transform', d => `translate(${d.x},${d.y})`);
  }

  function draw() {
    const t = TOPO[st.topo], fact = para.facts[st.fact], used = new Set(t.edges.flat());
    d3.selectAll('#graph-topo button').classed('is-dark', (d, i) => i === st.topo).attr('aria-pressed', (d, i) => i === st.topo);
    const V = used.size, E = t.edges.length, b0 = 1, b1 = E - V + b0;
    d3.select('#graph-name').text(t.name);
    tweenText(d3.select('#graph-V'), V, Math.round); tweenText(d3.select('#graph-E'), E, Math.round);
    tweenText(d3.select('#graph-b0'), b0, Math.round); tweenText(d3.select('#graph-b1'), b1, Math.round);
    svg.attr('aria-label', `${t.name} graph on ${V} paraphrases with ${E} edges`);

    // edges draw in / out along their length
    gE.selectAll('line').data(t.edges, d => d.join('-')).join(
      en => T(en.append('line').attr('stroke', C.ink).attr('stroke-width', 1.6).attr('stroke-dasharray', 400).attr('stroke-dashoffset', 400), 500).attr('stroke-dashoffset', 0).selection(),
      up => up,
      ex => T(ex, 300).attr('stroke-dashoffset', 400).remove());
    const g = gN.selectAll('g').data(nodes).join(en => { const g = en.append('g'); g.append('circle').attr('r', 15).attr('stroke-width', 1.5); g.append('text').attr('y', 5).attr('text-anchor', 'middle').attr('font-size', 14).text(d => d.i + 1); return g; });
    T(g.select('circle'), 300).attr('fill', d => used.has(d.i) ? C.h0 : '#fff').attr('stroke', d => used.has(d.i) ? C.h0 : C.light);
    T(g.select('text'), 300).attr('fill', d => used.has(d.i) ? '#fff' : C.light);

    // short force layout pulled toward the hexagon; unused nodes stay pinned
    nodes.forEach(n => { if (used.has(n.i)) { n.fx = n.fy = null; } else { n.fx = hex[n.i][0]; n.fy = hex[n.i][1]; } });
    if (sim) sim.stop();
    sim = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(t.edges.map(([s, u]) => ({ source: s, target: u }))).id(d => d.i).distance(86).strength(0.4))
      .force('charge', d3.forceManyBody().strength(-160))
      .force('x', d3.forceX(d => hex[d.i][0]).strength(0.12)).force('y', d3.forceY(d => hex[d.i][1]).strength(0.12))
      .force('clamp', () => nodes.forEach(n => { n.x = Math.max(18, Math.min(W - 18, n.x)); n.y = Math.max(18, Math.min(H - 18, n.y)); }))
      .alpha(0.7).alphaDecay(0.06).on('tick', place);
    if (REDUCED) { sim.stop(); sim.tick(150); }
    place();

    tipOn(g, d => `<b>Paraphrase ${d.i + 1}</b>${used.has(d.i) ? '' : ' (unused here)'}<br>${esc(fact.expressions[d.i].replace(/\s+/g, ' '))}`);
    d3.select('#graph-paraphrases').selectAll('li').data(fact.expressions).join('li')
      .classed('off', (d, i) => !used.has(i)).text(d => d.replace(/\s+/g, ' '));
    bars(t);
  }

  function bars(t) {
    const el = document.getElementById('graph-bars'), BW = Math.max(300, Math.min(el.clientWidth || 420, 460));
    const acc = m => ret[m.id].topology.acc, pair = TOPO[0].key;
    const data = rows.map(m => ({ id: m.id, label: m.label, v: acc(m)[t.key], dv: acc(m)[t.key] - acc(m)[pair] }));
    data.push({ id: 'mean', label: 'Mean', v: d3.mean(data, d => d.v), dv: d3.mean(data, d => d.dv), bold: true });
    const rh = 21, m = { l: 96, r: 90, t: 20 }, BH = m.t + data.length * rh + 4;
    const x = d3.scaleLinear().domain([0, 100]).range([m.l, BW - m.r]);
    const s = svgIn(el, BW, BH, `Hard retrieval accuracy per model for the ${t.name} topology`);
    const nt = rows[0] ? ret[rows[0].id].topology.n_test_facts : null;
    s.selectAll('text.hd').data([`${t.name}, top-1 %` + (nt ? (BW < 420 ? ` (${nt} facts)` : ` on ${nt} held-out facts`) : ''), 'vs. pair (pp)']).join('text').attr('class', 'hd').attr('font-size', 12).attr('fill', C.grey)
      .attr('x', (d, i) => i ? BW - 4 : m.l).attr('text-anchor', (d, i) => i ? 'end' : 'start').attr('y', 12).text(d => d);
    const row = s.selectAll('g.r').data(data, d => d.id).join(en => { const g = en.append('g').attr('class', 'r'); g.append('text').attr('class', 'n'); g.append('rect'); g.append('text').attr('class', 'v'); g.append('text').attr('class', 'dv'); return g; })
      .attr('transform', (d, i) => `translate(0,${m.t + i * rh})`);
    row.select('.n').attr('x', m.l - 6).attr('y', 14).attr('text-anchor', 'end').attr('font-size', 12).attr('font-weight', d => d.bold ? 700 : 400).attr('fill', C.ink).text(d => d.label);
    T(row.select('rect').attr('x', m.l).attr('y', 4).attr('height', rh - 8).attr('fill', d => d.bold ? C.ink : C.h0), 500).attr('width', d => x(d.v) - m.l);
    T(row.select('.v').attr('y', 14).attr('font-size', 12).attr('fill', C.ink), 500).attr('x', d => x(d.v) + 4)
      .tween('text', function (d) { const i = d3.interpolateNumber(+this.dataset.v || d.v, d.v); this.dataset.v = d.v; return t => { this.textContent = fmt1(i(t)); }; });
    tipOn(row, d => `<b>${d.label}</b><br>${t.name}: ${fmt1(d.v)}%` + (t.key === pair ? '' : `<br>pair: ${fmt1(d.v - d.dv)}%<br>difference: ${fmtS(d.dv)} pp`));
    row.select('.dv').attr('x', BW - 4).attr('y', 14).attr('text-anchor', 'end').attr('font-size', 12).attr('fill', C.grey).text(d => t.key === pair ? '' : fmtS(d.dv));
    const n = rows[0] && ret[rows[0].id].topology;
    if (n) d3.select('#graph-n').text(` (${n.n_train_facts} training and ${n.n_test_facts} held-out facts)`);
  }
  draw(); onResize(() => bars(TOPO[st.topo]));
}

// ---------- Figure 6: fragility scatter and example browser ----------
function fragFigure(models, frag, hodge, gens) {
  const all = models.filter(m => frag[m.id] && hodge[m.id]);
  const st = { hidden: new Set(), sel: 'meta-llama/Llama-2-7b-hf', kept: true, k: 0, more: false };
  let typing = null;
  d3.select('#frag-legend').selectAll('button').data(all).join('button').attr('type', 'button').attr('class', 'button is-small')
    .text(d => d.label)
    .on('click', (e, d) => {
      if (st.hidden.has(d.id)) st.hidden.delete(d.id);
      else if (all.length - st.hidden.size > 3) st.hidden.add(d.id);  // Spearman needs at least three points
      draw();
    });

  function draw() {
    d3.selectAll('#frag-legend button').classed('is-dark', d => !st.hidden.has(d.id))
      .attr('aria-pressed', d => !st.hidden.has(d.id)).attr('title', d => (st.hidden.has(d.id) ? 'Show ' : 'Hide ') + d.label);
    const pts = all.filter(m => !st.hidden.has(m.id))
      .map(m => ({ ...m, x: frag[m.id].mass_l2, y: frag[m.id].pres_pct, ci: frag[m.id].ci }));
    if (!pts.some(p => p.id === st.sel)) { st.sel = pts[0].id; st.k = 0; showExample(false); }
    tweenText(d3.select('#frag-rho'), -spearman(pts.map(p => p.x), pts.map(p => p.y)), d3.format('.2f'));
    d3.select('#frag-n').text(pts.length);

    const el = document.getElementById('frag-svg'), W = Math.min(width(el), 640), H = Math.round(W * (W < 520 ? 0.8 : 0.62));
    const m = { l: 52, r: 16, t: 12, b: 44 };
    const x = d3.scaleLog().domain([1e-5, 0.2]).range([m.l, W - m.r]);
    const y = d3.scaleLinear().domain([0, 50]).range([H - m.b, m.t]);
    const svg = svgIn(el, W, H, 'Scatter of harmonic mass against fact preservation');
    svg.selectAll('g.ax').data(['x', 'y']).join('g').attr('class', d => 'ax axis ' + d);
    svg.select('.axis.x').attr('transform', `translate(0,${H - m.b})`).call(d3.axisBottom(x).ticks(W < 500 ? 3 : 5, '.0e').tickSizeOuter(0));
    svg.select('.axis.y').attr('transform', `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(6).tickSizeOuter(0));
    svg.selectAll('text.lab').data([
      { t: 'harmonic mass, L = 2 (log)', x: (m.l + W - m.r) / 2, y: H - 8, a: 0 },
      { t: 'fact preservation (%)', x: -(m.t + H - m.b) / 2, y: 14, a: -90 }]).join('text')
      .attr('class', 'lab').attr('text-anchor', 'middle').attr('font-size', 13).attr('fill', C.ink)
      .attr('transform', d => d.a ? `rotate(${d.a})` : null).attr('x', d => d.x).attr('y', d => d.y).text(d => d.t);

    svg.selectAll('text.key').data(['vertical bars: 95% CI']).join('text').attr('class', 'key').attr('font-size', 11).attr('fill', C.grey)
      .attr('x', W - m.r).attr('y', m.t + 10).attr('text-anchor', 'end').text(d => d);
    const left = d => x(d.x) > W - 120;
    const g = svg.selectAll('g.point').data(pts, d => d.id).join(
      en => {
        const g = en.append('g').attr('class', 'point').attr('tabindex', 0).attr('role', 'button');
        g.append('line').attr('x1', d => x(d.x)).attr('x2', d => x(d.x)).attr('y1', d => y(d.y)).attr('y2', d => y(d.y));
        g.append('circle').attr('cx', d => x(d.x)).attr('cy', d => y(d.y)).attr('r', 0);
        g.append('text').attr('opacity', 0);
        return g;
      },
      up => up,
      ex => { T(ex.select('circle'), 350).attr('r', 0); T(ex.select('line'), 350).attr('y1', d => y(d.y)).attr('y2', d => y(d.y)); T(ex.select('text'), 250).attr('opacity', 0); T(ex, 350).remove(); });
    const pick = d => { st.sel = d.id; st.k = 0; st.more = false; draw(); showExample(true); };
    tipOn(g, d => `<b>${d.label}</b><br>harmonic mass (L = 2): ${fmtMass(d.x)}<br>fact preservation: ${fmt1(d.y)}%<br>95% CI: ${fmt1(d.ci[0])} to ${fmt1(d.ci[1])}%<br>n = ${frag[d.id].n} prompts`);
    g.attr('aria-label', d => `${d.label}: harmonic mass ${fmtMass(d.x)}, fact preservation ${fmt1(d.y)}%, show examples`).on('click', (e, d) => pick(d))
      .on('keydown', (e, d) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(d); } });
    T(g.select('line').attr('stroke', C.grey).attr('stroke-width', 1.2), 450).attr('x1', d => x(d.x)).attr('x2', d => x(d.x)).attr('y1', d => y(d.ci[0])).attr('y2', d => y(d.ci[1]));
    T(g.select('circle').attr('fill', C.ink).attr('stroke', d => d.id === st.sel ? C.h0 : C.ink)
      .attr('stroke-width', d => d.id === st.sel ? 3 : 1.5), 450).attr('cx', d => x(d.x)).attr('cy', d => y(d.y)).attr('r', d => d.id === st.sel ? 7 : 5.5);
    const tx = g.select('text').attr('x', d => x(d.x) + (left(d) ? -9 : 9)).attr('y', d => y(d.y) + 4)
      .attr('stroke', '#fff').attr('stroke-width', 3).attr('paint-order', 'stroke')
      .attr('text-anchor', d => left(d) ? 'end' : 'start').attr('font-size', 13).attr('fill', C.ink)
      .attr('font-weight', d => d.id === st.sel ? 700 : 400).text(d => d.label);
    T(tx, 450).attr('opacity', d => W >= 520 || d.id === st.sel ? 1 : 0);  // on narrow screens only the selected point is labelled
  }

  // Cut at the first sentence end that comes after the entity (or after 30 characters).
  function firstSentence(t, entity) {
    const hit = t.toLowerCase().indexOf(entity.toLowerCase()), min = Math.max(30, hit >= 0 ? hit + entity.length : 0);
    const re = /[.!?](?=\s+[A-Z"(]|$)/g; let mt;
    while ((mt = re.exec(t))) if (mt.index + 1 >= min) return t.slice(0, mt.index + 1);
    return t;
  }
  const bold = (t, entity) => { const re = new RegExp(esc(entity).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'); return esc(t).replace(re, s => `<b>${s}</b>`); };

  d3.selectAll('#ex-filter button').on('click', function () { st.kept = this.dataset.kept === '1'; st.k = 0; st.more = false; showExample(true); });
  d3.select('#ex-prev').on('click', () => { st.k--; st.more = false; showExample(true); });
  d3.select('#ex-next').on('click', () => { st.k++; st.more = false; showExample(true); });
  d3.select('#ex-more').on('click', () => { st.more = !st.more; showExample(false); });

  function showExample(animate) {
    if (typing) { typing.stop(); typing = null; }
    const p = all.find(m => m.id === st.sel), f = frag[p.id];
    const list = (gens[p.id] || []).filter(g => g.kept === st.kept);
    st.k = (st.k + list.length) % Math.max(1, list.length);
    const ex = list[st.k];
    d3.select('#ex-model').text(p.label);
    d3.select('#ex-stats').text(`${fmt1(f.pres_pct)}% of ${f.n} prompts keep the fact under random steering. Target entity in bold.`);
    d3.selectAll('#ex-filter button').classed('is-dark', function () { return (this.dataset.kept === '1') === st.kept; })
      .attr('aria-pressed', function () { return (this.dataset.kept === '1') === st.kept; });
    d3.select('#ex-count').text(list.length ? `${st.k + 1} of ${list.length}` : 'none');
    if (!ex) { d3.select('#ex-prompt').text(''); d3.selectAll('#ex-body .tw').text(''); return; }
    d3.select('#ex-prompt').text(ex.prompt);
    const texts = [ex.baseline, ex.steered].map(t => {
      const first = firstSentence(t, ex.entity), shown = st.more ? t : first + (first.length < t.length ? ' ...' : '');
      return { plain: shown, html: bold(shown, ex.entity) };
    });
    d3.select('#ex-more').text(st.more ? 'less' : 'more').attr('aria-expanded', st.more);
    const tws = d3.selectAll('#ex-body .tw').nodes();
    const finish = () => { if (typing) typing.stop(); typing = null; tws.forEach((e, i) => { e.innerHTML = texts[i].html; }); };
    if (!animate || REDUCED) return finish();
    // type both continuations in together; a click on either shows the full text at once
    tws.forEach(e => { e.textContent = ''; e.onclick = finish; });
    typing = d3.timer(t => {
      const k = Math.min(1, t / 500);
      tws.forEach((e, i) => { e.textContent = texts[i].plain.slice(0, Math.round(k * texts[i].plain.length)); });
      if (k === 1) finish();
    });
  }
  draw(); showExample(false); onResize(draw);
}

// ---------- Figure 7: layer stack + harmonic mass bars ----------
function layersFigure(models, hodge) {
  const Ls = ['2', '4', '8', '16'], PAIRS_DRAWN = 6;
  const ms = models.filter(m => hodge[m.id]).sort((a, b) => hodge[a.id].mass['2'] - hodge[b.id].mass['2']);
  const st = { model: 'meta-llama/Llama-2-7b-hf' };
  const slider = document.getElementById('layers-slider'), msel = d3.select('#layers-model');
  msel.selectAll('option').data(ms).join('option').attr('value', d => d.id).text(d => d.label).property('selected', d => d.id === st.model);
  msel.on('change', function () { st.model = this.value; draw(); });
  slider.addEventListener('input', () => draw());
  const color = d3.scaleSequentialLog([1e-5, 1], d3.interpolateRgb('#e8e8e8', C.h1));
  const decades = [1e-5, 1e-4, 1e-3, 1e-2, 1e-1, 1];
  const strutW = d3.scaleLog([1e-5, 1], [0.8, 7]).clamp(true);

  function draw() {
    const L = Ls[+slider.value], nL = +L, h = hodge[st.model], mass = h.mass[L];
    document.getElementById('layers-value').textContent = `L = ${L}`;
    const e = (Object.values(hodge).find(v => v.edges[L]) || h).edges[L], np = h.n_pairs;
    const ref = np * (nL - 1) / (e.h + e.v);
    d3.select('#layers-readout').html(mass
      ? `${ms.find(m => m.id === st.model).label}, L = ${L}: b<sub>1</sub> = N(L&minus;1) = ${np * (nL - 1)} squares over ${e.h + e.v} edges. Harmonic mass ${d3.format('.1e')(mass)}.`
      : `${ms.find(m => m.id === st.model).label} has no ${L}-layer grid (${h.n_layers_total - 1} layers).`);

    // isometric slabs, bottom layer first so each upper slab covers the struts' tops
    const el = document.getElementById('layers-stack'), W = width(el), H = 330;
    const sw = Math.min(300, W * 0.55), sx = sw * 0.35, sy = 46, th = 5, x0 = (W - sw - sx) / 2 - 40;
    const gap = Math.min(70, (H - 90) / Math.max(1, nL - 1)), yb = H - 30;
    const svg = svgIn(el, W, H, `Stack of ${L} layer slabs with struts shaded by harmonic mass`);
    const slabs = d3.range(nL).map(l => ({ l, y: yb - l * gap }));
    const face = y => `M${x0},${y} L${x0 + sw},${y} L${x0 + sw + sx},${y - sy} L${x0 + sx},${y - sy}Z`;
    const side = y => `M${x0},${y} L${x0 + sw},${y} L${x0 + sw},${y + th} L${x0},${y + th}Z`;
    const right = y => `M${x0 + sw},${y} L${x0 + sw + sx},${y - sy} L${x0 + sw + sx},${y - sy + th} L${x0 + sw},${y + th}Z`;
    const node = (j, k, y) => { const u = (j + 0.5) / PAIRS_DRAWN, v = k ? 0.7 : 0.3; return [x0 + u * sw + v * sx, y - v * sy]; };
    const layer = svg.selectAll('g.layer').data(slabs, d => d.l).join(
      en => {
        const g = en.append('g').attr('class', 'layer').attr('opacity', 0).attr('transform', d => `translate(0,${d.y - 40})`);
        g.append('path').attr('class', 'side').attr('d', side(0)).attr('fill', '#dcdcdc').attr('stroke', C.grey).attr('stroke-width', 0.8).attr('stroke-linejoin', 'round');
        g.append('path').attr('class', 'right').attr('d', right(0)).attr('fill', '#cfcfcf').attr('stroke', C.grey).attr('stroke-width', 0.8).attr('stroke-linejoin', 'round');
        g.append('path').attr('class', 'face').attr('d', face(0)).attr('fill', C.slab).attr('stroke', C.grey).attr('stroke-width', 0.8);
        g.append('g').attr('class', 'struts');
        g.selectAll('line.edge').data(d3.range(PAIRS_DRAWN)).join('line').attr('class', 'edge')
          .attr('x1', j => node(j, 0, 0)[0]).attr('y1', j => node(j, 0, 0)[1]).attr('x2', j => node(j, 1, 0)[0]).attr('y2', j => node(j, 1, 0)[1])
          .attr('stroke', C.ink).attr('stroke-width', 1);
        g.selectAll('circle').data(d3.range(PAIRS_DRAWN * 2)).join('circle').attr('r', 2.2).attr('fill', C.h0)
          .attr('cx', i => node(i >> 1, i & 1, 0)[0]).attr('cy', i => node(i >> 1, i & 1, 0)[1]);
        return g;
      },
      up => up,
      ex => T(ex, 300).attr('opacity', 0).attr('transform', d => `translate(0,${d.y - 40})`).remove());
    layer.sort((a, b) => a.l - b.l);
    T(layer, 450).delay(d => REDUCED ? 0 : d.l * 25).attr('opacity', 1).attr('transform', d => `translate(0,${d.y})`);
    // struts: from each node on layer l up to the same sentence on layer l+1 (one pair of struts per square)
    layer.select('g.struts').selectAll('line').data(d => d.l < nL - 1 ? d3.range(PAIRS_DRAWN * 2) : []).join(en => en.append('line').attr('y2', i => node(i >> 1, i & 1, 0)[1]))
      .attr('x1', i => node(i >> 1, i & 1, 0)[0]).attr('x2', i => node(i >> 1, i & 1, 0)[0]).attr('y1', i => node(i >> 1, i & 1, 0)[1])
      .attr('stroke-dasharray', mass ? null : '3 3')
      .call(s => T(s, 600).attr('y2', i => node(i >> 1, i & 1, 0)[1] - gap).attr('stroke', mass ? color(mass) : C.light).attr('stroke-width', mass ? strutW(mass) : 1.5));
    svg.selectAll('text.lvl').data([`layer 1`, `layer ${L}`]).join('text').attr('class', 'lvl').attr('font-size', 12).attr('fill', C.grey)
      .attr('x', x0 + sw + sx + 8).attr('text-anchor', 'start')
      .call(s => T(s, 450).attr('y', (d, i) => (i ? yb - (nL - 1) * gap : yb) - sy / 2));
    // legend: one strut sample per decade, drawn with the same shade and width as the struts
    const lg = svg.selectAll('g.legend').data([0]).join('g').attr('class', 'legend').attr('transform', `translate(${W - 146},${12})`);
    lg.selectAll('line.s').data(decades).join('line').attr('class', 's').attr('x1', (d, i) => 11 + i * 22).attr('x2', (d, i) => 11 + i * 22)
      .attr('y1', 6).attr('y2', 26).attr('stroke', d => color(d)).attr('stroke-width', d => strutW(d));
    lg.selectAll('text.t').data([decades[0], decades[decades.length - 1]]).join('text').attr('class', 't').attr('font-size', 11).attr('fill', C.ink)
      .attr('y', 40).attr('x', (d, i) => i * 132).attr('text-anchor', (d, i) => i ? 'end' : 'start').text(d => d3.format('.0e')(d));
    lg.selectAll('text.h').data(['strut shade and width:', 'harmonic mass']).join('text').attr('class', 'h').attr('font-size', 11).attr('fill', C.grey).attr('y', (d, i) => 54 + i * 13).text(d => d);
    if (mass) {
      const mk = lg.selectAll('path.mk').data([mass]).join('path').attr('class', 'mk').attr('d', 'M0,0 l-4,-6 h8z').attr('fill', C.ink);
      T(mk, 600).attr('transform', d => `translate(${11 + Math.log10(d / 1e-5) * 22},4)`);
    } else lg.selectAll('path.mk').remove();

    bars(L, ref);
  }

  function bars(L, ref) {
    const el = document.getElementById('layers-svg'), W = width(el), bh = 22, m = { l: 104, r: 56, t: 24, b: 34 };
    const H = m.t + m.b + ms.length * bh;
    const x = d3.scaleLog().domain([1e-5, 1]).range([m.l, W - m.r]);
    const y = d3.scaleBand().domain(ms.map(d => d.id)).range([m.t, H - m.b]).padding(0.25);
    const svg = svgIn(el, W, H, `Harmonic mass per model at L = ${L}`);
    svg.selectAll('g.axis').data([0]).join('g').attr('class', 'axis').attr('transform', `translate(0,${H - m.b})`)
      .call(d3.axisBottom(x).ticks(W < 500 ? 3 : 5, '.0e').tickSizeOuter(0));
    const row = svg.selectAll('g.row').data(ms, d => d.id).join(en => {
      const g = en.append('g').attr('class', 'row').style('cursor', 'pointer'); g.append('text').attr('class', 'name'); g.append('rect').attr('x', m.l).attr('width', 0); g.append('text').attr('class', 'val'); return g;
    }).attr('transform', d => `translate(0,${y(d.id)})`).on('click', (e, d) => { st.model = d.id; msel.property('value', d.id); draw(); });
    const v = d => hodge[d.id].mass[L];
    svg.selectAll('text.xl').data(['harmonic mass (log scale)']).join('text').attr('class', 'xl').attr('font-size', 12).attr('fill', C.ink)
      .attr('x', (m.l + W - m.r) / 2).attr('y', H - 2).attr('text-anchor', 'middle').text(d => d);
    tipOn(row, d => `<b>${d.label}</b>, L = ${L}<br>` + (v(d) ? `harmonic mass: ${d3.format('.2e')(v(d))}<br>random reference: ${d3.format('.2f')(ref)}` : 'no grid at this depth'));
    row.select('.name').attr('x', m.l - 6).attr('y', y.bandwidth() / 2 + 4).attr('text-anchor', 'end').attr('font-size', 12)
      .attr('font-weight', d => d.id === st.model ? 700 : 400).attr('fill', C.ink).text(d => d.label);
    T(row.select('rect').attr('height', y.bandwidth()).attr('fill', d => d.id === st.model ? C.h1 : '#e79aa6'), 450).attr('width', d => v(d) ? x(v(d)) - m.l : 0);
    T(row.select('.val').attr('y', y.bandwidth() / 2 + 4).attr('font-size', 11).attr('fill', C.grey)
      .attr('stroke', '#fff').attr('stroke-width', 3).attr('paint-order', 'stroke'), 450)
      .attr('x', d => v(d) ? x(v(d)) + 4 : m.l + 4).text(d => v(d) ? d3.format('.1e')(v(d)) : 'no grid');
    T(svg.selectAll('line.ref').data([ref]).join('line').attr('class', 'ref').lower().attr('y1', m.t).attr('y2', H - m.b)
      .attr('stroke', C.ink).attr('stroke-dasharray', '4 3'), 450).attr('x1', x(ref)).attr('x2', x(ref));
    T(svg.selectAll('text.ref').data([ref]).join('text').attr('class', 'ref').attr('font-size', 11).attr('fill', C.ink).attr('y', 14).attr('text-anchor', 'middle')
      .text(`b₁/|E| = ${d3.format('.2f')(ref)}`), 450).attr('x', x(ref));
  }
  draw(); onResize(draw);
}

pairFigure();
Promise.all(['models', 'paraphrases', 'retrieval', 'fragility', 'hodge', 'generations'].map(n => d3.json(`./data/${n}.json`)))
  .then(([models, para, ret, frag, hodge, gens]) => {
    graphFigure(models, para, ret);
    fragFigure(models, frag, hodge, gens);
    layersFigure(models, hodge);
  });
