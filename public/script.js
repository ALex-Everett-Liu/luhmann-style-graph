const apiBase = "http://localhost:3060/api";
let currentLanguage = 'en';
let currentFilter = null;
let currentPage = 1;
const rowsPerPage = 15;
let filteredData = null;
let selectedFilters = new Set();
let filterBookmarks = new Map();
let totalRows = 0;

// Using a Set allows for the automatic handling of duplicate entries, meaning that if a user enters the same value multiple times, it will only be stored once.
const recentInputs = {
    noteId: new Set(),
    noteContent: new Set(),
    noteContentZh: new Set(),
    noteParentId: new Set(),
    fromId: new Set(),
    toId: new Set(),
    linkDescription: new Set(),
    filterInput: new Set()
};

const MAX_RECENT_ITEMS = 5; // defines the maximum number of recent entries to keep for each input field.

// Add this helper function at the top of your script.js, checks if the application is running in an Electron environment.
function isElectron() {
    return window.electron !== undefined;
}

// handles the submission of a form for creating a link between two nodes
document.getElementById("linkForm").addEventListener("submit", (e) => {
    e.preventDefault();
  
    const from_id = document.getElementById("fromId").value;
    const to_id = document.getElementById("toId").value;
    const description = document.getElementById("linkDescription").value;
    const weight = parseFloat(document.getElementById("linkWeight").value) || 0;

    // Store recent inputs
    addRecentInput('fromId', from_id);
    addRecentInput('toId', to_id);
    addRecentInput('linkDescription', description);
  
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

// handle storing recent inputs
function addRecentInput(inputId, value) {
    if (!value.trim()) return;
    
    const recent = recentInputs[inputId];
    if (recent) {
        recent.add(value);
        if (recent.size > MAX_RECENT_ITEMS) {
            const firstItem = recent.values().next().value;
            recent.delete(firstItem);
        }
    }
}

// Add this function to create and show the dropdown
function showDropdown(input, items) {
    // Remove any existing dropdown
    const existingDropdown = document.querySelector('.autocomplete-dropdown');
    if (existingDropdown) {
        existingDropdown.remove();
    }

    if (items.size === 0) return;

    const dropdown = document.createElement('div');
    dropdown.className = 'autocomplete-dropdown';
    
    Array.from(items).reverse().forEach(item => {
        const option = document.createElement('div');
        option.className = 'autocomplete-item';
        option.textContent = item;
        option.addEventListener('click', () => {
            input.value = item;
            dropdown.remove();
        });
        dropdown.appendChild(option);
    });

    // Position the dropdown below the input
    const rect = input.getBoundingClientRect();
    dropdown.style.position = 'absolute';
    dropdown.style.left = rect.left + 'px';
    dropdown.style.top = (rect.bottom + window.scrollY) + 'px';
    dropdown.style.width = rect.width + 'px';

    document.body.appendChild(dropdown);

    // Close dropdown when clicking outside
    document.addEventListener('click', function closeDropdown(e) {
        if (!dropdown.contains(e.target) && e.target !== input) {
            dropdown.remove();
            document.removeEventListener('click', closeDropdown);
        }
    });
}

// Add this function to initialize autocomplete for an input
function initializeAutocomplete(inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;

    input.addEventListener('focus', () => {
        showDropdown(input, recentInputs[inputId]);
    });

    input.addEventListener('input', () => {
        addRecentInput(inputId, input.value);
    });
}

// Load and visualize the graph
function loadGraph() {
    if (currentFilter && filteredData) {
        // Use filtered data if available
        updateGraph(filteredData.nodes, filteredData.links || [], filteredData.rootIds);
    } else {
        // Load all data if no filter
        fetch(`${apiBase}/graph?lang=${currentLanguage}`)
            .then(response => response.json())
            .then(data => {
                updateGraph(data.nodes, data.links || [], []);
            })
            .catch(error => {
                console.error("Error loading graph:", error);
            });
    }
}

// Update loadNotesTable to handle pagination for both filtered and unfiltered data
function loadNotesTable(page = 1) {
    currentPage = page;
    
    if (filteredData) {
        // Handle filtered data pagination
        totalRows = filteredData.nodes.length; // Set totalRows for filtered data
        const startIndex = (currentPage - 1) * rowsPerPage;
        const endIndex = startIndex + rowsPerPage;
        const paginatedRows = filteredData.nodes.slice(startIndex, endIndex);
        displayTablePage(paginatedRows, null, totalRows);
    } else {
        // Handle unfiltered data pagination
        fetch(`${apiBase}/notes-table?page=${page}&limit=${rowsPerPage}&lang=${currentLanguage}`)
            .then(response => response.json())
            .then(data => {
                totalRows = data.total; // Set totalRows for unfiltered data
                displayTablePage(data.rows, null, totalRows);
            })
            .catch(error => {
                console.error('Error loading notes table:', error);
            });
    }
}

// Restore the original displayTablePage function
function displayTablePage(rows, rootId, totalRows = null) {
    const tableBody = document.querySelector("#notesTable tbody");
    tableBody.innerHTML = "";

    rows.forEach(row => {
        const tr = document.createElement("tr");
        tr.setAttribute('data-node-id', row.child_id);
        
        tr.innerHTML = `
            <td>
                ${row.child_id}
                <button class="markdown-button" onclick="handleMarkdownClick('${row.child_id}')">
                    📝
                </button>
            </td>
            <td>${row.child_content}</td>
            <td>${row.parent_id || "-"}</td>
            <td>${row.parent_content || "-"}</td>
        `;
        
        if (row.child_id === rootId) {
            tr.style.backgroundColor = '#ffeeba';
        }
        
        tableBody.appendChild(tr);
    });

    // Update pagination
    updatePagination(totalRows || rows.length);
}

// Restore the original updatePagination function
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
            <label for="page-input">Page</label>
            <input 
                type="number" 
                id="page-input"
                class="page-input"
                value="${currentPage}" 
                min="1" 
                max="${totalPages}"
                aria-label="Page number"
                title="Enter page number"
            >
            <span>of ${totalPages}</span>
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

// Restore the original changePage function
function changePage(newPage) {
    if (newPage < 1) return;
    
    const totalPages = Math.ceil(totalRows / rowsPerPage);
    
    if (newPage > totalPages) return;
    
    currentPage = newPage;
    loadNotesTable(newPage);
}

// Update form submission handlers to store recent inputs
document.getElementById("noteForm").addEventListener("submit", (e) => {
    e.preventDefault();
  
    const id = document.getElementById("noteId").value;
    const content = document.getElementById("noteContent").value;
    const content_zh = document.getElementById("noteContentZh").value;
    const parent_id = document.getElementById("noteParentId").value;

    // Store recent inputs
    addRecentInput('noteId', id);
    addRecentInput('noteContent', content);
    addRecentInput('noteContentZh', content_zh);
    addRecentInput('noteParentId', parent_id);
  
    fetch(`${apiBase}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, content, content_zh, parent_id }),
    }).then(() => {
      alert("Note added!");
      loadGraph();
      loadNotesTable();
      document.getElementById("noteForm").reset();
    });
});

function applyFilter() {
    const nodeId = document.getElementById('filterInput').value.trim();
    if (!nodeId) return;

    currentFilter = nodeId;
    currentPage = 1; // Reset to first page when filtering
    
    fetch(`${apiBase}/filter/${nodeId}?lang=${currentLanguage}`)
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
  
// Modify the updateGraph function to invert the weight for visualization
function updateGraph(nodes, links, rootIds) {
    try {
        // Transform the data structure for D3
        const graphNodes = nodes.map(node => ({
            id: node.child_id || node.id,
            content: node.child_content || node.content,
            parent_id: node.parent_id
        }));

        const graphLinks = links.map(link => ({
            source: link.from_id || link.source,
            target: link.to_id || link.target,
            weight: 0.4 * (30 - (link.weight || 0)) // Invert weight here for visualization
        }));

        // Clear existing SVG content
        const svg = d3.select("#graph svg");
        svg.selectAll("*").remove();

        // Set up SVG dimensions
        const width = svg.node().getBoundingClientRect().width;
        const height = svg.node().getBoundingClientRect().height;

        // Add zoom container
        const g = svg.append("g")
            .attr("class", "zoom-container");

        // Create force simulation
        const simulation = d3.forceSimulation(graphNodes)
            .force("link", d3.forceLink(graphLinks)
                .id(d => d.id)
                .distance(100))
            .force("charge", d3.forceManyBody()
                .strength(-200))
            .force("center", d3.forceCenter(width / 2, height / 2))
            .force("collision", d3.forceCollide().radius(30));

        // Create the links
        const link = g.append("g")
            .selectAll("line")
            .data(graphLinks)
            .join("line")
            .attr("stroke", "#999")
            .attr("stroke-width", d => Math.sqrt(d.weight || 1));

        // Create node groups
        const nodeGroup = g.append("g")
            .selectAll("g")
            .data(graphNodes)
            .join("g")
            .call(d3.drag()
                .on("start", dragstarted)
                .on("drag", dragged)
                .on("end", dragended));

        // Add circles to nodes
        nodeGroup.append("circle")
            .attr("r", 10)
            .attr("fill", d => {
                if (rootIds && rootIds.includes(d.id)) {
                    return "#ff5722"; // Root node color
                } else if (rootIds && rootIds.some(rootId => d.parent_id === rootId)) {
                    return "#2196f3"; // Direct child of root
                } else {
                    return "#69b3a2"; // Default color
                }
            });

        // Add labels to nodes
        nodeGroup.append("text")
            .text(d => {
                const content = d.content || '';
                return content.length > 20 ? content.substring(0, 17) + '...' : content;
            })
            .attr("x", 15)
            .attr("y", 5)
            .attr("font-family", "Arial")
            .attr("font-size", "12px")
            .attr("fill", "#333");

        // Add title for full content on hover
        nodeGroup.append("title")
            .text(d => d.content);

        // Add zoom behavior
        const zoom = d3.zoom()
            .scaleExtent([0.1, 4])
            .on("zoom", (event) => {
                g.attr("transform", event.transform);
            });

        svg.call(zoom);

        // Update positions on each tick
        simulation.on("tick", () => {
            link
                .attr("x1", d => d.source.x)
                .attr("y1", d => d.source.y)
                .attr("x2", d => d.target.x)
                .attr("y2", d => d.target.y);

            nodeGroup.attr("transform", d => `translate(${d.x},${d.y})`);
        });

        // Drag functions
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

    } catch (error) {
        console.error("Error in updateGraph:", error);
        clientLogger?.error('Graph visualization failed', { error: error.message });
    }
}

let mindmapData = null;

function showView(viewName) {
    console.log('Switching to view:', viewName);
    
    // Hide all views
    document.querySelectorAll('.view').forEach(view => {
        view.style.display = 'none';
    });

    // Show selected view
    let targetView;
    switch(viewName) {
        case 'table':
            targetView = document.getElementById('notesTable');
            loadNotesTable(); // Reload table data
            break;
        case 'graph':
            targetView = document.getElementById('graph');
            loadGraph(); // Reload graph
            break;
        case 'mindmap':
            targetView = document.getElementById('mindmap-container');
            loadMindMap(); // Reload mindmap
            break;
        case 'terminal':
            targetView = document.getElementById('terminal');
            break;
    }

    if (targetView) {
        targetView.style.display = 'block';
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
        // Add language parameter to the API call
        fetch(`${apiBase}/hierarchy?lang=${currentLanguage}`)
            .then(response => response.json())
            .then(hierarchyData => {
                console.log("Fetched hierarchy data:", hierarchyData);
                // Also fetch links data if not filtered, with language parameter
                return fetch(`${apiBase}/graph?lang=${currentLanguage}`)
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
            .size([height * 0.9, width * 0.7])
            .separation((a, b) => (a.parent === b.parent ? 5 : 7));

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
            .attr("r", 8)
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
            .attr("r", 8)
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
                    .attr("r", 8);

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
                const maxCharsPerLine = 20;
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
                    .attr("x", 5)
                    .attr("y", -5)
                    .text(linkCount)
                    .attr("font-size", "8px")
                    .attr("fill", "#666")
                    .style("font-weight", "bold")
                    .style("text-shadow", 
                        "1px 1px 0 white, -1px 1px 0 white, 1px -1px 0 white, -1px -1px 0 white");
            }
        });

        // Add zoom behavior
        const zoom = d3.zoom()
            .scaleExtent([0.2, 5])
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

// Update the filter section HTML in your index.html
function updateFilterUI() {
    const filterSection = document.getElementById('filterSection');
    filterSection.innerHTML = `
        <div class="filter-input-group">
            <input type="text" id="filterInput" placeholder="Enter node ID (e.g. 1a)">
            <button onclick="addFilter()">Add Filter</button>
            <button onclick="clearFilters()">Clear All</button>
            ${selectedFilters.size > 0 ? 
                `<button onclick="addFilterBookmark()" class="bookmark-button">Save Filter Combination</button>` : 
                ''}
        </div>
        <div id="activeFilters" class="active-filters"></div>
        <div id="filterBookmarks" class="filter-bookmarks"></div>
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

    // Update bookmarks list
    updateBookmarksList();
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
    
    fetch(`${apiBase}/filter-multiple?nodes=${nodeIds}&lang=${currentLanguage}`)
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
document.addEventListener('DOMContentLoaded', () => {
    updateFilterUI();
    showView('table'); // Start with table view

    // Initialize autocomplete for note form inputs
    initializeAutocomplete('noteId');
    initializeAutocomplete('noteContent');
    initializeAutocomplete('noteContentZh');
    initializeAutocomplete('noteParentId');
    
    // Initialize autocomplete for link form inputs
    initializeAutocomplete('fromId');
    initializeAutocomplete('toId');
    initializeAutocomplete('linkDescription');
    
    // Initialize autocomplete for filter input
    initializeAutocomplete('filterInput');
});

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

const clientLogger = {
    error: (message, data = {}) => {
        console.error(message, data);
        try {
            if (window.electron?.sendLog) {
                window.electron.sendLog('error', { message, data });
            }
        } catch (err) {
            console.error('Failed to send log:', err);
        }
    },
    warn: (message, data = {}) => {
        console.warn(message, data);
        try {
            if (window.electron?.sendLog) {
                window.electron.sendLog('warn', { message, data });
            }
        } catch (err) {
            console.warn('Failed to send log:', err);
        }
    },
    info: (message, data = {}) => {
        console.info(message, data);
        try {
            if (window.electron?.sendLog) {
                window.electron.sendLog('info', { message, data });
            }
        } catch (err) {
            console.info('Failed to send log:', err);
        }
    }
};

// Add language toggle function
function toggleLanguage() {
    currentLanguage = currentLanguage === 'en' ? 'zh' : 'en';
    // Update UI
    document.getElementById('langToggle').textContent = 
        currentLanguage === 'en' ? '切换到中文' : 'Switch to English';
    
    // Reload current view
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

// Update handleMarkdownClick function
async function handleMarkdownClick(nodeId) {
    try {
        // Get existing content
        const response = await fetch(`${apiBase}/markdown/${nodeId}`);
        const data = await response.json();
        
        // Create modal dialog
        const modal = document.createElement('div');
        modal.className = 'markdown-modal';
        modal.innerHTML = `
            <div class="markdown-modal-content">
                <h3>Notes for Node ${nodeId}</h3>
                <textarea id="markdown-content" rows="50" cols="120">${data.content}</textarea>
                <div class="markdown-modal-buttons">
                    <button onclick="saveMarkdown('${nodeId}')">Save</button>
                    <button onclick="closeMarkdownModal()">Close</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Focus the textarea
        document.getElementById('markdown-content').focus();
        
    } catch (error) {
        console.error('Error handling markdown:', error);
        alert('An error occurred while loading the notes');
    }
}

// Add save function
async function saveMarkdown(nodeId) {
    try {
        const content = document.getElementById('markdown-content').value;
        
        await fetch(`${apiBase}/markdown/${nodeId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ content })
        });
        
        closeMarkdownModal();
        updateMarkdownIndicator(nodeId, true);
    } catch (error) {
        console.error('Error saving markdown:', error);
        alert('An error occurred while saving the notes');
    }
}

// Add close function
function closeMarkdownModal() {
    const modal = document.querySelector('.markdown-modal');
    if (modal) {
        modal.remove();
    }
}

// Add this function to update the UI when a markdown file exists
function updateMarkdownIndicator(nodeId, hasMarkdown) {
    const row = document.querySelector(`tr[data-node-id="${nodeId}"]`);
    if (row) {
        if (hasMarkdown) {
            row.classList.add('has-markdown');
        } else {
            row.classList.remove('has-markdown');
        }
    }
}

// Add these styles to your existing styles
const autocompleteStyles = document.createElement('style');
autocompleteStyles.textContent = `
    .autocomplete-dropdown {
        background: white;
        border: 1px solid #ddd;
        border-radius: 4px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        max-height: 200px;
        overflow-y: auto;
        z-index: 1000;
    }

    .autocomplete-item {
        padding: 8px 12px;
        cursor: pointer;
        border-bottom: 1px solid #eee;
    }

    .autocomplete-item:last-child {
        border-bottom: none;
    }

    .autocomplete-item:hover {
        background-color: #f5f5f5;
    }
`;
document.head.appendChild(autocompleteStyles);

// Terminal handling
let terminalHistory = [];
let historyIndex = -1;

function initializeTerminal() {
    const input = document.getElementById('terminal-input');
    const output = document.getElementById('terminal-output');

    input.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter') {
            const command = input.value.trim();
            appendToTerminal(`zettel> ${command}`);
            
            if (command) {
                terminalHistory.unshift(command);
                historyIndex = -1;
                await executeCommand(command);
            }
            
            input.value = '';
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (historyIndex < terminalHistory.length - 1) {
                historyIndex++;
                input.value = terminalHistory[historyIndex];
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (historyIndex > 0) {
                historyIndex--;
                input.value = terminalHistory[historyIndex];
            } else if (historyIndex === 0) {
                historyIndex = -1;
                input.value = '';
            }
        }
    });
}

function appendToTerminal(text) {
    const output = document.getElementById('terminal-output');
    output.innerHTML += text + '\n';
    output.scrollTop = output.scrollHeight;
}

async function executeCommand(command) {
    const [cmd, ...args] = command.split(' ');
    
    try {
        switch (cmd) {
            case 'add':
                await handleAddNote();
                break;
            case 'link':
                await handleAddLink();
                break;
            case 'list':
                await handleList(args);
                break;
            case 'show':
                await handleShow(args);
                break;
            case 'filter':
                await handleFilter(args);
                break;
            case 'help':
                showHelp();
                break;
            case 'clear':
                document.getElementById('terminal-output').innerHTML = '';
                break;
            default:
                appendToTerminal('Unknown command. Type "help" for available commands.');
        }
    } catch (error) {
        appendToTerminal(`Error: ${error.message}`);
    }
}

async function handleAddNote() {
    const id = await terminalPrompt('Note ID: ');
    const content = await terminalPrompt('Content: ');
    const content_zh = await terminalPrompt('Chinese Content (optional): ');
    const parent_id = await terminalPrompt('Parent ID (optional): ');

    try {
        const response = await fetch(`${apiBase}/notes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, content, content_zh, parent_id })
        });

        if (!response.ok) throw new Error('Failed to add note');
        appendToTerminal('Note added successfully!');
        loadGraph(); // Refresh the graph
    } catch (error) {
        appendToTerminal(`Error: ${error.message}`);
    }
}

function terminalPrompt(question) {
    return new Promise((resolve) => {
        appendToTerminal(question);
        const input = document.getElementById('terminal-input');
        const handler = (e) => {
            if (e.key === 'Enter') {
                const value = input.value.trim();
                input.value = '';
                appendToTerminal(value);
                input.removeEventListener('keydown', handler);
                resolve(value);
            }
        };
        input.addEventListener('keydown', handler);
    });
}

function showHelp() {
    appendToTerminal(`
Available Commands:
==================
add              Add a new note
link             Create a link between notes
list [page]      List all notes (paginated)
show <note_id>   Show details of a specific note
filter <note_id> Filter notes by ID
help             Show this help message
clear            Clear terminal output
`);
}

// Update the event listeners for view buttons
document.addEventListener('DOMContentLoaded', () => {
    // Table View button
    document.querySelector('button[onclick="showView(\'table\')"]').addEventListener('click', () => {
        showView('table');
    });

    // Graph View button
    document.querySelector('button[onclick="showView(\'graph\')"]').addEventListener('click', () => {
        showView('graph');
    });

    // Mind Map button
    document.querySelector('button[onclick="showView(\'mindmap\')"]').addEventListener('click', () => {
        showView('mindmap');
    });

    // Terminal button
    document.querySelector('button[onclick="showView(\'terminal\')"]').addEventListener('click', () => {
        showView('terminal');
    });

    // Initialize terminal
    initializeTerminal();
});

// Load saved bookmarks from localStorage
function loadBookmarks() {
    try {
        const savedBookmarks = localStorage.getItem('filterBookmarks');
        if (savedBookmarks) {
            filterBookmarks = new Map(JSON.parse(savedBookmarks));
            updateBookmarksList();
        }
    } catch (error) {
        console.error('Error loading bookmarks:', error);
    }
}

// Save bookmarks to localStorage
function saveBookmarks() {
    try {
        localStorage.setItem('filterBookmarks', JSON.stringify([...filterBookmarks]));
    } catch (error) {
        console.error('Error saving bookmarks:', error);
    }
}

// Update the updateBookmarksList function
function updateBookmarksList() {
    const bookmarksContainer = document.getElementById('filterBookmarks');
    if (!bookmarksContainer) return;

    bookmarksContainer.innerHTML = '';
    
    if (filterBookmarks.size === 0) {
        bookmarksContainer.innerHTML = '<p class="no-bookmarks">No saved filter combinations</p>';
        return;
    }

    filterBookmarks.forEach((filters, name) => {
        const bookmarkDiv = document.createElement('div');
        bookmarkDiv.className = 'filter-bookmark';
        
        // Create the bookmark info div
        const infoDiv = document.createElement('div');
        infoDiv.className = 'bookmark-info';
        infoDiv.innerHTML = `
            <span class="bookmark-name">${name}</span>
            <span class="bookmark-filters">${filters.join(', ')}</span>
        `;
        
        // Create the actions div with buttons
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'bookmark-actions';
        
        // Create Apply button
        const applyButton = document.createElement('button');
        applyButton.className = 'apply-bookmark';
        applyButton.textContent = 'Apply';
        applyButton.addEventListener('click', () => applyBookmark(name));
        
        // Create Delete button
        const deleteButton = document.createElement('button');
        deleteButton.className = 'delete-bookmark';
        deleteButton.textContent = 'Delete';
        deleteButton.addEventListener('click', () => deleteBookmark(name));
        
        // Append buttons to actions div
        actionsDiv.appendChild(applyButton);
        actionsDiv.appendChild(deleteButton);
        
        // Append both divs to the bookmark div
        bookmarkDiv.appendChild(infoDiv);
        bookmarkDiv.appendChild(actionsDiv);
        
        // Append the bookmark div to the container
        bookmarksContainer.appendChild(bookmarkDiv);
    });
}

// Update the applyBookmark function
function applyBookmark(name) {
    const filters = filterBookmarks.get(name);
    if (!filters) return;

    // Clear existing filters
    selectedFilters.clear();
    
    // Add all filters from the bookmark
    filters.forEach(filter => selectedFilters.add(filter));
    
    // Update UI and apply filters
    updateFilterUI();
    applyFilters();
}

// Update the deleteBookmark function
function deleteBookmark(name) {
    if (confirm(`Delete bookmark "${name}"?`)) {
        filterBookmarks.delete(name);
        saveBookmarks();
        updateBookmarksList();
    }
}

// Add back the addFilterBookmark function
function addFilterBookmark() {
    // Create modal container
    const modal = document.createElement('div');
    modal.className = 'bookmark-modal';
    
    // Create modal content
    modal.innerHTML = `
        <div class="bookmark-modal-content">
            <h3>Save Filter Combination</h3>
            <input 
                type="text" 
                id="bookmarkName" 
                placeholder="Enter bookmark name"
                class="bookmark-name-input"
            >
            <div class="bookmark-modal-buttons">
                <button id="saveBookmark" class="save-button">Save</button>
                <button id="cancelBookmark" class="cancel-button">Cancel</button>
            </div>
        </div>
    `;
    
    // Add modal to document
    document.body.appendChild(modal);
    
    // Focus the input
    const input = modal.querySelector('#bookmarkName');
    input.focus();

    // Handle save
    modal.querySelector('#saveBookmark').addEventListener('click', () => {
        const name = input.value.trim();
        if (name) {
            filterBookmarks.set(name, Array.from(selectedFilters));
            saveBookmarks();
            updateBookmarksList();
            modal.remove();
        } else {
            input.classList.add('error');
            setTimeout(() => input.classList.remove('error'), 500);
        }
    });

    // Handle cancel
    modal.querySelector('#cancelBookmark').addEventListener('click', () => {
        modal.remove();
    });

    // Handle Enter key
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            modal.querySelector('#saveBookmark').click();
        }
    });

    // Handle Escape key
    document.addEventListener('keydown', function closeOnEscape(e) {
        if (e.key === 'Escape') {
            modal.remove();
            document.removeEventListener('keydown', closeOnEscape);
        }
    });

    // Close modal when clicking outside
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

// Add back the modal styles
const modalStyles = document.createElement('style');
modalStyles.textContent = `
    .bookmark-modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 1000;
    }

    .bookmark-modal-content {
        background: white;
        padding: 20px;
        border-radius: 8px;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        min-width: 300px;
    }

    .bookmark-modal-content h3 {
        margin: 0 0 15px 0;
        color: #333;
    }

    .bookmark-name-input {
        width: 100%;
        padding: 8px;
        margin-bottom: 15px;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-size: 14px;
    }

    .bookmark-name-input:focus {
        outline: none;
        border-color: #2196F3;
        box-shadow: 0 0 0 2px rgba(33, 150, 243, 0.1);
    }

    .bookmark-name-input.error {
        border-color: #f44336;
        animation: shake 0.5s;
    }

    .bookmark-modal-buttons {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
    }

    .bookmark-modal-buttons button {
        padding: 8px 16px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
    }

    .save-button {
        background: #4CAF50;
        color: white;
    }

    .save-button:hover {
        background: #45a049;
    }

    .cancel-button {
        background: #f5f5f5;
        border: 1px solid #ddd;
    }

    .cancel-button:hover {
        background: #e5e5e5;
    }

    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-5px); }
        75% { transform: translateX(5px); }
    }
`;
document.head.appendChild(modalStyles);

// Add these styles to your existing styles
const bookmarkStyles = document.createElement('style');
bookmarkStyles.textContent = `
    .filter-bookmarks {
        margin-top: 20px;
        border-top: 1px solid #eee;
        padding-top: 10px;
    }

    .filter-bookmark {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px;
        margin: 4px 0;
        background: #f5f5f5;
        border-radius: 4px;
        border: 1px solid #ddd;
    }

    .bookmark-info {
        flex: 1;
    }

    .bookmark-name {
        font-weight: bold;
        margin-right: 10px;
    }

    .bookmark-filters {
        color: #666;
        font-size: 0.9em;
    }

    .bookmark-actions {
        display: flex;
        gap: 8px;
    }

    .apply-bookmark {
        background: #4CAF50;
        color: white;
        border: none;
        padding: 4px 8px;
        border-radius: 3px;
        cursor: pointer;
    }

    .delete-bookmark {
        background: #f44336;
        color: white;
        border: none;
        padding: 4px 8px;
        border-radius: 3px;
        cursor: pointer;
    }

    .bookmark-button {
        background: #2196F3;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
    }

    .no-bookmarks {
        color: #666;
        font-style: italic;
        text-align: center;
        padding: 10px;
    }
`;
document.head.appendChild(bookmarkStyles);

// Initialize bookmarks when the page loads
document.addEventListener('DOMContentLoaded', () => {
    loadBookmarks();
    // ... existing DOMContentLoaded code ...
});

// Add this function to handle directory selection
async function selectMarkdownDirectory() {
    try {
        // Use Electron's dialog to select directory
        const result = await window.electron.showDirectoryPicker();
        
        if (!result.canceled) {
            const directory = result.filePaths[0];
            
            // Update the backend
            const response = await fetch(`${apiBase}/settings/markdown-dir`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ directory })
            });
            
            if (!response.ok) throw new Error('Failed to update markdown directory');
            
            const data = await response.json();
            alert('Markdown directory updated successfully!');
        }
    } catch (error) {
        console.error('Error updating markdown directory:', error);
        alert('Failed to update markdown directory: ' + error.message);
    }
}

// Add this function to handle markdown files transfer
async function transferMarkdownFiles() {
    try {
        // Use Electron's dialog to select directory
        const result = await window.electron.showDirectoryPicker();
        
        if (!result.canceled) {
            const directory = result.filePaths[0];
            
            // Show confirmation dialog
            if (!confirm(`Are you sure you want to transfer all markdown files to:\n${directory}`)) {
                return;
            }

            // Transfer the files
            const response = await fetch(`${apiBase}/settings/transfer-markdown`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ directory })
            });
            
            if (!response.ok) throw new Error('Failed to transfer files');
            
            const data = await response.json();
            
            // Show results
            let message = `Successfully transferred ${data.results.success.length} files to new location.`;
            if (data.results.failed.length > 0) {
                message += `\nFailed to transfer ${data.results.failed.length} files:`;
                data.results.failed.forEach(fail => {
                    message += `\n- ${fail.file}: ${fail.error}`;
                });
            }
            alert(message);
        }
    } catch (error) {
        console.error('Error transferring markdown files:', error);
        alert('Failed to transfer markdown files: ' + error.message);
    }
}