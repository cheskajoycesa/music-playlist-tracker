const fs = require("fs");

const FILE = "playlists.json";

// Create the file if it does not exist.
if (!fs.existsSync(FILE)) {
  fs.writeFileSync(FILE, "[]");
}

// Read all playlists.
exports.read = () => {
  return JSON.parse(fs.readFileSync(FILE, "utf8"));
};

// Save all playlists.
exports.write = (playlists) => {
  fs.writeFileSync(
    FILE,
    JSON.stringify(playlists, null, 2)
  );
};