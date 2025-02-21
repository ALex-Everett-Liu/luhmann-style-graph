const path = require("path");
const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const bodyParser = require("body-parser");
const cors = require("cors");

const app = express();
const PORT = 3060;

// Fix paths for packaged app
const isDev = !process.pkg;
const basePath = isDev ? process.cwd() : path.dirname(process.execPath);

// Update database path
const dbPath = path.join(basePath, "zettelkasten2.db");

// Update static files path
const publicPath = path.join(isDev ? __dirname : basePath, "public");

// Middleware
app.use(bodyParser.json());
app.use(cors());

// Add CSP headers middleware
app.use((req, res, next) => {
    res.setHeader(
        "Content-Security-Policy",
        "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://d3js.org; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'"
    );
    next();
});

// Serve static files
app.use(express.static(publicPath, {
    setHeaders: (res, path) => {
        // Set proper content type for JavaScript files
        if (path.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript');
        }
        // Set proper content type for CSS files
        if (path.endsWith('.css')) {
            res.setHeader('Content-Type', 'text/css');
        }
    }
}));

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
    const nodesQuery = `
      SELECT 
        n.id,
        n.content,
        n.parent_id
      FROM notes n
    `;

    const linksQuery = `
      SELECT 
        from_id as source,
        to_id as target,
        description,
        weight
      FROM links
    `;

    db.all(nodesQuery, [], (err, nodes) => {
        if (err) return res.status(500).json({ error: err.message });

        db.all(linksQuery, [], (err, links) => {
            if (err) return res.status(500).json({ error: err.message });

            res.json({
                nodes: nodes,
                links: links
            });
        });
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
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // First get total count
    const countQuery = `
        SELECT COUNT(*) as total
        FROM notes n
        LEFT JOIN notes p ON n.parent_id = p.id
    `;

    // Then get paginated data
    const dataQuery = `
        SELECT 
            n.id AS child_id,
            n.content AS child_content,
            n.parent_id,
            p.content AS parent_content
        FROM notes n
        LEFT JOIN notes p ON n.parent_id = p.id
        ORDER BY n.id
        LIMIT ? OFFSET ?
    `;

    db.get(countQuery, [], (err, countResult) => {
        if (err) return res.status(500).json({ error: err.message });

        db.all(dataQuery, [limit, offset], (err, rows) => {
            if (err) return res.status(500).json({ error: err.message });
            
            res.json({
                rows: rows,
                total: countResult.total,
                page: page,
                limit: limit
            });
        });
    });
});

app.get("/api/hierarchy", (req, res) => {
    const query = `
      WITH RECURSIVE hierarchy AS (
        -- Start with root nodes (those without parents)
        SELECT 
          id,
          content,
          parent_id,
          0 as depth,
          id as path
        FROM notes 
        WHERE parent_id IS NULL
        
        UNION ALL
        
        -- Add children
        SELECT 
          n.id,
          n.content,
          n.parent_id,
          h.depth + 1,
          h.path || '/' || n.id
        FROM notes n
        JOIN hierarchy h ON n.parent_id = h.id
      )
      SELECT 
        id,
        content,
        parent_id,
        depth,
        path
      FROM hierarchy
      ORDER BY path;
    `;

    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        
        // Process the data to ensure a single root
        const rootNodes = rows.filter(r => !r.parent_id);
        
        if (rootNodes.length > 1) {
            // Create a new artificial root
            const artificialRoot = {
                id: "root",
                content: "Root",
                parent_id: null,
                depth: 0,
                path: "root"
            };
            
            // Update all original root nodes to point to the artificial root
            const processedRows = rows.map(row => {
                if (!row.parent_id) {
                    return {
                        ...row,
                        parent_id: "root",
                        depth: row.depth + 1,
                        path: `root/${row.id}`
                    };
                }
                return row;
            });
            
            // Add the artificial root to the beginning of the array
            processedRows.unshift(artificialRoot);
            
            res.json(processedRows);
        } else {
            // If there's only one or no root, return the original data
            res.json(rows);
        }
    });
});

// Update the filter endpoint to handle multiple node IDs
app.get("/api/filter-multiple", (req, res) => {
    const nodeIds = req.query.nodes.split(',');
    
    const query = `
      WITH RECURSIVE descendants(id, root_id, depth) AS (
        -- Start with the selected nodes
        SELECT id, id as root_id, 0 
        FROM notes 
        WHERE id IN (${nodeIds.map(() => '?').join(',')})
        
        UNION ALL
        
        -- Add their descendants
        SELECT n.id, d.root_id, d.depth + 1
        FROM notes n
        JOIN descendants d ON n.parent_id = d.id
      )
      SELECT DISTINCT
        n.id AS child_id,
        n.content AS child_content,
        n.parent_id,
        p.content AS parent_content,
        d.root_id
      FROM descendants d
      JOIN notes n ON d.id = n.id
      LEFT JOIN notes p ON n.parent_id = p.id
      ORDER BY d.root_id, d.depth ASC;
    `;
    
    db.all(query, nodeIds, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        if (rows.length === 0) return res.status(404).json({ error: "Nodes not found" });
        
        const filteredIds = rows.map(r => r.child_id);
        
        // Get ALL links where either source or target is in our filtered nodes
        const linksQuery = `
            SELECT 
                from_id as source,
                to_id as target,
                description,
                weight
            FROM links 
            WHERE from_id IN (${filteredIds.map(() => '?').join(',')}) 
               OR to_id IN (${filteredIds.map(() => '?').join(',')})`;
        
        db.all(linksQuery, [...filteredIds, ...filteredIds], (err, links) => {
            if (err) return res.status(500).json({ error: err.message });
            
            res.json({ 
                nodes: rows,
                links: links,
                rootIds: nodeIds 
            });
        });
    });
});

// Add this temporary test endpoint
app.get("/api/hierarchy-test", (req, res) => {
    // Sample test data
    const testData = [
        { id: "root", content: "Root", parent_id: null, depth: 0, path: "root" },
        { id: "1", content: "First Node", parent_id: "root", depth: 1, path: "root/1" },
        { id: "2", content: "Second Node", parent_id: "root", depth: 1, path: "root/2" },
        { id: "1a", content: "Child of First", parent_id: "1", depth: 2, path: "root/1/1a" }
    ];
    res.json(testData);
});

// Add error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

// Add 404 handling
app.use((req, res, next) => {
    res.status(404).send('Sorry, that route does not exist.');
});

// Start the server and open browser
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  // Optionally open browser automatically
  const url = `http://localhost:${PORT}`;
  console.log(`Open ${url} in your browser to use the application`);
});

