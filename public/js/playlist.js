async function loadPlaylists() {
  const res = await fetch("/api/playlists");

  const playlists = await res.json();

  let html = "";

  for (let i = 0; i < playlists.length; i++) {
    const p = playlists[i];

    html += `
      <li>
        <strong>${p.name}</strong>
        <p>${p.description || ""}</p>
        <p>Genre: ${p.genre || ""}</p>
        <p>Mood: ${p.mood || ""}</p>

        <a href="edit.html?id=${p.id}">
          Edit
        </a>

        <button onclick="deletePlaylist(${p.id})">
          Delete
        </button>
      </li>
    `;
  }

  document.getElementById("playlists").innerHTML = html;
}

async function addPlaylist() {
  const playlist = {
    name: document.getElementById("name").value,
    description: document.getElementById("description").value,
    genre: document.getElementById("genre").value,
    mood: document.getElementById("mood").value
  };

  await fetch("/api/playlists", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(playlist)
  });

  loadPlaylists();
}

async function deletePlaylist(id) {
  await fetch("/api/playlists/" + id, {
    method: "DELETE"
  });

  loadPlaylists();
}

async function lookup() {
    const name = document.getElementById("search").value;

    const res = await fetch(
        "https://itunes.apple.com/search?term=" +
        encodeURIComponent(name) +
        "&media=music&limit=10"
    );

    const data = await res.json();

    let html = "";

    for (let i = 0; i < data.results.length; i++) {
        const song = data.results[i];

        html += `
            <li>
                <strong>${song.trackName}</strong>
                <p>Artist: ${song.artistName}</p>
                <p>Album: ${song.collectionName}</p>
            </li>
        `;
    }

    document.getElementById("results").innerHTML = html;
}

loadPlaylists();