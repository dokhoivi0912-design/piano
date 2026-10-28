// Run: node --test
const test = require('node:test');
const assert = require('node:assert');
const { KEYMAP, SONG, noteToFreq, songNotes } = require('./data.js');

test('A4 is 440 Hz, C5 is one octave above C4', () => {
  assert.strictEqual(noteToFreq('A4'), 440);
  assert.ok(Math.abs(noteToFreq('C5') / noteToFreq('C4') - 2) < 1e-9);
  assert.ok(Math.abs(noteToFreq('C#4') - 277.18) < 0.01);
});

test('keymap covers 25 unique notes C4..C6', () => {
  const notes = Object.values(KEYMAP);
  assert.strictEqual(notes.length, 25);
  assert.strictEqual(new Set(notes).size, 25);
});

test('every song note is playable from the keyboard', () => {
  const playable = new Set(Object.values(KEYMAP));
  const all = songNotes();
  assert.ok(all.length > 30);
  for (const { n, b } of all) {
    assert.ok(playable.has(n), `note ${n} not on keyboard`);
    assert.ok(b > 0, `bad duration for ${n}`);
  }
  assert.ok(SONG.title && SONG.bpm > 0);
});
