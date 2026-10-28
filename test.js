// Run: node --test
const test = require('node:test');
const assert = require('node:assert');
const { KEYMAP, SONG, noteToFreq, noteToMidi, songNotes, solfege } = require('./data.js');

test('A4 is 440 Hz, C5 is one octave above C4', () => {
  assert.strictEqual(noteToFreq('A4'), 440);
  assert.ok(Math.abs(noteToFreq('C5') / noteToFreq('C4') - 2) < 1e-9);
  assert.ok(Math.abs(noteToFreq('C#4') - 277.18) < 0.01);
});

test('white keys sit on the home row A..\' (A3..D5), ascending', () => {
  const whites = Object.entries(KEYMAP).filter(([, n]) => !n.includes('#'));
  assert.deepStrictEqual(whites.map(([c]) => c),
    ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyL', 'Semicolon', 'Quote']);
  assert.strictEqual(whites[0][1], 'A3');
  assert.strictEqual(whites.at(-1)[1], 'D5');
  const midi = Object.values(KEYMAP).map(noteToMidi);
  midi.forEach((m, i) => i && assert.strictEqual(m, midi[i - 1] + 1));
});

test('song is playable on white keys only', () => {
  const playable = new Set(Object.values(KEYMAP));
  const all = songNotes();
  assert.ok(all.length > 30);
  for (const { n, b } of all) {
    assert.ok(playable.has(n), `note ${n} not on keyboard`);
    assert.ok(!n.includes('#'), `${n} is a black key`);
    assert.ok(b > 0);
  }
  assert.ok(SONG.title && SONG.bpm > 0);
});

test('songNotes(part) filters by part and restarts timing at 0', () => {
  const verse = songNotes('Verse'), chorus = songNotes('Điệp khúc');
  assert.ok(verse.length && chorus.length);
  assert.strictEqual(verse.length + chorus.length, songNotes().length);
  for (const list of [verse, chorus]) {
    assert.strictEqual(list[0].start, 0);
    list.forEach((x, i) => i && assert.strictEqual(x.start, list[i - 1].start + list[i - 1].b));
  }
});

test('solfege names', () => {
  assert.strictEqual(solfege('C4'), 'Đô');
  assert.strictEqual(solfege('G4'), 'Sol');
  assert.strictEqual(solfege('C#4'), 'Đô#');
});
