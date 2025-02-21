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
    if (currentFilter && filteredData) {
        // Use filtered data if available
        updateGraph(filteredData.nodes, filteredData.links || [], filteredData.rootIds);
    } else {
        // Load all data if no filter
        fetch(`${apiBase}/graph`)
            .then(response => response.json())
            .then(data => {
                updateGraph(data.nodes, data.links || [], []);
            })
            .catch(error => {
                console.error("Error loading graph:", error);
            });
    }
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

    // Filter and format links
    const graphLinks = links
        .filter(link => {
            const sourceId = link.source;
            const targetId = link.target;
            return nodeIds.has(sourceId) && nodeIds.has(targetId);
        })
        .map(link => ({
            source: link.source,
            target: link.target,
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

    // If there's an active filter and filtered data, use it
    if (currentFilter && filteredData) {
        switch (viewName) {
            case 'mindmap':
                const hierarchyData = filteredData.nodes.map(node => ({
                    id: node.child_id,
                    content: node.child_content,
                    parent_id: node.parent_id
                }));
                drawMindMap(hierarchyData);
                break;
            case 'table':
                displayTablePage(filteredData.nodes, filteredData.rootIds);
                break;
            case 'graph':
                updateGraph(filteredData.nodes, filteredData.links || [], filteredData.rootIds);
                break;
        }
    } else {
        // Load appropriate data if no filter
        switch (viewName) {
            case 'mindmap':
                loadMindMap();
                break;
            case 'table':
                loadNotesTable();
                break;
            case 'graph':
                loadGraph();
                break;
        }
    }
}

function loadMindMap() {
    if (currentFilter && filteredData) {
        console.log("Using filtered data:", filteredData);
        const hierarchyData = filteredData.nodes.map(node => ({
            id: node.child_id,
            content: node.child_content,
            parent_id: node.parent_id
        }));
        drawMindMap(hierarchyData);
    } else {
        fetch(`${apiBase}/hierarchy`)
            .then(response => response.json())
            .then(hierarchyData => {
                console.log("Fetched hierarchy data:", hierarchyData);
                // Also fetch links data if not filtered
                return fetch(`${apiBase}/graph`)
                    .then(response => response.json())
                    .then(graphData => {
                        filteredData = {
                            nodes: hierarchyData,
                            links: graphData.links
                        };
                        drawMindMap(hierarchyData);
                    });
            })
            .catch(error => {
                console.error("Error loading mind map:", error);
            });
    }
}

function drawMindMap(data) {
    console.log("Drawing mind map with data:", data);
    
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
        hierarchyData.forEach(node => {
            if (node.id !== "root" && !hierarchyData.some(n => n.id === node.parent_id)) {
                node.parent_id = "root";
            }
        });
    }

    try {
        const stratify = d3.stratify()
            .id(d => d.id)
            .parentId(d => d.parent_id);

        const root = stratify(hierarchyData);

        const treeLayout = d3.tree()
            .size([height * 0.9, width * 0.5])
            .separation((a, b) => (a.parent === b.parent ? 2 : 3));

        treeLayout(root);

        // Create links
        const links = g.append("g")
            .attr("class", "links")
            .selectAll("path")
            .data(root.links())
            .join("path")
            .attr("class", "link")
            .attr("d", d3.linkHorizontal()
                .x(d => d.y)
                .y(d => d.x));

        // Create node groups
        const nodeGroups = g.append("g")
            .attr("class", "nodes")
            .selectAll("g")
            .data(root.descendants())
            .join("g")
            .attr("class", "node")
            .attr("transform", d => `translate(${d.y},${d.x})`);

        // Add circles in their own group
        const circles = nodeGroups.append("g")
            .attr("class", "circle-group");

        // Add the circle elements
        circles.append("circle")
            .attr("r", 6)
            .attr("fill", d => d.depth === 0 ? "#ff5722" : 
                              d.depth === 1 ? "#2196f3" : "#4caf50")
            .attr("class", "node-circle")
            .attr("stroke", "white")
            .attr("stroke-width", 1.5);

        // Add tooltip div if it doesn't exist
        const tooltip = d3.select("body").select(".mindmap-tooltip").node() ?
            d3.select(".mindmap-tooltip") :
            d3.select("body")
                .append("div")
                .attr("class", "mindmap-tooltip")
                .style("opacity", 0);

        // Function to get linked nodes information
        const getLinkedNodesInfo = (nodeId) => {
            // Get node's content by ID
            const getNodeContent = (id) => {
                const node = data.find(n => n.id === id) || 
                            data.find(n => n.child_id === id);
                return node ? (node.content || node.child_content) : 'Unknown';
            };

            // Get all links for this node
            const nodeLinks = filteredData?.links?.filter(link => 
                link.source === nodeId || link.target === nodeId
            ) || [];

            // Get outgoing links (where node is source)
            const outgoing = nodeLinks
                .filter(link => link.source === nodeId)
                .map(link => ({
                    targetId: link.target,
                    targetContent: getNodeContent(link.target),
                    weight: link.weight,
                    description: link.description
                }));

            // Get incoming links (where node is target)
            const incoming = nodeLinks
                .filter(link => link.target === nodeId)
                .map(link => ({
                    sourceId: link.source,
                    sourceContent: getNodeContent(link.source),
                    weight: link.weight,
                    description: link.description
                }));

            return { incoming, outgoing };
        };

        // Update circle groups with enhanced hover functionality
        circles.append("circle")
            .attr("r", 6)
            .attr("fill", d => d.depth === 0 ? "#ff5722" : 
                              d.depth === 1 ? "#2196f3" : "#4caf50")
            .attr("class", "node-circle")
            .attr("stroke", "white")
            .attr("stroke-width", 1.5)
            .on("mouseover", function(event, d) {
                // Highlight the circle
                d3.select(this)
                    .transition()
                    .duration(200)
                    .attr("r", 8);

                // Get linked nodes information
                const linkedInfo = getLinkedNodesInfo(d.data.id);

                // Create tooltip content
                let tooltipContent = `
                    <div class="tooltip-header">
                        <div class="tooltip-title">Current Node</div>
                        <div class="tooltip-content">
                            <span class="label">ID:</span> ${d.data.id}
                            <span class="label">Content:</span> ${d.data.content}
                        </div>
                    </div>`;

                if (linkedInfo.incoming.length > 0) {
                    tooltipContent += `
                        <div class="tooltip-section">
                            <div class="tooltip-title">Incoming Links</div>
                            ${linkedInfo.incoming.map(link => `
                                <div class="tooltip-content">
                                    <span class="label">From ID:</span> ${link.sourceId}
                                    <span class="label">Content:</span> ${link.sourceContent}
                                    ${link.weight ? `<span class="label">Weight:</span> ${link.weight}` : ''}
                                    ${link.description ? `<br><span class="label">Description:</span> ${link.description}` : ''}
                                </div>
                            `).join('')}
                        </div>`;
                }

                if (linkedInfo.outgoing.length > 0) {
                    tooltipContent += `
                        <div class="tooltip-section">
                            <div class="tooltip-title">Outgoing Links</div>
                            ${linkedInfo.outgoing.map(link => `
                                <div class="tooltip-content">
                                    <span class="label">To ID:</span> ${link.targetId}
                                    <span class="label">Content:</span> ${link.targetContent}
                                    ${link.weight ? `<span class="label">Weight:</span> ${link.weight}` : ''}
                                    ${link.description ? `<br><span class="label">Description:</span> ${link.description}` : ''}
                                </div>
                            `).join('')}
                        </div>`;
                }

                // Show tooltip
                tooltip.transition()
                    .duration(200)
                    .style("opacity", .9);
                
                tooltip.html(tooltipContent)
                    .style("left", (event.pageX + 10) + "px")
                    .style("top", (event.pageY - 28) + "px");
            })
            .on("mouseout", function() {
                // Reset circle size
                d3.select(this)
                    .transition()
                    .duration(200)
                    .attr("r", 6);

                // Hide tooltip
                tooltip.transition()
                    .duration(500)
                    .style("opacity", 0);
            })
            .on("mousemove", function(event) {
                // Move tooltip with cursor
                tooltip
                    .style("left", (event.pageX + 10) + "px")
                    .style("top", (event.pageY - 28) + "px");
            });

        // Add text in a separate group with offset
        const textGroups = nodeGroups.append("g")
            .attr("class", "text-group")
            .attr("transform", "translate(0, 15)"); // Offset text group below circle

        const labels = textGroups.append("text")
            .attr("text-anchor", "middle")
            .attr("class", "node-label")
            .each(function(d) {
                const text = d3.select(this);
                const content = d.data.content;
                const maxCharsPerLine = 10;
                const maxLines = 2;
                
                // Function to check if a string contains CJK characters
                const hasCJK = str => /[\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF]/.test(str);
                
                // Function to calculate visual length
                const getVisualLength = str => {
                    return str.split('').reduce((acc, char) => {
                        return acc + (hasCJK(char) ? 2 : 1);
                    }, 0);
                };

                // Function to split text into lines
                const splitIntoLines = (str) => {
                    const lines = [];
                    let currentLine = '';
                    let currentLength = 0;
                    
                    for (let char of str) {
                        const charLength = hasCJK(char) ? 2 : 1;
                        
                        if (currentLength + charLength > maxCharsPerLine) {
                            lines.push(currentLine);
                            currentLine = char;
                            currentLength = charLength;
                        } else {
                            currentLine += char;
                            currentLength += charLength;
                        }
                        
                        if (lines.length >= maxLines && currentLine) {
                            currentLine += '...';
                            lines.push(currentLine);
                            break;
                        }
                    }
                    
                    if (lines.length < maxLines && currentLine) {
                        lines.push(currentLine);
                    }
                    
                    return lines;
                };

                // Split content into lines and create tspan elements
                const lines = splitIntoLines(content);
                lines.forEach((line, i) => {
                    text.append("tspan")
                        .attr("x", 0)
                        .attr("dy", i === 0 ? 0 : "1.2em")
                        .text(line);
                });
            });

        // Add white background to text
        textGroups.insert("rect", "text")
            .attr("class", "text-background")
            .attr("fill", "white")
            .attr("opacity", 0.8)
            .each(function(d) {
                const textElement = d3.select(this.parentNode).select("text").node();
                const bbox = textElement.getBBox();
                d3.select(this)
                    .attr("x", bbox.x - 2)
                    .attr("y", bbox.y - 2)
                    .attr("width", bbox.width + 4)
                    .attr("height", bbox.height + 4);
            });

        // Add link count as superscript
        nodeGroups.each(function(d) {
            const linkCount = countNonTreeLinks(d.data.id, root);
            console.log(`Node ${d.data.id}: ${linkCount} non-tree links`); // Debug log
            if (linkCount > 0) {
                d3.select(this)
                    .append("text")
                    .attr("class", "link-count")
                    .attr("x", 8)
                    .attr("y", -8)
                    .text(linkCount)
                    .attr("font-size", "10px")
                    .attr("fill", "#666")
                    .style("font-weight", "bold")
                    .style("text-shadow", 
                        "1px 1px 0 white, -1px 1px 0 white, 1px -1px 0 white, -1px -1px 0 white");
            }
        });

        // Add zoom behavior
        const zoom = d3.zoom()
            .scaleExtent([0.5, 2])
            .on("zoom", (event) => {
                g.attr("transform", event.transform);
            });

        svg.call(zoom);

    } catch (error) {
        console.error("Stratify error:", error);
        console.log("Data that caused error:", JSON.stringify(data, null, 2));
        return;
    }
}

// Update tooltip styles
const mindmapStyles = document.createElement('style');
mindmapStyles.textContent = `
    .mindmap-tooltip {
        position: absolute;
        padding: 8px;
        font: 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, 
              "Helvetica Neue", Arial, "Noto Sans", sans-serif;
        background: rgba(255, 255, 255, 0.95);
        border: 1px solid #ddd;
        border-radius: 4px;
        pointer-events: none;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        z-index: 1000;
        max-width: 300px;
        line-height: 1.3;
    }

    .tooltip-header, .tooltip-section {
        margin: 0;
        padding: 4px 0;
    }

    .tooltip-section {
        border-top: 1px solid #eee;
        margin-top: 4px;
    }

    .tooltip-title {
        font-weight: bold;
        margin-bottom: 2px;
        color: #333;
    }

    .tooltip-content {
        margin: 2px 0;
        padding-left: 8px;
    }

    .label {
        color: #666;
        margin-right: 4px;
    }

    .label::after {
        content: " ";
    }

    .node-label {
        font-size: 11px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, 
                     "Helvetica Neue", Arial, "Noto Sans", sans-serif;
        line-height: 1.2;
        pointer-events: none;
    }

    .text-background {
        rx: 2;
        ry: 2;
    }

    .link {
        fill: none;
        stroke: #ccc;
        stroke-width: 1.5px;
    }

    .node {
        margin: 20px 0;
    }

    .node-circle {
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .node-circle:hover {
        filter: brightness(1.2);
    }

    .link-count {
        font-weight: bold;
        pointer-events: none;
        text-shadow: 1px 1px 0 white,
                    -1px 1px 0 white,
                    1px -1px 0 white,
                    -1px -1px 0 white;
    }
`;
document.head.appendChild(mindmapStyles);

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
    currentFilter = nodeIds;
    currentPage = 1;
    
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

            // Store filtered data globally
            filteredData = data;
            
            // Update current view based on filtered data
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

// Update the countNonTreeLinks function to be more explicit
function countNonTreeLinks(nodeId, root) {
    if (!filteredData?.links || !filteredData.links.length) {
        console.log(`No links data available for node ${nodeId}`);
        return 0;
    }
    
    // Get the node's parent and children IDs
    const node = root.descendants().find(n => n.data.id === nodeId);
    if (!node) {
        console.log(`Node ${nodeId} not found in hierarchy`);
        return 0;
    }

    const parentId = node.parent?.data.id;
    const childrenIds = (node.children || []).map(child => child.data.id);
    
    // Count links where this node is either source or target
    const count = filteredData.links.filter(link => {
        const sourceId = link.source;
        const targetId = link.target;
        
        // Check if this link involves our node
        const involvesNode = sourceId === nodeId || targetId === nodeId;
        
        // Check if this is a parent-child relationship
        const isParentChild = 
            (sourceId === parentId && targetId === nodeId) ||
            (sourceId === nodeId && targetId === parentId) ||
            (sourceId === nodeId && childrenIds.includes(targetId)) ||
            (targetId === nodeId && childrenIds.includes(sourceId));
        
        return involvesNode && !isParentChild;
    }).length;

    console.log(`Node ${nodeId}: Found ${count} non-tree links`); // Debug log
    return count;
}