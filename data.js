// Keyboard layout: bottom row = octave 4, top row = octave 5, "I" = C6.
// Keyed by KeyboardEvent.code so it works with any keyboard layout / Vietnamese IME.
const KEYMAP = {
  KeyZ: 'C4', KeyS: 'C#4', KeyX: 'D4', KeyD: 'D#4', KeyC: 'E4', KeyV: 'F4',
  KeyG: 'F#4', KeyB: 'G4', KeyH: 'G#4', KeyN: 'A4', KeyJ: 'A#4', KeyM: 'B4',
  KeyQ: 'C5', Digit2: 'C#5', KeyW: 'D5', Digit3: 'D#5', KeyE: 'E5', KeyR: 'F5',
  Digit5: 'F#5', KeyT: 'G5', Digit6: 'G#5', KeyY: 'A5', Digit7: 'A#5', KeyU: 'B5',
  KeyI: 'C6',
};

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const noteToMidi = (n) => NAMES.indexOf(n.slice(0, -1)) + 12 * (Number(n.slice(-1)) + 1);
const noteToFreq = (n) => 440 * 2 ** ((noteToMidi(n) - 69) / 12);

// Simplified melody arrangement (C major) for practice. Each item: [note, beats].
// shortcut: melody is an approximate arrangement, edit the notes here to match your sheet.
const SONG = {
  title: 'Nơi Này Có Anh',
  artist: 'Sơn Tùng M-TP',
  bpm: 84,
  sections: [
    { name: 'Verse — câu 1', notes: [
      ['E4', .5], ['G4', .5], ['A4', 1], ['A4', .5], ['G4', .5], ['A4', .5], ['C5', .5],
      ['D5', 1], ['C5', .5], ['A4', .5], ['G4', 2],
    ]},
    { name: 'Verse — câu 2', notes: [
      ['E4', .5], ['G4', .5], ['A4', 1], ['A4', .5], ['G4', .5], ['A4', .5], ['C5', .5],
      ['E5', 1], ['D5', .5], ['C5', .5], ['D5', 2],
    ]},
    { name: 'Verse — câu 3', notes: [
      ['C5', .5], ['D5', .5], ['E5', 1], ['E5', .5], ['D5', .5], ['C5', .5], ['A4', .5],
      ['C5', 1], ['A4', .5], ['G4', .5], ['E4', 1], ['G4', 1], ['A4', 2],
    ]},
    { name: 'Điệp khúc — câu 1', notes: [
      ['E5', .5], ['E5', .5], ['D5', .5], ['C5', .5], ['D5', 1], ['E5', .5], ['G5', 1.5],
      ['E5', .5], ['D5', .5], ['C5', 2],
    ]},
    { name: 'Điệp khúc — câu 2', notes: [
      ['A4', .5], ['C5', .5], ['D5', .5], ['E5', .5], ['D5', 1], ['C5', .5], ['A4', 1.5],
      ['C5', .5], ['D5', .5], ['E5', 2],
    ]},
    { name: 'Điệp khúc — câu 3', notes: [
      ['E5', .5], ['G5', .5], ['A5', 1], ['G5', .5], ['E5', .5], ['D5', .5], ['C5', .5],
      ['D5', 1], ['E5', .5], ['D5', .5], ['C5', 1], ['A4', .5], ['C5', 2.5],
    ]},
  ],
};

const songNotes = () =>
  SONG.sections.flatMap((s) => s.notes.map(([n, b], i) => ({ n, b, section: i === 0 ? s.name : null })));

if (typeof module !== 'undefined') module.exports = { KEYMAP, SONG, noteToFreq, songNotes };
