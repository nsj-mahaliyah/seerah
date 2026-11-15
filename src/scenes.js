/* Streg-animationer til teaseren – guld på natteblå, håndtegnet og stabil.
   Profeten ﷺ og sahaba vises aldrig som figurer: historien fortælles gennem steder og ting.
   Kun almindelige, ansigtsløse mennesker (ummah'en i dag) tegnes som stick figures. */

const SC = { gold: "rgb(238,194,107)", gold2: "rgb(255,230,168)", cream: "rgb(245,235,217)", sand: "rgb(204,171,115)", dome: "rgb(77,158,107)", ember: "rgb(230,120,77)", navy: "#0b1626", navy2: "#132238", navy3: "#1c2e47" };

function rng(seed) { let a = seed * 9301 + 49297; return () => { a = (a * 1103515245 + 12345) & 0x7fffffff; return a / 0x7fffffff; }; }
const easeOut = t => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
const easeIO = t => { t = Math.min(1, Math.max(0, t)); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };

function densify(pts, step = 14) {
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], d = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.round(d / step));
    for (let k = 1; k <= n; k++) out.push([x0 + (x1 - x0) * k / n, y0 + (y1 - y0) * k / n]);
  }
  return out;
}
function partial(pts, prog) {
  if (prog >= 1) return pts; if (prog <= 0) return [];
  let L = 0; const seg = []; for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); seg.push(d); L += d; }
  let goal = L * prog; const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    if (goal >= seg[i - 1]) { out.push(pts[i]); goal -= seg[i - 1]; }
    else { const f = goal / seg[i - 1]; out.push([pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f]); break; }
  }
  return out;
}
// stabil håndtegnet streg med glød
function stroke(ctx, pts, o = {}) {
  const { col = SC.gold, w = 6, a = 1, prog = 1, close = false, wob = 1.2, seed = 0, glow = 0 } = o;
  let p = densify(close ? pts.concat([pts[0]]) : pts, 14);
  const r = rng(seed + 1); p = p.map(([x, y]) => [x + (r() * 2 - 1) * wob, y + (r() * 2 - 1) * wob]);
  p = partial(p, prog); if (p.length < 2) return;
  ctx.save(); ctx.lineCap = "round"; ctx.lineJoin = "round";
  const path = () => { ctx.beginPath(); ctx.moveTo(p[0][0], p[0][1]); for (let i = 1; i < p.length; i++) ctx.lineTo(p[i][0], p[i][1]); };
  if (glow) for (const [ww, aa] of [[w * 4.5, .08], [w * 2.4, .18]]) { path(); ctx.strokeStyle = col; ctx.globalAlpha = aa * a * glow; ctx.lineWidth = ww; ctx.stroke(); }
  path(); ctx.strokeStyle = col; ctx.globalAlpha = a; ctx.lineWidth = w; ctx.stroke();
  ctx.restore();
}
function arcPts(cx, cy, r, a0, a1, n = 40, ry = r) { const o = []; for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; o.push([cx + r * Math.cos(a), cy + ry * Math.sin(a)]); } return o; }
function fillPoly(ctx, pts, col, a = 1) { ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = col; ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); ctx.fill(); ctx.restore(); }
function glowDot(ctx, x, y, r, col = "255,215,130", a = 1) { const g = ctx.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(${col},${0.9 * a})`); g.addColorStop(0.35, `rgba(${col},${0.35 * a})`); g.addColorStop(1, `rgba(${col},0)`); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, 2 * r, 2 * r); }

/* ---------- himmel ---------- */
function sky(ctx, W, H, t, seed = 3) {
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, SC.navy); g.addColorStop(1, SC.navy3);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const r = rng(seed);
  for (let i = 0; i < 46; i++) { const x = r() * W, y = r() * H * 0.62, ph = r() * 6.28, s = 1 + r() * 2.2; ctx.globalAlpha = 0.35 + 0.55 * (0.5 + 0.5 * Math.sin(t * 1.6 + ph)); ctx.fillStyle = SC.gold2; ctx.beginPath(); ctx.arc(x, y, s, 0, 6.283); ctx.fill(); }
  ctx.globalAlpha = 1;
}
function crescent(ctx, x, y, r, prog = 1) {
  ctx.save(); ctx.globalAlpha = easeOut(prog);
  glowDot(ctx, x, y, r * 3.2, "255,220,150", 0.5);
  ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.arc(x + r * 0.42, y - r * 0.18, r * 0.86, 0, 6.283, true); ctx.fillStyle = SC.gold2; ctx.fill("evenodd");
  ctx.restore();
}
function dunes(ctx, W, H, y0, t, prog) {
  const pts1 = [], pts2 = [];
  for (let x = -20; x <= W + 20; x += 20) { pts1.push([x, y0 + Math.sin(x / 140 + 1) * 18 + Math.sin(x / 61) * 6]); pts2.push([x, y0 + 60 + Math.sin(x / 110 + 3) * 22]); }
  fillPoly(ctx, pts2.concat([[W + 20, H], [-20, H]]), SC.navy, 0.9);
  stroke(ctx, pts2, { w: 4, prog, seed: 11, a: 0.55 });
  fillPoly(ctx, pts1.concat([[W + 20, y0 + 60], [-20, y0 + 60]]), SC.navy2, 0.6);
  stroke(ctx, pts1, { w: 4, prog, seed: 12, a: 0.75 });
}

/* ---------- stick figures (ansigtsløse, kun almindelige mennesker) ---------- */
const POSES = {
  stand: { la: [[-18, 34], [-24, 66]], ra: [[18, 34], [24, 66]], ll: [[-12, 50], [-16, 98]], rl: [[12, 50], [16, 98]], body: 68 },
  sit: { la: [[-20, 30], [-8, 52]], ra: [[20, 30], [8, 52]], ll: [[-30, 14], [10, 22]], rl: [[30, 14], [-10, 22]], body: 52 },
  teach: { la: [[-20, 30], [-8, 52]], ra: [[24, 6], [40, -18]], ll: [[-30, 14], [10, 22]], rl: [[30, 14], [-10, 22]], body: 52 },
  read: { la: [[-16, 26], [-4, 38]], ra: [[16, 26], [4, 38]], ll: [[-30, 14], [10, 22]], rl: [[30, 14], [-10, 22]], body: 52 },
};
function figure(ctx, x, y, s, pose, t = 0, col = SC.cream, seed = 1, walk = 0) {
  const P = POSES[pose], hr = 21 * s, neck = y - P.body * s;
  ctx.save(); ctx.translate(x, 0);
  const sw = walk ? Math.sin(t * walk) : 0;
  const limb = (pts, sgn) => {
    const [[ax, ay], [bx, by]] = pts;
    const k = walk ? sgn * sw : 0;
    return [[0, 0], [(ax + k * 10) * s, ay * s], [(bx + k * 22) * s, by * s]];
  };
  const shoulder = neck + 10 * s;
  const tr = (arr, oy) => arr.map(([px, py]) => [px, py + oy]);
  stroke(ctx, [[0, neck], [0, y]], { col, w: 5 * s + 1, seed, glow: .5 });
  stroke(ctx, tr(limb(P.la, 1), shoulder), { col, w: 5 * s + 1, seed: seed + 1 });
  stroke(ctx, tr(limb(P.ra, -1), shoulder), { col, w: 5 * s + 1, seed: seed + 2 });
  stroke(ctx, tr(limb(P.ll, -1), y), { col, w: 5 * s + 1, seed: seed + 3 });
  stroke(ctx, tr(limb(P.rl, 1), y), { col, w: 5 * s + 1, seed: seed + 4 });
  stroke(ctx, arcPts(0, neck - hr, hr, 0, 6.283, 24), { col, w: 5 * s + 1, seed: seed + 5, glow: .5 });
  ctx.restore();
}

/* ---------- ikoner ---------- */
function kaaba(ctx, cx, by, s, prog, t) {
  const w = 150 * s, d = 90 * s, h = 190 * s;
  const L = [cx - w, by - d * 0.35], F = [cx, by], R = [cx + w * 0.75, by - d * 0.45];
  const Lt = [L[0], L[1] - h], Ft = [F[0], F[1] - h], Rt = [R[0], R[1] - h], Bt = [cx - w * 0.25, by - d * 0.8 - h];
  fillPoly(ctx, [L, F, Ft, Lt], "#05080d", easeOut(prog * 1.4)); fillPoly(ctx, [F, R, Rt, Ft], "#0a0f17", easeOut(prog * 1.4)); fillPoly(ctx, [Lt, Ft, Rt, Bt], "#141b26", easeOut(prog * 1.4));
  const band = h * 0.22;
  fillPoly(ctx, [[L[0], L[1] - h + band], [F[0], F[1] - h + band], [F[0], F[1] - h + band + 16 * s], [L[0], L[1] - h + band + 16 * s]], SC.gold, easeOut(prog * 1.2 - .3));
  fillPoly(ctx, [[F[0], F[1] - h + band], [R[0], R[1] - h + band], [R[0], R[1] - h + band + 16 * s], [F[0], F[1] - h + band + 16 * s]], SC.gold, easeOut(prog * 1.2 - .3));
  const dx = cx + w * 0.3, dy = by - d * 0.18;
  fillPoly(ctx, [[dx - 14 * s, dy - 4 * s], [dx + 22 * s, dy - 12 * s], [dx + 22 * s, dy - 82 * s], [dx - 14 * s, dy - 74 * s]], SC.gold, 0.85 * easeOut(prog * 1.2 - .4));
  stroke(ctx, [L, F, R, Rt, Bt, Lt, L], { w: 4, prog, seed: 21, glow: .8 });
  stroke(ctx, [F, Ft], { w: 4, prog, seed: 22, glow: .8 }); stroke(ctx, [Lt, Ft, Rt], { w: 4, prog, seed: 23, glow: .8 });
}
function palm(ctx, x, by, s, prog, seed) {
  const top = [x + 18 * s, by - 170 * s];
  stroke(ctx, [[x, by], [x + 6 * s, by - 80 * s], top], { w: 6 * s, prog, seed, col: SC.sand });
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI * (0.05 + i * 0.18), len = 70 * s;
    const p = [top, [top[0] + Math.cos(a) * len * 0.55, top[1] + Math.sin(a) * len * 0.55 - 10 * s], [top[0] + Math.cos(a) * len, top[1] + Math.sin(a) * len + 18 * s]];
    stroke(ctx, p, { w: 5 * s, prog: prog * 1.3 - 0.3, seed: seed + i + 1, col: SC.dome });
  }
}
function tent(ctx, x, by, s, prog, seed) {
  stroke(ctx, [[x - 60 * s, by], [x, by - 70 * s], [x + 60 * s, by]], { w: 5, prog, seed, glow: .5 });
  stroke(ctx, [[x, by - 70 * s], [x - 8 * s, by], [x + 10 * s, by - 30 * s]], { w: 4, prog: prog * 1.2 - .2, seed: seed + 1 });
}
function lamp(ctx, x, y, s, prog, t) {
  const body = [[x - 50 * s, y], [x - 20 * s, y + 22 * s], [x + 40 * s, y + 18 * s], [x + 70 * s, y - 8 * s], [x + 40 * s, y - 2 * s], [x - 10 * s, y - 14 * s]];
  fillPoly(ctx, body, SC.navy2, 0.9); stroke(ctx, body, { w: 4, close: true, prog, seed: 41, glow: .7 });
  stroke(ctx, arcPts(x - 58 * s, y - 2 * s, 12 * s, -1.6, 1.6, 12), { w: 4, prog, seed: 42 });
  if (prog > .7) {
    const f = 1 + Math.sin(t * 9) * 0.08 + Math.sin(t * 13.7) * 0.05, fx = x + 70 * s, fy = y - 12 * s;
    glowDot(ctx, fx, fy - 20 * s, 120 * s * f, "255,200,110", easeOut((prog - .7) * 3));
    fillPoly(ctx, [[fx - 9 * s, fy], [fx, fy - 42 * s * f], [fx + 9 * s, fy]], SC.gold2, easeOut((prog - .7) * 3));
  }
}
function book(ctx, cx, cy, s, prog) {
  const L = [[cx, cy + 10 * s], [cx - 150 * s, cy - 10 * s], [cx - 150 * s, cy - 110 * s], [cx, cy - 90 * s]], R = [[cx, cy + 10 * s], [cx + 150 * s, cy - 10 * s], [cx + 150 * s, cy - 110 * s], [cx, cy - 90 * s]];
  fillPoly(ctx, L, SC.navy2, .85); fillPoly(ctx, R, SC.navy2, .85);
  stroke(ctx, L, { w: 4, close: true, prog, seed: 51, glow: .6 }); stroke(ctx, R, { w: 4, close: true, prog, seed: 52, glow: .6 });
  for (let i = 0; i < 4; i++) {
    stroke(ctx, [[cx - 125 * s, cy - (85 - i * 18) * s], [cx - 25 * s, cy - (72 - i * 18) * s]], { w: 3, prog: prog * 1.5 - .5 - i * .08, seed: 53 + i, a: .7, col: SC.sand });
    stroke(ctx, [[cx + 25 * s, cy - (72 - i * 18) * s], [cx + 125 * s, cy - (85 - i * 18) * s]], { w: 3, prog: prog * 1.5 - .6 - i * .08, seed: 63 + i, a: .7, col: SC.sand });
  }
}
function masjid(ctx, cx, by, s, prog, t) {
  const halo = 0.6 + 0.25 * Math.sin(t * 1.4);
  glowDot(ctx, cx, by - 210 * s, 300 * s, "120,220,160", 0.35 * halo * easeOut(prog));
  const base = [[cx - 200 * s, by], [cx - 200 * s, by - 110 * s], [cx + 200 * s, by - 110 * s], [cx + 200 * s, by]];
  fillPoly(ctx, base, SC.navy2, .9);
  const dome = [[cx - 110 * s, by - 110 * s]].concat(arcPts(cx, by - 110 * s, 110 * s, Math.PI, 2 * Math.PI, 30, 130 * s)).concat([[cx + 110 * s, by - 110 * s]]);
  fillPoly(ctx, dome, SC.dome, 0.85 * easeOut(prog * 1.3 - .2));
  stroke(ctx, base, { w: 5, prog, seed: 71, glow: .6 });
  stroke(ctx, dome, { w: 5, prog, seed: 72, glow: .9 });
  stroke(ctx, [[cx, by - 240 * s], [cx, by - 285 * s]], { w: 4, prog: prog * 1.3 - .3, seed: 73 });
  for (const m of [-1, 1]) {
    const mx = cx + m * 260 * s, mn = [[mx - 18 * s, by], [mx - 18 * s, by - 300 * s], [mx, by - 350 * s], [mx + 18 * s, by - 300 * s], [mx + 18 * s, by]];
    fillPoly(ctx, mn, SC.navy2, .9); stroke(ctx, mn, { w: 5, prog, seed: 74 + m, glow: .6 });
    stroke(ctx, [[mx - 26 * s, by - 230 * s], [mx + 26 * s, by - 230 * s]], { w: 5, prog: prog * 1.3 - .3, seed: 78 + m });
  }
  for (let i = 0; i < 5; i++) { const ax = cx - 120 * s + i * 60 * s; const arch = [[ax - 16 * s, by], [ax - 16 * s, by - 50 * s]].concat(arcPts(ax, by - 50 * s, 16 * s, Math.PI, 2 * Math.PI, 10)).concat([[ax + 16 * s, by]]); fillPoly(ctx, arch, "rgb(255,205,110)", .55 * easeOut(prog * 1.5 - .5)); }
}

/* ---------- scener ---------- */
// hver scene: (ctx, W, H, t) – t i sekunder siden scenen startede
const SCENES = {
  kaaba: { name: "Makkah om natten", draw(ctx, W, H, t) {
    sky(ctx, W, H, t, 5); crescent(ctx, W * 0.78, H * 0.17, 38, t / 1.5);
    dunes(ctx, W, H, H * 0.78, t, t / 2.2);
    kaaba(ctx, W * 0.5, H * 0.8, 1.15, t / 2.6, t);
    for (let i = 0; i < 7; i++) { // tawaf: almindelige mennesker i dag, små og ansigtsløse
      const a = t * 0.35 + i * 0.9, x = W * 0.5 + Math.cos(a) * 300, y = H * 0.86 + Math.sin(a) * 34;
      if (Math.sin(a) > -0.2) figure(ctx, x, y, 0.55, "stand", t, SC.cream, 90 + i, 6);
    }
  } },
  rejse: { name: "Rejsen: Makkah → Madinah", draw(ctx, W, H, t) {
    sky(ctx, W, H, t, 9);
    const m = 70, card = [[m, m + 30], [W - m, m], [W - m + 10, H - m], [m - 10, H - m - 20]];
    fillPoly(ctx, card, "rgb(30,44,64)", .85); stroke(ctx, card, { w: 5, close: true, prog: t / 1.4, seed: 31, glow: .6 });
    const A = [W * 0.32, H * 0.78], B = [W * 0.66, H * 0.24];
    const route = []; for (let i = 0; i <= 60; i++) { const f = i / 60; route.push([A[0] + (B[0] - A[0]) * f + Math.sin(f * Math.PI * 2.2) * 70, A[1] + (B[1] - A[1]) * f]); }
    const rp = easeIO((t - 1.2) / 5);
    const part = partial(densify(route, 6), rp);
    ctx.save(); ctx.setLineDash([14, 14]); stroke(ctx, part.length > 1 ? part : [A, A], { w: 5, wob: 0, glow: 1, col: SC.gold2 }); ctx.restore();
    if (part.length > 1 && rp < 1) { const p = part[part.length - 1]; glowDot(ctx, p[0], p[1], 40, "255,225,150", 1); }
    for (const [P, label, d] of [[A, "مَكَّة", 0.6], [B, "المَدِينَة", 1.0]]) {
      const pr = easeOut((t - d) / 0.6); if (pr <= 0) continue;
      glowDot(ctx, P[0], P[1], 46, "255,210,120", pr); ctx.fillStyle = SC.gold; ctx.beginPath(); ctx.arc(P[0], P[1], 10 * pr, 0, 6.283); ctx.fill();
      ctx.save(); ctx.globalAlpha = pr; ctx.font = "700 46px Amiri"; ctx.fillStyle = SC.gold2; ctx.textAlign = "center"; ctx.fillText(label, P[0] + (P === A ? 110 : 0), P[1] + (P === A ? 14 : -30)); ctx.restore();
    }
    palm(ctx, W * 0.2, H * 0.5, 0.9, (t - 0.8) / 1.5, 33); palm(ctx, W * 0.8, H * 0.7, 0.8, (t - 1.4) / 1.5, 37);
    tent(ctx, W * 0.75, H * 0.45, 0.8, (t - 2) / 1.2, 39);
    // kompas
    const cx = W * 0.18, cy = H * 0.2, cr = 46, cp = easeOut((t - 0.5) / 1);
    stroke(ctx, arcPts(cx, cy, cr, 0, 6.283, 30), { w: 3, prog: cp, seed: 44 }); stroke(ctx, [[cx, cy + cr], [cx, cy - cr - 14]], { w: 3, prog: cp, seed: 45 });
    if (cp > .5) { ctx.save(); ctx.globalAlpha = cp; ctx.font = "600 22px Cinzel"; ctx.fillStyle = SC.gold; ctx.textAlign = "center"; ctx.fillText("N", cx, cy - cr - 22); ctx.restore(); }
  } },
  masjid: { name: "Moskéen", draw(ctx, W, H, t) {
    sky(ctx, W, H, t, 13); crescent(ctx, W * 0.2, H * 0.16, 30, t / 1.5);
    masjid(ctx, W * 0.5, H * 0.86, 1.15, t / 2.8, t);
    stroke(ctx, [[0, H * 0.86], [W, H * 0.86]], { w: 4, prog: t / 1.2, seed: 81, a: .7 });
  } },
  halaqa: { name: "Halaqa i dag", draw(ctx, W, H, t) {
    sky(ctx, W, H, t, 17);
    const g = ctx.createRadialGradient(W / 2, H * 0.62, 10, W / 2, H * 0.62, W * 0.55); g.addColorStop(0, "rgba(255,200,110,0.22)"); g.addColorStop(1, "rgba(255,200,110,0)"); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const rug = arcPts(W / 2, H * 0.84, 390, 0, 6.283, 48, 95);
    fillPoly(ctx, rug, "rgb(40,30,24)", 0.55); stroke(ctx, rug, { w: 4, prog: t / 1.2, seed: 91, glow: .5 });
    stroke(ctx, arcPts(W / 2, H * 0.84, 350, 0, 6.283, 48, 78), { w: 2, prog: t / 1.4, seed: 92, a: .5, col: SC.sand });
    const a0 = easeOut((t - 0.5) / 0.6);
    if (a0 > 0) { ctx.save(); ctx.globalAlpha = a0; figure(ctx, W / 2, H * 0.76, 0.95, "teach", t, SC.gold, 128); ctx.restore(); }
    lamp(ctx, W * 0.5 - 10, H * 0.84, 0.75, (t - 0.2) / 1.6, t);
    const seats = [[-300, 0.86, "read"], [-170, 0.93, "sit"], [170, 0.93, "sit"], [300, 0.86, "read"]];
    seats.forEach(([dx, fy, pose], i) => { const a = easeOut((t - 0.8 - i * 0.25) / 0.6); if (a <= 0) return; ctx.save(); ctx.globalAlpha = a; figure(ctx, W / 2 + dx, H * fy, 1.0, pose, t, SC.cream, 100 + i * 7); ctx.restore(); });
  } },
  bog: { name: "Bog og lampe", draw(ctx, W, H, t) {
    sky(ctx, W, H, t, 23);
    book(ctx, W * 0.5, H * 0.72, 1.6, t / 2.2);
    lamp(ctx, W * 0.5 + 40, H * 0.36, 1.0, (t - 1.2) / 1.6, t);
    const r = rng(7); for (let i = 0; i < 16; i++) { const x = W * 0.25 + r() * W * 0.5, sp = 30 + r() * 50, y = H * 0.66 - ((t * sp + r() * 400) % (H * 0.5)); glowDot(ctx, x, y, 10 + r() * 8, "255,215,140", 0.7 * easeOut((t - 1.5) / 1)); }
  } },
};

// 8-takket stjerne-iris rundt om (cx, cy)
function starIris(ctx, cx, cy, R, rot) { starPath(ctx, cx, cy, R, 8, 0.765, rot); }
