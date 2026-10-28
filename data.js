// White keys on the home row A..' (A3..D5), black keys on the row above. Must stay in pitch order.
// Keyed by KeyboardEvent.code so it works with any keyboard layout / Vietnamese IME.
const KEYMAP = {
  KeyA: 'A3', KeyW: 'A#3', KeyS: 'B3', KeyD: 'C4', KeyR: 'C#4', KeyF: 'D4', KeyT: 'D#4',
  KeyG: 'E4', KeyH: 'F4', KeyU: 'F#4', KeyJ: 'G4', KeyI: 'G#4', KeyK: 'A4', KeyO: 'A#4',
  KeyL: 'B4', Semicolon: 'C5', BracketLeft: 'C#5', Quote: 'D5',
};

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const SOLFEGE = { C: 'Đô', D: 'Rê', E: 'Mi', F: 'Fa', G: 'Sol', A: 'La', B: 'Si' };
const solfege = (n) => SOLFEGE[n[0]] + (n.includes('#') ? '#' : '');
const noteToMidi = (n) => NAMES.indexOf(n.slice(0, -1)) + 12 * (Number(n.slice(-1)) + 1);
const noteToFreq = (n) => 440 * 2 ** ((noteToMidi(n) - 69) / 12);

// Simplified melody arrangement, transposed so it fits the home-row white keys. Each item: [note, beats].
// shortcut: melody is an approximate arrangement, edit the notes here to match your sheet.
const SONG = {
  title: 'Nơi Này Có Anh',
  artist: 'Sơn Tùng M-TP',
  bpm: 84,
  sections: [
    { name: 'Verse — câu 1', notes: [
      ['A3', .5], ['C4', .5], ['D4', 1], ['D4', .5], ['C4', .5], ['D4', .5], ['F4', .5],
      ['G4', 1], ['F4', .5], ['D4', .5], ['C4', 2],
    ]},
    { name: 'Verse — câu 2', notes: [
      ['A3', .5], ['C4', .5], ['D4', 1], ['D4', .5], ['C4', .5], ['D4', .5], ['F4', .5],
      ['A4', 1], ['G4', .5], ['F4', .5], ['G4', 2],
    ]},
    { name: 'Verse — câu 3', notes: [
      ['F4', .5], ['G4', .5], ['A4', 1], ['A4', .5], ['G4', .5], ['F4', .5], ['D4', .5],
      ['F4', 1], ['D4', .5], ['C4', .5], ['A3', 1], ['C4', 1], ['D4', 2],
    ]},
    { name: 'Điệp khúc — câu 1', notes: [
      ['A4', .5], ['A4', .5], ['G4', .5], ['F4', .5], ['G4', 1], ['A4', .5], ['C5', 1.5],
      ['A4', .5], ['G4', .5], ['F4', 2],
    ]},
    { name: 'Điệp khúc — câu 2', notes: [
      ['D4', .5], ['F4', .5], ['G4', .5], ['A4', .5], ['G4', 1], ['F4', .5], ['D4', 1.5],
      ['F4', .5], ['G4', .5], ['A4', 2],
    ]},
    { name: 'Điệp khúc — câu 3', notes: [
      ['A4', .5], ['C5', .5], ['D5', 1], ['C5', .5], ['A4', .5], ['G4', .5], ['F4', .5],
      ['G4', 1], ['A4', .5], ['G4', .5], ['F4', 1], ['D4', .5], ['F4', 2.5],
    ]},
  ],
};

// Part = text before " — " in the section name ("Verse", "Điệp khúc"); omit for the whole song.
const songNotes = (part) => {
  let start = 0;
  return SONG.sections
    .filter((s) => !part || s.name.startsWith(part + ' '))
    .flatMap((s) => s.notes.map(([n, b], i) => {
      const x = { n, b, start, section: i === 0 ? s.name : null };
      start += b;
      return x;
    }));
};

if (typeof module !== 'undefined') module.exports = { KEYMAP, SONG, noteToFreq, noteToMidi, songNotes, solfege };
