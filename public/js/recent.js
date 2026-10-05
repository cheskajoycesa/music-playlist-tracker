/* ================= Cassettefy · js/recent.js =================
   The Recently played page: listening history by day, with Resume and Clear history. */

/* ======================= RECENT ======================= */
// Recent renderer: displays listening history and resume information.
function renderRecent() {
  const items = Store.data.recent.map((r) => ({ r, t: Store.tape(r.playlistId) })).filter((x) => x.t);
  let rows = '';
  let group = '';
  items.forEach(({ r, t }) => {
    // A heading ("TODAY", "YESTERDAY", …) each time the day group changes.
    const g = groupLabel(r.at);
    if (g !== group) {
      rows += `<h2 class="group-h">${g}</h2>`;
      group = g;
    }

    const ord = orderTracks(t);
    const i = Math.max(
      0,
      ord.findIndex((x) => x.id === r.trackId),
    );
    const tr = ord[i];
    const detail = r.done
      ? 'Played to the end of the tape'
      : tr
        ? 'Stopped at ' + tr.title + ' · ' + fmt(r.position)
        : 'Stopped mid-tape';
    const reached = r.done ? ord.length : i + 1;
    const pct = ord.length ? Math.round((reached / ord.length) * 100) : 0;
    const resume = r.done ? '' : ` data-track="${r.trackId}" data-pos="${r.position}"`;

    rows += html`
      <div class="trow ticket">
        <div class="display t-when" style="font-size: 16px; color: #C1272D;">${esc(timeLabel(r.at).replace(/^(Today|Yesterday), /, ''))}</div>
        ${miniTape(64, t.shell, t.stripe)}
        <div style="min-width: 0; display: flex; flex-direction: column; gap: 5px;">
          <div style="font-size: 19px; font-weight: 700;">${esc(t.name)}</div>
          <div class="ellipsis" style="font-size: 15px; color: #6B4A3A;">${esc(detail)}</div>
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="flex: 0 1 220px; height: 8px; border-radius: 4px; background: #E6D6AE; overflow: hidden;">
              <div style="width: ${pct}%; height: 100%; background: #1E6B65;"></div>
            </div>
            <span style="font-size: 13px; color: #6B4A3A; white-space: nowrap;">${reached} of ${ord.length}</span>
          </div>
        </div>
        <button type="button" class="icon-btn t-heart" data-fav="${t.id}" aria-pressed="${!!t.fav}"
          aria-label="${t.fav ? 'Remove from' : 'Add to'} favorites" style="background: transparent; color: #C1272D;">
          ${icon(t.fav ? 'heartf' : 'heart', 22)}
        </button>
        <a href="#deck" data-play="${t.id}"${resume} class="resume-btn" style="background: ${r.done ? TEAL : RED};"
          aria-label="${r.done ? 'Play again ' : 'Resume '}${esc(t.name)}">
          ${icon('play', 16)}<span class="hide-phone">${r.done ? 'Play again' : 'Resume'}</span>
        </a>
      </div>`;
  });
  $('#recentList').innerHTML =
    rows || '<div class="empty-box">Nothing played yet. Load a tape in the deck and press play.</div>';
  const first = items.find((x) => !x.r.done) || items[0];
  const panel = $('#resumePanel');
  if (!first) {
    panel.hidden = true;
    return;
  }
  panel.hidden = false;
  const ord = orderTracks(first.t),
    tr = ord.find((x) => x.id === first.r.trackId) || ord[0];
  $('#resumeTape').innerHTML = tapeHTML(first.t, { side: tr ? tr.side : 'A', box: 'max-width: 280px;' });
  $('#resumeTitle').textContent = tr ? tr.title : first.t.name;
  $('#resumeSub').textContent = tr
    ? tr.artist + ' · Side ' + tr.side + ' · ' + fmt(first.r.position) + ' of ' + tr.time
    : '';
  $('#resumeFill').style.width =
    (tr && secs(tr.time) ? Math.min(100, (first.r.position / secs(tr.time)) * 100) : 0) + '%';
  const btn = $('#resumeBtn');
  btn.dataset.play = first.t.id;
  btn.dataset.track = first.r.trackId;
  btn.dataset.pos = first.r.done ? 0 : first.r.position;
}
$('#clearHistory').addEventListener('click', (e) =>
  confirmClick(e.currentTarget, 'Tap again to clear', () => {
    Store.data.recent = [];
    Store.save();
    toast('History cleared.');
    renderRecent();
  }),
);
