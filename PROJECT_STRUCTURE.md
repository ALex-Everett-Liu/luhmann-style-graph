# Luhmann-Style Graph Project Structure

## Table of Contents
1. [Project Overview](#project-overview)
2. [Core Components](#core-components)
3. [Main Workflow](#main-workflow)
4. [Error Handling](#error-handling)
5. [Future Extensions](#future-extensions)
6. [Technical Stack](#technical-stack)
7. [Build Process](#build-process)
8. [Key Interfaces](#key-interfaces)

## Project Overview

### Purpose
A desktop knowledge management system built with Electron, implementing a Zettelkasten-style note-taking approach with hierarchical relationships and graph-based visualizations.

### Key Features
- Hierarchical note organization
- Graph-based visualization
- Mind map view
- Interactive filtering
- Parent-child relationship management
- Weighted connections between notes
- Cross-platform desktop application
- Local data storage
- System-level integration
- Offline-first functionality
- Multilingual support (English/Chinese)
- Markdown content editing and storage
- Terminal interface for command-based interactions
- Bookmark system for filter combinations

## Core Components

### 1. Electron Infrastructure (main.js)

#### Main Process
Class: ElectronApp
- createWindow(): Creates and manages the main application window
- startServer(): Initializes the Express server
- setupIPC(): Configures inter-process communication
- handleAppEvents(): Manages application lifecycle events
- getStore(key): Retrieves data from persistent storage
- setStore(key, value): Stores data in persistent storage

#### IPC Communication
Class: IPCManager
- setupMainHandlers(): Configures main process handlers
- setupRendererBridge(): Sets up preload script bridges
- handleLogging(): Manages logging across processes
- showDirectoryPicker(): Opens dialog to select directories

### 2. Server Infrastructure (server.js)

#### Database Connection
Class: DatabaseManager
- getDbPath(): Determines correct database path based on environment
- init(): Initializes SQLite database connection
- handleError(error): Error handling for database operations

#### Server Configuration

Class: ServerConfig
- setupMiddleware(): Configure Express middleware
- setupCSP(): Set Content Security Policy
- setupStaticFiles(): Configure static file serving

### 3. Data Models

#### Notes Model

Class: Note
Properties:
- id: TEXT (Primary Key)
- content: TEXT
- content_zh: TEXT
- parent_id: TEXT (Foreign Key)

Methods:
- create(id, content, content_zh, parent_id) → Promise<void>
- get(id) → Promise<Note>
- getWithChildren(id) → Promise<{note: Note, children: Note[]}>
- update(id, content, content_zh) → Promise<void>
- delete(id) → Promise<void>

#### Links Model

Class: Link
Properties:
- from_id: TEXT
- to_id: TEXT
- description: TEXT
- weight: REAL (Default: 1.0)

Methods:
- create(from_id, to_id, description, weight) → Promise<void>
- get(from_id, to_id) → Promise<Link>
- update(from_id, to_id, properties) → Promise<void>
- delete(from_id, to_id) → Promise<void>

### 4. API Controllers

#### Notes Controller

Class: NotesController
Methods:
- addNote(req, res) → Promise<Response>
  Input: {id: string, content: string, content_zh?: string, parent_id?: string}
  Output: {message: string}

- addNoteWithAutoParent(req, res) → Promise<Response>
  Input: {id: string, content: string}
  Output: {message: string}

- getNotesTable(req, res) → Promise<Response>
  Input: {page: number, limit: number, lang: string}
  Output: {rows: Note[], total: number, page: number, limit: number}

#### Links Controller

Class: LinksController
Methods:
- addLink(req, res) → Promise<Response>
  Input: {from_id: string, to_id: string, description?: string, weight?: number}
  Output: {message: string}

- getGraph(req, res) → Promise<Response>
  Input: {lang: string}
  Output: {nodes: Node[], links: Link[]}

#### Hierarchy Controller

Class: HierarchyController
Methods:
- getHierarchy(req, res) → Promise<Response>
  Input: {lang: string}
  Output: Array<{id: string, content: string, parent_id: string, depth: number, path: string}>

- getHierarchyTest(req, res) → Promise<Response>
  Output: Array<{id: string, content: string, parent_id: string, depth: number, path: string}>

#### Markdown Controller

Class: MarkdownController
Methods:
- getMarkdown(req, res) → Promise<Response>
  Input: {nodeId: string}
  Output: {content: string}

- saveMarkdown(req, res) → Promise<Response>
  Input: {nodeId: string, content: string}
  Output: {success: boolean}

#### Settings Controller

Class: SettingsController
Methods:
- updateMarkdownDir(req, res) → Promise<Response>
  Input: {directory: string}
  Output: {success: boolean, directory: string}

- transferMarkdownFiles(req, res) → Promise<Response>
  Input: {directory: string}
  Output: {success: boolean, results: {success: string[], failed: {file: string, error: string}[]}, newDirectory: string}

### 5. Frontend Components (public/script.js)

#### Visualization Components

Class: GraphVisualizer
Methods:
- updateGraph(nodes, links, rootIds): Renders force-directed graph
- setupZoomControls(): Initializes zoom functionality
- handleNodeDrag(): Manages node dragging
- updateLinkStyles(): Updates link appearances based on weights

Class: MindMapVisualizer
Methods:
- drawMindMap(data): Renders hierarchical mind map
- setupInteractions(): Initializes interactive features
- updateNodeStyles(): Manages node appearances
- handleNodeClick(): Processes node click events
- hasCJK(str): Detects Chinese/Japanese/Korean characters
- getVisualLength(str): Calculates visual length of strings with mixed character sets
- splitIntoLines(str): Splits long text into properly formatted lines
- countNonTreeLinks(nodeId, root): Counts non-hierarchical links for a node

#### Data Management Components

Class: TableManager
Methods:
- loadNotesTable(): Loads and displays table data
- displayTablePage(rows, rootId, totalRows): Renders table page
- updatePagination(totalRows): Updates pagination controls
- changePage(newPage): Handles page changes

Class: FilterManager
Methods:
- addFilter(nodeId): Adds new filter
- removeFilter(nodeId): Removes existing filter
- applyFilters(): Applies current filters
- clearFilters(): Clears all filters
- addFilterBookmark(): Saves current filter combination
- loadBookmarks(): Loads saved filter bookmarks
- saveBookmarks(): Stores filter bookmarks

#### Language Components

Class: LanguageManager
Methods:
- toggleLanguage(): Switches between English and Chinese
- applyLanguage(lang): Updates UI based on selected language
- updateLabels(lang): Changes text labels based on language

#### Markdown Components

Class: MarkdownManager
Methods:
- handleMarkdownClick(nodeId): Opens markdown editor for specified node
- saveMarkdown(nodeId): Saves markdown content
- closeMarkdownModal(): Closes editor modal
- updateMarkdownIndicator(nodeId, hasMarkdown): Updates UI to show markdown status

#### Terminal Components

Class: TerminalManager
Methods:
- initializeTerminal(): Sets up terminal interface
- processCommand(command): Parses and executes commands
- appendToTerminal(text): Displays text in terminal output
- showHelp(): Displays command help information

### 6. Preload Bridge (preload.js)

Class: PreloadBridge
Methods:
- exposeAPIs(): Exposes safe APIs to renderer
- setupLogging(): Configures logging bridge
- setupIPC(): Sets up IPC communication
- openFile(filePath): Opens file with system default application
- showDirectoryPicker(): Opens directory selection dialog

## Main Workflow

### 1. Application Initialization
- Electron app startup
- Window creation
- Express server initialization
- Database connection establishment
- IPC setup
- Settings loading

### 2. Data Flow
- Note Creation → Parent-Child Relationship Establishment → Link Creation
- Hierarchical Structure Maintenance
- Link Weight and Description Management
- Markdown File Management

### 3. Visualization Pipeline
- Data Fetching → Data Processing → Visualization Rendering
- View Switching (Table ↔ Graph ↔ Mind Map ↔ Terminal)
- Filter Application → View Updates
- Language Selection → Content Display Updates

### 4. User Interaction Flow
- Note/Link Creation
- View Navigation
- Filter Application and Bookmark Management
- Pagination Navigation
- Graph/Mind Map Interaction
- Markdown Editing
- Command Execution in Terminal

## Error Handling

Class: ErrorHandler
Methods:
- handleDatabaseError(error): Database-specific error handling
- handleAPIError(error): API endpoint error handling
- handleValidationError(error): Input validation error handling
- handleFileSystemError(error): File system operation error handling

Class: Logger
Methods:
- error(message, meta): Logs errors with metadata
- warn(message, meta): Logs warnings
- info(message, meta): Logs informational messages
- debug(message, meta): Logs debug information
- trace(message, meta): Logs detailed trace information

## Future Extensions

1. Authentication System
   - User management
   - Access control
   - Session handling

2. Data Management
   - Export/Import functionality
   - Version control
   - Backup system

3. Collaborative Features
   - Real-time editing
   - User permissions
   - Change tracking

4. Enhanced Functionality
   - Advanced search
   - Custom filters
   - Tags and categories
   - Full-text search across markdown files

## Technical Stack

### Core Technologies
- Runtime: Electron (v28.0.0)
- Backend: Express.js (v4.x)
- Database: SQLite3 (v5.x)
- Frontend Visualization: D3.js (v7.x)
- UI Framework: Custom CSS/JS (no framework)
- API: REST over local HTTP
- Storage: Combination of SQLite DB and local filesystem for markdown files
- Logger: Winston with daily-rotate-file

### Key Technical Features
- Inter-Process Communication (IPC): Communication between Electron's main and renderer processes
- Context Isolation: Security measure to prevent direct access to Node.js APIs from renderer
- Preload Script: Securely exposes specific Node.js functionality to renderer process
- Content Security Policy (CSP): Prevents XSS attacks and limits resource loading
- Local HTTP Server: Express server running locally for API endpoints
- Persistent Storage: electron-store for app settings persistence
- File System Access: Direct filesystem access for markdown files
- Multi-language Support: Dynamic content loading based on language preference

### Development Tools
- Build System: electron-builder
- Package Manager: npm
- Development Tools: 
  - Electron DevTools
  - Browser DevTools
  - electron-rebuild

### Dependencies
| Package | Version | Purpose |
|---------|---------|---------|
| Electron | ^28.0.0 | Desktop runtime |
| Express.js | ^4.x | Web framework |
| SQLite3 | ^5.x | Database |
| D3.js | ^7.x | Visualization |
| winston | ^3.x | Logging |
| winston-daily-rotate-file | ^4.x | Log rotation |
| electron-store | ^8.x | Persistent settings storage |
| electron-builder | ^24.0.0 | Application packaging |
| electron-rebuild | ^3.2.9 | Native module rebuilding |

## Build Process

### Development Mode
1. Electron initializes main process (main.js)
2. Express server starts on port 3060
3. Electron window loads from http://localhost:3060
4. Preload script (preload.js) bridges main and renderer processes
5. Frontend loads and connects to local API endpoints

### Production Build
1. electron-builder packages application
2. Native modules are rebuilt for target platform with electron-rebuild
3. Assets are bundled into the application package
4. SQLite database is initialized on first run
5. User data is stored in platform-specific locations

### Platform-specific Considerations
- Windows: User data stored in %APPDATA%\luhmann-style-graph
- macOS: User data stored in ~/Library/Application Support/luhmann-style-graph
- Linux: User data stored in ~/.config/luhmann-style-graph

## Key Interfaces

### Database Schema
- notes (id, content, content_zh, parent_id)
- links (from_id, to_id, description, weight)

### API Endpoints
- POST /api/notes: Create a new note
- POST /api/notes/auto-parent: Create a note with automatic parent relationship
- GET /api/notes-table: Get paginated notes with parent relationships
- POST /api/links: Create a link between notes
- GET /api/graph: Get all nodes and links for visualization
- GET /api/hierarchy: Get hierarchical structure of notes
- GET /api/hierarchy-test: Get sample hierarchical data for testing
- GET /api/markdown/:nodeId: Get markdown content for a specific node
- POST /api/markdown/:nodeId: Save markdown content for a specific node
- POST /api/settings/markdown-dir: Update markdown directory setting
- POST /api/settings/transfer-markdown: Transfer markdown files to a new location

### IPC Channels
- log: Send log messages from renderer to main process
- show-directory-picker: Open directory selection dialog from renderer

### User Interface Components
- Note Entry Form: Create new notes with multilingual support
- Link Creation Form: Establish relationships between notes
- View Controls: Switch between Table, Graph, Mind Map, and Terminal views
- Table View: Display notes in tabular format with pagination
- Graph View: Force-directed visualization of notes and their connections
- Mind Map View: Hierarchical visualization of notes
- Terminal View: Command-line interface for advanced operations
- Filter System: Filter notes by ID with bookmarking capability
- Language Toggle: Switch between English and Chinese interfaces
- Markdown Editor: Rich-text editing for each note
- Settings: Configure markdown file storage location