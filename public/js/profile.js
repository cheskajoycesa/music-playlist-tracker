/* ================= Cassettefy · js/profile.js =================
   The Profile page: display name and library totals (its Spotify part is in spotify.js). */

/* ======================= PROFILE ======================= */
// (Spotify login, import and the Spotify part of this page are in js/spotify.js.)
const P = { editing: false };
// Profile renderer: displays listener information and Spotify connection controls.
function renderProfile() {
  const d = Store.data,
    connected = !!d.spotify;
  const name = d.profile.name || 'Guest listener';
  $('#profName').textContent = name;
  $('#profNameView').hidden = P.editing;
  $('#profNameForm').hidden = !P.editing;
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  $('#profAvatar').innerHTML = connected
    ? html`<span class="display" style="font-size: 34px;">${esc(initials)}</span>`
    : icon('user', 44);
  $('#profAvatar').style.background = connected ? RED : '#8A6A58';
  $('#statTapes').textContent = d.playlists.length;
  $('#statTracks').textContent = d.playlists.reduce((a, p) => a + p.tracks.length, 0);
  $('#statFavs').textContent = d.playlists.filter((p) => p.fav).length;
  renderSpotifyProfile(connected); // js/spotify.js
}
$('#profEdit').addEventListener('click', () => {
  P.editing = true;
  renderProfile();
  $('#dname').value = Store.data.profile.name;
  $('#dname').focus();
  $('#dname').select();
});
$('#profCancel').addEventListener('click', () => {
  P.editing = false;
  renderProfile();
  $('#profEdit').focus();
});
$('#profNameForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const v = $('#dname').value.trim();
  if (v) {
    Store.data.profile.name = v.slice(0, 40);
    Store.save();
    toast('Display name saved.');
  }
  P.editing = false;
  renderProfile();
  $('#profEdit').focus();
});
