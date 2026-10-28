// Run: node --test
const test = require('node:test');
const assert = require('node:assert');
const { KEYMAP, SONG, noteToFreq, noteToMidi, midiToNote, fitToKeys, samePitchClass, songNotes, solfege } = require('./data.js');

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
  assert.ok(samePitchClass('E5', 'E3'));
  assert.ok(!samePitchClass('C4', 'C#4'));
});

test('song (from the video) is playable on the computer keyboard after folding', () => {
  const playable = new Set(Object.values(KEYMAP));
  const all = songNotes();
  assert.ok(all.length > 300, `only ${all.length} notes`);
  for (const { n, b } of all) {
    assert.ok(playable.has(fitToKeys(n)), `note ${n} not on keyboard`);
    assert.ok(b > 0);
  }
  assert.ok(SONG.title && SONG.bpm > 0);
});

test('songNotes(section) returns one section with timing from 0', () => {
  assert.ok(SONG.sections.length >= 5);
  let total = 0;
  for (const s of SONG.sections) {
    const list = songNotes(s.name);
    assert.ok(list.length > 0, s.name);
    assert.strictEqual(list[0].start, 0);
    list.forEach((x, i) => i && assert.ok(Math.abs(x.start - (list[i - 1].start + list[i - 1].b)) < 1e-9));
    total += list.length;
  }
  assert.strictEqual(total, songNotes().length);
});

test('solfege names', () => {
  assert.strictEqual(solfege('C4'), 'Đô');
  assert.strictEqual(solfege('G4'), 'Sol');
  assert.strictEqual(solfege('C#4'), 'Đô#');
});
