const apiBase = "http://localhost:3060/api";

document.getElementById("linkForm").addEventListener("submit", (e) => {
    e.preventDefault();
  
    const from_id = document.getElementById("fromId").value;
    const to_id = document.getElementById("toId").value;
    const description = document.getElementById("linkDescription").value;
    const weight = parseFloat(document.getElementById("linkWeight").value) || 0;
  
    fetch(`${apiBase}/links`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from_id, to_id, description, weight }),
    }).then(() => {
      alert("Link added!");
      loadGraph();
      document.getElementById("linkForm").reset(); // Clear form
    });
});

// Load and visualize the graph
function loadGraph() {
    console.log("Loading graph view...");
    fetch(`${apiBase}/graph`)
      .then((response) => response.json())
      .then((graph) => {
        const svg = d3.select("#graph");
        const width = +svg.attr("width");
        const height = +svg.attr("height");
        
        svg.selectAll("*").remove();

        // Add zoom container
        const g = svg.append("g")
            .attr("class", "zoom-container");

        console.log("Graph data:", graph);
        console.log("Nodes:", graph.nodes.length);
        console.log("Links:", graph.links.length);

        // Add missing link IDs
        graph.links.forEach((link, i) => link.id = `link-${i}`);
  
        const simulation = d3.forceSimulation(graph.nodes)
          .force("link", d3.forceLink(graph.links)
            .id(d => d.id)
            .distance(100)
          )
          .force("charge", d3.forceManyBody().strength(-200))
          .force("center", d3.forceCenter(width/2, height/2))
          .force("collide", d3.forceCollide(20));
  
        // Add curved paths for links with weight-based styling
        const link = g.append("g")
          .selectAll("path")
          .data(graph.links)
          .enter().append("path")
          .attr("class", "link")
          .attr("stroke", d => `hsl(200, 70%, ${70 - ((d.weight || 1) * 0.5)}%)`)
          .attr("stroke-width", d => (d.weight || 1) * 0.5)
          .attr("fill", "none");

        // Add weight labels
        const linkLabels = g.append("g")
          .selectAll("text")
          .data(graph.links)
          .enter().append("text")
          .text(d => d.weight ? d.weight.toFixed(1) : "1.0")
          .attr("font-size", "10px")
          .attr("fill", "#666");
  
        // Draw nodes (circles) with hierarchy-based coloring
        const node = g.append("g")
          .selectAll("circle")
          .data(graph.nodes)
          .enter()
          .append("circle")
          .attr("r", 10)
          .attr("fill", d => !d.parent_id ? "#ff5722" : 
                            graph.nodes.some(n => n.parent_id === d.id) ? "#2196f3" : 
                            "#4caf50")
          .call(
            d3.drag()
              .on("start", dragstarted)
              .on("drag", dragged)
              .on("end", dragended)
          );
  
        // Add labels to nodes
        const labels = g.append("g")
          .selectAll("text")
          .data(graph.nodes)
          .enter()
          .append("text")
          .text(d => d.content || d.id)
          .attr("font-size", "12px")
          .attr("dx", 15)
          .attr("dy", 4)
          .attr("class", "node-text")
          .style("pointer-events", "none");
  
        // Add these styles to make text more readable
        const labelBackground = g.append("g")
          .selectAll("text")
          .data(graph.nodes)
          .enter()
          .append("text")
          .text(d => d.content || d.id)
          .attr("font-size", "12px")
          .attr("dx", 15)
          .attr("dy", 4)
          .attr("class", "node-text-background")
          .style("stroke", "white")
          .style("stroke-width", "3px")
          .style("opacity", "0.8")
          .style("pointer-events", "none");
  
        // Add tooltips to nodes
        node.append("title")
          .text(d => `${d.id}: ${d.content}`);

        // Add zoom behavior
        const zoom = d3.zoom()
            .scaleExtent([0.1, 4]) // Set zoom limits
            .on("zoom", (event) => {
                g.attr("transform", event.transform);
            });

        // Add zoom controls
        const zoomControls = svg.append("g")
            .attr("class", "zoom-controls")
            .attr("transform", "translate(20, 20)"); // Position in top-left corner

        // Zoom in button
        zoomControls.append("rect")
            .attr("x", 0)
            .attr("y", 0)
            .attr("width", 30)
            .attr("height", 30)
            .attr("fill", "#fff")
            .attr("stroke", "#999")
            .style("cursor", "pointer")
            .on("click", () => {
                svg.transition()
                   .duration(750)
                   .call(zoom.scaleBy, 1.3);
            });

        zoomControls.append("text")
            .attr("x", 15)
            .attr("y", 20)
            .attr("text-anchor", "middle")
            .text("+")
            .style("cursor", "pointer")
            .style("user-select", "none");

        // Zoom out button
        zoomControls.append("rect")
            .attr("x", 0)
            .attr("y", 40)
            .attr("width", 30)
            .attr("height", 30)
            .attr("fill", "#fff")
            .attr("stroke", "#999")
            .style("cursor", "pointer")
            .on("click", () => {
                svg.transition()
                   .duration(750)
                   .call(zoom.scaleBy, 0.7);
            });

        zoomControls.append("text")
            .attr("x", 15)
            .attr("y", 60)
            .attr("text-anchor", "middle")
            .text("-")
            .style("cursor", "pointer")
            .style("user-select", "none");

        // Reset zoom button
        zoomControls.append("rect")
            .attr("x", 0)
            .attr("y", 80)
            .attr("width", 30)
            .attr("height", 30)
            .attr("fill", "#fff")
            .attr("stroke", "#999")
            .style("cursor", "pointer")
            .on("click", () => {
                svg.transition()
                   .duration(750)
                   .call(zoom.transform, d3.zoomIdentity);
            });

        zoomControls.append("text")
            .attr("x", 15)
            .attr("y", 100)
            .attr("text-anchor", "middle")
            .text("R")
            .style("cursor", "pointer")
            .style("user-select", "none");

        // Enable zoom and pan
        svg.call(zoom);
  
        // Update positions on each tick
        simulation.on("tick", () => {
          link.attr("d", d => {
            const dx = d.target.x - d.source.x,
                  dy = d.target.y - d.source.y,
                  dr = Math.sqrt(dx * dx + dy * dy);
            return `M${d.source.x},${d.source.y}A${dr},${dr} 0 0,1 ${d.target.x},${d.target.y}`;
          });

          linkLabels
            .attr("x", d => (d.source.x + d.target.x) / 2)
            .attr("y", d => (d.source.y + d.target.y) / 2);
  
          node
            .attr("cx", d => d.x)
            .attr("cy", d => d.y);
  
          // Update both the background and foreground labels
          labelBackground
            .attr("x", d => d.x)
            .attr("y", d => d.y);
          
          labels
            .attr("x", d => d.x)
            .attr("y", d => d.y);
        });

        // Define drag functions
        function dragstarted(event, d) {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        }

        function dragged(event, d) {
          d.fx = event.x;
          d.fy = event.y;
        }

        function dragended(event, d) {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        }
      })
      .catch(error => {
        console.error("Error loading graph:", error);
      });
}
  

// Add pagination state
let currentPage = 1;
const rowsPerPage = 10;
let filteredData = null; // Store filtered data globally

// Update loadNotesTable to handle pagination for both filtered and unfiltered data
function loadNotesTable() {
    if (currentFilter) {
        // If we have filtered data, use it with client-side pagination
        if (filteredData) {
            displayTablePage(filteredData.nodes, filteredData.rootId);
        } else {
            // If filtered data isn't loaded yet, fetch it
            fetch(`${apiBase}/filter/${currentFilter}`)
                .then(response => response.json())
                .then(data => {
                    filteredData = data;
                    displayTablePage(data.nodes, data.rootId);
                });
        }
    } else {
        // For unfiltered data, use server-side pagination
        fetch(`${apiBase}/notes-table?page=${currentPage}&limit=${rowsPerPage}`)
            .then(response => response.json())
            .then(data => {
                displayTablePage(data.rows, null, data.total);
                filteredData = null; // Clear filtered data
            });
    }
}

// Function to display a page of the table
function displayTablePage(rows, rootId, totalRows = null) {
    const tableBody = document.querySelector("#notesTable tbody");
    tableBody.innerHTML = "";

    if (currentFilter) {
        // For filtered data, implement client-side pagination
        const start = (currentPage - 1) * rowsPerPage;
        const end = start + rowsPerPage;
        const pageRows = rows.slice(start, end);

        pageRows.forEach(row => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${row.child_id}</td>
                <td>${row.child_content}</td>
                <td>${row.parent_id || "-"}</td>
                <td>${row.parent_content || "-"}</td>
            `;
            if (row.child_id === rootId) {
                tr.style.backgroundColor = '#ffeeba';
            }
            tableBody.appendChild(tr);
        });

        // Update pagination with total filtered rows
        updatePagination(rows.length);
    } else {
        // For unfiltered data, display as is (server-side pagination)
        rows.forEach(row => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${row.child_id}</td>
                <td>${row.child_content}</td>
                <td>${row.parent_id || "-"}</td>
                <td>${row.parent_content || "-"}</td>
            `;
            tableBody.appendChild(tr);
        });

        // Update pagination with total rows from server
        updatePagination(totalRows);
    }
}

// Update pagination controls with input field
function updatePagination(totalRows) {
    const totalPages = Math.ceil(totalRows / rowsPerPage);
    const paginationDiv = document.getElementById('pagination-controls');
    
    // Create pagination controls if they don't exist
    if (!paginationDiv) {
        const table = document.getElementById('notesTable');
        const newPaginationDiv = document.createElement('div');
        newPaginationDiv.id = 'pagination-controls';
        newPaginationDiv.className = 'pagination';
        table.parentNode.insertBefore(newPaginationDiv, table.nextSibling);
    }

    const controls = document.getElementById('pagination-controls');
    controls.innerHTML = `
        <button onclick="changePage(1)" ${currentPage === 1 ? 'disabled' : ''}>
            First
        </button>
        <button onclick="changePage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>
            Previous
        </button>
        <div class="page-input-container">
            Page <input type="number" value="${currentPage}" min="1" max="${totalPages}" class="page-input"> of ${totalPages}
        </div>
        <button onclick="changePage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>
            Next
        </button>
        <button onclick="changePage(${totalPages})" ${currentPage === totalPages ? 'disabled' : ''}>
            Last
        </button>
    `;

    // Add event listener for the input field
    const pageInput = controls.querySelector('.page-input');
    pageInput.addEventListener('change', (e) => {
        let newPage = parseInt(e.target.value);
        // Validate the input
        if (newPage < 1) newPage = 1;
        if (newPage > totalPages) newPage = totalPages;
        if (newPage !== currentPage) {
            changePage(newPage);
        } else {
            // Reset the input value if invalid
            e.target.value = currentPage;
        }
    });

    // Add event listener for Enter key
    pageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.target.blur(); // Remove focus to trigger the change event
        }
    });
}

// Add page change handler
function changePage(newPage) {
    currentPage = newPage;
    loadNotesTable();
}

document.getElementById("noteForm").addEventListener("submit", (e) => {
    e.preventDefault();
  
    const id = document.getElementById("noteId").value;
    const content = document.getElementById("noteContent").value;
    const parent_id = document.getElementById("noteParentId").value || null; // Get parent ID from the form
  
    fetch(`${apiBase}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, content, parent_id }), // Include parent_id in the request body
    }).then(() => {
      alert("Note added!");
      loadGraph(); // Reload the graph visualization
      loadNotesTable(); // Reload the parent-child table
    });
});

let currentFilter = null;

function applyFilter() {
    const nodeId = document.getElementById('filterInput').value.trim();
    if (!nodeId) return;

    currentFilter = nodeId;
    currentPage = 1; // Reset to first page when filtering
    
    fetch(`${apiBase}/filter/${nodeId}`)
        .then(response => {
            if (!response.ok) throw new Error('Filter failed');
            return response.json();
        })
        .then(data => {
            if (!data.nodes || data.nodes.length === 0) {
                alert('No nodes found for this filter');
                return;
            }

            filteredData = data; // Store filtered data
            const activeView = document.querySelector('.view[style*="display: block"]').id;
            
            switch (activeView) {
                case 'notesTable':
                    displayTablePage(data.nodes, data.rootId);
                    break;
                case 'graph':
                    updateGraph(data.nodes, data.links || [], data.rootId);
                    break;
                case 'mindmap-container':
                    const hierarchyData = data.nodes.map(node => ({
                        id: node.child_id,
                        content: node.child_content,
                        parent_id: node.parent_id
                    }));
                    drawMindMap(hierarchyData);
                    break;
            }
        })
        .catch(error => {
            console.error('Filter error:', error);
            alert('Error applying filter: ' + error.message);
        });
}

function clearFilter() {
    currentFilter = null;
    filteredData = null;
    currentPage = 1; // Reset to first page when clearing filter
    document.getElementById('filterInput').value = '';
    
    const activeView = document.querySelector('.view[style*="display: block"]').id;
    
    switch (activeView) {
        case 'notesTable':
            loadNotesTable();
            break;
        case 'graph':
            loadGraph();
            break;
        case 'mindmap-container':
            loadMindMap();
            break;
    }
}

function updateTable(rows, rootId) {
    const tableBody = document.querySelector("#notesTable tbody");
    tableBody.innerHTML = "";
  
    rows.forEach(row => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${row.child_id}</td>
        <td>${row.child_content}</td>
        <td>${row.parent_id || "-"}</td>
        <td>${row.parent_content || "-"}</td>
      `;
      // Highlight root node
      if (row.child_id === rootId) {
        tr.style.backgroundColor = '#ffeeba';
      }
      tableBody.appendChild(tr);
    });
}
  
function updateGraph(nodes, links, rootIds) {
    // Transform the data structure to match what D3 expects
    const graphNodes = nodes.map(node => ({
        id: node.child_id,
        content: node.child_content,
        parent_id: node.parent_id
    }));

    // Create a Set of all valid node IDs
    const nodeIds = new Set(graphNodes.map(n => n.id));

    // Filter links to only include those where both source and target nodes exist
    const graphLinks = links
        .filter(link => {
            const sourceId = link.from_id || link.source;
            const targetId = link.to_id || link.target;
            return nodeIds.has(sourceId) && nodeIds.has(targetId);
        })
        .map(link => ({
            source: link.from_id || link.source,
            target: link.to_id || link.target,
            weight: link.weight || 1,
            description: link.description
        }));

    const svg = d3.select("#graph");
    svg.selectAll("*").remove();

    const width = +svg.attr("width");
    const height = +svg.attr("height");

    // Add zoom container
    const g = svg.append("g")
        .attr("class", "zoom-container");

    // Create force simulation with transformed data
    const simulation = d3.forceSimulation(graphNodes)
        .force("link", d3.forceLink(graphLinks)
            .id(d => d.id)
            .distance(100)
        )
        .force("charge", d3.forceManyBody().strength(-300))
        .force("center", d3.forceCenter(width / 2, height / 2))
        .force("x", d3.forceX().x(d => d.id === rootIds[0] ? width/2 : null))
        .force("y", d3.forceY().y(d => d.id === rootIds[0] ? height/2 : null));

    // Draw links with weight-based styling
    const link = g.append("g")
        .selectAll("line")
        .data(graphLinks)
        .enter().append("line")
        .attr("stroke", d => `hsl(200, 70%, ${70 - ((d.weight || 1) * 0.5)}%)`)
        .attr("stroke-width", d => (d.weight || 1) * 0.5)
        .attr("opacity", 0.8);

    // Add weight labels
    const linkLabels = g.append("g")
        .selectAll("text")
        .data(graphLinks)
        .enter().append("text")
        .text(d => d.weight ? d.weight.toFixed(1) : "1.0")
        .attr("font-size", "10px")
        .attr("fill", "#666");

    // Draw nodes with hierarchy-based coloring
    const node = g.append("g")
        .selectAll("circle")
        .data(graphNodes)
        .enter().append("circle")
        .attr("r", 10)
        .attr("fill", d => {
            if (Array.isArray(rootIds) && rootIds.includes(d.id)) {
                return "#ff5722"; // Root node color
            } else if (Array.isArray(rootIds) && rootIds.some(rootId => d.parent_id === rootId)) {
                return "#2196f3"; // Direct child of root
            } else {
                return "#4caf50"; // Other nodes
            }
        })
        .call(d3.drag()
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended));

    // Add labels
    const labels = g.append("g")
        .selectAll("text")
        .data(graphNodes)
        .enter().append("text")
        .text(d => d.content || d.id)
        .attr("font-size", "12px")
        .attr("dx", 15)
        .attr("dy", 4);

    // Add zoom behavior
    const zoom = d3.zoom()
        .scaleExtent([0.1, 4])
        .on("zoom", (event) => {
            g.attr("transform", event.transform);
        });

    // Add zoom controls
    const zoomControls = svg.append("g")
        .attr("class", "zoom-controls")
        .attr("transform", "translate(20, 20)");

    // Zoom in button
    zoomControls.append("rect")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", 30)
        .attr("height", 30)
        .attr("fill", "#fff")
        .attr("stroke", "#999")
        .style("cursor", "pointer")
        .on("click", () => {
            svg.transition()
               .duration(750)
               .call(zoom.scaleBy, 1.3);
        });

    zoomControls.append("text")
        .attr("x", 15)
        .attr("y", 20)
        .attr("text-anchor", "middle")
        .text("+")
        .style("cursor", "pointer")
        .style("user-select", "none");

    // Zoom out button
    zoomControls.append("rect")
        .attr("x", 0)
        .attr("y", 40)
        .attr("width", 30)
        .attr("height", 30)
        .attr("fill", "#fff")
        .attr("stroke", "#999")
        .style("cursor", "pointer")
        .on("click", () => {
            svg.transition()
               .duration(750)
               .call(zoom.scaleBy, 0.7);
        });

    zoomControls.append("text")
        .attr("x", 15)
        .attr("y", 60)
        .attr("text-anchor", "middle")
        .text("-")
        .style("cursor", "pointer")
        .style("user-select", "none");

    // Reset zoom button
    zoomControls.append("rect")
        .attr("x", 0)
        .attr("y", 80)
        .attr("width", 30)
        .attr("height", 30)
        .attr("fill", "#fff")
        .attr("stroke", "#999")
        .style("cursor", "pointer")
        .on("click", () => {
            svg.transition()
               .duration(750)
               .call(zoom.transform, d3.zoomIdentity);
        });

    zoomControls.append("text")
        .attr("x", 15)
        .attr("y", 100)
        .attr("text-anchor", "middle")
        .text("R")
        .style("cursor", "pointer")
        .style("user-select", "none");

    // Enable zoom and pan
    svg.call(zoom);

    // Update positions on each tick
    simulation.on("tick", () => {
        link
            .attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);

        linkLabels
            .attr("x", d => (d.source.x + d.target.x) / 2)
            .attr("y", d => (d.source.y + d.target.y) / 2);

        node
            .attr("cx", d => d.x)
            .attr("cy", d => d.y);

        labels
            .attr("x", d => d.x)
            .attr("y", d => d.y);
    });

    // Define drag functions
    function dragstarted(event, d) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
    }

    function dragged(event, d) {
        d.fx = event.x;
        d.fy = event.y;
    }

    function dragended(event, d) {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
    }
}

let mindmapData = null;

function showView(viewName) {
    // Hide all views
    document.querySelectorAll('.view').forEach(el => {
        el.style.display = 'none';
    });

    // Show selected view
    const viewElement = viewName === 'mindmap' ? 'mindmap-container' : 
                       viewName === 'table' ? 'notesTable' : 'graph';
    
    document.getElementById(viewElement).style.display = 'block';

    // If there's an active filter, apply it to the new view
    const currentFilterId = document.getElementById('filterInput').value.trim();
    if (currentFilterId) {
        applyFilter();
    } else {
        // Load appropriate data only if needed
        if (viewName === 'mindmap') {
            loadMindMap();
        } else if (viewName === 'table') {
            loadNotesTable();
        } else if (viewName === 'graph') {
            loadGraph();
        }
    }
}

function loadMindMap() {
    console.log("Loading mind map...");
    fetch(`${apiBase}/hierarchy`)
        .then(response => response.json())
        .then(data => {
            console.log("Mind map data received:", data);
            mindmapData = data;
            drawMindMap(data);
        })
        .catch(error => {
            console.error("Error loading mind map:", error);
        });
}

function drawMindMap(data) {
    console.log("Drawing mind map with data:", data);
    
    // Check if data is empty
    if (!data || data.length === 0) {
        console.warn("No data available for mind map");
        return;
    }

    const svg = d3.select("#mindmap");
    const width = +svg.attr("width");
    const height = +svg.attr("height");
    
    svg.selectAll("*").remove();
    
    // Add a group that we can transform
    const g = svg.append("g")
        .attr("transform", `translate(${width/4},${height/2})`);

    // Transform data to ensure all required fields are present
    const hierarchyData = data.map(node => ({
        id: node.id || node.child_id,
        content: node.content || node.child_content,
        parent_id: node.parent_id
    }));

    // Add artificial root if needed
    const hasRoot = hierarchyData.some(node => !node.parent_id);
    if (!hasRoot) {
        hierarchyData.unshift({
            id: "root",
            content: "Root",
            parent_id: null
        });
        // Update nodes without parents to point to root
        hierarchyData.forEach(node => {
            if (node.id !== "root" && !hierarchyData.some(n => n.id === node.parent_id)) {
                node.parent_id = "root";
            }
        });
    }

    // Create hierarchy
    try {
        const stratify = d3.stratify()
            .id(d => d.id)
            .parentId(d => d.parent_id);

        const root = stratify(hierarchyData);

        // Create tree layout
        const treeLayout = d3.tree()
            .size([height * 0.9, width * 0.5])
            .separation((a, b) => (a.parent === b.parent ? 1 : 2));

        // Apply the layout
        treeLayout(root);

        // Create links
        const links = g.append("g")
            .attr("class", "links")
            .selectAll("path")
            .data(root.links())
            .join("path")
            .attr("class", "link")
            .attr("d", d3.linkHorizontal()
                .x(d => d.y)    // Note: x and y are swapped to make tree horizontal
                .y(d => d.x));

        // Create nodes
        const nodes = g.append("g")
            .attr("class", "nodes")
            .selectAll("g")
            .data(root.descendants())
            .join("g")
            .attr("class", "node")
            .attr("transform", d => `translate(${d.y},${d.x})`);

        // Add circles to nodes
        nodes.append("circle")
            .attr("r", 6)
            .attr("fill", d => d.depth === 0 ? "#ff5722" : 
                              d.depth === 1 ? "#2196f3" : "#4caf50");

        // Add labels
        nodes.append("text")
            .attr("dy", "0.31em")
            .attr("x", d => d.children ? -8 : 8)
            .attr("text-anchor", d => d.children ? "end" : "start")
            .text(d => d.data.content || d.data.id)
            .clone(true).lower()
            .attr("stroke", "white")
            .attr("stroke-width", 3);

        // Add zoom behavior
        const zoom = d3.zoom()
            .scaleExtent([0.5, 2])
            .on("zoom", (event) => {
                g.attr("transform", event.transform);
            });

        svg.call(zoom);

    } catch (error) {
        console.error("Stratify error:", error);
        console.log("Data that caused error:", JSON.stringify(hierarchyData, null, 2));
        return;
    }
}

// Add this function
function testMindMap() {
    console.log("Testing mind map with sample data...");
    fetch(`${apiBase}/hierarchy-test`)
        .then(response => response.json())
        .then(data => {
            console.log("Test data received:", data);
            drawMindMap(data);
        })
        .catch(error => {
            console.error("Error in test:", error);
        });
}

// Initial load

showView('table'); // Start with table view

// Add selected filters state
let selectedFilters = new Set();

// Update the filter section HTML in your index.html
function updateFilterUI() {
    const filterSection = document.getElementById('filterSection');
    filterSection.innerHTML = `
        <div class="filter-input-group">
            <input type="text" id="filterInput" placeholder="Enter node ID (e.g. 1a)">
            <button onclick="addFilter()">Add Filter</button>
            <button onclick="clearFilters()">Clear All</button>
        </div>
        <div id="activeFilters" class="active-filters"></div>
    `;
    
    // Display active filters
    const activeFiltersDiv = document.getElementById('activeFilters');
    activeFiltersDiv.innerHTML = '';
    selectedFilters.forEach(filter => {
        const filterTag = document.createElement('span');
        filterTag.className = 'filter-tag';
        filterTag.innerHTML = `
            ${filter}
            <button onclick="removeFilter('${filter}')">&times;</button>
        `;
        activeFiltersDiv.appendChild(filterTag);
    });
}

// Add a new filter
function addFilter() {
    const filterInput = document.getElementById('filterInput');
    const nodeId = filterInput.value.trim();
    
    if (nodeId && !selectedFilters.has(nodeId)) {
        selectedFilters.add(nodeId);
        filterInput.value = '';
        updateFilterUI();
        applyFilters();
    }
}

// Remove a filter
function removeFilter(nodeId) {
    selectedFilters.delete(nodeId);
    updateFilterUI();
    if (selectedFilters.size === 0) {
        clearFilters();
    } else {
        applyFilters();
    }
}

// Clear all filters
function clearFilters() {
    selectedFilters.clear();
    currentFilter = null;
    filteredData = null;
    currentPage = 1;
    updateFilterUI();
    
    const activeView = document.querySelector('.view[style*="display: block"]').id;
    switch (activeView) {
        case 'notesTable':
            loadNotesTable();
            break;
        case 'graph':
            loadGraph();
            break;
        case 'mindmap-container':
            loadMindMap();
            break;
    }
}

// Apply multiple filters
function applyFilters() {
    if (selectedFilters.size === 0) return;
    
    const nodeIds = Array.from(selectedFilters).join(',');
    currentFilter = nodeIds; // Store current filter state
    currentPage = 1; // Reset to first page when filtering
    
    fetch(`${apiBase}/filter-multiple?nodes=${nodeIds}`)
        .then(response => {
            if (!response.ok) throw new Error('Filter failed');
            return response.json();
        })
        .then(data => {
            if (!data.nodes || data.nodes.length === 0) {
                alert('No nodes found for these filters');
                return;
            }

            filteredData = data;
            const activeView = document.querySelector('.view[style*="display: block"]').id;
            
            switch (activeView) {
                case 'notesTable':
                    displayTablePage(data.nodes, data.rootIds);
                    break;
                case 'graph':
                    updateGraph(data.nodes, data.links || [], data.rootIds);
                    break;
                case 'mindmap-container':
                    const hierarchyData = data.nodes.map(node => ({
                        id: node.child_id,
                        content: node.child_content,
                        parent_id: node.parent_id
                    }));
                    drawMindMap(hierarchyData);
                    break;
            }
        })
        .catch(error => {
            console.error('Filter error:', error);
            alert('Error applying filters: ' + error.message);
        });
}

// Add styles for filter tags
const filterStyles = document.createElement('style');
filterStyles.textContent = `
    .filter-input-group {
        margin-bottom: 10px;
        display: flex;
        gap: 10px;
        align-items: center;
    }
    
    .active-filters {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 10px;
    }
    
    .filter-tag {
        background: #e0e0e0;
        padding: 4px 8px;
        border-radius: 16px;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 14px;
    }
    
    .filter-tag button {
        border: none;
        background: none;
        color: #666;
        cursor: pointer;
        padding: 0 4px;
        font-size: 16px;
        line-height: 1;
    }
    
    .filter-tag button:hover {
        color: #000;
    }
`;
document.head.appendChild(filterStyles);

// Initialize filter UI when the page loads
document.addEventListener('DOMContentLoaded', updateFilterUI);