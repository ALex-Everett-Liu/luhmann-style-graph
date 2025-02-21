const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const bodyParser = require("body-parser");
const cors = require("cors");

const app = express();
const PORT = 3060;
const path = require("path");

// Middleware
app.use(bodyParser.json());
app.use(cors());

// SQLite Database Setup
const db = new sqlite3.Database("zettelkasten2.db", (err) => {
  if (err) console.error("Failed to connect to database:", err.message);
  else console.log("Connected to SQLite database.");
});

// Initialize database tables
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      content TEXT
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS links (
      from_id TEXT,
      to_id TEXT,
      FOREIGN KEY (from_id) REFERENCES notes (id),
      FOREIGN KEY (to_id) REFERENCES notes (id)
    )
  `);
});

// API Endpoints

// 1. Add a new note
app.post("/api/notes", (req, res) => {
  const { id, content } = req.body;
  db.run("INSERT INTO notes (id, content) VALUES (?, ?)", [id, content], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ message: "Note added successfully!" });
  });
});

// 2. Add a link between notes
app.post("/api/links", (req, res) => {
  const { from_id, to_id } = req.body;
  db.run("INSERT INTO links (from_id, to_id) VALUES (?, ?)", [from_id, to_id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ message: "Link added successfully!" });
  });
});

// 3. Get all notes and links
app.get("/api/graph", (req, res) => {
  const graph = { nodes: [], links: [] };

  db.all("SELECT * FROM notes", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    graph.nodes = rows;

    db.all("SELECT * FROM links", [], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      graph.links = rows;
      res.json(graph);
    });
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, "public")));
