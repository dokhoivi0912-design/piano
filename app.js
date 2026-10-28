/* global KEYMAP, SONG, noteToFreq, noteToMidi, midiToNote, fitToKeys, songEvents, practiceSteps, matchKey, solfege */
const $ = (id) => document.getElementById(id);
const CODE_OF = Object.fromEntries(Object.entries(KEYMAP).map(([code, n]) => [n, code]));
const PUNCT = { Semicolon: ';', Quote: "'" };
const label = (code) => PUNCT[code] || code.replace(/^Key/, '');
const keyOf = (n) => label(CODE_OF[n]);
let keyEls = {};

// 'keys' = computer keyboard (right hand only, folded into G4..C6), 'midi' = external MIDI keyboard (real pitch, any octave)
let input = 'keys', hand = 'R'; // hand practised on MIDI: 'R' | 'L' | 'RL'
let level = 'easy', pattern = 'block'; // version of the song and left-hand pattern (easy only)
const saved = (k, ok) => { try { const v = localStorage.getItem(k); return ok.includes(v) ? v : null; } catch { return null; } };
const save = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
input = saved('input', ['keys', 'midi']) || input;
hand = saved('hand', ['R', 'L', 'RL']) || hand;
level = saved('level', ['easy', 'orig']) || level;
pattern = saved('pattern', ['block', 'beats', 'bass']) || pattern;
const practisedHands = () => (input === 'midi' ? [...hand] : ['R']);
const HAND_NAME = { R: 'Tay phải', L: 'Tay trái' };
// Which on-screen key shows a note. The computer keyboard only has right-hand keys, so the left hand is heard, not drawn.
const laneOf = (e, n) => (input === 'midi' ? n : e.hand === 'R' ? fitToKeys(n) : null);
const pitchOf = (e, n) => (input === 'keys' && e.hand === 'R' ? fitToKeys(n) : n);
const nameOf = (n) => (input === 'midi' ? solfege(n) : keyOf(fitToKeys(n)));

// ---------- Audio: simple additive "piano-ish" synth ----------
let ctx, master;
const voices = {};
function audio() {
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = 0.35;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp).connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
function noteOn(n, vol = 1) {
  const c = audio(), t = c.currentTime, f = noteToFreq(n);
  noteOff(n, 0.02);
  const g = c.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.25 * vol, t + 0.4);
  g.gain.exponentialRampToValueAtTime(0.001, t + 3.5);
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(Math.min(f * 8, 12000), t);
  lp.frequency.exponentialRampToValueAtTime(f * 2, t + 1.5);
  lp.connect(g).connect(master);
  const oscs = [[1, 'triangle', 0.6], [2, 'sine', 0.25], [3, 'sine', 0.1], [1.002, 'sine', 0.3]].map(([m, type, v]) => {
    const o = c.createOscillator(), og = c.createGain();
    o.type = type; o.frequency.value = f * m; og.gain.value = v;
    o.connect(og).connect(lp); o.start(t);
    return o;
  });
  voices[n] = { g, oscs };
}
function click(accent) {
  const c = audio(), t = c.currentTime, o = c.createOscillator(), g = c.createGain();
  o.type = 'square'; o.frequency.value = accent ? 1600 : 1000;
  g.gain.setValueAtTime(accent ? 0.5 : 0.3, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
  o.connect(g).connect(master); o.start(t); o.stop(t + 0.05);
}
function noteOff(n, rel = 0.35) {
  const v = voices[n];
  if (!v) return;
  const t = ctx.currentTime;
  v.g.gain.cancelScheduledValues(t);
  v.g.gain.setTargetAtTime(0, t, rel / 4);
  v.oscs.forEach((o) => o.stop(t + rel + 0.1));
  delete voices[n];
}

// ---------- Keyboard UI ----------
// Keys to draw: the computer keymap, or (MIDI) both hands' real range widened to whole octaves.
function pianoKeys() {
  if (input === 'keys') return Object.entries(KEYMAP).map(([code, n]) => [label(code), n]);
  const midi = songEvents(undefined, level, 'bass').flatMap((e) => e.notes.map(noteToMidi));
  const lo = Math.min(...midi) - (Math.min(...midi) % 12), hi = Math.max(...midi) + 11 - (Math.max(...midi) % 12);
  return Array.from({ length: hi - lo + 1 }, (_, i) => midiToNote(lo + i)).map((n) => [n.startsWith('C') && !n.includes('#') ? n : '', n]);
}

function buildPiano() {
  const piano = $('piano');
  piano.innerHTML = '';
  keyEls = {};
  const keys = pianoKeys();
  const whites = keys.filter(([, n]) => !n.includes('#')).length;
  document.body.classList.toggle('midi-mode', input === 'midi');
  let whiteIndex = 0;
  keys.forEach(([lbl, n]) => {
    const black = n.includes('#');
    const el = document.createElement('div');
    el.className = `key ${black ? 'black' : 'white'}`;
    el.title = n;
    el.innerHTML = `<span class="lbl">${lbl}</span><span class="nm">${solfege(n)}</span>`;
    if (black) el.style.left = `calc(${(whiteIndex / whites) * 100}% - var(--black-w) / 2)`;
    else whiteIndex++;
    el.addEventListener('pointerdown', (e) => { e.preventDefault(); press(n); });
    el.addEventListener('pointerup', () => release(n));
    el.addEventListener('pointerleave', () => release(n));
    piano.appendChild(el);
    keyEls[n] = el;
  });
}

function press(n) {
  noteOn(n);
  keyEls[n]?.classList.add('on');
  if (mode === 'practice') checkPractice(n);
}
function release(n) {
  noteOff(n);
  keyEls[n]?.classList.remove('on');
}

const held = new Set();
addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey || $('guide').open) return;
  if (e.code === 'Space') { e.preventDefault(); return hint(); }
  const n = KEYMAP[e.code];
  if (!n || e.repeat) return;
  e.preventDefault();
  held.add(e.code);
  press(n);
});
addEventListener('keyup', (e) => {
  if (!held.delete(e.code)) return;
  release(KEYMAP[e.code]);
});
addEventListener('blur', () => { held.forEach((c) => release(KEYMAP[c])); held.clear(); });

// ---------- External MIDI keyboard (Web MIDI: Chrome / Edge) ----------
let midiAccess = null;
function midiDevices() {
  const names = midiAccess ? [...midiAccess.inputs.values()].map((i) => i.name) : [];
  $('midiState').textContent = names.length ? `🎹 Đã kết nối: ${names.join(', ')}` : '⚠️ Chưa thấy đàn MIDI — cắm đàn qua USB (web tự nhận).';
  $('midiState').classList.toggle('ok', names.length > 0);
  if (midiAccess) midiAccess.inputs.forEach((i) => { i.onmidimessage = onMidi; });
}
function onMidi({ data: [status, note, vel] }) {
  const cmd = status & 0xf0;
  if (cmd === 0x90 && vel > 0) press(midiToNote(note));
  else if (cmd === 0x80 || cmd === 0x90) release(midiToNote(note));
}
async function connectMidi() {
  if (!navigator.requestMIDIAccess) {
    $('midiState').textContent = '⚠️ Trình duyệt này không hỗ trợ đàn MIDI — hãy mở web bằng Chrome hoặc Edge.';
    return;
  }
  try {
    midiAccess ??= await navigator.requestMIDIAccess();
    midiAccess.onstatechange = midiDevices;
    midiDevices();
  } catch {
    $('midiState').textContent = '⚠️ Chưa được cấp quyền MIDI — bấm "Cho phép" khi trình duyệt hỏi, rồi chọn lại chế độ Đàn MIDI.';
  }
}

function setInput(v) {
  input = v;
  save('input', v);
  document.querySelectorAll('[data-input]').forEach((b) => b.classList.toggle('active', b.dataset.input === v));
  buildPiano();
  reset('idle');
  if (v === 'midi') connectMidi();
  setStatus(v === 'midi'
    ? 'Chế độ <b>Đàn MIDI</b>: chọn tay muốn luyện, đánh theo tên nốt rơi xuống (quãng tám nào cũng được).'
    : 'Chế độ <b>Bàn phím máy tính</b>: bạn đánh tay phải (chữ trên nốt rơi), web tự đệm hợp âm tay trái.');
}
function setHand(v) {
  hand = v;
  save('hand', v);
  document.querySelectorAll('[data-hand]').forEach((b) => b.classList.toggle('active', b.dataset.hand === v));
  reset('idle');
  setStatus(`Luyện <b>${v === 'RL' ? 'hai tay' : HAND_NAME[v].toLowerCase()}</b>${v === 'RL' ? '' : ' — web tự đệm tay còn lại'}.`);
}

// Version (easy / video original), left-hand pattern and section all decide which events are loaded.
function loadSong() {
  events = songEvents($('part').value || undefined, level, pattern);
  document.body.classList.toggle('level-orig', level === 'orig');
  info(); reset('idle');
}
function setLevel(v) {
  level = v;
  save('level', v);
  document.querySelectorAll('[data-level]').forEach((b) => b.classList.toggle('active', b.dataset.level === v));
  if (input === 'midi') buildPiano(); // the key range depends on the version
  loadSong();
  setStatus(v === 'easy'
    ? 'Bản <b>Dễ</b>: giai điệu đủ nốt, nhịp móc đơn, tay trái là hợp âm 3 nốt theo nhịp 4/4.'
    : 'Bản <b>Gốc</b>: giai điệu theo nhịp video (có nốt luyến) · tay trái: <b>Verse</b> hợp âm khối, <b>Điệp khúc</b> rải legato.');
}

// ---------- Song state ----------
const BEAT_PX = 80; // falling speed: pixels per beat
let events = songEvents();
let steps = [];    // what the player must hit, in order (a melody note, a chord, or both hands together)
let auto = [];     // events the web plays by itself (the other hand, or everything in a demo)
let mode = 'idle'; // 'idle' | 'practice' | 'demo'
let idx = 0, autoIdx = 0;
let pos = 0;       // song position in beats; an event touches the keys when pos === event.start
let wrong = 0, t0 = 0, lastBeat = 0;
let sounding = []; // auto-played notes still ringing: { n, lane, end }
const leadIn = () => $('fall').clientHeight / BEAT_PX;
const setStatus = (html) => { $('status').innerHTML = html; };

function reset(newMode) {
  sounding.forEach((s) => release(s.n));
  sounding = []; mode = newMode; idx = 0; autoIdx = 0; wrong = 0; t0 = 0;
  const hands = practisedHands();
  steps = practiceSteps(events, hands);
  steps.forEach((s) => {
    s.need = new Set(s.events.flatMap((e) => e.notes.map((n) => matchKey(n, input))));
    s.hit = new Set();
  });
  auto = newMode === 'demo' ? events : events.filter((e) => !hands.includes(e.hand));
  pos = newMode === 'idle' ? 0 : -leadIn();
  lastBeat = Math.floor(pos);
  $('demoBtn').textContent = newMode === 'demo' ? '■ Dừng' : '▶ Nghe mẫu';
  $('practiceBtn').textContent = newMode === 'practice' ? 'Bắt đầu lại' : 'Bắt đầu luyện';
  updateTarget();
}

// "Tay phải: H (Mi) · Tay trái: Fa + Đô + La" for the notes of the step still to hit
function describe(step) {
  return ['R', 'L'].map((h) => {
    const ns = step.events.filter((e) => e.hand === h).flatMap((e) => e.notes).filter((n) => !step.hit.has(matchKey(n, input)));
    if (!ns.length) return '';
    const txt = [...new Set(ns.map(nameOf))].join(' + ');
    return `${HAND_NAME[h]}: <b>${txt}</b>${input === 'keys' ? ` (${[...new Set(ns.map(solfege))].join(' + ')})` : ''}`;
  }).filter(Boolean).join(' · ');
}

function updateTarget() {
  Object.values(keyEls).forEach((el) => el.classList.remove('target', 'hit'));
  const s = mode === 'practice' && steps[idx];
  if (s) s.events.forEach((e) => e.notes.forEach((n) => keyEls[laneOf(e, n)]?.classList.add(s.hit.has(matchKey(n, input)) ? 'hit' : 'target')));
  $('bar').style.width = `${(idx / Math.max(steps.length, 1)) * 100}%`;
}

function startPractice() {
  audio();
  reset('practice');
  setStatus(`Nốt đầu tiên đang rơi xuống — ${describe(steps[0])}.`);
}

function checkPractice(n) {
  const s = steps[idx];
  if (!s) return;
  const k = matchKey(n, input);
  if (s.hit.has(k)) return; // already got this one
  // the rest of a chord just completed (e.g. the second F of F3+F4) is not a mistake on the next step
  const prev = steps[idx - 1];
  if (!s.need.has(k) && prev?.need.has(k) && performance.now() - prev.doneAt < 500) return;
  if (!s.need.has(k)) {
    wrong++;
    const el = keyEls[n];
    el?.classList.add('wrong');
    setTimeout(() => el?.classList.remove('wrong'), 250);
    setStatus(`Chưa đúng — cần bấm ${describe(s)}. Bấm <kbd>Space</kbd> để nghe gợi ý.`);
    return;
  }
  s.hit.add(k);
  if (idx === 0 && s.hit.size === 1) t0 = performance.now();
  if (s.hit.size < s.need.size) {
    updateTarget();
    return setStatus(`Đúng rồi, bấm tiếp: ${describe(s)}`);
  }
  s.doneAt = performance.now();
  idx++;
  updateTarget();
  if (idx === steps.length) return finish();
  const next = steps[idx], sec = next.events.find((e) => e.section)?.section;
  setStatus(`${sec ? `<b>${sec}</b> · ` : ''}Tiếp theo: ${describe(next)} — ${idx + 1}/${steps.length}`);
}

function finish() {
  mode = 'idle';
  sounding.forEach((s) => release(s.n)); sounding = [];
  const secs = Math.round((performance.now() - t0) / 1000);
  const total = steps.reduce((a, s) => a + s.need.size, 0);
  const acc = Math.round((total / (total + wrong)) * 100);
  $('practiceBtn').textContent = 'Luyện lại';
  setStatus(`🎉 <b>Hoàn thành!</b> Sai <b>${wrong}</b> lần · độ chính xác <b>${acc}%</b> · thời gian <b>${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}</b>`);
}

function hint() {
  const s = mode === 'practice' && steps[idx];
  if (!s) return;
  const ns = s.events.flatMap((e) => e.notes.map((n) => pitchOf(e, n)));
  ns.forEach((n) => noteOn(n, 0.7));
  setTimeout(() => ns.forEach((n) => noteOff(n)), 600);
}

function toggleDemo() {
  if (mode === 'demo') return reset('idle'), setStatus('Đã dừng. Bấm <b>Bắt đầu luyện</b> để tự đánh.');
  audio();
  reset('demo');
  setStatus('Đang phát mẫu cả hai tay — vàng là tay phải, xanh là tay trái.');
}

// ---------- Falling notes ----------
function tick(dt) {
  if (mode === 'idle') return;
  const bps = SONG.bpm / 60, s = mode === 'practice' && steps[idx];
  if (s) {
    // fall at tempo, wait at the keys until the step is hit, catch up quickly if the player is ahead
    const gap = s.start - pos;
    pos += Math.min(gap, Math.max(bps, gap * 6) * dt);
  } else pos += bps * dt;

  // metronome while listening to the demo; the lead-in gives a count-in, beat 1 of each bar is accented
  if (mode === 'demo' && Math.floor(pos) > lastBeat) {
    lastBeat = Math.floor(pos);
    if ($('metro').checked) click(((lastBeat % 4) + 4) % 4 === 0);
  }

  // auto-played notes; in practice, notes that coincide with the waiting step sound together with it, not before
  sounding = sounding.filter((x) => (pos >= x.end ? (release(x.n), false) : true));
  const limit = s ? Math.min(pos, s.start - 0.15) : pos;
  while (auto[autoIdx] && auto[autoIdx].start <= limit) {
    const e = auto[autoIdx++];
    e.notes.forEach((n) => {
      const p = pitchOf(e, n);
      noteOn(p, e.hand === 'L' ? 0.6 : 1);
      if (laneOf(e, n)) keyEls[p]?.classList.add('on');
      sounding.push({ n: p, end: e.start + Math.max(e.b * 0.95, 0.1) });
    });
  }
  if (mode === 'demo') {
    $('bar').style.width = `${(autoIdx / auto.length) * 100}%`;
    if (!auto[autoIdx] && !sounding.length) reset('idle'), setStatus('Hết bài mẫu. Giờ bấm <b>Bắt đầu luyện</b> để tự đánh nhé!');
  }
}

const COLORS = { R: ['#fff1cc', '#e8cf98', '#a8874c'], L: ['#e3f1ff', '#9cc4ea', '#4f7fae'] };
function draw() {
  const c = $('fall'), dpr = devicePixelRatio || 1, W = c.clientWidth, H = c.clientHeight;
  if (c.width !== W * dpr || c.height !== H * dpr) { c.width = W * dpr; c.height = H * dpr; }
  const g = c.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, W, H);

  // lanes for white keys
  g.fillStyle = '#ffffff08';
  Object.values(keyEls).forEach((el, i) => { if (el.classList.contains('white') && i % 2) g.fillRect(el.offsetLeft, 0, el.offsetWidth, H); });

  const hands = practisedHands(), cur = mode === 'practice' ? steps[idx] : null;
  g.textAlign = 'center';
  for (const e of events) {
    const bottom = H - (e.start - pos) * BEAT_PX, h = Math.max(e.b * BEAT_PX - 4, 10); // grace notes stay visible
    if (bottom < 0 || bottom - h > H) continue;
    if (e.section) {
      g.fillStyle = '#c9a96e55'; g.fillRect(0, bottom, W, 1);
      g.fillStyle = '#c9a96e'; g.textAlign = 'right'; g.font = '600 11px Inter, sans-serif';
      g.fillText(e.section.toUpperCase(), W - 8, bottom - 6); g.textAlign = 'center';
    }
    const isNext = cur && cur.events.includes(e);
    const mine = mode !== 'practice' || hands.includes(e.hand);
    const done = mode === 'practice' && mine && !isNext && (!cur || e.start < cur.start);
    for (const n of e.notes) {
      const el = keyEls[laneOf(e, n)];
      if (!el) continue;
      const kx = el.offsetLeft + 2, kw = el.offsetWidth - 4;
      const hit = isNext && cur.hit.has(matchKey(n, input));
      const [hi, mid, lo] = hit ? ['#d9ffe3', '#8fd19e', '#4e9a63'] : COLORS[e.hand];
      g.globalAlpha = done ? 0.25 : mine ? 1 : 0.4;
      const grad = g.createLinearGradient(0, bottom - h, 0, bottom);
      grad.addColorStop(0, isNext ? hi : mid);
      grad.addColorStop(1, isNext ? mid : lo);
      g.fillStyle = grad;
      if (isNext && !hit) { g.shadowColor = mid; g.shadowBlur = 20; }
      g.beginPath(); g.roundRect(kx, bottom - h, kw, h, 5); g.fill();
      g.shadowBlur = 0;
      if (mine && (h > 18 || isNext)) {
        const inside = h > 18; // too short to hold text: write it above the block
        g.fillStyle = inside ? '#1d1a12' : mid; g.font = `700 ${input === 'midi' ? 11 : 15}px Inter, sans-serif`;
        g.fillText(nameOf(n), kx + kw / 2, inside ? bottom - 7 : bottom - h - 6);
      }
      g.globalAlpha = 1;
    }
    if (e.chord) {
      // chord name above the chord, or at the left edge when the left hand isn't drawn (computer keyboard)
      const els = e.notes.map((n) => keyEls[laneOf(e, n)]).filter(Boolean);
      g.fillStyle = '#9cc4ea'; g.font = '700 13px Inter, sans-serif';
      if (els.length) {
        const x0 = els[0].offsetLeft, x1 = els.at(-1).offsetLeft + els.at(-1).offsetWidth;
        g.fillText(e.chord, (x0 + x1) / 2, bottom - h - 6);
      } else {
        g.textAlign = 'left'; g.fillText(e.chord, 8, bottom - 6); g.textAlign = 'center';
      }
    }
  }

  // glow at the hit line for keys being pressed
  Object.values(keyEls).forEach((el) => {
    if (!el.classList.contains('on')) return;
    const grad = g.createLinearGradient(0, H - 60, 0, H);
    grad.addColorStop(0, '#e8cf9800'); grad.addColorStop(1, '#e8cf98aa');
    g.fillStyle = grad; g.fillRect(el.offsetLeft, H - 60, el.offsetWidth, 60);
  });
}

let last = performance.now();
function frame(now) {
  tick(Math.min((now - last) / 1000, 0.1));
  last = now;
  draw();
  requestAnimationFrame(frame);
}

// ---------- Init ----------
SONG.sections.forEach((s) => $('part').add(new Option(s.name, s.name)));
document.querySelectorAll('[data-input]').forEach((b) => { b.onclick = () => { b.blur(); setInput(b.dataset.input); }; });
document.querySelectorAll('[data-level]').forEach((b) => { b.onclick = () => { b.blur(); setLevel(b.dataset.level); }; });
$('pattern').value = pattern;
$('pattern').onchange = (e) => {
  pattern = e.target.value; save('pattern', pattern); e.target.blur(); loadSong();
  setStatus(`Kiểu đệm: <b>${e.target.selectedOptions[0].text}</b>.`);
};
document.querySelectorAll('[data-hand]').forEach((b) => { b.onclick = () => { b.blur(); setHand(b.dataset.hand); }; });
document.querySelectorAll('[data-hand]').forEach((b) => b.classList.toggle('active', b.dataset.hand === hand));
$('songTitle').textContent = SONG.title;
const info = () => {
  const r = events.filter((e) => e.hand === 'R').length, l = events.length - r;
  $('songArtist').textContent = `${SONG.artist} · ${r} nốt tay phải · ${l} lần bấm tay trái · ${level === 'easy' ? 'bản dễ' : 'bản gốc: verse khối, điệp khúc rải'} · nhịp 4/4 (Đô trưởng)`;
};
setInput(input);
setLevel(level);
$('tempo').value = SONG.bpm;
$('tempoOut').textContent = SONG.bpm;
$('tempo').oninput = (e) => { SONG.bpm = +e.target.value; $('tempoOut').textContent = SONG.bpm; };
$('tempo').onchange = (e) => e.target.blur();
$('part').onchange = (e) => {
  e.target.blur(); loadSong();
  setStatus('Đã chọn đoạn. Bấm <b>Nghe mẫu</b> hoặc <b>Bắt đầu luyện</b>.');
};
$('practiceBtn').onclick = (e) => { e.currentTarget.blur(); startPractice(); };
$('demoBtn').onclick = (e) => { e.currentTarget.blur(); toggleDemo(); };
$('guideBtn').onclick = () => $('guide').showModal();
$('showNotes').onchange = (e) => document.body.classList.toggle('hide-notes', !e.target.checked);
requestAnimationFrame(frame);
try { if (!localStorage.getItem('seenGuide4')) { $('guide').showModal(); localStorage.setItem('seenGuide4', '1'); } } catch {}
