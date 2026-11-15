/* Automatisk teaser: talegenkendelse (whisper-small i browseren) → udvælgelse af stærke sætninger →
   klip til præcis 30/45/60 sek. → scene KUN når emnet passer, ellers skrivemaskine-tekst → nasheed under talen. */

const TZ = { intro: 1.4, outro: 2.6, gap: 0.35 };

/* ---------- IndexedDB (gemmer nasheed og transskriptioner lokalt) ---------- */
function idb() { return new Promise((res, rej) => { const r = indexedDB.open("seerah", 1); r.onupgradeneeded = () => r.result.createObjectStore("kv"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
async function idbGet(k) { try { const db = await idb(); return await new Promise(r => { const q = db.transaction("kv").objectStore("kv").get(k); q.onsuccess = () => r(q.result); q.onerror = () => r(null); }); } catch (e) { return null; } }
async function idbSet(k, v) { try { const db = await idb(); await new Promise(r => { const t = db.transaction("kv", "readwrite"); t.objectStore("kv").put(v, k); t.oncomplete = r; t.onerror = r; }); } catch (e) { } }

/* ---------- talegenkendelse ---------- */
const ASR_WORKER = `
import { pipeline, env } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.2";
env.allowLocalModels = false;
let asr = null;
self.onmessage = async (e) => {
  const m = e.data;
  try {
    if (m.type === "load") {
      asr = await pipeline("automatic-speech-recognition", "onnx-community/whisper-small", {
        device: m.webgpu ? "webgpu" : "wasm",
        dtype: m.webgpu ? { encoder_model: "fp32", decoder_model_merged: "q4" } : "q8",
        progress_callback: p => { if (p.status === "progress") self.postMessage({ type: "dl", file: p.file, loaded: p.loaded, total: p.total }); }
      });
      self.postMessage({ type: "ready" });
    } else if (m.type === "run") {
      const out = await asr(m.audio, { language: "danish", task: "transcribe", return_timestamps: true, no_repeat_ngram_size: 4 });
      self.postMessage({ type: "done", chunks: out.chunks || [{ timestamp: [0, m.audio.length / 16000], text: out.text || "" }] });
    }
  } catch (err) { self.postMessage({ type: "error", message: String((err && err.message) || err) }); }
};`;
let asrWorker = null, asrReady = null;
async function hasWebGPU() { try { return !!(navigator.gpu && await navigator.gpu.requestAdapter()); } catch (e) { return false; } }
function asrCall(msg, onDl) {
  return new Promise((res, rej) => {
    const h = e => {
      const d = e.data;
      if (d.type === "dl") { onDl && onDl(d); return; }
      asrWorker.removeEventListener("message", h);
      d.type === "error" ? rej(new Error(d.message)) : res(d);
    };
    asrWorker.addEventListener("message", h);
    asrWorker.postMessage(msg, msg.audio ? [msg.audio.buffer] : []);
  });
}
async function ensureASR(webgpu, st) {
  if (asrReady) return asrReady;
  asrWorker = new Worker(URL.createObjectURL(new Blob([ASR_WORKER], { type: "text/javascript" })), { type: "module" });
  const files = {};
  asrReady = asrCall({ type: "load", webgpu }, d => {
    files[d.file] = [d.loaded || 0, d.total || 0];
    let a = 0, b = 0; for (const k in files) { a += files[k][0]; b += files[k][1]; }
    st(`Henter talemodel (kun første gang) … ${(a / 1e6).toFixed(0)} / ${(b / 1e6).toFixed(0)} MB`, b ? 0.02 + 0.18 * a / b : 0.02);
  }).catch(e => { asrReady = null; throw e; });
  return asrReady;
}
async function to16k(chans, sr) {
  const len = chans[0].length, n = Math.ceil(len * 16000 / sr);
  const src = new AudioBuffer({ length: len, numberOfChannels: 1, sampleRate: sr });
  const mono = new Float32Array(len); for (const c of chans) for (let i = 0; i < len; i++) mono[i] += c[i] / chans.length;
  src.copyToChannel(mono, 0);
  const oc = new OfflineAudioContext(1, n, 16000), s = oc.createBufferSource(); s.buffer = src; s.connect(oc.destination); s.start();
  return (await oc.startRendering()).getChannelData(0);
}
// vinduer på ≤28 s, skåret i den mest stille 10-ms-blok mellem 18 og 28 s
function windows16k(a, from, to) {
  const out = [], blk = 160; let s = from;
  while (s < to - 16000) {
    let e = Math.min(to, s + 28 * 16000);
    if (e < to) {
      let best = e, bv = Infinity;
      for (let p = s + 18 * 16000; p + blk < e; p += blk) { let v = 0; for (let i = p; i < p + blk; i++) v += a[i] * a[i]; if (v < bv) { bv = v; best = p + blk / 2; } }
      e = Math.round(best);
    }
    out.push([s, e]); s = e;
  }
  return out;
}
function cleanText(t) {
  return t.replace(/\s+/g, " ").trim()
    .replace(/\bProphet\b/gi, "Profeten")
    .replace(/\bMuhammad(?:\s+(?:al|el|as|sal|salla|sallallahu|alayhi|alaihi|wa|wasallam|sallam|salam|salaam|aziz)[\w'’-]*)+/gi, "Muhammad ﷺ")
    .replace(/\bProfeten(?:\s+(?:sal|salla|sallallahu|alayhi|alaihi|wa|sallam|salam)[\w'’-]*)+/gi, "Profeten ﷺ");
}
function repetitive(t) { const w = t.toLowerCase().split(/\s+/).filter(Boolean); if (w.length < 8) return false; return new Set(w).size / w.length < 0.45; }

async function transcribe(full, st) {
  const { chans, sr } = state.processed;
  const key = "tx:" + state.file.name + ":" + state.file.size + ":" + (full ? "full" : "quick");
  const cached = await idbGet(key); if (cached) return cached;
  const webgpu = await hasWebGPU();
  await ensureASR(webgpu, st);
  st("Forbereder lyd til talegenkendelse …", 0.2);
  const a = await to16k(chans, sr), L = a.length;
  // hurtig: de første 2 min + 6 jævnt fordelte stykker á 50 s
  let regions = [[0, L]];
  if (!full && L > 16000 * 240) {
    regions = [[0, 120 * 16000]];
    const rest = L - 150 * 16000; for (let k = 0; k < 6; k++) { const c = 150 * 16000 + Math.round(rest * (k + 0.5) / 6); regions.push([c - 25 * 16000, Math.min(L, c + 25 * 16000)]); }
  }
  const wins = regions.flatMap(([f, t]) => windows16k(a, f, t));
  const total = wins.reduce((s, [x, y]) => s + y - x, 0); let done = 0; const t0 = performance.now();
  const segs = [];
  for (const [s, e] of wins) {
    const d = await asrCall({ type: "run", audio: a.slice(s, e) });
    for (const c of d.chunks) {
      const cs = s / 16000 + (c.timestamp[0] ?? 0), ce = s / 16000 + (c.timestamp[1] ?? (e - s) / 16000);
      const text = cleanText(c.text || ""); if (!text || repetitive(text) || ce - cs < 0.4) continue;
      segs.push({ s: cs, e: Math.min(ce, e / 16000), text });
    }
    done += e - s; const el = (performance.now() - t0) / 1000;
    st(`Lytter til episoden (${webgpu ? "grafikkort" : "processor"}) … ${Math.round(100 * done / total)} % · ca. ${fmt(el / done * (total - done))} tilbage`, 0.2 + 0.75 * done / total);
  }
  await idbSet(key, segs);
  return segs;
}

/* ---------- emner → scener (kun ved sikkert match) ---------- */
const SCENE_WORDS = {
  kaaba: ["kaaba", "ka'ba", "kaba", "makkah", "mekka", "mekkah", "makka", "haram", "tawaf", "hajj", "umrah", "umra", "zamzam", "quraysh", "quraish", "qurays", "qurash", "kuraish", "ibrahim", "abraham", "hjerte af arabien"],
  rejse: ["hijra", "hijrah", "hidjra", "udvandr", "rejse", "rejste", "rejsen", "karavane", "handelsrejse", "madinah", "medina", "madina", "yathrib", "syrien", "sham", "ørken", "kamel", "flugt", "flygte", "migr"],
  masjid: ["moské", "moskéen", "moske", "masjid", "bøn", "bønnen", "salah", "salat", "bede", "beder", "imam", "fredagsbøn", "adhan", "quba", "sajda", "nedfaldt"],
  halaqa: ["ummah", "umma", "muslimer i dag", "i dag", "unge", "fællesskab", "familie", "forældre", "børn", "undervis", "lære", "lærer", "halaqa", "nation", "samfund", "vi lever", "vores tid"],
  bog: ["koran", "qur'an", "quran", "åbenbar", "vers", "ayah", "āyah", "sura", "surah", "hadith", "bog", "bøger", "læs", "iqra", "lærde", "kilde", "historie", "seerah", "sirah", "viden"],
};
const HOOK_WORDS = ["tænk", "forestil", "hvorfor", "hvad hvis", "aldrig", "altid", "bedste", "vigtigste", "første", "sandhed", "allah", "profeten", "ﷺ", "hjerte", "liv", "døde", "kærlighed", "spørgsmål", "hemmelig", "ingen", "alle"];
const norm = t => " " + t.toLowerCase().replace(/[.,!?;:«»"()]/g, " ") + " ";
function countWords(text, list) { const n = norm(text); let c = 0; for (const w of list) { const i = n.indexOf(w.includes(" ") ? " " + w : " " + w); if (i >= 0) c++; } return c; }
function resolveScene(text) {
  let best = null, bs = 0;
  for (const k in SCENE_WORDS) { const c = countWords(text, SCENE_WORDS[k]); if (c > bs) { bs = c; best = k; } }
  return bs >= 1 ? best : "text";
}

/* ---------- sætninger → enheder → udvalg ---------- */
function buildUnits(segs) {
  const units = []; let cur = null;
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i];
    if (!cur) cur = { s: s.s, e: s.e, text: s.text, segs: [s], pauseBefore: i ? s.s - segs[i - 1].e : 1 };
    else { cur.e = s.e; cur.text += " " + s.text; cur.segs.push(s); }
    const dur = cur.e - cur.s, ends = /[.?!]$/.test(s.text.trim()), next = segs[i + 1], jump = next && next.s - s.e > 2;
    if ((ends && dur >= 3) || dur >= 14 || !next || jump) { units.push(cur); cur = null; }
  }
  for (const u of units) {
    const w = u.text.split(/\s+/).length, d = Math.max(1, u.e - u.s);
    u.score = 1 + 0.6 * countWords(u.text, HOOK_WORDS) + 0.5 * (u.text.includes("?") ? 1 : 0) + 0.35 * Math.max(...Object.values(SCENE_WORDS).map(l => Math.min(2, countWords(u.text, l))))
      + 0.15 * Math.min(w / d, 3.5) + (u.pauseBefore > 0.3 ? 0.3 : 0) - (d < 3 ? 1 : 0);
  }
  return units;
}
function selectUnits(units, target, mode) {
  const budget = target - TZ.intro - TZ.outro;
  if (mode === "one") {
    let best = null, bv = -1;
    for (let i = 0; i < units.length; i++) {
      let sum = 0, len = 0;
      for (let j = i; j < units.length; j++) {
        if (j > i && units[j].s - units[j - 1].e > 1.5) break;
        len = units[j].e - units[i].s; if (len > budget) break;
        sum += units[j].score; const v = sum + len * 0.05;
        if (v > bv) { bv = v; best = [i, j]; }
      }
    }
    return best ? units.slice(best[0], best[1] + 1) : [];
  }
  const order = units.map((u, i) => [u.score / Math.pow(Math.max(2, u.e - u.s), 0.25), i]).sort((a, b) => b[0] - a[0]);
  const pick = new Set(); let used = 0;
  for (const [, i] of order) {
    const d = units[i].e - units[i].s; if (d > budget * 0.6) continue;
    const extra = d + (pick.size ? TZ.gap : 0);
    if (used + extra <= budget) { pick.add(i); used += extra; }
    if (budget - used < 3) break;
  }
  return [...pick].sort((a, b) => a - b).map(i => units[i]);
}

/* ---------- plan: placering på teaserens tidslinje ---------- */
let TP = { segs: null, units: [], clips: [], target: 60 };
function layout(clips, target) {
  let t = TZ.intro;
  clips.forEach((c, k) => {
    const contiguous = k && c.s - clips[k - 1].e < 0.6;
    if (k && !contiguous) t += TZ.gap;
    c.t0 = t; c.src0 = contiguous ? clips[k - 1].e : c.s; c.t0 = contiguous ? clips[k - 1].t1 : t; c.t1 = c.t0 + (c.e - c.src0); t = c.t1;
  });
  return { speechEnd: t, total: target, fits: t <= target - TZ.outro + 0.05 };
}
function clipVisual(c) { return c.scene === "auto" ? (TP.anim === "text" ? "text" : resolveScene(c.text)) : c.scene; }

/* ---------- tegning: skrivemaskine-tekst i buen ---------- */
function wrapLines(ctx, text, maxW) {
  const words = text.split(/\s+/), lines = []; let line = "";
  for (const w of words) { const t = line ? line + " " + w : w; if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; }
  if (line) lines.push(line); return lines;
}
function typewriter(ctx, W, H, text, frac, t, opts = {}) {
  const size = opts.size || 56, lh = size * 1.28, maxW = W - 150;
  ctx.save(); ctx.font = `600 ${size}px 'Cormorant Garamond', Amiri`; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  frac = Math.max(0, Math.min(1, frac)); const shown = text.slice(0, Math.floor(text.length * frac));
  const lines = wrapLines(ctx, shown || " ", maxW), maxLines = opts.maxLines || Math.floor((H - 200) / lh);
  const vis = lines.slice(-maxLines), y0 = (opts.cy || H * 0.5) - (vis.length - 1) * lh / 2;
  vis.forEach((l, i) => {
    ctx.globalAlpha = i < vis.length - 2 ? 0.55 : 1; ctx.fillStyle = opts.col || CREAM;
    ctx.shadowColor = "rgba(0,0,0,0.6)"; ctx.shadowBlur = 10; ctx.fillText(l, W / 2, y0 + i * lh);
  });
  if (frac < 1 && Math.floor(t * 2.2) % 2 === 0) { const last = vis[vis.length - 1] || "", w = ctx.measureText(last).width; ctx.globalAlpha = 1; ctx.fillStyle = GOLD; ctx.fillRect(W / 2 + w / 2 + 6, y0 + (vis.length - 1) * lh - size * 0.42, 4, size * 0.8); }
  ctx.restore();
}
function textScene(ctx, W, H, t, text, frac) {
  sky(ctx, W, H, t, 31);
  ctx.save(); ctx.globalAlpha = 0.35; rosette(ctx, W / 2, H * 0.52, W * 0.36); ctx.restore();
  ctx.save(); ctx.font = "700 60px Amiri"; ctx.fillStyle = GOLD; ctx.globalAlpha = 0.85; ctx.textAlign = "center"; ctx.fillText("❝", W / 2, 120); ctx.restore();
  typewriter(ctx, W, H, text, frac, t, { size: 54, cy: H * 0.55 });
}
function outroScene(ctx, W, H, t) {
  sky(ctx, W, H, t, 37);
  const m = meta(), a = easeOut(t / 0.6);
  ctx.save(); ctx.globalAlpha = a; ctx.font = "600 34px Cinzel"; ctx.fillStyle = GOLD2; drawSpaced(ctx, "SE HELE EPISODEN", W / 2, H * 0.38, 10);
  ctx.font = "700 76px Cinzel"; ctx.fillStyle = GOLD; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.shadowColor = "rgba(255,200,90,.6)"; ctx.shadowBlur = 24; ctx.fillText("PÅ YOUTUBE", W / 2, H * 0.49); ctx.restore();
  if (m.when) typewriter(ctx, W, H, m.when, (t - 0.4) / 1.2, t, { size: 44, cy: H * 0.64, maxLines: 2 });
}

/* ---------- tidslinje → billede ---------- */
function visualAt(tau) {
  const cl = TP.clips;
  if (!cl.length) return { kind: "outro", lt: tau, start: 0 };
  if (tau >= TP.total - TZ.outro) return { kind: "outro", lt: tau - (TP.total - TZ.outro), start: TP.total - TZ.outro, key: "outro" };
  let k = 0; while (k < cl.length - 1 && tau >= cl[k + 1].t0 - (cl[k + 1].t0 - cl[k].t1)) k++;
  // gruppér nabo-klip med samme scene, så animationen ikke starter forfra
  const v = clipVisual(cl[k]); let g = k; while (g > 0 && clipVisual(cl[g - 1]) === v && v !== "text") g--;
  const start = g === 0 ? 0 : cl[g - 1].t1;
  return { kind: v, k, lt: tau - start, start, key: v === "text" ? "text" + k : v };
}
function drawVisual(ctx, W, H, vis, tau) {
  if (vis.kind === "outro") return outroScene(ctx, W, H, vis.lt);
  const c = TP.clips[vis.k];
  const frac = (tau - c.t0) / Math.max(0.5, (c.t1 - c.t0) * 0.92);
  if (vis.kind === "text") return textScene(ctx, W, H, vis.lt, c.text, frac);
  SCENES[vis.kind].draw(ctx, W, H, vis.lt);
  if (TP.captions) { // undertekst nederst i buen
    const g = ctx.createLinearGradient(0, H - 300, 0, H); g.addColorStop(0, "rgba(6,14,24,0)"); g.addColorStop(1, "rgba(6,14,24,0.9)"); ctx.fillStyle = g; ctx.fillRect(0, H - 300, W, 300);
    typewriter(ctx, W, H, c.text, frac, tau, { size: 40, cy: H - 120, maxLines: 2 });
  }
}
function frameAuto(ctx, tau, data) {
  ctx.drawImage(bgT, 0, 0); particles(ctx, PT, 1080, 1920, tau);
  const W = sceneCanvas.width, H = sceneCanvas.height, TR = 0.5;
  const cur = visualAt(tau), prevTau = cur.start - 0.001, prev = cur.start > 0 ? visualAt(prevTau) : null;
  drawVisual(sctx, W, H, cur, tau);
  ctx.save(); archPath(ctx, 0); ctx.clip();
  const since = tau - cur.start;
  if (prev && prev.key !== cur.key && since < 0.4 && prev.kind === "text" && cur.kind === "text") {
    drawVisual(pctx, W, H, { ...prev, lt: prev.lt + since }, tau);
    ctx.drawImage(prevCanvas, AR.x0, AR.apex); ctx.globalAlpha = easeIO(since / 0.4); ctx.drawImage(sceneCanvas, AR.x0, AR.apex); ctx.globalAlpha = 1;
  } else if (prev && prev.key !== cur.key && since < TR) {
    drawVisual(pctx, W, H, { ...prev, lt: prev.lt + since }, tau);
    ctx.drawImage(prevCanvas, AR.x0, AR.apex);
    const R = Math.max(1, easeIO(since / TR) * 760);
    ctx.save(); starIris(ctx, 540, AR.apex + H / 2, R, since * 0.6); ctx.clip(); ctx.drawImage(sceneCanvas, AR.x0, AR.apex); ctx.restore();
    ctx.save(); starIris(ctx, 540, AR.apex + H / 2, R, since * 0.6); ctx.strokeStyle = GOLD2; ctx.lineWidth = 5; ctx.shadowColor = "rgba(255,210,120,0.9)"; ctx.shadowBlur = 20; ctx.stroke(); ctx.restore();
  } else ctx.drawImage(sceneCanvas, AR.x0, AR.apex);
  const g = ctx.createLinearGradient(0, AR.y1 - 120, 0, AR.y1); g.addColorStop(0, "rgba(6,20,16,0)"); g.addColorStop(1, "rgba(6,20,16,0.7)"); ctx.fillStyle = g; ctx.fillRect(AR.x0, AR.y1 - 120, AR.x1 - AR.x0, 120);
  ctx.restore(); ctx.drawImage(archOverlay, 0, 0);
  // lydsøjler: følger kun talen
  let vals = ZERO;
  const c = TP.clips.find(c => tau >= c.t0 && tau < c.t1);
  if (c && data) { const f = Math.floor((c.src0 + tau - c.t0) * FPS); vals = data.subarray(f * N_HALF, (f + 1) * N_HALF); if (vals.length < N_HALF) vals = ZERO; }
  drawBars(ctx, spT, vals, 540, 1412, 8, 4, 120, 6);
}
const ZERO = new Float32Array(N_HALF);

/* ---------- lyd: klip + nasheed ---------- */
let nasheed = null; // {chans, sr, name}
async function loadNasheedFromFile(file) {
  const buf = await decodeFile(file);
  nasheed = { chans: Array.from({ length: Math.min(2, buf.numberOfChannels) }, (_, i) => buf.getChannelData(i).slice()), sr: buf.sampleRate, name: file.name };
  await idbSet("nasheed", { name: file.name, data: await file.arrayBuffer() });
  showNasheed();
}
async function restoreNasheed() {
  const v = await idbGet("nasheed"); if (!v) return showNasheed();
  try { const buf = await decodeFile(new Blob([v.data])); nasheed = { chans: Array.from({ length: Math.min(2, buf.numberOfChannels) }, (_, i) => buf.getChannelData(i).slice()), sr: buf.sampleRate, name: v.name }; } catch (e) { }
  showNasheed();
}
function showNasheed() { $("nname").textContent = nasheed ? "♪ " + nasheed.name.replace(/\.[^.]+$/, "").slice(0, 70) : "Ingen nasheed valgt – upload en (gemmes i browseren)"; }
function rms(a, from = 0, to = a.length) { let s = 0, n = 0; for (let i = from; i < to; i += 4) { s += a[i] * a[i]; n++; } return Math.sqrt(s / Math.max(1, n)); }

function buildTeaserAudio(sr, chOut) {
  const N = Math.round(TP.total * sr), src = state.processed.chans, out = Array.from({ length: chOut }, () => new Float32Array(N));
  const fade = Math.round(sr * 0.015);
  for (const c of TP.clips) {
    const a = Math.round(c.src0 * sr), b = Math.round(c.e * sr), o = Math.round(c.t0 * sr), n = Math.min(b - a, N - o);
    for (let ch = 0; ch < chOut; ch++) {
      const s = src[Math.min(ch, src.length - 1)];
      for (let i = 0; i < n; i++) { const g = Math.min(1, i / fade, (n - i) / fade); out[ch][o + i] += s[a + i] * g; }
    }
  }
  const mode = $("bgmode").value, vol = +$("padvol").value / 100;
  if (mode === "none") return out;
  // tale-konvolut til automatisk dæmpning
  const env = new Float32Array(N), win = Math.round(sr * 0.05); let acc = 0; const m = out[0];
  for (let i = 0; i < N; i++) { acc += m[i] * m[i]; if (i >= win) acc -= m[i - win] * m[i - win]; env[i] = Math.sqrt(Math.max(0, acc) / win); }
  const speechRms = rms(m) || 0.05;
  let bed;
  if (mode === "nasheed" && nasheed) {
    const nc = nasheed.chans, L = nc[0].length, xf = Math.round(sr * 1.5), step = L - xf;
    bed = Array.from({ length: chOut }, () => new Float32Array(N));
    const ratio = nasheed.sr / sr;
    for (let ch = 0; ch < chOut; ch++) {
      const s = nc[Math.min(ch, nc.length - 1)];
      for (let i = 0; i < N; i++) {
        const p = i * ratio, loop = Math.floor(p / step), pos = p - loop * step, idx = Math.floor(pos);
        let v = s[idx] || 0;
        if (loop > 0 && pos < xf) { const prevIdx = Math.floor(pos + step); const w = pos / xf; v = v * w + (s[prevIdx] || 0) * (1 - w); }
        bed[ch][i] = v;
      }
    }
    const k = (speechRms * Math.pow(10, -14 / 20)) / (rms(bed[0]) || 0.05);
    for (const b of bed) for (let i = 0; i < N; i++) b[i] *= k;
  } else {
    const pad = makePad(N, sr, [new Float32Array(N)], 1);
    const k = (speechRms * Math.pow(10, -16 / 20)) / (rms(pad) || 0.05);
    bed = Array.from({ length: chOut }, () => pad.map(v => v * k));
  }
  const thr = speechRms * 0.25, att = 1 - Math.exp(-1 / (0.06 * sr)), rel = 1 - Math.exp(-1 / (0.5 * sr));
  const fin = Math.round(sr * 0.8), fout = Math.round(sr * 1.6);
  let duck = 0;
  for (let i = 0; i < N; i++) {
    const tg = env[i] > thr ? 1 : 0; duck += (tg - duck) * (tg > duck ? att : rel);
    const g = vol * 2 * (1 - 0.6 * duck) * Math.min(1, i / fin, (N - i) / fout);
    for (let ch = 0; ch < chOut; ch++) out[ch][i] += bed[ch][i] * g;
  }
  return gainAndLimit(out, sr, 0);
}

/* ---------- UI ---------- */
function tUI(txt, p, err) { tStatus(txt, p, err); }
async function analyseTeaser() {
  if (!state.file || !supported(tStatus)) return;
  $("tana").disabled = true; $("tgo").disabled = true; $("tdl").hidden = true;
  try {
    await prepare(tUI);
    const full = $("tmode").value === "full";
    TP.segs = await transcribe(full, tUI);
    if (!TP.segs.length) throw new Error("Kunne ikke genkende tale i filen.");
    TP.units = buildUnits(TP.segs);
    autoPick();
    tUI(`Klar: ${TP.segs.length} sætninger genkendt. Gennemse klippene herunder og ret teksten, hvis noget er hørt forkert.`, 1);
  } catch (e) { console.error(e); tUI("Fejl: " + (e.message || e), null, true); }
  finally { $("tana").disabled = false; }
}
function autoPick() {
  TP.target = +$("tlen").value;
  const sel = selectUnits(TP.units, TP.target, $("tcompose").value);
  TP.clips = sel.map(u => ({ s: u.s, e: u.e, text: u.text, scene: "auto", unit: u }));
  renderClips();
}
const SCENE_OPTS = [["auto", "Automatisk"], ["text", "Kun tekst"], ...Object.entries(SCENES).map(([k, v]) => [k, v.name])];
function renderClips() {
  TP.clips.sort((a, b) => a.s - b.s);
  TP.total = +$("tlen").value; TP.anim = $("tanim").value; TP.captions = $("tcap").checked;
  const L = layout(TP.clips, TP.total);
  const box = $("clips"); box.innerHTML = "";
  TP.clips.forEach((c, i) => {
    const el = document.createElement("div"); el.className = "clip";
    const vis = clipVisual(c), vname = vis === "text" ? "skrivemaskine-tekst" : SCENES[vis].name;
    el.innerHTML = `<div class="clip-h"><span class="clip-t">${fmt(c.s)}–${fmt(c.e)} · ${(c.e - c.s).toFixed(1)} s</span>
      <select aria-label="Visning">${SCENE_OPTS.map(([k, n]) => `<option value="${k}"${k === c.scene ? " selected" : ""}>${n}</option>`).join("")}</select>
      <button class="ghost cplay" title="Lyt">▶</button><button class="ghost cdel" title="Fjern">✕</button></div>
      <textarea rows="2" aria-label="Tekst"></textarea><div class="hint">Vises som: <b>${vname}</b>${c.scene === "auto" && vis === "text" ? " (intet sikkert emne-match)" : ""}</div>`;
    el.querySelector("textarea").value = c.text;
    el.querySelector("textarea").oninput = e => { c.text = e.target.value; };
    el.querySelector("textarea").onchange = () => renderClips();
    el.querySelector("select").onchange = e => { c.scene = e.target.value; renderClips(); };
    el.querySelector(".cdel").onclick = () => { TP.clips.splice(i, 1); renderClips(); };
    el.querySelector(".cplay").onclick = () => { const a = $("player"); a.currentTime = c.s; a.play(); clearTimeout(a._stop); a._stop = setTimeout(() => a.pause(), (c.e - c.s) * 1000); };
    box.appendChild(el);
  });
  const used = L.speechEnd - TZ.intro, budget = TP.total - TZ.intro - TZ.outro;
  $("tsum").innerHTML = TP.clips.length ? `Tale: <b>${used.toFixed(1)} s</b> af ${budget.toFixed(1)} s · intro ${TZ.intro} s + outro ${TZ.outro} s` + (L.fits ? "" : ` · <span class="err">for langt – fjern et klip</span>`) : "";
  // flere forslag
  const taken = new Set(TP.clips.map(c => c.unit));
  const more = TP.units.filter(u => !taken.has(u) && u.e - u.s <= budget).sort((a, b) => b.score - a.score).slice(0, 8);
  const mb = $("more"); mb.innerHTML = more.length ? "<div class='hint' style='margin:10px 0 4px'>Flere forslag:</div>" : "";
  for (const u of more) {
    const r = document.createElement("div"); r.className = "more";
    r.innerHTML = `<button class="ghost madd">＋</button><span class="clip-t">${fmt(u.s)} · ${(u.e - u.s).toFixed(0)} s</span><span class="mtext"></span>`;
    r.querySelector(".mtext").textContent = u.text;
    r.querySelector(".madd").onclick = () => { TP.clips.push({ s: u.s, e: u.e, text: u.text, scene: "auto", unit: u }); renderClips(); };
    mb.appendChild(r);
  }
  $("tgo").disabled = !TP.clips.length || !L.fits;
  $("clipwrap").hidden = !TP.units.length;
  if (TP.clips.length) previewAuto(TZ.intro + 1.5);
}
function previewAuto(tau) {
  bgT = bgVertical(meta(), "teaser"); spT = makeSprite(8, 120); archOverlay = archOverlay || makeArchOverlay();
  frameAuto($("pv-teaser").getContext("2d"), tau, state.analysis && state.analysis.data);
}
async function renderTeaser() {
  if (!TP.clips.length) return;
  $("tgo").disabled = true; $("tdl").hidden = true;
  try {
    await prepare(tUI);
    renderClips();
    const { sr } = state.processed, ch = Math.min(2, state.processed.chans.length);
    tUI("Sætter lyd og nasheed sammen …", 0.05);
    await yieldUI();
    const mix = buildTeaserAudio(sr, ch);
    const nfr = Math.round(TP.total * FPS), data = state.analysis.data;
    bgT = bgVertical(meta(), "teaser"); spT = makeSprite(8, 120); archOverlay = archOverlay || makeArchOverlay();
    state.teaserBlob = await encodeVideo({
      w: 1080, h: 1920, nfr, chans: mix, sr, start: 0, len: mix[0].length, fade: false,
      draw: (ctx, f) => frameAuto(ctx, f / FPS, data),
      onProg: p => tUI(`Laver teaser … ${Math.round(p * 100)} %`, 0.1 + 0.89 * p),
      preview: cv => $("pv-teaser").getContext("2d").drawImage(cv, 0, 0),
    });
    tUI(`Færdig! ${(state.teaserBlob.size / 1e6).toFixed(1)} MB · ${TP.total} sek. · ${TP.clips.length} klip`, 1);
    $("tdl").hidden = false;
  } catch (e) { console.error(e); tUI("Fejl: " + (e.message || e), null, true); }
  finally { $("tgo").disabled = false; }
}
