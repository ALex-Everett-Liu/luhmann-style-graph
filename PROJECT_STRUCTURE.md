# Luhmann-Style Graph Project Structure

## Table of Contents
1. [Project Overview](#project-overview)
2. [Core Components](#core-components)
3. [Main Workflow](#main-workflow)
4. [Error Handling](#error-handling)
5. [Future Extensions](#future-extensions)
6. [Technical Stack](#technical-stack)

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

## Core Components

### 1. Electron Infrastructure (main.js)

#### Main Process
Class: ElectronApp
- createWindow(): Creates and manages the main application window
- startServer(): Initializes the Express server
- setupIPC(): Configures inter-process communication
- handleAppEvents(): Manages application lifecycle events

#### IPC Communication
Class: IPCManager
- setupMainHandlers(): Configures main process handlers
- setupRendererBridge(): Sets up preload script bridges
- handleLogging(): Manages logging across processes

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
- parent_id: TEXT (Foreign Key)

Methods:
- create(id, content, parent_id) → Promise<void>
- get(id) → Promise<Note>
- getWithChildren(id) → Promise<{note: Note, children: Note[]}>
- update(id, content) → Promise<void>
- delete(id) → Promise<void>

#### Links Model

Class: Link
Properties:
- from_id: TEXT
- to_id: TEXT
- description: TEXT
- weight: REAL

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
  Input: {id: string, content: string, parent_id?: string}
  Output: {message: string}

- addNoteWithAutoParent(req, res) → Promise<Response>
  Input: {id: string, content: string}
  Output: {message: string}

- getNotesTable(req, res) → Promise<Response>
  Input: {page: number, limit: number}
  Output: {rows: Note[], total: number, page: number, limit: number}

#### Links Controller

Class: LinksController
Methods:
- addLink(req, res) → Promise<Response>
  Input: {from_id: string, to_id: string, description?: string, weight?: number}
  Output: {message: string}

- getGraph(req, res) → Promise<Response>
  Output: {nodes: Node[], links: Link[]}

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

### 6. Preload Bridge (preload.js)

Class: PreloadBridge
Methods:
- exposeAPIs(): Exposes safe APIs to renderer
- setupLogging(): Configures logging bridge
- setupIPC(): Sets up IPC communication

## Main Workflow

### 1. Application Initialization
- Electron app startup
- Window creation
- Express server initialization
- Database connection establishment
- IPC setup

### 2. Data Flow
- Note Creation → Parent-Child Relationship Establishment → Link Creation
- Hierarchical Structure Maintenance
- Link Weight and Description Management

### 3. Visualization Pipeline
- Data Fetching → Data Processing → Visualization Rendering
- View Switching (Table ↔ Graph ↔ Mind Map)
- Filter Application → View Updates

### 4. User Interaction Flow
- Note/Link Creation
- View Navigation
- Filter Application
- Pagination Navigation
- Graph/Mind Map Interaction

## Error Handling

Class: ErrorHandler
Methods:
- handleDatabaseError(error): Database-specific error handling
- handleAPIError(error): API endpoint error handling
- handleValidationError(error): Input validation error handling

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

## Technical Stack

### Core Technologies
- Runtime: Electron
- Backend: Express.js
- Database: SQLite3
- Frontend: D3.js
- API: REST

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
| electron-builder | ^24.0.0 | Application packaging |
| electron-rebuild | ^3.2.9 | Native module rebuilding |