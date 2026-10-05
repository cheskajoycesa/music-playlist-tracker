/* ================= Cassettefy · js/artwork.js =================
   Drawings made from templates: the icons, the logo, the big cassette, the mini tape and the song receipt. */

/* ---------------- icons & art (templates generated from the design) ---------------- */
const ICONS = {
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  star: '<path d="M12 3.2l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 17l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z" fill="currentColor" stroke="none"/>',
  export:
    '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  note: '<path d="M9 17.5V6l10-2v11.5"/><circle cx="6.5" cy="17.5" r="2.5" fill="currentColor"/><circle cx="16.5" cy="15.5" r="2.5" fill="currentColor"/>',
  play: '<path d="M7 4.5l12.5 7.5L7 19.5z" fill="currentColor" stroke="none"/>',
  pause:
    '<rect x="6" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none"/><rect x="14" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none"/>',
  prev: '<path d="M19 5.5L9 12l10 6.5z" fill="currentColor" stroke="none"/><path d="M5.5 5.5v13"/>',
  next: '<path d="M5 5.5L15 12 5 18.5z" fill="currentColor" stroke="none"/><path d="M18.5 5.5v13"/>',
  rew: '<path d="M11.5 6L3 12l8.5 6zM21 6l-8.5 6 8.5 6z" fill="currentColor" stroke="none"/>',
  ffw: '<path d="M12.5 6L21 12l-8.5 6zM3 6l8.5 6L3 18z" fill="currentColor" stroke="none"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="1.5" fill="currentColor" stroke="none"/>',
  eject:
    '<path d="M12 5l7.5 8.5h-15z" fill="currentColor" stroke="none"/><rect x="4.5" y="16" width="15" height="3" rx="1" fill="currentColor" stroke="none"/>',
  heart: '<path d="M12 20s-7.2-4.4-9.1-9.1A5 5 0 0 1 12 6.2a5 5 0 0 1 9.1 4.7C19.2 15.6 12 20 12 20z"/>',
  heartf:
    '<path d="M12 20s-7.2-4.4-9.1-9.1A5 5 0 0 1 12 6.2a5 5 0 0 1 9.1 4.7C19.2 15.6 12 20 12 20z" fill="currentColor"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  pencil: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  trash: '<path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13"/>',
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  chev: '<path d="M6 6l6 6-6 6M13 6l6 6-6 6"/>',
  shuffle:
    '<path d="M3 7h4l10 10h4M3 17h4l3-3M14 10l3-3h4M18.5 4.5L21 7l-2.5 2.5M18.5 14.5L21 17l-2.5 2.5"/>',
  repeat:
    '<path d="M4 12V9.5A3.5 3.5 0 0 1 7.5 6H20M17 3l3 3-3 3M20 12v2.5a3.5 3.5 0 0 1-3.5 3.5H4M7 21l-3-3 3-3"/>',
  vinyl: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.5"/><path d="M7.5 9.5a5 5 0 0 1 2-2"/>',
  vol: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path d="M15.5 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>',
  tape: '<rect x="2.5" y="5" width="19" height="14" rx="2"/><circle cx="8.5" cy="11" r="2"/><circle cx="15.5" cy="11" r="2"/><path d="M6 19l1.5-3h9l1.5 3"/>',
  stack: '<path d="M5 4v16M10 4v16M14.5 5.5l5 14"/>',
  home: '<path d="M3.5 11L12 4l8.5 7M6 9.5V20h12V9.5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  link: '<path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>',
  up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  down: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  back: '<path d="M18 6l-6 6 6 6M11 6l-6 6 6 6"/>',
};
/** One of the ICONS above as an inline <svg>, `size` px square; `extra` adds inline CSS. */
function icon(name, size, extra) {
  const px = size || 22;
  return html`
    <svg width="${px}" height="${px}" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
      style="flex-shrink: 0;${extra || ''}">${ICONS[name]}</svg>`;
}
const LOGO_FULL =
    '<svg width="__S__" height="__S__" viewBox="0 0 200 200" role="img" aria-label="Cassettefy logo" style="flex-shrink: 0; display: block;"><rect x="8" y="14" width="184" height="180" rx="28" fill="#0F3A36"/><rect x="8" y="6" width="184" height="180" rx="28" fill="#1E6B65"/><circle cx="26" cy="22" r="5" fill="#174F4A"/><path d="M23 22h6" stroke="#5E9C93" stroke-width="1.5"/><circle cx="174" cy="22" r="5" fill="#174F4A"/><path d="M171 22h6" stroke="#5E9C93" stroke-width="1.5"/><circle cx="26" cy="170" r="5" fill="#174F4A"/><path d="M23 170h6" stroke="#5E9C93" stroke-width="1.5"/><circle cx="174" cy="170" r="5" fill="#174F4A"/><path d="M171 170h6" stroke="#5E9C93" stroke-width="1.5"/><rect x="24" y="34" width="152" height="108" rx="10" fill="#FAF3E0"/><path d="M24 44a10 10 0 0 1 10-10h132a10 10 0 0 1 10 10v5H24z" fill="#F2CF6B"/><rect x="24" y="52" width="152" height="5" fill="#C1272D"/><text x="100" y="87" text-anchor="middle" font-family="Alfa Slab One, Georgia, serif" font-size="18.5" letter-spacing=".4" fill="#C1272D">CASSETTE<tspan font-family="Yellowtail, cursive" font-size="29" fill="#1E6B65">fy</tspan></text><rect x="48" y="100" width="104" height="32" rx="16" fill="#3A2A22"/><rect x="88" y="109" width="24" height="14" rx="2" fill="none" stroke="#FAF3E0" stroke-opacity=".45" stroke-width="1.5"/><path d="M89 121h22" stroke="#6B3B2A" stroke-width="3"/><circle cx="70" cy="116" r="13.0" fill="#6B3B2A"/><circle cx="70" cy="116" r="10.1" fill="none" stroke="#8A5238" stroke-width="1"/><circle cx="70" cy="116" r="7.5" fill="#FAF3E0"/><circle cx="70" cy="116" r="4.1" fill="#2A1D17"/><rect x="68.7" y="111.3" width="2.7" height="2.2" rx=".6" fill="#FAF3E0" transform="rotate(0 70 116)"/><rect x="68.7" y="111.3" width="2.7" height="2.2" rx=".6" fill="#FAF3E0" transform="rotate(60 70 116)"/><rect x="68.7" y="111.3" width="2.7" height="2.2" rx=".6" fill="#FAF3E0" transform="rotate(120 70 116)"/><rect x="68.7" y="111.3" width="2.7" height="2.2" rx=".6" fill="#FAF3E0" transform="rotate(180 70 116)"/><rect x="68.7" y="111.3" width="2.7" height="2.2" rx=".6" fill="#FAF3E0" transform="rotate(240 70 116)"/><rect x="68.7" y="111.3" width="2.7" height="2.2" rx=".6" fill="#FAF3E0" transform="rotate(300 70 116)"/><circle cx="130" cy="116" r="10.0" fill="#6B3B2A"/><circle cx="130" cy="116" r="7.8" fill="none" stroke="#8A5238" stroke-width="1"/><circle cx="130" cy="116" r="7.5" fill="#FAF3E0"/><circle cx="130" cy="116" r="4.1" fill="#2A1D17"/><rect x="128.7" y="111.3" width="2.7" height="2.2" rx=".6" fill="#FAF3E0" transform="rotate(0 130 116)"/><rect x="128.7" y="111.3" width="2.7" height="2.2" rx=".6" fill="#FAF3E0" transform="rotate(60 130 116)"/><rect x="128.7" y="111.3" width="2.7" height="2.2" rx=".6" fill="#FAF3E0" transform="rotate(120 130 116)"/><rect x="128.7" y="111.3" width="2.7" height="2.2" rx=".6" fill="#FAF3E0" transform="rotate(180 130 116)"/><rect x="128.7" y="111.3" width="2.7" height="2.2" rx=".6" fill="#FAF3E0" transform="rotate(240 130 116)"/><rect x="128.7" y="111.3" width="2.7" height="2.2" rx=".6" fill="#FAF3E0" transform="rotate(300 130 116)"/><path d="M54 186L64 152h72l10 34z" fill="#174F4A"/><circle cx="84" cy="170" r="5" fill="#0F3A36"/><circle cx="116" cy="170" r="5" fill="#0F3A36"/><rect x="96" y="160" width="8" height="6" rx="1" fill="#0F3A36"/></svg>',
  LOGO_MARK =
    '<svg width="__S__" height="__S__" viewBox="0 0 200 200" role="img" aria-label="Cassettefy logo" style="flex-shrink: 0; display: block;"><rect x="8" y="14" width="184" height="180" rx="28" fill="#0F3A36"/><rect x="8" y="6" width="184" height="180" rx="28" fill="#1E6B65"/><circle cx="26" cy="22" r="5" fill="#174F4A"/><path d="M23 22h6" stroke="#5E9C93" stroke-width="1.5"/><circle cx="174" cy="22" r="5" fill="#174F4A"/><path d="M171 22h6" stroke="#5E9C93" stroke-width="1.5"/><circle cx="26" cy="170" r="5" fill="#174F4A"/><path d="M23 170h6" stroke="#5E9C93" stroke-width="1.5"/><circle cx="174" cy="170" r="5" fill="#174F4A"/><path d="M171 170h6" stroke="#5E9C93" stroke-width="1.5"/><rect x="24" y="34" width="152" height="108" rx="10" fill="#FAF3E0"/><path d="M24 44a10 10 0 0 1 10-10h132a10 10 0 0 1 10 10v5H24z" fill="#F2CF6B"/><rect x="24" y="52" width="152" height="5" fill="#C1272D"/><rect x="36" y="70" width="128" height="56" rx="28" fill="#3A2A22"/><rect x="88" y="88" width="24" height="20" rx="2" fill="none" stroke="#FAF3E0" stroke-opacity=".45" stroke-width="2"/><path d="M89 105h22" stroke="#6B3B2A" stroke-width="4"/><circle cx="66" cy="98" r="22.0" fill="#6B3B2A"/><circle cx="66" cy="98" r="17.2" fill="none" stroke="#8A5238" stroke-width="1"/><circle cx="66" cy="98" r="12.0" fill="#FAF3E0"/><circle cx="66" cy="98" r="6.6" fill="#2A1D17"/><rect x="63.8" y="90.6" width="4.3" height="3.6" rx=".6" fill="#FAF3E0" transform="rotate(0 66 98)"/><rect x="63.8" y="90.6" width="4.3" height="3.6" rx=".6" fill="#FAF3E0" transform="rotate(60 66 98)"/><rect x="63.8" y="90.6" width="4.3" height="3.6" rx=".6" fill="#FAF3E0" transform="rotate(120 66 98)"/><rect x="63.8" y="90.6" width="4.3" height="3.6" rx=".6" fill="#FAF3E0" transform="rotate(180 66 98)"/><rect x="63.8" y="90.6" width="4.3" height="3.6" rx=".6" fill="#FAF3E0" transform="rotate(240 66 98)"/><rect x="63.8" y="90.6" width="4.3" height="3.6" rx=".6" fill="#FAF3E0" transform="rotate(300 66 98)"/><circle cx="134" cy="98" r="16.0" fill="#6B3B2A"/><circle cx="134" cy="98" r="12.5" fill="none" stroke="#8A5238" stroke-width="1"/><circle cx="134" cy="98" r="12.0" fill="#FAF3E0"/><circle cx="134" cy="98" r="6.6" fill="#2A1D17"/><rect x="131.8" y="90.6" width="4.3" height="3.6" rx=".6" fill="#FAF3E0" transform="rotate(0 134 98)"/><rect x="131.8" y="90.6" width="4.3" height="3.6" rx=".6" fill="#FAF3E0" transform="rotate(60 134 98)"/><rect x="131.8" y="90.6" width="4.3" height="3.6" rx=".6" fill="#FAF3E0" transform="rotate(120 134 98)"/><rect x="131.8" y="90.6" width="4.3" height="3.6" rx=".6" fill="#FAF3E0" transform="rotate(180 134 98)"/><rect x="131.8" y="90.6" width="4.3" height="3.6" rx=".6" fill="#FAF3E0" transform="rotate(240 134 98)"/><rect x="131.8" y="90.6" width="4.3" height="3.6" rx=".6" fill="#FAF3E0" transform="rotate(300 134 98)"/><path d="M54 186L64 152h72l10 34z" fill="#174F4A"/><circle cx="84" cy="170" r="5" fill="#0F3A36"/><circle cx="116" cy="170" r="5" fill="#0F3A36"/><rect x="96" y="160" width="8" height="6" rx="1" fill="#0F3A36"/></svg>';
const logoSVG = (size, variant) => (variant === 'mark' ? LOGO_MARK : LOGO_FULL).split('__S__').join(size);
const TAPE_TPL =
  '<div class="tapebox" style="__BOX__"><div style="font-size: 1cqi; position: relative; width: 100em; background: __SHELL__; border-radius: 5em; padding: 4.5em 4.5em 0; box-shadow: 0 1.2em 0 rgba(58,42,34,.28);"><span style="position: absolute; left: 1.8em; top: 1.8em; width: 1.8em; height: 1.8em; border-radius: 50%; background: rgba(0,0,0,.28);"></span><span style="position: absolute; right: 1.8em; top: 1.8em; width: 1.8em; height: 1.8em; border-radius: 50%; background: rgba(0,0,0,.28);"></span><span style="position: absolute; left: 1.8em; bottom: 1.8em; width: 1.8em; height: 1.8em; border-radius: 50%; background: rgba(0,0,0,.28);"></span><span style="position: absolute; right: 1.8em; bottom: 1.8em; width: 1.8em; height: 1.8em; border-radius: 50%; background: rgba(0,0,0,.28);"></span><div style="background: #FAF3E0; border-radius: 2em; padding: 3em 4em 3.5em; display: flex; flex-direction: column; align-items: center; gap: 2.5em;"><div style="width: 100%; display: flex; align-items: center; gap: 2.5em;"><span style="width: 7.5em; height: 7.5em; flex-shrink: 0; border-radius: 1em; background: __SHELL2__; display: flex; align-items: center; justify-content: center;"><span class="display" style="font-size: 5em; color: #FAF3E0; line-height: 1;">__SIDE__</span></span><span class="script" style="flex-grow: 1; min-width: 0; text-align: center; font-size: 7.5em; line-height: 1.1; color: #4A2C22; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">__TITLE__</span><span style="width: 7.5em; flex-shrink: 0; text-align: right;"><span style="font-size: max(9px, 2.6em); font-weight: 700; letter-spacing: .06em; color: #4A2C22;">C-60</span></span></div><div style="width: 100%; display: flex; flex-direction: column; gap: .6em;"><div style="height: 1.2em; background: __STRIPE__;"></div><div style="height: 1.2em; background: __SHELL2__;"></div></div><div style="width: 80%; height: 20em; background: #3A2A22; border-radius: 10em; padding: 0 3em; display: flex; align-items: center; justify-content: space-between; gap: 3em;"><svg class="reel" viewBox="-50 -50 100 100" aria-hidden="true" style="width: 15.5em; height: 15.5em; flex-shrink: 0;"><circle r="46" fill="#6B3B2A"/><circle r="30" fill="none" stroke="#83503A" stroke-width="1"/><circle r="36" fill="none" stroke="#83503A" stroke-width="1"/><circle r="42" fill="none" stroke="#83503A" stroke-width="1"/><circle r="26" fill="#FAF3E0"/><circle r="13" fill="#2A1D17"/><rect x="-3" y="-13" width="6" height="6" rx="1" transform="rotate(0)" fill="#FAF3E0"/><rect x="-3" y="-13" width="6" height="6" rx="1" transform="rotate(60)" fill="#FAF3E0"/><rect x="-3" y="-13" width="6" height="6" rx="1" transform="rotate(120)" fill="#FAF3E0"/><rect x="-3" y="-13" width="6" height="6" rx="1" transform="rotate(180)" fill="#FAF3E0"/><rect x="-3" y="-13" width="6" height="6" rx="1" transform="rotate(240)" fill="#FAF3E0"/><rect x="-3" y="-13" width="6" height="6" rx="1" transform="rotate(300)" fill="#FAF3E0"/><circle cx="0" cy="-19" r="3" fill="#2A1D17"/><circle cx="16.5" cy="9.5" r="3" fill="#2A1D17"/><circle cx="-16.5" cy="9.5" r="3" fill="#2A1D17"/></svg><div style="flex-grow: 1; height: 44%; border: 2px solid rgba(250,243,224,.35); border-radius: 4px; display: flex; align-items: flex-end;"><div style="width: 100%; height: 1em; min-height: 3px; background: #6B3B2A;"></div></div><svg class="reel" viewBox="-50 -50 100 100" aria-hidden="true" style="width: 15.5em; height: 15.5em; flex-shrink: 0;"><circle r="34" fill="#6B3B2A"/><circle r="30" fill="none" stroke="#83503A" stroke-width="1"/><circle r="26" fill="#FAF3E0"/><circle r="13" fill="#2A1D17"/><rect x="-3" y="-13" width="6" height="6" rx="1" transform="rotate(0)" fill="#FAF3E0"/><rect x="-3" y="-13" width="6" height="6" rx="1" transform="rotate(60)" fill="#FAF3E0"/><rect x="-3" y="-13" width="6" height="6" rx="1" transform="rotate(120)" fill="#FAF3E0"/><rect x="-3" y="-13" width="6" height="6" rx="1" transform="rotate(180)" fill="#FAF3E0"/><rect x="-3" y="-13" width="6" height="6" rx="1" transform="rotate(240)" fill="#FAF3E0"/><rect x="-3" y="-13" width="6" height="6" rx="1" transform="rotate(300)" fill="#FAF3E0"/><circle cx="0" cy="-19" r="3" fill="#2A1D17"/><circle cx="16.5" cy="9.5" r="3" fill="#2A1D17"/><circle cx="-16.5" cy="9.5" r="3" fill="#2A1D17"/></svg></div></div><div style="margin: 2.5em auto 0; width: 62%; height: 8.5em; background: rgba(0,0,0,.2); clip-path: polygon(7% 0, 93% 0, 100% 100%, 0 100%); display: flex; align-items: center; justify-content: center; gap: 30%;"><span style="width: 2.2em; height: 2.2em; border-radius: 50%; background: rgba(0,0,0,.35);"></span><span style="width: 2.2em; height: 2.2em; border-radius: 50%; background: rgba(0,0,0,.35);"></span></div></div></div>';
// The big cassette drawing for a tape. opts.side = letter on the label, opts.box = extra CSS for the wrapper.
function tapeHTML(t, opts) {
  opts = opts || {};
  return TAPE_TPL.split('__SHELL2__')
    .join(shell2(t.shell))
    .split('__SHELL__')
    .join(t.shell)
    .split('__STRIPE__')
    .join(t.stripe)
    .split('__TITLE__')
    .join(esc(t.name))
    .split('__SIDE__')
    .join(opts.side || 'A')
    .split('__BOX__')
    .join(opts.box || '');
}
const MINI_TPL =
  '<svg width="__W__" height="__H__" viewBox="0 0 80 52" aria-hidden="true" style="flex-shrink: 0;"><rect width="80" height="52" rx="6" fill="__SHELL__"/><rect x="6" y="6" width="68" height="29" rx="3" fill="#FAF3E0"/><rect x="6" y="6" width="68" height="5" fill="__STRIPE__"/><rect x="19" y="17" width="42" height="13" rx="6.5" fill="#3A2A22"/><circle cx="27" cy="23.5" r="4" fill="#FAF3E0"/><circle cx="53" cy="23.5" r="4" fill="#FAF3E0"/><path d="M17 52l4-11h38l4 11z" fill="#000" fill-opacity=".2"/></svg>';
const miniTape = (w, shell, stripe) =>
  MINI_TPL.split('__W__')
    .join(w)
    .split('__H__')
    .join(Math.round((w * 52) / 80))
    .split('__SHELL__')
    .join(shell)
    .split('__STRIPE__')
    .join(stripe);

/* ---------------- receipt ---------------- */
/**
 * The paper "receipt" listing a tape's songs by side, with subtotals and total time.
 * opts.sel = id of the highlighted line, opts.mark = icon on that line ('pencil' or 'vol'),
 * opts.note = the hint printed at the bottom, opts.trash = a remove button on every song (the editor's
 * Edit songs popup).
 */
function receiptHTML(tape, opts) {
  opts = opts || {};
  const mark = opts.mark || 'pencil';
  const verb = mark === 'pencil' ? 'Edit' : 'Play';
  let n = 0;

  const row = (t) => {
    n++;
    const on = t.id === opts.sel;
    const num = pad2(n);
    // opts.trash: a plain line with a remove button at the end (used by the Edit songs popup in edit.html).
    if (opts.trash) {
      return html`
        <div class="r-row with-trash" data-track="${t.id}">
          <span>${num}</span>
          <span style="min-width: 0;">
            <span class="r-t"><b>${esc(t.title || 'Untitled')}</b><span class="r-lead"></span></span>
            <span class="r-sub">${esc(t.artist || 'Unknown artist')} · ${esc(t.genre || '—')}</span>
          </span>
          <span class="r-time">${esc(t.time || '-:--')}</span>
          <button type="button" class="r-trash" data-remove="${t.id}"
            aria-label="Remove ${esc(t.title || 'this song')} from the tape">${icon('trash', 18)}</button>
        </div>`;
    }
    return html`
      <button type="button" class="r-row${on ? ' on' : ''}" data-track="${t.id}" aria-pressed="${on}"
        aria-label="${verb} line ${num}, ${esc(t.title || 'untitled')}">
        <span>${num}</span>
        <span style="min-width: 0;">
          <span class="r-t"><b>${esc(t.title || 'Untitled')}</b><span class="r-lead"></span></span>
          <span class="r-sub">${esc(t.artist || 'Unknown artist')} · ${esc(t.genre || '—')}</span>
        </span>
        <span class="r-time">${esc(t.time || '-:--')}</span>
        <span class="r-mark">${on ? icon(mark, 16) : ''}</span>
      </button>`;
  };

  const A = tape.tracks.filter((t) => t.side === 'A');
  const B = tape.tracks.filter((t) => t.side === 'B');
  const sum = (arr) => arr.reduce((a, t) => a + secs(t.time), 0);
  const side = (arr) => (arr.length ? arr.map(row).join('') : '<div class="r-empty">(blank side)</div>');

  const d = new Date(tape.createdAt || Date.now());
  const clock = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const date = `${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}/${d.getFullYear()} · ${clock}`;
  const no = String(Store.tapeNo(tape) || 1).padStart(3, '0');
  const star = icon('star', 15, ' vertical-align: -0.08em;'); // drawn, so no system symbol font is needed
  const stamp = tape.fav
    ? html`<div class="stamp" aria-label="Favorite tape">${icon('heartf', 20)}TOP<br>SHELF</div>`
    : '';

  return html`
    <div class="receipt">
      <div class="r-c">
        <div class="display" style="font-size: 20px; color: #C1272D; letter-spacing: .04em;">${star} CASSETTEFY TAPE CO. ${star}</div>
        <div style="font-size: 14px; letter-spacing: .12em; margin-top: 4px;">MIXTAPE RECEIPT</div>
        <div style="font-size: 14px; margin-top: 2px;">TAPE No. ${no} · C-60 CASSETTE</div>
        <div style="font-size: 14px;">${esc(date)}</div>
      </div>
      <div class="r-rule"></div>
      <div class="r-namebox">
        ${stamp}
        <div style="font-size: 20px; font-weight: 700; text-transform: uppercase; line-height: 1.2; padding: 0 ${tape.fav ? '96px' : '6px'} 0 6px;">${esc(tape.name)}</div>
        <div style="font-size: 14px; padding: 2px 6px 0; text-transform: uppercase;">GENRE: ${esc(tape.genre || '—')}</div>
      </div>
      <div class="r-rule"></div>
      <div class="r-head"><span>#</span><span>ITEM</span><span style="text-align: right;">TIME</span><span></span></div>
      <div class="r-songs">
        <div class="r-side">&#8212; SIDE A &#8212;</div>
        ${side(A)}
        <div class="r-side">&#8212; SIDE B &#8212;</div>
        ${side(B)}
      </div>
      <div class="r-rule"></div>
      <div class="r-line"><span>SUBTOTAL SIDE A</span><span class="r-time">${fmt(sum(A))}</span></div>
      <div class="r-line"><span>SUBTOTAL SIDE B</span><span class="r-time">${fmt(sum(B))}</span></div>
      <div class="r-rule dbl"></div>
      <div class="r-line"><span>TRACKS</span><span class="r-time">${tape.tracks.length}</span></div>
      <div class="r-line" style="font-size: 20px; font-weight: 700; background: linear-gradient(transparent 55%, #FF9ED2 55%);">
        <span>TOTAL TIME</span><span class="r-time">${fmt(sum(A) + sum(B))}</span>
      </div>
      <div class="r-rule"></div>
      <div class="barcode" aria-hidden="true"></div>
      <div class="r-c" style="font-size: 13px; letter-spacing: .1em;">*** ${esc(opts.note || 'CLICK ANY LINE TO EDIT IT')} ***</div>
      <div class="r-c" style="font-size: 12px; margin-top: 4px; color: #6B5A48;">KEEP THIS RECEIPT · PLAY IT LOUD</div>
    </div>`;
}
