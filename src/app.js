/* Fra seerah til handling – videogenerator + promo
   Alt kører i browseren: lydforbedring (Web Audio), analyse (FFT), tegning (canvas),
   kodning (WebCodecs H.264) og pakning (mp4-muxer). */

const FPS = 25;
const TITLE_AR_A = "سِيرَةُ النَّبِيِّ ﷺ", TITLE_AR_B = "الإِسْلَامُ فِي الوَاقِعِ";
const TITLE_AR = TITLE_AR_A + " " + TITLE_AR_B;
const TITLE_DA = "Profetens liv", TITLE_SUB = "ISLAM I PRAKSIS", SERIES = "Profetens liv – Islam i praksis";
const KICKER = "LYDSERIE";
const GOLD = "#d4af37", GOLD2 = "#f0d68c", CREAM = "#f5eedc";
const N_HALF = 34;

const $ = id => document.getElementById(id);
const state = { file: null, decoded: null, processed: null, analysis: null, procKey: "", videoBlob: null, teaserBlob: null };
const yieldUI = () => new Promise(r => { const c = new MessageChannel(); c.port1.onmessage = r; c.port2.postMessage(0); });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const fmt = s => { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };

/* ================= tegne-hjælpere ================= */
function starPath(ctx, cx, cy, r, points = 8, inner = 0.62, rot = 0) {
  ctx.beginPath();
  for (let k = 0; k < points * 2; k++) {
    const a = rot + Math.PI / points * k, rr = k % 2 ? r * inner : r;
    k ? ctx.lineTo(cx + rr * Math.cos(a), cy + rr * Math.sin(a)) : ctx.moveTo(cx + rr * Math.cos(a), cy + rr * Math.sin(a));
  }
  ctx.closePath();
}
function rosette(ctx, cx, cy, R, alpha = 1) {
  ctx.save();
  ctx.strokeStyle = `rgba(212,175,55,${0.16 * alpha})`; ctx.lineWidth = Math.max(1.5, R / 150);
  for (let ring = 0; ring < 4; ring++) { starPath(ctx, cx, cy, R * (1 - ring * 0.22), 16, 0.84, ring % 2 ? Math.PI / 16 : 0); ctx.stroke(); }
  ctx.strokeStyle = `rgba(212,175,55,${0.10 * alpha})`;
  for (let i = 0; i < 16; i++) {
    const a = Math.PI / 8 * i;
    ctx.beginPath(); ctx.moveTo(cx + R * 0.32 * Math.cos(a), cy + R * 0.32 * Math.sin(a)); ctx.lineTo(cx + R * 1.12 * Math.cos(a), cy + R * 1.12 * Math.sin(a)); ctx.stroke();
  }
  for (const r of [R * 1.12, R * 1.18]) { ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke(); }
  ctx.restore();
}
function lantern(ctx, x, topY, len, s) {
  const y = topY + len;
  ctx.save();
  ctx.strokeStyle = "rgba(212,175,55,0.7)"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x, topY); ctx.lineTo(x, y); ctx.stroke();
  const g = ctx.createRadialGradient(x, y + 70 * s, 5, x, y + 70 * s, 190 * s);
  g.addColorStop(0, "rgba(255,210,120,0.40)"); g.addColorStop(1, "rgba(255,210,120,0)");
  ctx.fillStyle = g; ctx.fillRect(x - 200 * s, y - 120 * s, 400 * s, 400 * s);
  ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = GOLD; ctx.strokeStyle = GOLD; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(0, 4, 8, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(-14, 30); ctx.quadraticCurveTo(0, 0, 14, 30); ctx.closePath(); ctx.fill();
  ctx.fillRect(-30, 30, 60, 8);
  ctx.beginPath(); ctx.moveTo(-30, 38); ctx.lineTo(-40, 70); ctx.lineTo(-28, 120); ctx.lineTo(28, 120); ctx.lineTo(40, 70); ctx.lineTo(30, 38); ctx.closePath();
  const body = ctx.createLinearGradient(0, 38, 0, 120);
  body.addColorStop(0, "rgba(255,226,150,0.95)"); body.addColorStop(1, "rgba(230,160,60,0.85)");
  ctx.fillStyle = body; ctx.fill(); ctx.stroke();
  ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 38); ctx.lineTo(0, 120); ctx.moveTo(-36, 70); ctx.lineTo(36, 70); ctx.stroke();
  starPath(ctx, 0, 92, 11, 8, 0.6); ctx.strokeStyle = "rgba(120,70,10,0.8)"; ctx.stroke();
  ctx.fillStyle = GOLD; ctx.fillRect(-32, 120, 64, 8);
  ctx.beginPath(); ctx.moveTo(-20, 128); ctx.lineTo(0, 150); ctx.lineTo(20, 128); ctx.fill();
  ctx.beginPath(); ctx.arc(0, 156, 5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
function mosque(ctx, x0, baseY, scale, mirror) {
  ctx.save(); ctx.translate(x0, baseY); ctx.scale(mirror ? -scale : scale, scale);
  const p = new Path2D();
  p.moveTo(0, 0); p.lineTo(0, -200); p.lineTo(-6, -200); p.lineTo(-6, -208); p.lineTo(0, -208); p.lineTo(0, -250);
  p.lineTo(6, -282); p.lineTo(12, -250); p.lineTo(12, -208); p.lineTo(18, -208); p.lineTo(18, -200); p.lineTo(12, -200);
  p.lineTo(12, -90); p.lineTo(40, -90); p.quadraticCurveTo(40, -135, 75, -150); p.quadraticCurveTo(110, -135, 110, -90);
  p.lineTo(130, -90); p.lineTo(130, -110);
  p.bezierCurveTo(130, -185, 175, -205, 202.5, -232); p.bezierCurveTo(230, -205, 275, -185, 275, -110);
  p.lineTo(275, -90); p.lineTo(300, -90); p.quadraticCurveTo(300, -130, 330, -142); p.quadraticCurveTo(360, -130, 360, -90);
  p.lineTo(380, -90); p.lineTo(380, -160); p.lineTo(374, -160); p.lineTo(374, -166); p.lineTo(380, -166); p.lineTo(380, -190);
  p.lineTo(386, -214); p.lineTo(392, -190); p.lineTo(392, -166); p.lineTo(398, -166); p.lineTo(398, -160); p.lineTo(392, -160);
  p.lineTo(392, -90); p.lineTo(470, -90); p.lineTo(470, 0); p.closePath();
  const fill = ctx.createLinearGradient(0, -300, 0, 0);
  fill.addColorStop(0, "#08362b"); fill.addColorStop(1, "#031712");
  ctx.fillStyle = fill; ctx.fill(p);
  ctx.strokeStyle = "rgba(212,175,55,0.55)"; ctx.lineWidth = 2 / scale; ctx.stroke(p);
  ctx.beginPath(); ctx.moveTo(202.5, -232); ctx.lineTo(202.5, -262); ctx.moveTo(75, -150); ctx.lineTo(75, -166); ctx.moveTo(330, -142); ctx.lineTo(330, -156); ctx.stroke();
  ctx.fillStyle = "rgba(212,175,55,0.8)";
  for (const [fx, fy, fr] of [[202.5, -266, 5], [75, -169, 3], [330, -159, 3], [6, -286, 3], [386, -218, 3]]) { ctx.beginPath(); ctx.arc(fx, fy, fr, 0, 6.283); ctx.fill(); }
  ctx.fillStyle = "rgba(255,205,110,0.55)";
  for (let i = 0; i < 6; i++) { const wx = 150 + i * 20; ctx.beginPath(); ctx.moveTo(wx, -40); ctx.lineTo(wx, -62); ctx.quadraticCurveTo(wx + 5, -72, wx + 10, -62); ctx.lineTo(wx + 10, -40); ctx.fill(); }
  ctx.restore();
}
function measureSpaced(ctx, t, sp) { let w = 0; for (const ch of t) w += ctx.measureText(ch).width; return w + sp * ([...t].length - 1); }
function drawSpaced(ctx, t, cx, cy, sp) {
  let x = cx - measureSpaced(ctx, t, sp) / 2;
  ctx.textAlign = "left"; ctx.textBaseline = "middle";
  for (const ch of t) { ctx.fillText(ch, x, cy); x += ctx.measureText(ch).width + sp; }
  ctx.textAlign = "center";
}
function fitFont(ctx, text, weight, family, size, maxW) {
  let s = size; do { ctx.font = `${weight} ${s}px ${family}`; s -= 2; } while (ctx.measureText(text).width > maxW && s > 10);
}
function cartouche(ctx, cx, cy, text, size = 46) {
  ctx.save();
  const k = size / 46, sp = 12 * k;
  ctx.font = `700 ${size}px Cinzel`;
  const tw = measureSpaced(ctx, text, sp);
  const w = tw + 140 * k, h = 84 * k, x = cx - w / 2, y = cy - h / 2, e = 30 * k;
  const shape = new Path2D();
  shape.moveTo(x + e, y); shape.lineTo(x + w - e, y); shape.lineTo(x + w, cy); shape.lineTo(x + w - e, y + h); shape.lineTo(x + e, y + h); shape.lineTo(x, cy); shape.closePath();
  const f = ctx.createLinearGradient(0, y, 0, y + h); f.addColorStop(0, "#0d3e32"); f.addColorStop(1, "#06261e");
  ctx.shadowColor = "rgba(0,0,0,0.5)"; ctx.shadowBlur = 24 * k; ctx.fillStyle = f; ctx.fill(shape);
  ctx.shadowBlur = 0; ctx.strokeStyle = GOLD; ctx.lineWidth = 3 * k; ctx.stroke(shape);
  const i9 = 9 * k, inner = new Path2D();
  inner.moveTo(x + e + 6 * k, y + i9); inner.lineTo(x + w - e - 6 * k, y + i9); inner.lineTo(x + w - 11 * k, cy); inner.lineTo(x + w - e - 6 * k, y + h - i9);
  inner.lineTo(x + e + 6 * k, y + h - i9); inner.lineTo(x + 11 * k, cy); inner.closePath();
  ctx.strokeStyle = "rgba(212,175,55,0.45)"; ctx.lineWidth = 1.2 * k; ctx.stroke(inner);
  for (const dx of [x + 40 * k, x + w - 40 * k]) { ctx.fillStyle = GOLD; starPath(ctx, dx, cy, 9 * k, 4, 0.4, 0); ctx.fill(); }
  const g = ctx.createLinearGradient(0, cy - 24 * k, 0, cy + 24 * k); g.addColorStop(0, GOLD2); g.addColorStop(1, "#c9982c");
  ctx.fillStyle = g; drawSpaced(ctx, text, cx, cy + 2 * k, sp);
  ctx.restore();
}
function divider(ctx, cx, y, half, k = 1) {
  ctx.save();
  const g = ctx.createLinearGradient(cx - half, 0, cx + half, 0);
  g.addColorStop(0, "rgba(212,175,55,0)"); g.addColorStop(0.5, GOLD); g.addColorStop(1, "rgba(212,175,55,0)");
  ctx.strokeStyle = g; ctx.lineWidth = 2 * k;
  ctx.beginPath(); ctx.moveTo(cx - half, y); ctx.lineTo(cx - 26 * k, y); ctx.moveTo(cx + 26 * k, y); ctx.lineTo(cx + half, y); ctx.stroke();
  ctx.fillStyle = GOLD; starPath(ctx, cx, y, 13 * k, 8, 0.5); ctx.fill();
  for (const d of [-40, 40]) { ctx.beginPath(); ctx.arc(cx + d * k, y, 3.5 * k, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}
function arabicTitle(ctx, x, y, size, maxW) {
  ctx.save(); ctx.direction = "rtl"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
  let sz = size, wA, wB, gap;
  do { ctx.font = `700 ${sz}px Amiri`; wA = ctx.measureText(TITLE_AR_A).width; wB = ctx.measureText(TITLE_AR_B).width; gap = sz * 0.85; sz -= 2; } while (wA + wB + gap > maxW && sz > 12);
  sz += 2; const total = wA + wB + gap, right = x + total / 2, left = x - total / 2;
  const tg = ctx.createLinearGradient(0, y - sz * 0.6, 0, y + sz * 0.55);
  tg.addColorStop(0, "#f7e2a0"); tg.addColorStop(0.55, GOLD); tg.addColorStop(1, "#b8862a");
  ctx.fillStyle = tg; ctx.direction = "ltr"; ctx.textAlign = "center";
  const cA = right - wA / 2, cB = left + wB / 2;
  for (const pass of [1, 0]) {
    ctx.shadowColor = "rgba(255,200,90,0.55)"; ctx.shadowBlur = pass ? sz * 0.32 : 0;
    ctx.fillText(TITLE_AR_A, cA, y); ctx.fillText(TITLE_AR_B, cB, y);
  }
  ctx.fillStyle = GOLD; starPath(ctx, right - wA - gap / 2, y + sz * 0.08, sz * 0.2, 8, 0.45); ctx.fill();
  ctx.restore();
}
function subTitle(ctx, x, y, size) { ctx.save(); ctx.font = `600 ${size}px Cinzel`; ctx.fillStyle = GOLD2; drawSpaced(ctx, TITLE_SUB, x, y, size * 0.42); ctx.restore(); }
function creamText(ctx, text, x, y, size, maxW, weight = 600, family = "'Cormorant Garamond', Amiri", color = CREAM) {
  ctx.save(); ctx.textAlign = "center"; ctx.textBaseline = "middle";
  fitFont(ctx, text, weight, family, size, maxW);
  ctx.fillStyle = color; ctx.shadowColor = "rgba(0,0,0,0.55)"; ctx.shadowBlur = size * 0.2; ctx.fillText(text, x, y);
  ctx.restore();
}

// fælles scene: grund, mønster, lys, rosette, moskéer, lanterner, vignette, ramme
function scene(ctx, w, h, o) {
  const k = Math.min(w, h) / 1080;
  let g = ctx.createRadialGradient(w / 2, o.rosY, 50 * k, w / 2, o.rosY, Math.max(w, h) * 0.7);
  g.addColorStop(0, "#15604b"); g.addColorStop(0.55, "#0a3a2e"); g.addColorStop(1, "#03140f");
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  ctx.save(); ctx.strokeStyle = "rgba(212,175,55,0.075)"; ctx.lineWidth = 1.5 * k;
  const step = 110 * k;
  for (let y = -step, r = 0; y < h + step; y += step * 0.5, r++)
    for (let x = -step; x < w + step; x += step) { starPath(ctx, x + (r % 2 ? step / 2 : 0), y, 34 * k, 8, 0.6, Math.PI / 8); ctx.stroke(); }
  ctx.restore();
  g = ctx.createRadialGradient(w / 2, h * 0.47, 100 * k, w / 2, h * 0.47, Math.max(w, h) * 0.4);
  g.addColorStop(0, "rgba(16,82,63,0.92)"); g.addColorStop(0.7, "rgba(12,62,48,0.55)"); g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  g = ctx.createRadialGradient(w / 2, o.rosY, 0, w / 2, o.rosY, o.rosR * 1.4);
  g.addColorStop(0, "rgba(255,215,120,0.16)"); g.addColorStop(1, "rgba(255,215,120,0)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  rosette(ctx, w / 2, o.rosY, o.rosR);
  if (o.mosques) {
    const ms = o.mosqueScale || k;
    mosque(ctx, 36 * k + 34 * k, h - 50 * k, ms, false);
    mosque(ctx, w - 70 * k, h - 50 * k, ms, true);
    g = ctx.createLinearGradient(0, h - 120 * k, 0, h);
    g.addColorStop(0, "rgba(3,20,15,0)"); g.addColorStop(1, "rgba(3,20,15,0.9)");
    ctx.fillStyle = g; ctx.fillRect(0, h - 120 * k, w, 120 * k);
  }
  for (const L of o.lanterns || []) lantern(ctx, L[0], 34 * k + 26 * k, L[1], L[2]);
  g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.45, w / 2, h / 2, Math.max(w, h) * 0.72);
  g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  const m = 34 * k;
  ctx.strokeStyle = GOLD; ctx.lineWidth = 3 * k; ctx.strokeRect(m, m, w - 2 * m, h - 2 * m);
  ctx.strokeStyle = "rgba(212,175,55,0.45)"; ctx.lineWidth = 1 * k; ctx.strokeRect(m + 12 * k, m + 12 * k, w - 2 * m - 24 * k, h - 2 * m - 24 * k);
  for (const [x, y] of [[m, m], [w - m, m], [m, h - m], [w - m, h - m]]) {
    ctx.fillStyle = "#06261e"; starPath(ctx, x, y, 26 * k, 8, 0.6, Math.PI / 8); ctx.fill();
    ctx.strokeStyle = GOLD; ctx.lineWidth = 2.5 * k; ctx.stroke();
    ctx.fillStyle = GOLD; starPath(ctx, x, y, 10 * k, 4, 0.45); ctx.fill();
  }
}

/* ================= layouts ================= */
const meta = () => ({ ep: $("ep").value || "1", title: $("eptitle").value.trim(), when: $("when").value.trim() });

// 1920x1080 video-baggrund
function bgVideo(m) {
  const c = mk(1920, 1080), ctx = c.getContext("2d"), W = 1920;
  scene(ctx, 1920, 1080, { rosY: 625, rosR: 300, mosques: true, lanterns: [[300, 120, 1], [W - 300, 160, .85], [150, 30, .6], [W - 150, 50, .6]] });
  ctx.font = "600 26px Cinzel"; ctx.fillStyle = GOLD2; drawSpaced(ctx, KICKER, W / 2, 92, 7);
  arabicTitle(ctx, W / 2, 222, 96, 1080);
  creamText(ctx, TITLE_DA, W / 2, 335, 74, 1000);
  subTitle(ctx, W / 2, 400, 26);
  divider(ctx, W / 2, 445, 260);
  if (m.title) { cartouche(ctx, W / 2, 878, `EPISODE ${m.ep}`, 42); creamText(ctx, m.title, W / 2, 962, 46, 900); }
  else cartouche(ctx, W / 2, 905, `EPISODE ${m.ep}`);
  return c;
}
// 1080x1920 lodret (teaser + story)
function bgVertical(m, kind) {
  const W = 1080, H = 1920, c = mk(W, H), ctx = c.getContext("2d");
  scene(ctx, W, H, { rosY: 1010, rosR: 360, mosques: true, mosqueScale: 0.7, lanterns: [[150, 10, .6], [W - 150, 40, .55]] });
  ctx.font = "600 34px Cinzel"; ctx.fillStyle = GOLD2; drawSpaced(ctx, kind === "story" ? "NY EPISODE" : "LYDSERIE", W / 2, 140, 12);
  if (kind === "story") { ctx.font = "600 26px Cinzel"; ctx.fillStyle = "rgba(240,214,140,0.8)"; drawSpaced(ctx, "LYDSERIE", W / 2, 192, 9); }
  arabicTitle(ctx, W / 2, 330, 80, 900);
  creamText(ctx, TITLE_DA, W / 2, 440, 84, 880);
  subTitle(ctx, W / 2, 510, 30);
  divider(ctx, W / 2, 560, 230);
  const T = kind === "teaser";
  cartouche(ctx, W / 2, T ? 1505 : 1420, `EPISODE ${m.ep}`, T ? 44 : 50);
  if (m.title) creamText(ctx, m.title, W / 2, T ? 1592 : 1530, T ? 54 : 60, 860);
  const cta = kind === "story" ? (m.when || "Ude nu på YouTube") : (m.when || "");
  ctx.save(); fitFont(ctx, cta.toUpperCase(), 600, "Cinzel", 36, 760); ctx.fillStyle = GOLD2; drawSpaced(ctx, cta.toUpperCase(), W / 2, T ? 1672 : 1640, 6); ctx.restore();
  if (kind === "story") staticBars(ctx, W / 2, 1010, 9, 4, 360, 7);
  return c;
}
// 1080x1080 opslag
function bgSquare(m) {
  const W = 1080, c = mk(W, W), ctx = c.getContext("2d");
  scene(ctx, W, W, { rosY: 600, rosR: 250, mosques: false, lanterns: [[150, 70, .7], [W - 150, 100, .62]] });
  ctx.font = "600 26px Cinzel"; ctx.fillStyle = GOLD2; drawSpaced(ctx, "NY EPISODE", W / 2, 108, 8);
  arabicTitle(ctx, W / 2, 205, 70, 800);
  creamText(ctx, TITLE_DA, W / 2, 300, 66, 760);
  subTitle(ctx, W / 2, 360, 24);
  divider(ctx, W / 2, 402, 200);
  staticBars(ctx, W / 2, 590, 8, 4, 230, 6);
  cartouche(ctx, W / 2, 820, `EPISODE ${m.ep}`, 40);
  if (m.title) creamText(ctx, m.title, W / 2, 905, 50, 820);
  ctx.save(); fitFont(ctx, (m.when || "Ude nu på YouTube").toUpperCase(), 600, "Cinzel", 28, 760); ctx.fillStyle = GOLD2; drawSpaced(ctx, (m.when || "Ude nu på YouTube").toUpperCase(), W / 2, 975, 5); ctx.restore();
  return c;
}
// 1280x720 YouTube-thumbnail: stor og læsbar på lille skærm
function bgThumb(m) {
  const W = 1280, H = 720, c = mk(W, H), ctx = c.getContext("2d");
  scene(ctx, W, H, { rosY: 380, rosR: 260, mosques: true, mosqueScale: 0.62, lanterns: [[150, 60, .6], [W - 150, 90, .55]] });
  arabicTitle(ctx, W / 2, 130, 64, 900);
  ctx.save(); ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.font = "700 150px Cinzel"; ctx.shadowColor = "rgba(255,200,90,0.6)"; ctx.shadowBlur = 40;
  const g = ctx.createLinearGradient(0, 270, 0, 430); g.addColorStop(0, "#fff0c0"); g.addColorStop(1, "#c9982c");
  ctx.fillStyle = g; ctx.fillText(m.ep, W / 2, 360); ctx.shadowBlur = 0; ctx.fillText(m.ep, W / 2, 360); ctx.restore();
  ctx.font = "700 30px Cinzel"; ctx.fillStyle = GOLD2; drawSpaced(ctx, "EPISODE", W / 2, 255, 14);
  creamText(ctx, m.title || SERIES, W / 2, 520, 68, 1000, 700);
  divider(ctx, W / 2, 585, 220, .8);
  return c;
}
function staticBars(ctx, cx, cy, bw, gap, maxh, seed) {
  const vals = new Float32Array(N_HALF).map((_, i) => { const v = Math.sin(i * 0.9 + seed) * 0.5 + 0.5; return 0.2 + 0.75 * v * (1 - i / N_HALF * 0.6); });
  const sp = makeSprite(bw, maxh); drawBars(ctx, sp, vals, cx, cy, bw, gap, maxh);
}
const mk = (w, h) => { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; };

/* ================= bars (hurtig: forrendret glød-sprite, 9-slice) ================= */
const spriteCache = {};
function makeSprite(bw, maxh) {
  const key = bw + "x" + maxh; if (spriteCache[key]) return spriteCache[key];
  const pad = Math.round(bw * 1.8), c = mk(bw + pad * 2, maxh + pad * 2), x = c.getContext("2d");
  const g = x.createLinearGradient(0, pad, 0, pad + maxh);
  g.addColorStop(0, "#c9982c"); g.addColorStop(0.5, "#fff0c0"); g.addColorStop(1, "#c9982c");
  x.shadowColor = "rgba(255,200,90,0.85)"; x.shadowBlur = bw * 1.6; x.fillStyle = g;
  x.beginPath(); x.roundRect(pad, pad, bw, maxh, bw / 2); x.fill();
  return (spriteCache[key] = { c, pad, cap: pad + Math.ceil(bw / 2) });
}
function drawBars(ctx, sp, vals, cx, cy, bw, gap, maxh, minh = bw * 0.6) {
  const total = 2 * N_HALF * bw + (2 * N_HALF - 1) * gap;
  let x = cx - total / 2;
  const { c, pad, cap } = sp, sw = c.width, midSrcH = c.height - 2 * cap;
  for (let i = 0; i < 2 * N_HALF; i++) {
    const b = i < N_HALF ? N_HALF - 1 - i : i - N_HALF;
    const h = minh + vals[b] * (maxh - minh) * (1 - 0.3 * b / N_HALF);
    const dx = x - pad, top = cy - h / 2 - pad, midH = Math.max(0, h + 2 * pad - 2 * cap);
    ctx.drawImage(c, 0, 0, sw, cap, dx, top, sw, cap);
    if (midH > 0) ctx.drawImage(c, 0, cap, sw, midSrcH, dx, top + cap, sw, midH);
    ctx.drawImage(c, 0, c.height - cap, sw, cap, dx, top + cap + midH, sw, cap);
    x += bw + gap;
  }
}

/* ================= guldstøv ================= */
function makeParticles(w, h, n) {
  return Array.from({ length: n }, (_, i) => {
    const r = s => { const v = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return v - Math.floor(v); };
    return { x: r(1) * w, y: r(2) * h, sp: 8 + r(3) * 22, sz: 1 + r(4) * 2.6, ph: r(5) * 6.28, dr: (r(6) - .5) * 14 };
  });
}
let dot = null;
function particles(ctx, P, w, h, t) {
  if (!dot) { dot = mk(16, 16); const d = dot.getContext("2d"), g = d.createRadialGradient(8, 8, 0, 8, 8, 8); g.addColorStop(0, "rgba(255,230,160,1)"); g.addColorStop(0.45, "rgba(255,222,140,0.8)"); g.addColorStop(1, "rgba(255,222,140,0)"); d.fillStyle = g; d.fillRect(0, 0, 16, 16); }
  for (const p of P) {
    const y = ((p.y - t * p.sp) % h + h) % h, x = p.x + Math.sin(t * 0.4 + p.ph) * p.dr;
    ctx.globalAlpha = 0.25 + 0.45 * (0.5 + 0.5 * Math.sin(t * 1.3 + p.ph));
    const s = p.sz * 3; ctx.drawImage(dot, x - s / 2, y - s / 2, s, s);
  }
  ctx.globalAlpha = 1;
}

/* ================= lyd: dekodning, forbedring, analyse ================= */
async function decodeFile(file) {
  const actx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 48000 });
  const buf = await actx.decodeAudioData(await file.arrayBuffer()); actx.close();
  return buf;
}
// diskret kæde: highpass 75 Hz, -2 dB @250 Hz (mudder), +1.5 dB @4.5 kHz (nærvær), +1 dB luft >10 kHz, blid kompression 2.5:1
async function enhancePass1(buf) {
  const ch = Math.min(2, buf.numberOfChannels);
  const oc = new OfflineAudioContext(ch, buf.length, buf.sampleRate);
  const src = oc.createBufferSource(); src.buffer = buf;
  const hp = oc.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 75; hp.Q.value = 0.7;
  const mud = oc.createBiquadFilter(); mud.type = "peaking"; mud.frequency.value = 250; mud.Q.value = 1.0; mud.gain.value = -2;
  const pres = oc.createBiquadFilter(); pres.type = "peaking"; pres.frequency.value = 4500; pres.Q.value = 0.8; pres.gain.value = 1.5;
  const air = oc.createBiquadFilter(); air.type = "highshelf"; air.frequency.value = 10000; air.gain.value = 1;
  const comp = oc.createDynamicsCompressor(); comp.threshold.value = -22; comp.knee.value = 12; comp.ratio.value = 2.5; comp.attack.value = 0.008; comp.release.value = 0.25;
  src.connect(hp).connect(mud).connect(pres).connect(air).connect(comp).connect(oc.destination);
  src.start();
  return oc.startRendering();
}
// integreret loudness (BS.1770 K-vægtning + gating) -> LUFS
function measureLUFS(chans, sr) {
  const n = chans[0].length, blk = Math.round(sr * 0.4), hop = Math.round(sr * 0.1);
  // K-filter koefficienter for 48 kHz
  const s1 = [1.53512485958697, -2.69169618940638, 1.19839281085285, -1.69065929318241, 0.73248077421585];
  const s2 = [1.0, -2.0, 1.0, -1.99004745483398, 0.99007225036621];
  const sq = new Float32Array(n);
  for (const x of chans) {
    let a1 = 0, a2 = 0, b1 = 0, b2 = 0, c1 = 0, c2 = 0, d1 = 0, d2 = 0;
    for (let i = 0; i < n; i++) {
      const v = x[i];
      const y = s1[0] * v + s1[1] * a1 + s1[2] * a2 - s1[3] * b1 - s1[4] * b2; a2 = a1; a1 = v; b2 = b1; b1 = y;
      const z = s2[0] * y + s2[1] * c1 + s2[2] * c2 - s2[3] * d1 - s2[4] * d2; c2 = c1; c1 = y; d2 = d1; d1 = z;
      sq[i] += z * z;
    }
  }
  const cum = new Float64Array(n + 1); for (let i = 0; i < n; i++) cum[i + 1] = cum[i] + sq[i];
  const L = []; for (let s = 0; s + blk <= n; s += hop) L.push((cum[s + blk] - cum[s]) / blk);
  const lk = z => -0.691 + 10 * Math.log10(z + 1e-12);
  let g1 = L.filter(z => lk(z) > -70); if (!g1.length) return -70;
  const rel = lk(g1.reduce((a, b) => a + b, 0) / g1.length) - 10;
  const g2 = g1.filter(z => lk(z) > rel);
  return lk(g2.reduce((a, b) => a + b, 0) / g2.length);
}
// gain + lookahead-peak-limiter (loft -1.5 dBFS)
function gainAndLimit(chans, sr, gainDb) {
  const n = chans[0].length, gl = Math.pow(10, gainDb / 20), ceil = Math.pow(10, -1.5 / 20);
  const env = new Float32Array(n);
  for (let i = 0; i < n; i++) { let p = 0; for (const c of chans) { const a = Math.abs(c[i]) * gl; if (a > p) p = a; } env[i] = p > ceil ? ceil / p : 1; }
  const L = Math.round(sr * 0.003), up = 1 / L;
  for (let i = n - 2; i >= 0; i--) { const v = env[i + 1] + up; if (v < env[i]) env[i] = v; }
  const rel = 1 - Math.exp(-1 / (0.12 * sr)); let g = 1;
  for (let i = 0; i < n; i++) { const t = env[i]; g = t < g ? t : g + (t - g) * rel; env[i] = g * gl; }
  return chans.map(c => { const o = new Float32Array(n); for (let i = 0; i < n; i++) o[i] = c[i] * env[i]; return o; });
}
async function enhance(buf, onStep) {
  onStep && onStep("Forbedrer lyden …");
  const p1 = await enhancePass1(buf);
  const chans = Array.from({ length: p1.numberOfChannels }, (_, i) => p1.getChannelData(i));
  await yieldUI();
  const lufs = measureLUFS(chans, p1.sampleRate);
  const gainDb = Math.max(-12, Math.min(14, -16 - lufs));
  await yieldUI();
  return { chans: gainAndLimit(chans, p1.sampleRate, gainDb), sr: p1.sampleRate, lufs, gainDb };
}
function rawChans(buf) { return { chans: Array.from({ length: Math.min(2, buf.numberOfChannels) }, (_, i) => buf.getChannelData(i)), sr: buf.sampleRate }; }

function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang), half = len >> 1;
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < half; k++) {
        const a = i + k, b = a + half, tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
        const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr;
      }
    }
  }
}
async function analyse(chans, sr, onProg) {
  const len = chans[0].length, mono = new Float32Array(len);
  for (const c of chans) for (let i = 0; i < len; i++) mono[i] += c[i] / chans.length;
  const hop = sr / FPS, nfr = Math.floor(len / hop), WIN = 2048;
  const hann = new Float32Array(WIN).map((_, i) => 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (WIN - 1)));
  const edges = Array.from({ length: N_HALF + 1 }, (_, i) => 90 * Math.pow(5000 / 90, i / N_HALF));
  const bin = f => Math.round(f * WIN / sr);
  const idx = []; for (let i = 0; i < N_HALF; i++) { const a = bin(edges[i]); idx.push([a, Math.max(bin(edges[i + 1]), a + 1)]); }
  const out = new Float32Array(nfr * N_HALF), re = new Float32Array(WIN), im = new Float32Array(WIN);
  for (let f = 0; f < nfr; f++) {
    const c = Math.floor(f * hop) - WIN / 2;
    for (let i = 0; i < WIN; i++) { const s = c + i; re[i] = (s >= 0 && s < len ? mono[s] : 0) * hann[i]; im[i] = 0; }
    fft(re, im);
    for (let b = 0; b < N_HALF; b++) { let sum = 0; const [a, e] = idx[b]; for (let k = a; k < e; k++) sum += Math.hypot(re[k], im[k]); out[f * N_HALF + b] = Math.log1p(sum / (e - a) * 20); }
    if (f % 3000 === 0) { onProg(f / nfr); await yieldUI(); }
  }
  for (let b = 0; b < N_HALF; b++) {
    const col = new Float32Array(nfr); for (let f = 0; f < nfr; f++) col[f] = out[f * N_HALF + b];
    const s = col.slice().sort(), lo = s[Math.floor(nfr * 0.3)], hi = s[Math.floor(nfr * 0.98)] + 1e-6;
    let prev = 0;
    for (let f = 0; f < nfr; f++) {
      let v = Math.min(1, Math.max(0, (col[f] - lo) / (hi - lo))) ** 1.4;
      v = v > prev ? prev + (v - prev) * 0.6 : prev * 0.86;
      out[f * N_HALF + b] = prev = v;
    }
  }
  return { data: out, nfr };
}

// forbereder lyd + analyse én gang pr. fil/indstilling
async function prepare(status) {
  const key = state.file.name + state.file.size + ":" + $("enh").checked;
  if (state.procKey === key && state.processed && state.analysis) return;
  if (!state.decoded) { status("Læser lydfilen …", 0.01); state.decoded = await decodeFile(state.file); }
  state.processed = $("enh").checked ? await enhance(state.decoded, t => status(t, 0.03)) : rawChans(state.decoded);
  status("Analyserer stemmen …", 0.05);
  state.analysis = await analyse(state.processed.chans, state.processed.sr, p => status("Analyserer stemmen …", 0.05 + p * 0.05));
  state.procKey = key;
}

/* ================= kodning ================= */
async function pickVideoConfig(w, h) {
  for (const codec of ["avc1.640028", "avc1.4d0028", "avc1.42e028", "avc1.640032"]) for (const hw of ["prefer-hardware", "no-preference"]) {
    const cfg = { codec, width: w, height: h, bitrate: w * h > 2e6 ? 2_500_000 : 3_000_000, bitrateMode: "variable", framerate: FPS, hardwareAcceleration: hw, avc: { format: "avc" } };
    try { if ((await VideoEncoder.isConfigSupported(cfg)).supported) return cfg; } catch (e) { }
  }
  throw new Error("Din browser kan ikke lave H.264-video. Brug Chrome eller Edge på computer.");
}
async function pickAudioConfig(ch, sr) {
  for (const [codec, mux] of [["mp4a.40.2", "aac"], ["opus", "opus"]]) {
    const cfg = { codec, sampleRate: sr, numberOfChannels: ch, bitrate: 160000 };
    try { if ((await AudioEncoder.isConfigSupported(cfg)).supported) return { cfg, mux }; } catch (e) { }
  }
  throw new Error("Din browser kan ikke kode lyd til MP4.");
}
async function encodeVideo({ w, h, nfr, draw, chans, sr, start = 0, len, fade = false, onProg, preview }) {
  const ch = chans.length;
  const vcfg = await pickVideoConfig(w, h), { cfg: acfg, mux } = await pickAudioConfig(ch, sr);
  const muxer = new Mp4Muxer.Muxer({ target: new Mp4Muxer.ArrayBufferTarget(), video: { codec: "avc", width: w, height: h, frameRate: FPS }, audio: { codec: mux, numberOfChannels: ch, sampleRate: sr }, fastStart: "in-memory", firstTimestampBehavior: "offset" });
  let err = null;
  const venc = new VideoEncoder({ output: (c, m) => muxer.addVideoChunk(c, m), error: e => err = e }); venc.configure(vcfg);
  const aenc = new AudioEncoder({ output: (c, m) => muxer.addAudioChunk(c, m), error: e => err = e }); aenc.configure(acfg);
  const CH = 9600, fi = Math.round(sr * 0.3), fo = Math.round(sr * 1.2);
  for (let off = 0; off < len; off += CH) {
    const n = Math.min(CH, len - off), buf = new Float32Array(n * ch);
    for (let c = 0; c < ch; c++) {
      const seg = chans[c].subarray(start + off, start + off + n);
      if (fade) for (let i = 0; i < n; i++) { const p = off + i; const g = Math.min(1, p / fi, (len - p) / fo); buf[c * n + i] = seg[i] * g; }
      else buf.set(seg, c * n);
    }
    aenc.encode(new AudioData({ format: "f32-planar", sampleRate: sr, numberOfFrames: n, numberOfChannels: ch, timestamp: Math.round(off / sr * 1e6), data: buf }));
    if (aenc.encodeQueueSize > 64) await new Promise(r => aenc.addEventListener("dequeue", r, { once: true }));
  }
  const cv = mk(w, h), cx = cv.getContext("2d", { alpha: false, desynchronized: true });
  const t0 = performance.now();
  for (let f = 0; f < nfr; f++) {
    if (err) throw err;
    draw(cx, f);
    const vf = new VideoFrame(cv, { timestamp: Math.round(f * 1e6 / FPS), duration: Math.round(1e6 / FPS) });
    venc.encode(vf, { keyFrame: f % (FPS * 10) === 0 }); vf.close();
    if (venc.encodeQueueSize > 16) await new Promise(r => venc.addEventListener("dequeue", r, { once: true }));
    if (f % 50 === 0) {
      if (preview) preview(cv);
      const el = (performance.now() - t0) / 1000, p = (f + 1) / nfr;
      onProg(p, el / p - el, f / el);
      await yieldUI();
    }
  }
  await venc.flush(); await aenc.flush(); if (err) throw err;
  muxer.finalize();
  return new Blob([muxer.target.buffer], { type: "video/mp4" });
}

/* ================= download ================= */
async function saveFile(name, data) {
  try {
    if (window.claude && window.claude.use) { const d = await window.claude.use("downloads"); if (d) { await d.save({ filename: name, data }); return; } }
  } catch (e) { if (e && e.code === "declined") return; }
  const a = document.createElement("a"); a.href = URL.createObjectURL(data); a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 60000);
}
const canvasBlob = c => new Promise(r => c.toBlob(r, "image/png"));
const slug = () => `Episode_${meta().ep}`;

/* ================= UI: video ================= */
const view = $("view"), vctx = view.getContext("2d");
let bgV = null, idle = true, P16 = makeParticles(1920, 1080, 70), spV = null, it0 = performance.now();
function refreshAll() { bgV = bgVideo(meta()); spV = makeSprite(13, 300); renderPromos(); }
function idleLoop() {
  if (!idle) return;
  const t = (performance.now() - it0) / 1000;
  const v = new Float32Array(N_HALF).map((_, i) => 0.18 + 0.5 * Math.max(0, Math.sin(t * 2.1 + i * 0.45) * Math.sin(t * 0.9 + i * 0.13)));
  frameV(vctx, v, t);
  requestAnimationFrame(idleLoop);
}
function frameV(ctx, vals, t) { ctx.drawImage(bgV, 0, 0); particles(ctx, P16, 1920, 1080, t); drawBars(ctx, spV, vals, 960, 625, 13, 6, 300, 8); }

function setFile(f) {
  if (!f) return;
  state.file = f; state.decoded = state.processed = state.analysis = null; state.procKey = ""; state.videoBlob = state.teaserBlob = null;
  $("dl").hidden = true; $("tdl").hidden = true;
  TP.segs = null; TP.units = []; TP.clips = []; $("clipwrap").hidden = true; $("tana").disabled = false;
  $("fname").textContent = f.name;
  const m = f.name.match(/ep(?:isode)?[\s_-]*(\d+)/i) || f.name.match(/(\d+)(?!.*\d)/); if (m) $("ep").value = parseInt(m[1], 10);
  refreshAll();
  $("go").disabled = false; $("ab").disabled = false; $("tgo").disabled = true;
  const pl = $("player"); if (pl.src) URL.revokeObjectURL(pl.src); pl.src = URL.createObjectURL(f); $("chadd").disabled = false;
  loadCh(); renderCh();
}
const drop = $("drop");
drop.onclick = () => $("pick").click();
$("pick").onchange = e => setFile(e.target.files[0]);
["dragenter", "dragover"].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add("over"); }));
["dragleave", "drop"].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove("over"); }));
drop.addEventListener("drop", e => setFile(e.dataTransfer.files[0]));
document.addEventListener("dragover", e => e.preventDefault());
document.addEventListener("drop", e => { e.preventDefault(); if (e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]); });
["ep", "eptitle", "when"].forEach(id => $(id).addEventListener("input", () => { refreshAll(); if (id === "ep") { loadCh(); renderCh(); } else buildDesc(); try { localStorage.setItem("seerah:" + id, $(id).value); } catch (e) { } }));
$("enh").onchange = () => { try { localStorage.setItem("seerah:enh", $("enh").checked ? "1" : "0"); } catch (e) { } };

function status(el, bar) { return (txt, p, err) => { $(el).parentElement.hidden = false; $(el).textContent = txt; $(el).className = "status" + (err ? " err" : ""); if (p != null) $(bar).style.width = (p * 100).toFixed(1) + "%"; }; }
const vStatus = status("status", "barfill"), tStatus = status("tstatus", "tbarfill");
function supported(st) { if ("VideoEncoder" in window && "AudioEncoder" in window) return true; st("Denne browser kan ikke lave video. Åbn siden i Chrome eller Edge på computer.", 0, true); return false; }

$("go").onclick = async () => {
  if (!state.file || !supported(vStatus)) return;
  $("go").disabled = true; $("dl").hidden = true; idle = false;
  try {
    await prepare(vStatus);
    const { chans, sr } = state.processed, { data, nfr } = state.analysis;
    refreshAll();
    state.videoBlob = await encodeVideo({
      w: 1920, h: 1080, nfr, chans, sr, len: chans[0].length,
      draw: (ctx, f) => frameV(ctx, data.subarray(f * N_HALF, (f + 1) * N_HALF), f / FPS),
      onProg: (p, eta, fps) => vStatus(`Laver video … ${fmt(p * nfr / FPS)} af ${fmt(nfr / FPS)} · ${Math.round(fps / FPS)}× hurtigere end afspilning · ca. ${fmt(eta)} tilbage`, 0.1 + 0.89 * p),
      preview: cv => vctx.drawImage(cv, 0, 0),
    });
    vStatus(`Færdig! ${(state.videoBlob.size / 1e6).toFixed(0)} MB · ${fmt(nfr / FPS)}` + (state.processed.lufs != null ? ` · lyd justeret ${state.processed.gainDb >= 0 ? "+" : ""}${state.processed.gainDb.toFixed(1)} dB` : ""), 1);
    $("dl").hidden = false;
  } catch (e) { console.error(e); vStatus("Fejl: " + (e.message || e), null, true); }
  finally { $("go").disabled = false; idle = true; it0 = performance.now(); idleLoop(); }
};
$("dl").onclick = () => state.videoBlob && saveFile(`Profetens_liv_${slug()}.mp4`, state.videoBlob);

/* før/efter-lyt: 15 sek. fra minut 1 (eller start) */
let abCtx = null, abSrc = null, abBufs = null;
$("ab").onclick = async () => {
  if (!state.file) return;
  $("ab").disabled = true; $("abtxt").textContent = "Forbereder prøve …";
  try {
    if (!abCtx) abCtx = new AudioContext({ sampleRate: 48000 });
    if (!state.decoded) state.decoded = await decodeFile(state.file);
    if (!abBufs) {
      const b = state.decoded, sr = b.sampleRate, st = Math.min(Math.floor(60 * sr), Math.max(0, b.length - 15 * sr)), n = Math.min(15 * sr, b.length - st);
      const seg = abCtx.createBuffer(Math.min(2, b.numberOfChannels), n, sr);
      for (let c = 0; c < seg.numberOfChannels; c++) seg.copyToChannel(b.getChannelData(c).subarray(st, st + n), c);
      // samme kæde på prøven, men med gain fra hele filen hvis kendt; ellers fra prøven
      const p1 = await enhancePass1(seg);
      const ch = Array.from({ length: p1.numberOfChannels }, (_, i) => p1.getChannelData(i));
      const gainDb = Math.max(-12, Math.min(14, -16 - measureLUFS(ch, sr)));
      const outC = gainAndLimit(ch, sr, gainDb), enh = abCtx.createBuffer(outC.length, n, sr);
      outC.forEach((d, i) => enh.copyToChannel(d, i));
      abBufs = { orig: seg, enh };
    }
    $("abwrap").hidden = false; $("abtxt").textContent = "Lyt og sammenlign (15 sek.)";
  } catch (e) { $("abtxt").textContent = "Kunne ikke lave prøven: " + e.message; }
  $("ab").disabled = false;
};
function playAB(which) {
  if (!abBufs) return;
  try { abSrc && abSrc.stop(); } catch (e) { }
  abCtx.resume();
  abSrc = abCtx.createBufferSource(); abSrc.buffer = abBufs[which]; abSrc.connect(abCtx.destination); abSrc.start();
  document.querySelectorAll(".abbtn").forEach(b => b.classList.toggle("on", b.dataset.w === which));
  abSrc.onended = () => document.querySelectorAll(".abbtn").forEach(b => b.classList.remove("on"));
}
document.querySelectorAll(".abbtn").forEach(b => b.onclick = () => b.dataset.w === "stop" ? (abSrc && abSrc.stop()) : playAB(b.dataset.w));

/* ================= UI: promo ================= */
const promos = [
  { id: "thumb", name: "YouTube-thumbnail", size: "1280×720", make: bgThumb },
  { id: "story", name: "Story / WhatsApp-status", size: "1080×1920", make: m => bgVertical(m, "story") },
  { id: "post", name: "Opslag (Instagram/Facebook)", size: "1080×1080", make: bgSquare },
];
function renderPromos() {
  const m = meta();
  for (const p of promos) {
    const c = p.make(m), tgt = $("pv-" + p.id);
    tgt.width = c.width; tgt.height = c.height; tgt.getContext("2d").drawImage(c, 0, 0);
  }
  drawTeaserPreview();
}
promos.forEach(p => $("dl-" + p.id).onclick = async () => saveFile(`Profetens_liv_${slug()}_${p.id}.png`, await canvasBlob($("pv-" + p.id))));

let bgT = null, PT = makeParticles(1080, 1920, 50), spT = null, archOverlay = null;
const AR = { x0: 96, x1: 984, y1: 1345, ys: 820, apex: 598 };
function archPath(ctx, inset = 0) {
  const { x0, x1, y1, ys, apex } = AR, c = (x0 + x1) / 2;
  ctx.beginPath(); ctx.moveTo(x0 + inset, y1 - inset); ctx.lineTo(x0 + inset, ys);
  ctx.bezierCurveTo(x0 + inset, ys - 150, c - 170, apex + 40 + inset, c, apex + inset);
  ctx.bezierCurveTo(c + 170, apex + 40 + inset, x1 - inset, ys - 150, x1 - inset, ys);
  ctx.lineTo(x1 - inset, y1 - inset); ctx.closePath();
}
function makeArchOverlay() {
  const c = mk(1080, 1920), x = c.getContext("2d");
  x.shadowColor = "rgba(255,200,90,0.6)"; x.shadowBlur = 18; x.strokeStyle = GOLD; x.lineWidth = 4; archPath(x, 0); x.stroke();
  x.shadowBlur = 0; x.strokeStyle = "rgba(212,175,55,0.5)"; x.lineWidth = 1.5; archPath(x, 12); x.stroke();
  x.fillStyle = GOLD; starPath(x, 540, AR.apex - 2, 14, 8, 0.5); x.fill();
  return c;
}
const sceneCanvas = mk(AR.x1 - AR.x0, AR.y1 - AR.apex), sctx = sceneCanvas.getContext("2d");
const prevCanvas = mk(AR.x1 - AR.x0, AR.y1 - AR.apex), pctx = prevCanvas.getContext("2d");
function selectedScenes() { const l = [...document.querySelectorAll("#scenes input:checked")].map(i => i.value); return l.length ? l : Object.keys(SCENES); }
function sceneAt(list, dur, t) { const d = Math.max(6, dur / list.length), i = Math.floor(t / d); return { key: list[i % list.length], prev: i ? list[(i - 1) % list.length] : null, lt: t - i * d, d }; }
function drawSceneArea(ctx, list, dur, t) {
  const W = sceneCanvas.width, H = sceneCanvas.height, sc = sceneAt(list, dur, t), TR = 0.5;
  SCENES[sc.key].draw(sctx, W, H, sc.lt);
  ctx.save(); archPath(ctx, 0); ctx.clip();
  if (sc.prev && sc.lt < TR) {
    SCENES[sc.prev].draw(pctx, W, H, sc.d + sc.lt);
    ctx.drawImage(prevCanvas, AR.x0, AR.apex);
    const R = easeIO(sc.lt / TR) * 760; ctx.save(); starIris(ctx, 540, AR.apex + H / 2, Math.max(1, R), sc.lt * 0.6); ctx.clip();
    ctx.drawImage(sceneCanvas, AR.x0, AR.apex); ctx.restore();
    ctx.save(); starIris(ctx, 540, AR.apex + H / 2, Math.max(1, R), sc.lt * 0.6); ctx.strokeStyle = GOLD2; ctx.lineWidth = 5; ctx.shadowColor = "rgba(255,210,120,0.9)"; ctx.shadowBlur = 20; ctx.stroke(); ctx.restore();
  } else ctx.drawImage(sceneCanvas, AR.x0, AR.apex);
  // blød indre vignette
  const g = ctx.createLinearGradient(0, AR.y1 - 160, 0, AR.y1); g.addColorStop(0, "rgba(6,20,16,0)"); g.addColorStop(1, "rgba(6,20,16,0.85)"); ctx.fillStyle = g; ctx.fillRect(AR.x0, AR.y1 - 160, AR.x1 - AR.x0, 160);
  ctx.restore();
  ctx.drawImage(archOverlay, 0, 0);
}
function drawTeaserPreview() {
  bgT = bgVertical(meta(), "teaser"); spT = makeSprite(8, 120); archOverlay = archOverlay || makeArchOverlay();
  if (typeof TP !== "undefined" && TP.clips.length) return previewAuto(TZ.intro + 1.5);
  const v = new Float32Array(N_HALF).map((_, i) => 0.2 + 0.6 * Math.abs(Math.sin(i * 0.7 + 1)) * (1 - i / N_HALF * .5));
  frameT($("pv-teaser").getContext("2d"), v, 3.2, ["masjid"], 6);
}
function frameT(ctx, vals, t, list, dur) {
  ctx.drawImage(bgT, 0, 0); particles(ctx, PT, 1080, 1920, t);
  drawSceneArea(ctx, list, dur, t);
  drawBars(ctx, spT, vals, 540, 1412, 8, 4, 120, 6);
}

/* rolig lydflade: blød "vind" (filtreret støj) + dyb, stille grundtone uden melodi. Dæmpes når der tales. */
function makePad(n, sr, speech, level) {
  const out = new Float32Array(n), r = rng(42);
  let brown = 0, lp = 0, lp2 = 0;
  const env = new Float32Array(n), win = Math.round(sr * 0.05);
  let acc = 0; const mono = speech[0], sq = i => mono[i] * mono[i];
  for (let i = 0; i < n; i++) { acc += sq(i); if (i >= win) acc -= sq(i - win); env[i] = Math.sqrt(Math.max(0, acc) / win); }
  const thr = 0.02; let duck = 0; const att = 1 - Math.exp(-1 / (0.08 * sr)), rel = 1 - Math.exp(-1 / (0.6 * sr));
  const f1 = 55, f2 = 82.5, f3 = 110;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    brown = (brown + (r() * 2 - 1) * 0.02) * 0.998;
    const cut = 0.012 + 0.008 * (0.5 + 0.5 * Math.sin(t * 0.21 * 6.283)) + 0.004 * Math.sin(t * 0.07 * 6.283);
    lp += (brown - lp) * cut; lp2 += (lp - lp2) * cut;
    const wind = lp2 * 6;
    const swell = 0.5 + 0.5 * Math.sin(t * 0.11 * 6.283 - 1.2);
    const drone = (Math.sin(6.283 * f1 * t) * 0.5 + Math.sin(6.283 * f2 * t) * 0.22 * swell + Math.sin(6.283 * f3 * t) * 0.12) * 0.06;
    const target = env[i] > thr ? 1 : 0; duck += (target - duck) * (target > duck ? att : rel);
    out[i] = (wind + drone) * level * (1 - 0.65 * duck);
  }
  return out;
}

const parseTime = s => { const p = String(s).trim().split(":").map(Number); return p.length === 2 ? p[0] * 60 + p[1] : (p[0] || 0); };

$("tgo").onclick = renderTeaser;
$("tana").onclick = analyseTeaser;
["tlen", "tcompose"].forEach(id => $(id).addEventListener("change", () => { if (TP.units.length) autoPick(); }));
["tanim", "tcap"].forEach(id => $(id).addEventListener("change", () => { if (TP.units.length) renderClips(); }));
$("npick").onchange = async e => { const f = e.target.files[0]; if (f) { $("nname").textContent = "Indlæser …"; try { await loadNasheedFromFile(f); $("bgmode").value = "nasheed"; } catch (err) { $("nname").textContent = "Kunne ikke læse filen"; } } };
$("nbtn").onclick = () => $("npick").click();
$("tdl").onclick = () => state.teaserBlob && saveFile(`Profetens_liv_${slug()}_teaser.mp4`, state.teaserBlob);


/* ================= UI: YouTube (beskrivelse + kapitler) ================= */
const DEFAULT_DESC = "Profetens liv – Islam i praksis er en lydserie om profeten Muhammeds ﷺ liv. Vi går gennem seerahen begivenhed for begivenhed og ser på de valg og beslutninger, han ﷺ traf – og hvad de betyder for, hvordan vi lever islam i dag.\n\nNy episode hver uge. Abonnér, så du ikke går glip af den næste.";
const DEFAULT_TAGS = "#ProfetensLiv #IslamIPraksis #Seerah #Sirah #Islam #Profeten";
let chapters = [];
const t2s = t => { t = Math.max(0, Math.floor(t)); const h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), s = t % 60; return (h ? h + ":" + String(m).padStart(2, "0") : m) + ":" + String(s).padStart(2, "0"); };
const s2t = str => { const p = String(str).trim().split(":").map(Number); if (p.some(isNaN)) return NaN; return p.reduce((a, v) => a * 60 + v, 0); };
function saveCh() { try { localStorage.setItem("seerah:ch:" + meta().ep, JSON.stringify(chapters)); } catch (e) { } }
function loadCh() { try { chapters = JSON.parse(localStorage.getItem("seerah:ch:" + meta().ep) || "[]"); } catch (e) { chapters = []; } }
function renderCh() {
  chapters.sort((a, b) => a.t - b.t);
  const box = $("chlist"); box.innerHTML = "";
  chapters.forEach((c, i) => {
    const row = document.createElement("div"); row.className = "chrow";
    row.innerHTML = `<input type="text" class="cht" value="${t2s(c.t)}" aria-label="Tid"><input type="text" class="chn" placeholder="Kapitlets navn" aria-label="Navn"><button class="ghost chx" title="Slet" aria-label="Slet kapitel">✕</button>`;
    row.querySelector(".chn").value = c.name || "";
    row.querySelector(".cht").onchange = e => { const v = s2t(e.target.value); if (!isNaN(v)) { c.t = v; saveCh(); renderCh(); } else e.target.value = t2s(c.t); };
    row.querySelector(".chn").oninput = e => { c.name = e.target.value; saveCh(); buildDesc(); };
    row.querySelector(".chx").onclick = () => { chapters.splice(i, 1); saveCh(); renderCh(); };
    row.querySelector(".cht").ondblclick = () => { const a = $("player"); a.currentTime = c.t; a.play(); };
    box.appendChild(row);
  });
  buildDesc();
}
function chapterWarnings() {
  const w = []; if (!chapters.length) return w;
  if (chapters[0].t !== 0) w.push("Første kapitel skal starte på 0:00 (tilføjes automatisk som \"Introduktion\").");
  const list = chapters[0].t === 0 ? chapters : [{ t: 0 }].concat(chapters);
  if (list.length < 3) w.push("YouTube kræver mindst 3 kapitler.");
  for (let i = 1; i < list.length; i++) if (list[i].t - list[i - 1].t < 10) w.push(`Kapitlet ved ${t2s(list[i].t)} ligger under 10 sek. efter det forrige – YouTube kræver mindst 10 sek.`);
  if (chapters.some(c => !String(c.name || "").trim())) w.push("Nogle kapitler mangler navn.");
  return w;
}
function buildDesc() {
  const m = meta(), title = `${SERIES} | Episode ${m.ep}${m.title ? ": " + m.title : ""}`;
  $("yttitle").value = title;
  let out = (m.title ? `Episode ${m.ep}: ${m.title}\n\n` : "") + ($("ytdesc").value.trim() || DEFAULT_DESC);
  if (chapters.length) {
    const list = chapters[0].t === 0 ? chapters : [{ t: 0, name: "Introduktion" }].concat(chapters);
    out += "\n\nKapitler:\n" + list.map(c => `${t2s(c.t)} ${String(c.name || "").trim() || "…"}`).join("\n");
  }
  out += "\n\n" + ($("yttags").value.trim() || DEFAULT_TAGS);
  $("ytout").value = out;
  const w = chapterWarnings(); $("chwarn").innerHTML = w.map(x => `<li>${x}</li>`).join(""); $("chwarn").hidden = !w.length;
}
$("chadd").onclick = () => { const a = $("player"); chapters.push({ t: Math.floor(a.currentTime || 0), name: "" }); saveCh(); renderCh(); const rows = document.querySelectorAll(".chrow"); const tt = Math.floor(a.currentTime || 0); [...rows].find(r => r.querySelector(".cht").value === t2s(tt))?.querySelector(".chn").focus(); };
$("chback").onclick = () => { const a = $("player"); a.currentTime = Math.max(0, a.currentTime - 10); };
$("chfwd").onclick = () => { const a = $("player"); a.currentTime = a.currentTime + 30; };
["ytdesc", "yttags"].forEach(id => $(id).addEventListener("input", () => { try { localStorage.setItem("seerah:" + id, $(id).value); } catch (e) { } buildDesc(); }));
async function copy(id, btn) {
  const v = $(id).value; let ok = false;
  try { await navigator.clipboard.writeText(v); ok = true; } catch (e) { $(id).select(); try { ok = document.execCommand("copy"); } catch (e2) { } }
  const o = btn.textContent; btn.textContent = ok ? "Kopieret ✓" : "Markér og kopiér selv"; setTimeout(() => btn.textContent = o, 1600);
}
$("cpout").onclick = e => copy("ytout", e.target); $("cptitle").onclick = e => copy("yttitle", e.target);

/* faner (hash) */
function showTab() {
  const t = ["#promo", "#youtube"].includes(location.hash) ? location.hash.slice(1) : "video";
  document.querySelectorAll(".tab").forEach(b => b.classList.toggle("on", b.dataset.t === t));
  document.querySelectorAll(".pane").forEach(p => p.hidden = p.id !== "pane-" + t);
}
window.addEventListener("hashchange", showTab);

/* start */
try { for (const id of ["eptitle", "when", "ytdesc", "yttags"]) { const v = localStorage.getItem("seerah:" + id); if (v) $(id).value = v; } const e = localStorage.getItem("seerah:enh"); if (e) $("enh").checked = e === "1"; } catch (e) { }
if (!$("ytdesc").value) $("ytdesc").value = DEFAULT_DESC; if (!$("yttags").value) $("yttags").value = DEFAULT_TAGS;
restoreNasheed();
showTab(); loadCh(); renderCh();
document.fonts.ready.then(() => Promise.all([
  document.fonts.load("700 112px Amiri", TITLE_AR + "ﷺ"), document.fonts.load("600 26px Cinzel"),
  document.fonts.load("700 46px Cinzel"), document.fonts.load("600 66px 'Cormorant Garamond'"), document.fonts.load("700 66px 'Cormorant Garamond'")
])).then(() => { refreshAll(); idleLoop(); });
