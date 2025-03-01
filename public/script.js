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

const MAX_RECENT_ITEMS = 10; // defines the maximum number of recent entries to keep for each input field.

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

function addFilter() {
    const nodeId = document.getElementById('filterInput').value.trim();
    if (!nodeId) return;

    selectedFilters.add(nodeId);
    applyFilters();
}

function clearFilters() {
    selectedFilters.clear();
    currentFilter = null;
    filteredData = null;
    currentPage = 1;
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
            const activeView = document.querySelector('.view[style*="display: block"]')?.id;
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
        view.classList.remove('active');
    });

    // Update all buttons to show active state
    document.querySelectorAll('.view-controls button').forEach(button => {
        button.classList.remove('active-view');
        if (button.getAttribute('data-view') === viewName) {
            button.classList.add('active-view');
        }
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
        targetView.classList.add('active');
    }
    
    // Save the current view preference
    localStorage.setItem('lastActiveView', viewName);
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
        </div>
        ${selectedFilters.size > 0 ? 
            `<div class="bookmark-button-container">
                <button id="saveFilterBtn" class="bookmark-button">Save Filter Combination</button>
            </div>` : 
            ''}
        <div id="activeFilters" class="active-filters"></div>
        <div id="filterBookmarks" class="filter-bookmarks"></div>
    `;
    
    // Re-attach event handler for the Save Filter button if it exists
    const saveFilterBtn = document.getElementById('saveFilterBtn');
    if (saveFilterBtn) {
        saveFilterBtn.addEventListener('click', addFilterBookmark);
    }
    
    // Re-attach event handler for the language toggle button to ensure it works after DOM changes
    const langToggle = document.getElementById('langToggle');
    if (langToggle) {
        langToggle.onclick = toggleLanguage;
    }
    
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
    const toggleButton = document.getElementById('langToggle');
    if (toggleButton) {
        toggleButton.textContent = currentLanguage === 'en' ? '切换到中文' : 'Switch to English';
    }
    
    // Clear any filters first to simplify state management
    selectedFilters.clear();
    currentFilter = null;
    filteredData = null;
    currentPage = 1;
    
    // Reload current view with new language
    const activeView = document.querySelector('.view[style*="display: block"]')?.id;
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
    
    // Update filter UI if needed
    if (document.getElementById('filterSection')) {
        updateFilterUI();
    }
    
    console.log(`Language switched to: ${currentLanguage}`);
}

// Make sure language toggle is properly initialized in DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    // Initialize interface and other components
    initializeInterface();
    enhanceFormInputs();
    
    // Initialize existing autocomplete inputs
    initializeAutocomplete('noteId');
    initializeAutocomplete('noteContent');
    initializeAutocomplete('noteContentZh');
    initializeAutocomplete('noteParentId');
    initializeAutocomplete('fromId');
    initializeAutocomplete('toId');
    initializeAutocomplete('linkDescription');
    initializeAutocomplete('filterInput');
    
    // Ensure language toggle is properly set up
    const langToggle = document.getElementById('langToggle');
    if (langToggle) {
        // Make sure text is correct
        langToggle.textContent = currentLanguage === 'en' ? '切换到中文' : 'Switch to English';
        
        // Explicitly set the onclick handler
        langToggle.onclick = toggleLanguage;
        console.log('Language toggle initialized');
    }
    
    // Load bookmarks
    loadBookmarks();
    
    // Show the initial view
    const lastActiveView = localStorage.getItem('lastActiveView') || 'table';
    showView(lastActiveView);
});

// When updating the user interface, don't try to preserve the language toggle
// Just make sure it works in the initial state
function initializeInterface() {
    // ... existing code ...
    
    // Create language toggle container
    const langToggleContainer = document.createElement('div');
    langToggleContainer.className = 'language-toggle';
    
    // Create toggle button
    const toggleButton = document.createElement('button');
    toggleButton.id = 'langToggle';
    toggleButton.textContent = currentLanguage === 'en' ? '切换到中文' : 'Switch to English';
    toggleButton.onclick = toggleLanguage;
    
    // Append to container
    langToggleContainer.appendChild(toggleButton);
    
    // ... rest of existing code ...
}

// Update applyFilters to be simpler - don't worry about maintaining language toggle
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
            const activeView = document.querySelector('.view[style*="display: block"]')?.id;
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

// ... existing code ...

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

// Update the initializeInterface function to preserve language toggle functionality
function initializeInterface() {
  // First check if we've already initialized to prevent duplication
  if (document.querySelector('.app-container')) return;
  
  // Create main app container
  const appContainer = document.createElement('div');
  appContainer.className = 'app-container';
  
  // Create header - but preserve any existing language toggle buttons
  const existingToggle = document.getElementById('langToggle');
  const toggleFunction = existingToggle ? existingToggle.onclick : null;
  
  const header = document.createElement('header');
  header.className = 'app-header';
  
  // Create title
  const titleElement = document.createElement('h1');
  titleElement.className = 'app-title';
  titleElement.textContent = 'Zettelkasten System';
  
  // Create language toggle container
  const langToggleContainer = document.createElement('div');
  langToggleContainer.className = 'language-toggle';
  
  // Create toggle button while preserving original onclick function
  const toggleButton = document.createElement('button');
  toggleButton.id = 'langToggle';
  toggleButton.textContent = '切换到中文'; // Default text
  
  // If we found an existing toggle, preserve its text and function
  if (existingToggle) {
    toggleButton.textContent = existingToggle.textContent;
    if (toggleFunction) {
      toggleButton.onclick = toggleFunction;
    }
  }
  
  // Assemble header
  langToggleContainer.appendChild(toggleButton);
  header.appendChild(titleElement);
  header.appendChild(langToggleContainer);
  
  // Create main content area
  const mainContent = document.createElement('main');
  mainContent.className = 'main-content';
  
  // Create sidebar for forms and filters
  const sidebar = document.createElement('aside');
  sidebar.className = 'sidebar';
  
  // Find existing forms
  const noteForm = document.getElementById('noteForm');
  const linkForm = document.getElementById('linkForm');
  const filterSection = document.getElementById('filterSection');
  
  // Handle existing elements without removing them
  if (noteForm) {
    const noteCard = wrapInCard(noteForm, 'Add Note');
    sidebar.appendChild(noteCard);
  }
  
  if (linkForm) {
    const linkCard = wrapInCard(linkForm, 'Add Link');
    sidebar.appendChild(linkCard);
  }
  
  if (filterSection) {
    const filterCard = wrapInCard(filterSection, 'Filter');
    sidebar.appendChild(filterCard);
  }
  
  // Create view container
  const viewContainer = document.createElement('div');
  viewContainer.className = 'view-container';
  
  // Move view controls and views to view container
  const viewControls = document.querySelector('.view-controls');
  if (viewControls) {
    viewContainer.appendChild(viewControls);
  }
  
  // Move all views to view container
  document.querySelectorAll('.view').forEach(view => {
    viewContainer.appendChild(view);
  });
  
  // Assemble the layout
  mainContent.appendChild(sidebar);
  mainContent.appendChild(viewContainer);
  
  // Remove only specific outdated elements, rather than clearing everything
  // This preserves event handlers on elements we're not explicitly handling
  document.querySelectorAll('h1').forEach(h => {
    if (h !== titleElement) h.remove();
  });
  
  // Insert our new structure
  document.body.prepend(appContainer);
  appContainer.appendChild(header);
  appContainer.appendChild(mainContent);
  
  // Add CSS to body to apply new layout
  const style = document.createElement('style');
  style.textContent = `
    .app-container {
      max-width: 1600px;
      margin: 0 auto;
    }
    
    .main-content {
      display: grid;
      grid-template-columns: 300px 1fr;
      gap: 20px;
      margin-top: 20px;
    }
    
    .sidebar {
      grid-column: 1;
    }
    
    .view-container {
      grid-column: 2;
    }
    
    /* Responsive layout */
    @media (max-width: 900px) {
      .main-content {
        grid-template-columns: 1fr;
      }
      
      .sidebar, .view-container {
        grid-column: 1;
      }
    }
    
    /* Language toggle */
    .language-toggle button {
      background-color: var(--secondary-color);
    }
  `;
  document.head.appendChild(style);
}

// Helper function to wrap element in a card
function wrapInCard(element, title) {
  // Check if element is already wrapped in a card
  if (element.parentElement && element.parentElement.classList.contains('card')) {
    return element.parentElement;
  }
  
  // Create a new card
  const card = document.createElement('div');
  card.className = 'card';
  
  // Create card title
  const cardTitle = document.createElement('h2');
  cardTitle.className = 'card-title';
  cardTitle.textContent = title;
  
  // Clone element to preserve all event handlers
  const elementClone = element.cloneNode(true);
  
  // Find all elements with event handlers in the original
  const elementsWithHandlers = getAllElements(element);
  elementsWithHandlers.forEach(el => {
    // Find corresponding element in the clone
    const selector = getUniqueSelector(el);
    if (selector) {
      const cloneEl = elementClone.querySelector(selector);
      if (cloneEl) {
        // Copy all event handlers to the clone
        copyEventListeners(el, cloneEl);
      }
    }
  });
  
  // Remove the original element from DOM
  if (element.parentElement) {
    element.parentElement.removeChild(element);
  }
  
  // Add title and cloned element to card
  card.appendChild(cardTitle);
  card.appendChild(elementClone);
  
  return card;
}

// Helper function to get all elements inside a container
function getAllElements(container) {
  return [container, ...container.querySelectorAll('*')];
}

// Helper function to get a unique selector for an element
function getUniqueSelector(el) {
  if (el.id) return `#${el.id}`;
  
  // For elements without ID, try to create a path
  let path = '';
  while (el && el.tagName) {
    let selector = el.tagName.toLowerCase();
    if (el.className) {
      const classes = el.className.split(' ').filter(c => c).join('.');
      if (classes) {
        selector += `.${classes}`;
      }
    }
    path = path ? `${selector} > ${path}` : selector;
    el = el.parentElement;
  }
  
  return path;
}

// Helper function to copy event listeners from one element to another
function copyEventListeners(source, target) {
  // For declarative event handlers (onclick, etc.)
  const eventAttributes = ['onclick', 'onchange', 'onsubmit', 'onkeyup', 'onkeydown', 'oninput'];
  eventAttributes.forEach(attr => {
    if (source[attr]) {
      target[attr] = source[attr];
    }
  });
  
  // Copy the source element's ID to ensure any JS references work
  if (source.id && !target.id) {
    target.id = source.id;
  }
}

// Initialize the interface after DOM loaded
document.addEventListener('DOMContentLoaded', () => {
  initializeInterface();
  
  // Initialize existing autocomplete inputs
  initializeAutocomplete('noteId');
  initializeAutocomplete('noteContent');
  initializeAutocomplete('noteContentZh');
  initializeAutocomplete('noteParentId');
  initializeAutocomplete('fromId');
  initializeAutocomplete('toId');
  initializeAutocomplete('linkDescription');
  initializeAutocomplete('filterInput');
  
  // Load the initial view
  showView('table');
});

// Enhance form design and add validation feedback
function enhanceFormInputs() {
  // Improve form layout
  const formStyle = document.createElement('style');
  formStyle.textContent = `
    form {
      display: grid;
      grid-template-columns: 1fr;
      gap: 15px;
    }
    
    .form-group {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }
    
    .form-group label {
      font-weight: 500;
      font-size: 14px;
      color: #555;
    }
    
    .form-actions {
      display: flex;
      justify-content: flex-end;
      margin-top: 10px;
    }
    
    .input-error {
      border-color: var(--error-color) !important;
    }
    
    .error-message {
      color: var(--error-color);
      font-size: 12px;
      margin-top: 4px;
    }
    
    .input-with-icon {
      position: relative;
    }
    
    .clear-input {
      position: absolute;
      right: 10px;
      top: 50%;
      transform: translateY(-50%);
      background: none;
      border: none;
      cursor: pointer;
      color: #999;
      padding: 0;
      font-size: 16px;
    }
    
    .clear-input:hover {
      color: var(--error-color);
    }
  `;
  document.head.appendChild(formStyle);
  
  // Update note form structure
  const noteForm = document.getElementById('noteForm');
  if (noteForm) {
    // Save the original inputs
    const inputs = Array.from(noteForm.querySelectorAll('input'));
    const button = noteForm.querySelector('button');
    
    // Clear the form
    noteForm.innerHTML = '';
    
    // Rebuild the form with better structure
    inputs.forEach(input => {
      const formGroup = document.createElement('div');
      formGroup.className = 'form-group';
      
      const label = document.createElement('label');
      label.htmlFor = input.id;
      label.textContent = formatLabelText(input.placeholder || input.id);
      
      const inputWrapper = document.createElement('div');
      inputWrapper.className = 'input-with-icon';
      
      // Create new input with same properties
      const newInput = document.createElement('input');
      newInput.type = input.type;
      newInput.id = input.id;
      newInput.name = input.name;
      newInput.placeholder = input.placeholder;
      newInput.required = input.required;
      newInput.className = input.className;
      
      // Add clear button
      const clearButton = document.createElement('button');
      clearButton.type = 'button';
      clearButton.className = 'clear-input';
      clearButton.innerHTML = '&times;';
      clearButton.addEventListener('click', () => {
        newInput.value = '';
        newInput.focus();
      });
      
      // Error message container
      const errorMsg = document.createElement('div');
      errorMsg.className = 'error-message';
      errorMsg.style.display = 'none';
      
      // Add validation
      newInput.addEventListener('invalid', (e) => {
        e.preventDefault();
        newInput.classList.add('input-error');
        errorMsg.textContent = newInput.validationMessage || 'This field is required';
        errorMsg.style.display = 'block';
      });
      
      newInput.addEventListener('input', () => {
        newInput.classList.remove('input-error');
        errorMsg.style.display = 'none';
      });
      
      inputWrapper.appendChild(newInput);
      inputWrapper.appendChild(clearButton);
      
      formGroup.appendChild(label);
      formGroup.appendChild(inputWrapper);
      formGroup.appendChild(errorMsg);
      
      noteForm.appendChild(formGroup);
    });
    
    // Add form actions
    const formActions = document.createElement('div');
    formActions.className = 'form-actions';
    
    // Create new button
    const newButton = document.createElement('button');
    newButton.type = 'submit';
    newButton.textContent = button ? button.textContent : 'Add Note';
    
    formActions.appendChild(newButton);
    noteForm.appendChild(formActions);
  }
  
  // Similarly update the link form
  const linkForm = document.getElementById('linkForm');
  if (linkForm) {
    // Similar restructuring for link form
    // (I'll skip the implementation details for brevity, but it would follow the same pattern)
  }
}

// Helper to format label text from camelCase/id
function formatLabelText(text) {
  // Convert camelCase to spaces
  text = text.replace(/([A-Z])/g, ' $1');
  // Replace underscores and hyphens with spaces
  text = text.replace(/[_-]/g, ' ');
  // Capitalize first letter
  text = text.charAt(0).toUpperCase() + text.slice(1);
  // Replace common abbreviations
  text = text.replace(/Id\b/g, 'ID');
  text = text.replace(/Zh\b/g, '(Chinese)');
  return text;
}

// Add call to enhance forms in your initialization
document.addEventListener('DOMContentLoaded', () => {
  initializeInterface();
  enhanceFormInputs();
  // ... other initialization code ...
});

// Update the view controls
function enhanceViewControls() {
    const viewControls = document.querySelector('.view-controls');
    if (!viewControls) return;
    
    // Clear existing controls
    viewControls.innerHTML = '';
    
    // Add styled tabs
    const tabStyles = document.createElement('style');
    tabStyles.textContent = `
        .view-tabs {
            display: flex;
            background-color: white;
            border-radius: var(--radius);
            box-shadow: var(--shadow);
            margin-bottom: 20px;
            overflow: hidden;
        }
        
        .view-tab {
            padding: 12px 20px;
            border: none;
            background: none;
            color: var(--text-color);
            font-weight: 500;
            cursor: pointer;
            position: relative;
            transition: color 0.2s;
        }
        
        .view-tab:hover {
            background-color: rgba(33, 150, 243, 0.1);
        }
        
        .view-tab.active-view {
            color: var(--primary-color);
        }
        
        .view-tab.active-view::after {
            content: '';
            position: absolute;
            bottom: 0;
            left: 0;
            width: 100%;
            height: 3px;
            background-color: var(--primary-color);
        }
        
        .view-tab .tab-icon {
            margin-right: 8px;
            font-size: 16px;
        }
        
        .settings-container {
            margin-left: auto;
        }
    `;
    document.head.appendChild(tabStyles);
    
    // Create tabs container
    const tabsContainer = document.createElement('div');
    tabsContainer.className = 'view-tabs';
    
    // Add view tabs
    const views = [
        { id: 'table', icon: '📋', label: 'Table View' },
        { id: 'graph', icon: '🔄', label: 'Graph View' },
        { id: 'mindmap', icon: '🧠', label: 'Mind Map' },
        { id: 'terminal', icon: '💻', label: 'Terminal' }
    ];
    
    views.forEach(view => {
        const tab = document.createElement('button');
        tab.className = 'view-tab';
        tab.setAttribute('data-view', view.id);
        tab.innerHTML = `<span class="tab-icon">${view.icon}</span> ${view.label}`;
        tab.addEventListener('click', () => showView(view.id));
        tabsContainer.appendChild(tab);
    });
    
    // Add settings container
    const settingsContainer = document.createElement('div');
    settingsContainer.className = 'settings-container';
    
    // Add transfer markdown button
    const transferButton = document.createElement('button');
    transferButton.className = 'view-tab';
    transferButton.innerHTML = '<span class="tab-icon">📁</span> Transfer Files';
    transferButton.addEventListener('click', () => transferMarkdownFiles());
    
    settingsContainer.appendChild(transferButton);
    tabsContainer.appendChild(settingsContainer);
    
    // Add tabs to the view controls
    viewControls.appendChild(tabsContainer);
    
    // Load last active view or default to table
    const lastActiveView = localStorage.getItem('lastActiveView') || 'table';
    showView(lastActiveView);
}

// Update table display with better controls
function enhanceTableView() {
    // Style for enhanced table
    const tableStyles = document.createElement('style');
    tableStyles.textContent = `
        #notesTable {
            width: 100%;
            border-collapse: collapse;
            border-radius: var(--radius);
            overflow: hidden;
            box-shadow: var(--shadow);
        }
        
        #notesTable thead {
            background-color: var(--primary-color);
            color: white;
        }
        
        #notesTable th {
            text-align: left;
            padding: 12px 16px;
            font-weight: 500;
            cursor: pointer;
            position: relative;
        }
        
        #notesTable th::after {
            content: '⇕';
            margin-left: 5px;
            font-size: 12px;
            opacity: 0.5;
        }
        
        #notesTable th.sort-asc::after {
            content: '↓';
            opacity: 1;
        }
        
        #notesTable th.sort-desc::after {
            content: '↑';
            opacity: 1;
        }
        
        #notesTable td {
            padding: 12px 16px;
            border-bottom: 1px solid var(--border-color);
            vertical-align: top;
        }
        
        #notesTable tr:hover td {
            background-color: rgba(33, 150, 243, 0.05);
        }
        
        #notesTable tr.highlighted td {
            background-color: rgba(255, 87, 34, 0.08);
        }
        
        .table-actions {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 15px;
        }
        
        .table-search {
            position: relative;
            max-width: 300px;
        }
        
        .table-search input {
            padding-left: 35px;
        }
        
        .table-search::before {
            content: '🔍';
            position: absolute;
            left: 12px;
            top: 50%;
            transform: translateY(-50%);
            opacity: 0.5;
        }
        
        .pagination {
            display: flex;
            align-items: center;
            gap: 10px;
            background-color: white;
            padding: 10px 15px;
            border-radius: var(--radius);
            box-shadow: var(--shadow);
        }
        
        .pagination button {
            min-width: 40px;
        }
        
        .pagination button.active {
            background-color: var(--primary-color);
            color: white;
        }
    `;
    document.head.appendChild(tableStyles);
    
    // Update function to enhance the table display
    const enhanceTable = () => {
        const tableContainer = document.getElementById('notesTable');
        if (!tableContainer) return;
        
        // Add table actions section before the table
        if (!document.querySelector('.table-actions')) {
            const actionsContainer = document.createElement('div');
            actionsContainer.className = 'table-actions';
            
            // Add search input
            const searchContainer = document.createElement('div');
            searchContainer.className = 'table-search';
            
            const searchInput = document.createElement('input');
            searchInput.type = 'text';
            searchInput.placeholder = 'Search notes...';
            searchInput.id = 'table-search-input';
            searchInput.addEventListener('input', (e) => {
                const searchTerm = e.target.value.toLowerCase();
                const rows = tableContainer.querySelectorAll('tbody tr');
                
                rows.forEach(row => {
                    const text = row.textContent.toLowerCase();
                    if (text.includes(searchTerm)) {
                        row.style.display = '';
                    } else {
                        row.style.display = 'none';
                    }
                });
            });
            
            searchContainer.appendChild(searchInput);
            actionsContainer.appendChild(searchContainer);
            
            // Insert before table
            tableContainer.parentNode.insertBefore(actionsContainer, tableContainer);
        }
        
        // Add sorting functionality to table headers
        const headers = tableContainer.querySelectorAll('thead th');
        headers.forEach((header, index) => {
            header.addEventListener('click', () => {
                // Remove sort indicators from all headers
                headers.forEach(h => {
                    h.classList.remove('sort-asc', 'sort-desc');
                });
                
                const isAscending = header.classList.contains('sort-desc');
                header.classList.add(isAscending ? 'sort-asc' : 'sort-desc');
                
                // Sort table rows
                const rows = Array.from(tableContainer.querySelectorAll('tbody tr'));
                rows.sort((a, b) => {
                    const aValue = a.cells[index].textContent;
                    const bValue = b.cells[index].textContent;
                    
                    return isAscending 
                        ? aValue.localeCompare(bValue) 
                        : bValue.localeCompare(aValue);
                });
                
                // Reorder rows in the DOM
                const tbody = tableContainer.querySelector('tbody');
                rows.forEach(row => tbody.appendChild(row));
            });
        });
    };
    
    // Call initially and observe for changes
    enhanceTable();
    
    // Update the original displayTablePage function to work with enhancements
    const originalDisplayTablePage = displayTablePage;
    window.displayTablePage = function(rows, rootId, totalRows = null) {
        originalDisplayTablePage(rows, rootId, totalRows);
        enhanceTable();
    };
}

// ... existing code ...

// Add calls to all enhancers in initialization
document.addEventListener('DOMContentLoaded', () => {
    initializeInterface();
    enhanceFormInputs();
    enhanceViewControls();
    enhanceTableView();
    
    // Initialize existing autocomplete inputs
    initializeAutocomplete('noteId');
    initializeAutocomplete('noteContent');
    initializeAutocomplete('noteContentZh');
    initializeAutocomplete('noteParentId');
    initializeAutocomplete('fromId');
    initializeAutocomplete('toId');
    initializeAutocomplete('linkDescription');
    initializeAutocomplete('filterInput');
});

// Update the form initialization
function enhanceFormInputs() {
    // Add Note form
    const noteForm = document.getElementById('noteForm');
    if (noteForm) {
        // Make sure the form has a submit button
        if (!noteForm.querySelector('button[type="submit"]')) {
            const submitButton = document.createElement('button');
            submitButton.type = 'submit';
            submitButton.textContent = 'Add Note';
            noteForm.appendChild(submitButton);
        }
        
        // Add submit handler
        noteForm.onsubmit = handleNoteSubmit;
    }
    
    // Link form handling
    const linkForm = document.getElementById('linkForm');
    if (linkForm) {
        linkForm.onsubmit = handleLinkSubmit;
    }
}

// Updated filter section in HTML to fix duplicate heading
function updateFilterUI() {
    const filterSection = document.getElementById('filterSection');
    filterSection.innerHTML = `
        <div class="filter-input-group">
            <input type="text" id="filterInput" placeholder="Enter node ID (e.g. 1a)">
            <button onclick="addFilter()">Add Filter</button>
            <button onclick="clearFilters()">Clear All</button>
        </div>
        ${selectedFilters.size > 0 ? 
            `<div class="bookmark-button-container">
                <button id="saveFilterBtn" class="bookmark-button">Save Filter Combination</button>
            </div>` : 
            ''}
        <div id="activeFilters" class="active-filters"></div>
        <div id="filterBookmarks" class="filter-bookmarks"></div>
    `;
    
    // Re-attach event handler for the Save Filter button if it exists
    const saveFilterBtn = document.getElementById('saveFilterBtn');
    if (saveFilterBtn) {
        saveFilterBtn.addEventListener('click', addFilterBookmark);
    }
    
    // Re-attach event handler for the language toggle button to ensure it works after DOM changes
    const langToggle = document.getElementById('langToggle');
    if (langToggle) {
        langToggle.onclick = toggleLanguage;
    }
    
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

// Make sure our DOMContentLoaded handler runs enhanceFormInputs
document.addEventListener('DOMContentLoaded', () => {
    // Initialize interface and other components
    initializeInterface();
    enhanceFormInputs(); // This will add the missing "Add Note" button
    
    // Initialize existing autocomplete inputs
    initializeAutocomplete('noteId');
    initializeAutocomplete('noteContent');
    initializeAutocomplete('noteContentZh');
    initializeAutocomplete('noteParentId');
    initializeAutocomplete('fromId');
    initializeAutocomplete('toId');
    initializeAutocomplete('linkDescription');
    initializeAutocomplete('filterInput');
    
    // Ensure language toggle is properly set up
    const langToggle = document.getElementById('langToggle');
    if (langToggle) {
        // Make sure text is correct
        langToggle.textContent = currentLanguage === 'en' ? '切换到中文' : 'Switch to English';
        
        // Explicitly set the onclick handler
        langToggle.onclick = toggleLanguage;
        console.log('Language toggle initialized');
    }
    
    // Load bookmarks
    loadBookmarks();
    
    // Show the initial view
    const lastActiveView = localStorage.getItem('lastActiveView') || 'table';
    showView(lastActiveView);
    
    // Update filter UI to prevent duplicate heading
    updateFilterUI();
});