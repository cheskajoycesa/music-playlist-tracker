/* ================= Cassettefy · js/ui.js =================
   Small UI pieces used everywhere: toast messages, two-click confirm buttons, and the now-playing display
   in the sidebar mini player and the bottom player. */

/* ---------------- small UI helpers ---------------- */
// Shows a short message at the bottom of the screen for a few seconds.
function toast(msg) {
  const el = $('#toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.remove('show'), 2800);
}
/** Two-step confirm for destructive buttons (no browser dialogs). */
function confirmClick(btn, label, action) {
  if (btn.dataset.armed === '1') {
    action();
    return;
  }
  btn.dataset.armed = '1';
  btn.dataset.orig = btn.innerHTML;
  btn.classList.add('armed');
  btn.textContent = label;
  setTimeout(() => {
    if (btn.isConnected && btn.dataset.armed === '1') {
      btn.dataset.armed = '';
      btn.classList.remove('armed');
      btn.innerHTML = btn.dataset.orig;
    }
  }, 3500);
}
/** Fills the sidebar mini player + tablet/phone dock with the current track. */
function paintNowPlaying(info) {
  const t = info && info.track,
    tape = info && info.tape;
  $$('[data-np="title"]').forEach((e) => (e.textContent = t ? t.title : 'Nothing playing'));
  $$('[data-np="artist"]').forEach((e) => (e.textContent = t ? t.artist : 'Load a tape in the deck'));
  $$('[data-np="sub"]').forEach(
    (e) => (e.textContent = t ? t.artist + ' · ' + tape.name : 'Load a tape in the deck'),
  );
  // The bottom player's bar is left alone while the listener is dragging it.
  const dragging = document.querySelector('.np-seek.dragging');
  const free = (e) => !dragging || !dragging.parentElement.contains(e);
  $$('[data-np="elapsed"]').forEach((e) => free(e) && (e.textContent = fmt(info ? info.pos : 0)));
  $$('[data-np="total"]').forEach((e) => (e.textContent = fmt(info ? info.dur : 0)));
  $$('[data-np="fill"]').forEach(
    (e) =>
      free(e) && (e.style.width = (info && info.dur ? Math.min(100, (info.pos / info.dur) * 100) : 0) + '%'),
  );
  // Slider values for screen readers and keyboard users.
  $$('[data-np="seek"]').forEach((b) => {
    b.setAttribute('aria-valuenow', Math.round(info ? info.pos : 0));
    b.setAttribute('aria-valuemax', Math.round(info ? info.dur : 0));
    b.setAttribute('aria-valuetext', fmt(info ? info.pos : 0) + ' of ' + fmt(info ? info.dur : 0));
    b.setAttribute('aria-disabled', !(info && info.dur));
  });
  $$('[data-np="tape"]').forEach(
    (e) => (e.innerHTML = miniTape(e.dataset.w || 58, tape ? tape.shell : RED, tape ? tape.stripe : MUST)),
  );
  $$('[data-np="play"]').forEach((b) => {
    b.innerHTML = icon(info && info.playing ? 'pause' : 'play', 22);
    b.setAttribute('aria-label', info && info.playing ? 'Pause' : 'Play');
  });
}
