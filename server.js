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
      description TEXT,
      weight REAL DEFAULT 1.0,
      FOREIGN KEY (from_id) REFERENCES notes (id),
      FOREIGN KEY (to_id) REFERENCES notes (id),
      PRIMARY KEY (from_id, to_id)
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
    const { from_id, to_id, description, weight } = req.body;
    const weightValue = parseFloat(weight || 1.0);
  
    // Validate weight range
    if (weightValue < 0 || weightValue > 100) {
      return res.status(400).json({ error: "Weight must be between 0 and 100" });
    }
  
    db.run(
      "INSERT INTO links (from_id, to_id, description, weight) VALUES (?, ?, ?, ?)",
      [from_id, to_id, description || null, weightValue],
      (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ message: "Link added successfully!" });
      }
    );
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

// server.js (modified GET /api/notes endpoint)

app.get('/api/notes', async (req, res) => {
    const page = parseInt(req.query.page) || 1; // Default to page 1 if not provided
    const pageSize = parseInt(req.query.pageSize) || 10; // Default page size of 10

    if (isNaN(page) || isNaN(pageSize) || page < 1 || pageSize < 1) {
        return res.status(400).json({ error: 'Invalid page or pageSize parameters.' });
    }

    const offset = (page - 1) * pageSize;

    try {
        const notes = await db.all(`
            SELECT
                n1.id AS child_id,
                n1.content AS child_content,
                n2.id AS parent_id,
                n2.content AS parent_content,
                l.weight
            FROM notes n1
            LEFT JOIN links l ON n1.id = l.to_id
            LEFT JOIN notes n2 ON l.from_id = n2.id
            ORDER BY n1.id
            LIMIT ? OFFSET ?; -- Add LIMIT and OFFSET for pagination
        `, [pageSize, offset]);

        const totalNotesResult = await db.get("SELECT COUNT(*) AS total FROM notes");
        const totalNotes = totalNotesResult.total;
        const totalPages = Math.ceil(totalNotes / pageSize);

        res.json({
            notes: notes,
            page: page,
            pageSize: pageSize,
            totalNotes: totalNotes,
            totalPages: totalPages
        });

    } catch (error) {
        console.error('Error fetching notes with pagination:', error);
        res.status(500).json({ error: 'Failed to fetch notes.' });
    }
});


app.get("/api/hierarchy", (req, res) => {
    db.all(`
      WITH RECURSIVE hierarchy(
        id, 
        content,
        parent_id,
        depth
      ) AS (
        SELECT 
          id,
          content,
          parent_id,
          0
        FROM notes
        WHERE parent_id IS NULL
        
        UNION ALL
        
        SELECT
          n.id,
          n.content,
          n.parent_id,
          h.depth + 1
        FROM notes n
        JOIN hierarchy h ON n.parent_id = h.id
      )
      SELECT * FROM hierarchy
    `, (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    });
  });

// Recursive descendant query endpoint
app.get("/api/filter/:nodeId", (req, res) => {
    const nodeId = req.params.nodeId;
  
    const query = `
      WITH RECURSIVE descendants(id, depth) AS (
        SELECT id, 0 
        FROM notes 
        WHERE id = ?
        UNION ALL
        SELECT n.id, d.depth + 1
        FROM notes n
        JOIN descendants d ON n.parent_id = d.id
      )
      SELECT 
        n.id AS child_id,
        n.content AS child_content,
        n.parent_id,
        p.content AS parent_content
      FROM descendants d
      JOIN notes n ON d.id = n.id
      LEFT JOIN notes p ON n.parent_id = p.id
      ORDER BY d.depth ASC;
    `;
  
    db.all(query, [nodeId], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      if (rows.length === 0) return res.status(404).json({ error: "Node not found" });
  
      const filteredIds = rows.map(r => r.child_id);
      
      // Get links that connect filtered nodes
      db.all(
        `SELECT * FROM links 
         WHERE from_id IN (${filteredIds.map(() => '?').join(',')}) 
           AND to_id IN (${filteredIds.map(() => '?').join(',')})`,
        [...filteredIds, ...filteredIds],
        (err, links) => {
          if (err) return res.status(500).json({ error: err.message });
          
          // Include the root node's parent if exists
          const rootNode = rows.find(r => r.child_id === nodeId);
          if (rootNode?.parent_id) {
            links.push({ from_id: rootNode.parent_id, to_id: nodeId });
          }
  
          res.json({ 
            nodes: rows,
            links: links,
            rootId: nodeId 
          });
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

