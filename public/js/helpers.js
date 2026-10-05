/* ================= Cassettefy · js/helpers.js =================
   Small shared helpers: brand colors and shell colors, $ / $$ to find elements, esc() for safe HTML, the html``
   tag for templates, time formatting, and the duplicate-song check (songKey, hasSong, insertOnSide). */

// Brand colors and the six shell/stripe color pairs a tape can have.
const RED = '#C1272D',
  DRED = '#9B1B22',
  TEAL = '#1E6B65',
  DTEAL = '#174F4A',
  PINK = '#EE8A83',
  MUST = '#F2CF6B',
  PAPER = '#FAF3E0';
const SHELLS = [
  { name: 'Cherry red', shell: RED, stripe: MUST },
  { name: 'Diner teal', shell: TEAL, stripe: PINK },
  { name: 'Mustard', shell: MUST, stripe: TEAL },
  { name: 'Soda pink', shell: PINK, stripe: TEAL },
  { name: 'Night teal', shell: DTEAL, stripe: PINK },
  { name: 'Kraft', shell: '#E4D3A8', stripe: RED },
];
const LIGHT_SHELLS = ['#F2CF6B', '#EE8A83', '#E4D3A8'];
const GENRES = [
  'Disco',
  'Funk',
  'Soul',
  'Europop',
  'Electronic',
  'Doo-wop',
  "Rock 'n' roll",
  'Pop',
  'Easy listening',
  'R&B',
  'Jazz',
  'Hip-hop',
];

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = (s) =>
  String(s == null ? '' : s).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
/**
 * Tag for HTML template strings: html`<div>...</div>`.
 * Lets markup be written across several indented lines without adding stray spaces to the page:
 * a line break next to a tag (or next to a ${value}) is removed; one between words or attributes
 * becomes a single space.
 */
const html = (strings, ...values) =>
  strings.reduce((out, s, i) => {
    const clean = s
      .replace(/>\s*\n\s*/g, '>')
      .replace(/\s*\n\s*</g, '<')
      .replace(/^\s*\n\s*|\s*\n\s*$/g, '')
      .replace(/\s*\n\s*/g, ' ');
    return out + clean + (i < values.length ? values[i] : '');
  }, '');
const uid = () => Math.random().toString(36).slice(2, 10);
const pad2 = (n) => (n < 10 ? '0' : '') + n;
const durOk = (t) => /^\d{1,3}:[0-5]\d$/.test(String(t || '').trim());
// Converts a "m:ss" duration to seconds (0 if the text isn't a valid duration).
function secs(t) {
  const m = /^(\d{1,3}):([0-5]\d)$/.exec(String(t || '').trim());
  return m ? +m[1] * 60 + +m[2] : 0;
}
// Formats seconds as "m:ss", or "h:mm:ss" from an hour up.
function fmt(s) {
  s = Math.max(0, Math.round(s || 0));
  const h = Math.floor(s / 3600),
    m = Math.floor((s % 3600) / 60),
    r = s % 60;
  return h ? h + ':' + pad2(m) + ':' + pad2(r) : m + ':' + pad2(r);
}
const tapeSeconds = (tape) => tape.tracks.reduce((a, t) => a + secs(t.time), 0);
const tapeMeta = (tape) =>
  `${tape.tracks.length} ${tape.tracks.length === 1 ? 'track' : 'tracks'} · ${Math.round(tapeSeconds(tape) / 60)} min`;
const shell2 = (shell) => (LIGHT_SHELLS.includes(shell) ? RED : shell);
const orderTracks = (tape) =>
  tape.tracks.filter((t) => t.side === 'A').concat(tape.tracks.filter((t) => t.side === 'B'));

/**
 * Identity of a song for spotting duplicates: title + main artist, ignoring capitals, accents,
 * punctuation and guest artists ("feat. …", "A, B" → "A"). Works for non-Latin titles too.
 */
function songKey(song) {
  const clean = (s) =>
    String(s || '')
      .normalize('NFKD')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, '');
  const mainArtist = String(song.artist || '').split(/,|&|\s(?:feat\.?|ft\.?|featuring|with)\s/i)[0];
  return clean(song.title) + '|' + clean(mainArtist);
}
/** True if the tape already has this song (same Spotify track, or same title and main artist). */
function hasSong(tape, song) {
  const key = songKey(song);
  return (tape.tracks || []).some(
    (t) => (song.spotifyUri && t.spotifyUri === song.spotifyUri) || songKey(t) === key,
  );
}

/** Puts a song at the end of its side. Returns false (and adds nothing) if the tape already has it. */
function insertOnSide(tape, track) {
  if (!tape || !track) return false;

  if (!Array.isArray(tape.tracks)) {
    tape.tracks = [];
  }
  if (hasSong(tape, track)) return false;

  if (track.side === 'A') {
    const firstB = tape.tracks.findIndex((t) => t.side === 'B');

    if (firstB === -1) {
      tape.tracks.push(track);
    } else {
      tape.tracks.splice(firstB, 0, track);
    }
  } else {
    tape.tracks.push(track);
  }
  return true;
}

// Friendly play time: "Today, 3:05 PM", "Yesterday, …", a weekday within the week, otherwise "Sep 12".
function timeLabel(ts) {
  const d = new Date(ts),
    now = new Date();
  const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(now) - day(d)) / 86400000);
  const clock = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (diff === 0) return 'Today, ' + clock;
  if (diff === 1) return 'Yesterday, ' + clock;
  if (diff < 7) return d.toLocaleDateString([], { weekday: 'long' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
// The day heading a timestamp falls under on the Recent page.
function groupLabel(ts) {
  const d = new Date(ts),
    now = new Date();
  const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(now) - day(d)) / 86400000);
  return diff === 0 ? 'TODAY' : diff === 1 ? 'YESTERDAY' : diff < 7 ? 'EARLIER THIS WEEK' : 'EARLIER';
}
