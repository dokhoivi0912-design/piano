// Run: node --test
const test = require('node:test');
const assert = require('node:assert');
const {
  KEYMAP, SONG, SONGS, noteToFreq, noteToMidi, midiToNote, fitToKeys, samePitchClass,
  songEvents, practiceSteps, matchKey, solfege, chordNotes, accompany,
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

test('sections are labelled verse / chorus / outro', () => {
  assert.deepStrictEqual(SONG.sections.map((x) => x.part), [
    'chorus', 'verse', 'verse', 'chorus', 'verse', 'chorus', 'verse', 'chorus', 'verse', 'verse', 'chorus', 'verse', 'outro']);
  SONG.sections.forEach((x) => assert.ok(x.name.includes(x.part === 'chorus' ? 'Điệp khúc' : x.part === 'verse' ? 'Verse' : 'Kết'), x.name));
});

test('songEvents(section) keeps beat 1 on a bar line', () => {
  for (const [level, names] of [['easy', SONG.sections.map((x) => x.name)], ['orig', SONG.sheet.form.map((x) => x.name)]]) {
    let total = 0;
    for (const name of names) {
      const ev = songEvents(name, level);
      assert.ok(ev.length > 0, name);
      assert.ok(Math.min(...ev.map((e) => e.start)) < 4);
      total += ev.length;
    }
    assert.strictEqual(total, songEvents(undefined, level).length);
  }
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

test('root-position triads', () => {
  assert.deepStrictEqual(chordNotes('C'), ['C3', 'E3', 'G3']);
  assert.deepStrictEqual(chordNotes('F'), ['F3', 'A3', 'C4']);
  assert.deepStrictEqual(chordNotes('G'), ['G3', 'B3', 'D4']);
  assert.deepStrictEqual(chordNotes('Am'), ['A3', 'C4', 'E4']);
  assert.deepStrictEqual(chordNotes('Dm'), ['D3', 'F3', 'A3']);
  assert.deepStrictEqual(chordNotes('Em'), ['E3', 'G3', 'B3']);
});

test('accompaniment patterns in 4/4', () => {
  const chords = [['F', 4, 2], ['G', 6, 2], ['C', 8, 4]];
  const block = accompany(chords, 'block');
  assert.deepStrictEqual(block.map((e) => [e.notes.join(' '), e.start, e.b]),
    [['F3 A3 C4', 4, 2], ['G3 B3 D4', 6, 2], ['C3 E3 G3', 8, 4]]);
  const beats = accompany(chords, 'beats');
  assert.deepStrictEqual(beats.map((e) => e.start), [4, 5, 6, 7, 8, 9, 10, 11]);
  beats.forEach((e) => assert.strictEqual(e.notes.length, 3));
  const bass = accompany(chords, 'bass');
  // beats 1 and 3 of a bar: bass note an octave below the root; beats 2 and 4: the triad
  assert.deepStrictEqual(bass.map((e) => e.notes.join(' ')),
    ['F2', 'F3 A3 C4', 'G2', 'G3 B3 D4', 'C2', 'C3 E3 G3', 'C2', 'C3 E3 G3']);
  // the chord name is shown once, on its first event
  assert.deepStrictEqual(bass.filter((e) => e.chord).map((e) => e.chord), ['F', 'G', 'C']);
  [block, beats, bass].forEach((list) => list.forEach((e) => assert.strictEqual(e.hand, 'L')));
});

const inOctave = (n) => noteToMidi(n) >= noteToMidi('G4') && noteToMidi(n) <= noteToMidi('G5');

test('easy right hand: every melody note kept, 8th grid, one octave, legato', () => {
  const rh = songEvents(undefined, 'easy').filter((e) => e.hand === 'R');
  assert.ok(rh.length >= 440, `only ${rh.length} notes`);
  rh.forEach((e, i) => {
    assert.ok(inOctave(e.notes[0]), e.notes[0]);
    assert.strictEqual(e.start * 2 % 1, 0, `start ${e.start} not on an 8th`);
    const next = rh[i + 1];
    if (!next) return;
    assert.ok(next.start > e.start, 'two melody notes at once');
    // no hollow gaps: a note rings until the next one (up to 2 beats)
    assert.strictEqual(e.b, Math.min(next.start - e.start, 2), `gap after ${e.notes[0]} at ${e.start}`);
  });
});

test('original version follows the sheet form with its repeats', () => {
  const { form, bars } = SONG.sheet;
  assert.strictEqual(SONG.sheet.bpm, 92);
  assert.deepStrictEqual(form.map((x) => x.name), [
    'Intro', 'Verse 1', 'Điệp khúc', 'Refrain', 'Interlude', 'Verse 2',
    'Điệp khúc 2', 'Refrain 2', 'Bridge', 'Điệp khúc 3', 'Refrain 3', 'Outro']);
  assert.deepStrictEqual(form[1].bars, [9, 10, 11, 12, 13, 14, 15, 16, 9, 10, 11, 12, 13, 14, 15, 17]);
  assert.deepStrictEqual(form[7].bars.slice(-1), [47]);
  assert.strictEqual(form.reduce((a, x) => a + x.bars.length, 0), 96);
  form.forEach((x) => x.bars.forEach((n) => assert.ok(bars[n], `bar ${n} missing`)));
});

test('sheet bars add up: left hand fills 4 beats, chords are known, at most 3 notes at once', () => {
  const NAMES_OK = ['C', 'Dm', 'Em', 'F', 'G', 'Am', 'Csus4'];
  for (const [n, bar] of Object.entries(SONG.sheet.bars)) {
    bar.chords.split(' ').forEach((c) => assert.ok(NAMES_OK.includes(c), `bar ${n}: chord ${c}`));
    const ends = bar.lh.map(([, st, len]) => st + len);
    assert.strictEqual(Math.max(...ends), 4, `bar ${n}: left hand does not end on beat 4`);
    bar.lh.forEach(([notes]) => assert.ok(notes.split(' ').length <= 3, `bar ${n}: ${notes}`));
    bar.rh.forEach(([note, st, len]) => {
      assert.ok(st >= -1 && st < 4 && len > 0, `bar ${n}: ${note} at ${st}`);
      assert.ok(noteToMidi(note) >= noteToMidi('E4') && noteToMidi(note) <= noteToMidi('B5'), `bar ${n}: ${note}`);
    });
  }
});

test('original right hand is one melody line with no counting errors', () => {
  const rh = songEvents(undefined, 'orig').filter((e) => e.hand === 'R');
  assert.ok(rh.length > 600, `only ${rh.length} notes`);
  let gaps = 0;
  rh.forEach((e, i) => {
    const next = rh[i + 1];
    if (!next) return;
    const end = Math.round((e.start + e.b) * 1000) / 1000;
    assert.ok(end <= next.start + 1e-9, `${e.notes[0]} at ${e.start} overlaps ${next.notes[0]} at ${next.start}`);
    gaps += next.start - end;
  });
  assert.ok(gaps < 3, `${gaps} beats of unexpected rests`);
});

test('original left hand shows the sheet chord names', () => {
  const lh = songEvents('Intro', 'orig').filter((e) => e.hand === 'L' && e.chord);
  assert.deepStrictEqual(lh.map((e) => e.chord).slice(0, 7), ['F', 'G', 'Em', 'Am', 'F', 'G', 'C']);
});

test('easy version: basic triads that fill every bar', () => {
  assert.ok(SONG.sections.length >= 5);
  const chords = SONG.sections.flatMap((s) => s.chords);
  chords.forEach(([name, start, len], i) => {
    assert.ok(['C', 'Dm', 'Em', 'F', 'G', 'Am'].includes(name), name);
    assert.strictEqual(start % 2, 0);
    if (i) assert.strictEqual(chords[i - 1][1] + chords[i - 1][2], start, 'gap between chords');
  });
  for (const p of ['block', 'beats', 'bass']) {
    const lh = songEvents(SONG.sections[1].name, 'easy', p).filter((e) => e.hand === 'L');
    assert.ok(lh.length > 0, p);
  }
});

test('Một Nhà: sheet bars add up and the D.S. form is written out', () => {
  const mn = SONGS.find((x) => x.title === 'Một Nhà');
  assert.strictEqual(mn.sheet.bpm, 95);
  assert.strictEqual(mn.sheet.form.reduce((a, x) => a + x.bars.length, 0), 4 + 24 + 24 + 5);
  for (const [n, b] of Object.entries(mn.sheet.bars)) {
    assert.strictEqual(Math.max(...b.lh.map(([, st, len]) => st + len)), 4, `bar ${n}: left hand`);
    if (b.rh.length && n > 4) assert.strictEqual(b.rh.at(-1)[1] + b.rh.at(-1)[2] >= 4, true, `bar ${n}: right hand ends early`);
  }
  const rh = songEvents(undefined, 'orig', 'block', mn).filter((e) => e.hand === 'R' && e.start >= 16);
  rh.forEach((e, i) => {
    const next = rh[i + 1];
    if (next) assert.ok(e.start + e.b <= next.start + 1e-9, `${e.notes[0]} at ${e.start} overlaps`);
  });
  // easy: same melody, triads from the chord names
  const easy = songEvents(undefined, 'easy', 'beats', mn);
  assert.deepStrictEqual(easy.filter((e) => e.hand === 'R'), songEvents(undefined, 'orig', 'block', mn).filter((e) => e.hand === 'R'));
  easy.filter((e) => e.hand === 'L').forEach((e) => assert.strictEqual(e.notes.length, 3));
});
