const path = require("path");
const express = require("express");
const Database = require('better-sqlite3');
const bodyParser = require("body-parser");
const cors = require("cors");
const { logger, categoryLogger } = require('./utils/logger');
const requestLogger = categoryLogger('request');
const errorLogger = categoryLogger('error');

// Export a function that creates and configures the Express app
module.exports = function createServer(electronApp) {
    const app = express();
    const PORT = 3060;

    // Update the database path handling
    const isDev = process.env.NODE_ENV === 'development';
    const basePath = isDev ? process.cwd() : 
                    process.type === 'renderer' ? path.dirname(process.execPath) :
                    electronApp.getPath('userData');

    // Update database path
    const dbPath = path.join(basePath, "zettelkasten2.db");

    // Update static files path
    const publicPath = path.join(isDev ? __dirname : process.resourcesPath, "public");

    // Middleware
    app.use(bodyParser.json());
    app.use(cors());

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

    // Update the database connection
    const db = new Database(dbPath, { verbose: console.log });

    // Initialize database tables
    db.prepare(`
      CREATE TABLE IF NOT EXISTS notes (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        content_zh TEXT,
        parent_id TEXT,
        FOREIGN KEY (parent_id) REFERENCES notes (id)
      )
    `).run();

    db.prepare(`
      CREATE TABLE IF NOT EXISTS links (
        from_id TEXT,
        to_id TEXT,
        description TEXT,
        weight REAL DEFAULT 1.0,
        FOREIGN KEY (from_id) REFERENCES notes (id),
        FOREIGN KEY (to_id) REFERENCES notes (id),
        PRIMARY KEY (from_id, to_id)
      )
    `).run();

    // API Endpoints

    // 1. Add a new note
    app.post("/api/notes", (req, res) => {
        const { id, content, content_zh, parent_id } = req.body;
      
        db.prepare(`
          INSERT INTO notes (id, content, content_zh, parent_id) VALUES (?, ?, ?, ?)
        `).run(id, content, content_zh || null, parent_id || null);
        res.status(201).json({ message: "Note added successfully!" });
    });
    

    // 2. Add a link between notes
    app.post("/api/links", (req, res) => {
        const { from_id, to_id, description, weight } = req.body;
        const weightValue = parseFloat(weight || 1.0);
      
        // Validate weight range
        if (weightValue < 0 || weightValue > 100) {
          return res.status(400).json({ error: "Weight must be between 0 and 100" });
        }
      
        db.prepare(`
          INSERT INTO links (from_id, to_id, description, weight) VALUES (?, ?, ?, ?)
        `).run(from_id, to_id, description || null, weightValue);
        res.status(201).json({ message: "Link added successfully!" });
    });

    // 3. Get all notes and links
    app.get("/api/graph", (req, res) => {
        const lang = req.query.lang || 'en';
        
        const nodesQuery = `
          SELECT 
            n.id,
            ${lang === 'zh' ? 'n.content_zh as content' : 'n.content'},
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

        const nodes = db.prepare(nodesQuery).all();
        const links = db.prepare(linksQuery).all();

        res.json({
            nodes: nodes,
            links: links
        });
    });
    

    // Add a new note and infer parent-child relationship
    app.post("/api/notes/auto-parent", (req, res) => {
        const { id, content } = req.body;
      
        // Infer parent ID
        const parentId = id.slice(0, -1); // Remove the last character to get the parent ID
        const isRoot = parentId === "";   // Root notes have no parent
      
        db.prepare(`
          INSERT INTO notes (id, content) VALUES (?, ?)
        `).run(id, content);
      
        // Add a link to the parent if it's not a root note
        if (!isRoot) {
          db.prepare(`
            INSERT INTO links (from_id, to_id) VALUES (?, ?)
          `).run(parentId, id);
        }
        res.status(201).json({ message: "Note and parent relationship added successfully!" });
    });

    // Fetch all notes and their parent-child relationships
    app.get("/api/notes-table", (req, res) => {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;
        const lang = req.query.lang || 'en';

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
                ${lang === 'zh' ? 'n.content_zh' : 'n.content'} AS child_content,
                n.parent_id,
                ${lang === 'zh' ? 'p.content_zh' : 'p.content'} AS parent_content
            FROM notes n
            LEFT JOIN notes p ON n.parent_id = p.id
            ORDER BY n.id
            LIMIT ? OFFSET ?
        `;

        const countResult = db.prepare(countQuery).get();
        const rows = db.prepare(dataQuery).all(limit, offset);

        res.json({
            rows: rows,
            total: countResult.total,
            page: page,
            limit: limit
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

        const rows = db.prepare(query).all();
        
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
        
        const rows = db.prepare(query).all(...nodeIds);
        
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
        
        const links = db.prepare(linksQuery).all(...filteredIds, ...filteredIds);
        
        res.json({ 
            nodes: rows,
            links: links,
            rootIds: nodeIds 
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

    // 1. Request Logging & ID Generation Middleware (Early in the middleware chain)
    app.use((req, res, next) => {
        req.requestId = generateRequestId();
        requestLogger.info('Incoming request', {
            requestId: req.requestId,
            method: req.method,
            path: req.path,
            query: req.query,
            ip: req.ip
        });
        next();
    });

    // 2. CSP Headers Middleware
    app.use((req, res, next) => {
        res.setHeader(
            "Content-Security-Policy",
            "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://d3js.org; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'"
        );
        next();
    });

    // 3. 404 Handler (After all routes)
    app.use((req, res, next) => {
        requestLogger.warn('Route not found', {
            requestId: req.requestId,
            path: req.path,
            method: req.method
        });
        res.status(404).json({
            error: 'Route not found',
            path: req.path,
            method: req.method
        });
    });

    // 4. Error Handler (Last middleware)
    app.use((err, req, res, next) => {
        errorLogger.error('Unhandled error', {
            requestId: req.requestId,
            error: {
                name: err.name,
                message: err.message,
                stack: err.stack
            },
            request: {
                method: req.method,
                path: req.path,
                query: req.query,
                body: req.body
            }
        });

        // Don't send error details in production
        const isProduction = process.env.NODE_ENV === 'production';
        res.status(500).json({
            error: 'Internal Server Error',
            requestId: req.requestId,
            ...(isProduction ? {} : { details: err.message })
        });
    });

    return app;
};

