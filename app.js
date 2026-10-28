/* global KEYMAP, SONG, noteToFreq, songNotes */
const $ = (id) => document.getElementById(id);
const CODE_OF = Object.fromEntries(Object.entries(KEYMAP).map(([code, n]) => [n, code]));
const label = (code) => code.replace(/^Key|^Digit/, '');
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
  let whiteIndex = 0;
  Object.entries(KEYMAP).forEach(([code, n]) => {
    const black = n.includes('#');
    const el = document.createElement('div');
    el.className = `key ${black ? 'black' : 'white'}`;
    el.innerHTML = `<span class="lbl">${label(code)}</span><span class="nm">${n}</span>`;
    if (black) el.style.left = `calc(${(whiteIndex / 15) * 100}% - 13px)`;
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
  if (practicing) checkPractice(n);
}
function release(n) {
  noteOff(n);
  keyEls[n]?.classList.remove('on');
}

const held = new Set();
addEventListener('keydown', (e) => {
  const n = KEYMAP[e.code];
  if (!n || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
  e.preventDefault();
  held.add(e.code);
  press(n);
});
addEventListener('keyup', (e) => {
  if (!held.delete(e.code)) return;
  release(KEYMAP[e.code]);
});
addEventListener('blur', () => { held.forEach((c) => release(KEYMAP[c])); held.clear(); });

// ---------- Song practice ----------
const NOTES = songNotes();
let idx = 0, practicing = false, demoTimer = null;

function renderStrip() {
  $('strip').innerHTML = NOTES.map(({ n, b, section }, i) =>
    `<div class="chip ${i < idx ? 'done' : ''} ${i === idx && practicing ? 'now' : ''} ${b >= 2 ? 'long' : ''}" data-i="${i}">` +
    (section ? `<span class="sec">${section}</span>` : '') +
    `<span class="k">${label(CODE_OF[n])}</span><span class="n">${n}</span></div>`).join('');
  $('strip').querySelector('.now')?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  $('bar').style.width = `${(idx / NOTES.length) * 100}%`;
  Object.values(keyEls).forEach((el) => el.classList.remove('target'));
  if (practicing && NOTES[idx]) keyEls[NOTES[idx].n].classList.add('target');
}

function startPractice() {
  stopDemo();
  practicing = true; idx = 0;
  $('practiceBtn').textContent = 'Bắt đầu lại';
  setStatus(`Bấm phím <b>${label(CODE_OF[NOTES[0].n])}</b> để bắt đầu.`);
  renderStrip();
}

function checkPractice(n) {
  const want = NOTES[idx];
  if (!want) return;
  if (n !== want.n) {
    const el = keyEls[n];
    el.classList.add('wrong');
    setTimeout(() => el.classList.remove('wrong'), 250);
    setStatus(`Chưa đúng — cần bấm <b>${label(CODE_OF[want.n])}</b> (${want.n}).`);
    return;
  }
  idx++;
  if (idx === NOTES.length) {
    practicing = false;
    setStatus('🎉 <b>Hoàn thành bài!</b> Bấm "Bắt đầu lại" để luyện tiếp, hoặc tăng tốc độ ở phần Nghe mẫu.');
  } else {
    const next = NOTES[idx];
    setStatus(`${next.section ? `<b>${next.section}</b> · ` : ''}Tiếp theo: <b>${label(CODE_OF[next.n])}</b> (${next.n}) — nốt ${idx + 1}/${NOTES.length}`);
  }
  renderStrip();
}

function playDemo() {
  if (demoTimer) return stopDemo();
  practicing = false;
  audio();
  $('demoBtn').textContent = '■ Dừng';
  let i = 0;
  const step = () => {
    if (i > 0) release(NOTES[i - 1].n);
    if (i === NOTES.length) return stopDemo();
    const { n, b } = NOTES[i];
    idx = i; renderStrip();
    keyEls[n].classList.add('on');
    noteOn(n);
    i++;
    demoTimer = setTimeout(step, (b * 60000) / SONG.bpm);
  };
  step();
}
function stopDemo() {
  clearTimeout(demoTimer); demoTimer = null;
  Object.keys(voices).forEach((n) => release(n));
  $('demoBtn').textContent = '▶ Nghe mẫu';
  idx = 0; renderStrip();
}

const setStatus = (html) => { $('status').innerHTML = html; };

// ---------- Init ----------
buildPiano();
$('songTitle').textContent = SONG.title;
$('songArtist').textContent = `${SONG.artist} · ${NOTES.length} nốt · bản giai điệu đơn giản`;
$('tempo').value = SONG.bpm;
$('tempoOut').textContent = SONG.bpm;
$('tempo').oninput = (e) => { SONG.bpm = +e.target.value; $('tempoOut').textContent = SONG.bpm; };
$('practiceBtn').onclick = (e) => { e.currentTarget.blur(); startPractice(); };
$('demoBtn').onclick = (e) => { e.currentTarget.blur(); playDemo(); };
$('guideBtn').onclick = () => $('guide').showModal();
$('showNotes').onchange = (e) => document.body.classList.toggle('hide-notes', !e.target.checked);
renderStrip();
try { if (!localStorage.getItem('seenGuide')) { $('guide').showModal(); localStorage.setItem('seenGuide', '1'); } } catch {}
