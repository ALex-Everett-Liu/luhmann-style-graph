# Logging System Design

## 1. Log Levels

### ERROR (Highest Priority)
- Unrecoverable errors that prevent system operation
- Database connection failures
- API endpoint failures
- Data corruption issues
- Uncaught exceptions
- Security violations

### WARN
- Recoverable issues that need attention
- Performance degradation
- Invalid user input
- Data inconsistencies
- Failed data transformations
- Non-critical API failures

### INFO
- Important system events
- Application startup/shutdown
- Configuration changes
- User actions (create/update/delete)
- View changes
- Filter applications

### DEBUG
- Detailed information for debugging
- Function entry/exit points
- Data transformation steps
- State changes
- Performance metrics

### TRACE (Lowest Priority)
- Most granular information
- Variable values
- Loop iterations
- DOM updates
- Resource usage

## 2. Implementation Example

luhmann-style-graph/utils/logger.js

## 3. Logging Categories

### Database Operations

```javascript
// Example logging structure
{
    timestamp: "2024-03-20T10:00:00.000Z",
    level: "error",
    category: "database",
    operation: "insert",
    table: "notes",
    error: {
        code: "SQLITE_CONSTRAINT",
        message: "UNIQUE constraint failed"
    },
    data: {
        noteId: "1a",
        content: "..."
    }
}
```

### API Endpoints

```javascript
// Example logging structure
{
    timestamp: "2024-03-20T10:01:00.000Z",
    level: "info",
    category: "api",
    method: "POST",
    endpoint: "/api/notes",
    duration: 125,
    requestId: "req-123",
    userId: "user-456"
}
```

### Visualization Operations

```javascript
// Example logging structure
{
    timestamp: "2024-03-20T10:02:00.000Z",
    level: "debug",
    category: "visualization",
    component: "mindMap",
    action: "render",
    nodeCount: 15,
    linkCount: 23,
    renderTime: 250
}
```

## 4. Integration Points

### Server-side Integration

```javascript
// Add to server.js
app.use((req, res, next) => {
  req.requestId = generateRequestId();
  logger.info({
    category: 'request',
    method: req.method,
    path: req.path,
    requestId: req.requestId
  });
  next();
});
```
### Client-side Integration

```javascript
// Add to script.js
const clientLogger = {
    error: (message, data) => {
        console.error(message, data);
        fetch('/api/logs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                level: 'error',
                message,
                data,
                timestamp: new Date().toISOString()
            })
        });
    }
    // ... other levels
};
```

## 5. Log Analysis

### Key Metrics to Track
- Error rates by category
- API endpoint response times
- Database operation durations
- Visualization rendering performance
- User action frequencies
- Resource usage patterns

### Log Rotation Policy
- Error logs: 5MB per file, 5 files maximum
- Combined logs: 10MB per file, 5 files maximum
- Daily rotation with date-based naming
- Compression of older logs

### Monitoring Alerts
- Error rate exceeds threshold
- API endpoint response time > 1000ms
- Database operation time > 500ms
- Memory usage > 80%
- Disk space < 20%

## 6. Implementation Steps

1. Install Dependencies

```json
{
    "dependencies": {
        "winston": "^3.11.0",
        "winston-daily-rotate-file": "^5.0.0"
    }
}
```

2. Create Log Directories

```bash
mkdir -p logs/error
mkdir -p logs/combined
mkdir -p logs/access
```

3. Update Application Code
- Add logging calls at key points
- Implement error boundaries
- Add performance monitoring
- Set up log rotation
- Configure monitoring alerts

4. Documentation
- Log format specifications
- Error code definitions
- Troubleshooting guides
- Performance benchmarks
- Alert thresholds