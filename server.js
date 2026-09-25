const express = require("express");
const cors = require("cors");

const db = require("./db");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

//Get all playlists
app.get("/api/playlists", (req, res) => {
  res.json(db.read());
});

//Create a new playlist
app.post("/api/playlists", (req, res) => {
  const playlists = db.read();

  const playlist = {
    id: Date.now(),
    ...req.body
  };

  playlists.push(playlist);

  db.write(playlists);

  res.status(201).json(playlist);
});

// Update a playlist
app.put("/api/playlists/:id", (req, res) => {
  const playlists = db.read();

  const playlist = playlists.find(
    (p) => p.id == req.params.id
  );

  if (!playlist) {
    return res.status(404).json({
      message: "Playlist not found"
    });
  }

  Object.assign(playlist, req.body);

  db.write(playlists);

  res.json(playlist);
});

//Remove a playlist
app.delete("/api/playlists/:id", (req, res) => {
  const playlists = db.read();

  const updatedPlaylists = playlists.filter(
    (p) => p.id != req.params.id
  );

  if (updatedPlaylists.length === playlists.length) {
    return res.status(404).json({
      message: "Playlist not found"
    });
  }

  db.write(updatedPlaylists);

  res.json({
    message: "Playlist deleted"
  });
});

//Server
app.listen(3000, () => {
  console.log(
    "Server running at http://127.0.0.1:3000/index.html"
  );
});