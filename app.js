/* global KEYMAP, SONG, noteToFreq, songNotes, solfege */
const $ = (id) => document.getElementById(id);
const CODE_OF = Object.fromEntries(Object.entries(KEYMAP).map(([code, n]) => [n, code]));
const PUNCT = { Semicolon: ';', Quote: "'", BracketLeft: '[' };
const label = (code) => PUNCT[code] || code.replace(/^Key/, '');
const keyOf = (n) => label(CODE_OF[n]);
const keyEls = {};

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
function noteOn(n) {
  const c = audio(), t = c.currentTime, f = noteToFreq(n);
  noteOff(n, 0.02);
  const g = c.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(1, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.25, t + 0.4);
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
function buildPiano() {
  const piano = $('piano');
  const whites = Object.values(KEYMAP).filter((n) => !n.includes('#')).length;
  let whiteIndex = 0;
  Object.entries(KEYMAP).forEach(([code, n]) => {
    const black = n.includes('#');
    const el = document.createElement('div');
    el.className = `key ${black ? 'black' : 'white'}`;
    el.title = n;
    el.innerHTML = `<span class="lbl">${label(code)}</span><span class="nm">${solfege(n)}</span>`;
    if (black) el.style.left = `calc(${(whiteIndex / whites) * 100}% - 15px)`;
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
  keyEls[n].classList.add('on');
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

// ---------- Song state ----------
const BEAT_PX = 80; // falling speed: pixels per beat
let notes = songNotes();
let mode = 'idle'; // 'idle' | 'practice' | 'demo'
let idx = 0;       // next note to hit (practice) or to play (demo)
let pos = 0;       // song position in beats; a note touches the keys when pos === note.start
let wrong = 0, t0 = 0, demoOn = null;
const leadIn = () => $('fall').clientHeight / BEAT_PX;
const setStatus = (html) => { $('status').innerHTML = html; };

function reset(newMode) {
  if (demoOn) release(demoOn);
  demoOn = null; mode = newMode; idx = 0; wrong = 0; t0 = 0;
  pos = newMode === 'idle' ? 0 : -leadIn();
  $('demoBtn').textContent = newMode === 'demo' ? '■ Dừng' : '▶ Nghe mẫu';
  $('practiceBtn').textContent = newMode === 'practice' ? 'Bắt đầu lại' : 'Bắt đầu luyện';
  updateTarget();
}

function updateTarget() {
  Object.values(keyEls).forEach((el) => el.classList.remove('target'));
  if (mode === 'practice' && notes[idx]) keyEls[notes[idx].n].classList.add('target');
  $('bar').style.width = `${(idx / notes.length) * 100}%`;
}

function startPractice() {
  reset('practice');
  setStatus(`Nốt đầu tiên đang rơi xuống — bấm <b>${keyOf(notes[0].n)}</b> (${solfege(notes[0].n)}) khi bạn sẵn sàng.`);
}

function checkPractice(n) {
  const want = notes[idx];
  if (n !== want.n) {
    wrong++;
    const el = keyEls[n];
    el.classList.add('wrong');
    setTimeout(() => el.classList.remove('wrong'), 250);
    setStatus(`Chưa đúng — cần bấm <b>${keyOf(want.n)}</b> (${solfege(want.n)}). Bấm <kbd>Space</kbd> để nghe gợi ý.`);
    return;
  }
  if (idx === 0) t0 = performance.now();
  idx++;
  updateTarget();
  if (idx === notes.length) return finish();
  const next = notes[idx];
  setStatus(`${next.section ? `<b>${next.section}</b> · ` : ''}Tiếp theo: <b>${keyOf(next.n)}</b> (${solfege(next.n)}) — nốt ${idx + 1}/${notes.length}`);
}

function finish() {
  mode = 'idle';
  const secs = Math.round((performance.now() - t0) / 1000);
  const acc = Math.round((notes.length / (notes.length + wrong)) * 100);
  $('practiceBtn').textContent = 'Luyện lại';
  setStatus(`🎉 <b>Hoàn thành!</b> Sai <b>${wrong}</b> lần · độ chính xác <b>${acc}%</b> · thời gian <b>${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}</b>`);
}

function hint() {
  if (mode !== 'practice' || !notes[idx]) return;
  const n = notes[idx].n;
  noteOn(n);
  setTimeout(() => noteOff(n), 500);
}

function toggleDemo() {
  if (mode === 'demo') return reset('idle'), setStatus('Đã dừng. Bấm <b>Bắt đầu luyện</b> để tự đánh.');
  audio();
  reset('demo');
  setStatus('Đang phát mẫu — nhìn nốt rơi chạm phím nào thì phím đó kêu.');
}

// ---------- Falling notes ----------
function tick(dt) {
  const bps = SONG.bpm / 60;
  if (mode === 'practice' && notes[idx]) {
    // fall at tempo, wait at the keys until the right key is hit, catch up quickly if the player is ahead
    const gap = notes[idx].start - pos;
    pos += Math.min(gap, Math.max(bps, gap * 6) * dt);
  } else if (mode === 'practice') {
    pos += bps * dt; // let the last notes fall away after finishing
  } else if (mode === 'demo') {
    pos += bps * dt;
    if (demoOn && pos >= demoOn.end) { release(demoOn.n); demoOn = null; }
    while (notes[idx] && notes[idx].start <= pos) {
      if (demoOn) release(demoOn.n);
      const x = notes[idx++];
      noteOn(x.n); keyEls[x.n].classList.add('on');
      demoOn = { n: x.n, end: x.start + x.b * 0.92 };
      $('bar').style.width = `${(idx / notes.length) * 100}%`;
    }
    if (!notes[idx] && !demoOn) reset('idle'), setStatus('Hết bài mẫu. Giờ bấm <b>Bắt đầu luyện</b> để tự đánh nhé!');
  }
}

function draw() {
  const c = $('fall'), dpr = devicePixelRatio || 1, W = c.clientWidth, H = c.clientHeight;
  if (c.width !== W * dpr || c.height !== H * dpr) { c.width = W * dpr; c.height = H * dpr; }
  const g = c.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, W, H);

  // lanes for white keys
  g.fillStyle = '#ffffff08';
  Object.values(keyEls).forEach((el, i) => { if (el.classList.contains('white') && i % 2) g.fillRect(el.offsetLeft, 0, el.offsetWidth, H); });

  g.textAlign = 'center';
  notes.forEach((x, i) => {
    const bottom = H - (x.start - pos) * BEAT_PX, h = x.b * BEAT_PX - 4;
    if (bottom < 0 || bottom - h > H) return;
    const el = keyEls[x.n], kx = el.offsetLeft + 3, kw = el.offsetWidth - 6;
    if (x.section) {
      g.fillStyle = '#c9a96e55'; g.fillRect(0, bottom, W, 1);
      g.fillStyle = '#c9a96e'; g.textAlign = 'right'; g.font = '600 11px Inter, sans-serif';
      g.fillText(x.section.toUpperCase(), W - 8, bottom - 6); g.textAlign = 'center';
    }
    const isNext = mode === 'practice' && i === idx, done = i < idx;
    g.globalAlpha = done ? 0.25 : 1;
    const grad = g.createLinearGradient(0, bottom - h, 0, bottom);
    grad.addColorStop(0, isNext ? '#fff1cc' : '#e8cf98');
    grad.addColorStop(1, isNext ? '#e8cf98' : '#a8874c');
    g.fillStyle = grad;
    if (isNext) { g.shadowColor = '#e8cf98'; g.shadowBlur = 20; }
    g.beginPath(); g.roundRect(kx, bottom - h, kw, h, 6); g.fill();
    g.shadowBlur = 0;
    if (h > 18) {
      g.fillStyle = '#2a200c'; g.font = '700 15px Inter, sans-serif';
      g.fillText(keyOf(x.n), kx + kw / 2, bottom - 8);
    }
    g.globalAlpha = 1;
  });

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
buildPiano();
$('songTitle').textContent = SONG.title;
const info = () => { $('songArtist').textContent = `${SONG.artist} · ${notes.length} nốt · bản giai điệu đơn giản`; };
info();
$('tempo').value = SONG.bpm;
$('tempoOut').textContent = SONG.bpm;
$('tempo').oninput = (e) => { SONG.bpm = +e.target.value; $('tempoOut').textContent = SONG.bpm; };
$('tempo').onchange = (e) => e.target.blur();
$('part').onchange = (e) => {
  notes = songNotes(e.target.value || undefined);
  e.target.blur(); info(); reset('idle');
  setStatus('Đã chọn đoạn. Bấm <b>Nghe mẫu</b> hoặc <b>Bắt đầu luyện</b>.');
};
$('practiceBtn').onclick = (e) => { e.currentTarget.blur(); startPractice(); };
$('demoBtn').onclick = (e) => { e.currentTarget.blur(); toggleDemo(); };
$('guideBtn').onclick = () => $('guide').showModal();
$('showNotes').onchange = (e) => document.body.classList.toggle('hide-notes', !e.target.checked);
updateTarget();
requestAnimationFrame(frame);
try { if (!localStorage.getItem('seenGuide2')) { $('guide').showModal(); localStorage.setItem('seenGuide2', '1'); } } catch {}
