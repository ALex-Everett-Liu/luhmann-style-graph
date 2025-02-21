const path = require("path");
const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const bodyParser = require("body-parser");
const cors = require("cors");

const app = express();
const PORT = 3060;

// 1. Fix database path for EXE
const dbPath = path.join(
    process.cwd(), // Use the EXE's directory
    "zettelkasten2.db"
);

// Middleware
app.use(bodyParser.json());
app.use(cors());

// SQLite Database Setup
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error("Failed to connect to database:", err.message);
  else console.log("Connected to SQLite database.");
});

// Initialize database tables
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      parent_id TEXT,
      FOREIGN KEY (parent_id) REFERENCES notes (id)
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
    const { id, content, parent_id } = req.body;
  
    db.run(
      "INSERT INTO notes (id, content, parent_id) VALUES (?, ?, ?)",
      [id, content, parent_id || null],
      (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ message: "Note added successfully!" });
      }
    );
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
    const query = `
      SELECT 
        n.id AS child_id,
        n.content AS child_content,
        n.parent_id,
        p.content AS parent_content
      FROM notes n
      LEFT JOIN notes p ON n.parent_id = p.id
    `;
  
    db.all(query, [], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
  
      // Format data for D3.js
      const nodes = [];
      const links = [];
  
      rows.forEach((row) => {
        nodes.push({ id: row.child_id, content: row.child_content });
  
        if (row.parent_id) {
          links.push({ source: row.parent_id, target: row.child_id });
        }
      });
  
      res.json({ nodes, links });
    });
});
  

// Add a new note and infer parent-child relationship
app.post("/api/notes/auto-parent", (req, res) => {
    const { id, content } = req.body;
  
    // Infer parent ID
    const parentId = id.slice(0, -1); // Remove the last character to get the parent ID
    const isRoot = parentId === "";   // Root notes have no parent
  
    db.run("INSERT INTO notes (id, content) VALUES (?, ?)", [id, content], (err) => {
      if (err) return res.status(500).json({ error: err.message });
  
      // Add a link to the parent if it's not a root note
      if (!isRoot) {
        db.run("INSERT INTO links (from_id, to_id) VALUES (?, ?)", [parentId, id], (err) => {
          if (err) return res.status(500).json({ error: err.message });
          res.status(201).json({ message: "Note and parent relationship added successfully!" });
        });
      } else {
        res.status(201).json({ message: "Root note added successfully!" });
      }
    });
});

// Fetch all notes and their parent-child relationships
app.get("/api/notes-table", (req, res) => {
    const query = `
      SELECT 
        n.id AS child_id,
        n.content AS child_content,
        n.parent_id,
        p.content AS parent_content
      FROM notes n
      LEFT JOIN notes p ON n.parent_id = p.id
    `;
  
    db.all(query, [], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    });
});

// Recursive descendant query endpoint
app.get("/api/filter/:nodeId", (req, res) => {
    const nodeId = req.params.nodeId;
    
    const query = `
      WITH RECURSIVE descendants(id) AS (
        SELECT id FROM notes WHERE id = ?
        UNION ALL
        SELECT n.id FROM notes n
        INNER JOIN descendants d ON n.parent_id = d.id
      )
      SELECT 
        n.id AS child_id,
        n.content AS child_content,
        n.parent_id,
        p.content AS parent_content
      FROM descendants d
      JOIN notes n ON d.id = n.id
      LEFT JOIN notes p ON n.parent_id = p.id
    `;
  
    db.all(query, [nodeId], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      if (rows.length === 0) return res.status(404).json({ error: "Node not found" });
      
      // Get related links
      const filteredIds = rows.map(r => r.child_id);
      db.all(
        `SELECT * FROM links WHERE from_id IN (${filteredIds.map(() => '?').join(',')}) 
         AND to_id IN (${filteredIds.map(() => '?').join(',')})`,
        [...filteredIds, ...filteredIds],
        (err, links) => {
          if (err) return res.status(500).json({ error: err.message });
          res.json({ nodes: rows, links });
        }
      );
    });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

// Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, "public")));

