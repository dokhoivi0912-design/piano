// Run: node --test
const test = require('node:test');
const assert = require('node:assert');
const {
  KEYMAP, SONG, noteToFreq, noteToMidi, midiToNote, fitToKeys, samePitchClass,
  songEvents, practiceSteps, matchKey, solfege,
} = require('./data.js');

test('A4 is 440 Hz, C5 is one octave above C4', () => {
  assert.strictEqual(noteToFreq('A4'), 440);
  assert.ok(Math.abs(noteToFreq('C5') / noteToFreq('C4') - 2) < 1e-9);
  assert.ok(Math.abs(noteToFreq('C#4') - 277.18) < 0.01);
});

test('white keys sit on the home row A..\' (G4..C6), ascending', () => {
  const whites = Object.entries(KEYMAP).filter(([, n]) => !n.includes('#'));
  assert.deepStrictEqual(whites.map(([c]) => c),
    ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyL', 'Semicolon', 'Quote']);
  assert.strictEqual(whites[0][1], 'G4');
  assert.strictEqual(whites.at(-1)[1], 'C6');
  const midi = Object.values(KEYMAP).map(noteToMidi);
  midi.forEach((m, i) => i && assert.strictEqual(m, midi[i - 1] + 1));
});

test('midiToNote is the inverse of noteToMidi', () => {
  assert.strictEqual(midiToNote(60), 'C4');
  assert.strictEqual(midiToNote(61), 'C#4');
  for (let m = 21; m <= 108; m++) assert.strictEqual(noteToMidi(midiToNote(m)), m);
});

test('fitToKeys folds by octaves into the computer keyboard range', () => {
  assert.strictEqual(fitToKeys('C4'), 'C5');
  assert.strictEqual(fitToKeys('G6'), 'G5');
  assert.strictEqual(fitToKeys('E5'), 'E5');
  assert.strictEqual(fitToKeys('C6'), 'C6');
  assert.strictEqual(fitToKeys('F#4'), 'F#5');
});

test('MIDI mode accepts any octave of the right note', () => {
  assert.ok(samePitchClass('C4', 'C6'));
  assert.ok(!samePitchClass('C4', 'C#4'));
  assert.strictEqual(matchKey('C3', 'midi'), matchKey('C6', 'midi'));
  assert.notStrictEqual(matchKey('C3', 'midi'), matchKey('D3', 'midi'));
  assert.strictEqual(matchKey('C4', 'keys'), 'C5');
});

test('song has a right-hand melody and left-hand chords from the video', () => {
  const ev = songEvents();
  const rh = ev.filter((e) => e.hand === 'R'), lh = ev.filter((e) => e.hand === 'L');
  assert.ok(rh.length > 300, `rh ${rh.length}`);
  assert.ok(lh.length > 150, `lh ${lh.length}`);
  assert.ok(lh.some((e) => e.notes.length >= 3), 'expected some 3+ note chords');
  rh.forEach((e) => assert.strictEqual(e.notes.length, 1));
  const playable = new Set(Object.values(KEYMAP));
  rh.forEach((e) => assert.ok(playable.has(fitToKeys(e.notes[0])), e.notes[0]));
  ev.forEach((e, i) => {
    assert.ok(e.b > 0);
    e.notes.forEach((n) => assert.ok(noteToMidi(n) >= 21 && noteToMidi(n) <= 108, n));
    if (i) assert.ok(e.start >= ev[i - 1].start);
  });
  assert.ok(SONG.title && SONG.bpm > 0);
});

test('songEvents(section) returns one section starting at 0', () => {
  assert.ok(SONG.sections.length >= 5);
  let total = 0;
  for (const s of SONG.sections) {
    const ev = songEvents(s.name);
    assert.ok(ev.length > 0, s.name);
    assert.strictEqual(Math.min(...ev.map((e) => e.start)), 0);
    total += ev.length;
  }
  assert.strictEqual(total, songEvents().length);
});

test('practiceSteps groups simultaneous notes of the chosen hands', () => {
  const ev = [
    { hand: 'R', notes: ['E5'], start: 0, b: 1 },
    { hand: 'L', notes: ['F3', 'C4', 'A4'], start: 0.05, b: 2 },
    { hand: 'R', notes: ['F5'], start: 1, b: 1 },
  ];
  const both = practiceSteps(ev, ['R', 'L']);
  assert.strictEqual(both.length, 2);
  assert.strictEqual(both[0].events.length, 2);
  assert.deepStrictEqual(practiceSteps(ev, ['L']).map((s) => s.start), [0.05]);
  assert.deepStrictEqual(practiceSteps(ev, ['R']).map((s) => s.events[0].notes[0]), ['E5', 'F5']);
});

test('solfege names', () => {
  assert.strictEqual(solfege('C4'), 'Đô');
  assert.strictEqual(solfege('G4'), 'Sol');
  assert.strictEqual(solfege('C#4'), 'Đô#');
});
