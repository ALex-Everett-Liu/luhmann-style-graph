// Outliner Module for Zettelkasten System
let outlinerData = null;

// Function to load outliner data
function loadOutliner() {
    if (currentFilter && filteredData) {
        console.log("Using filtered data for outliner:", filteredData);
        const hierarchyData = filteredData.nodes.map(node => ({
            id: node.child_id,
            content: node.child_content,
            parent_id: node.parent_id
        }));
        
        // Calculate proper depth for filtered data
        calculateDepthForFilteredData(hierarchyData);
        renderOutliner(hierarchyData);
        initializeOutlinerSearch(); // Initialize search after rendering
    } else {
        // Add language parameter to the API call
        fetch(`${apiBase}/hierarchy?lang=${currentLanguage}`)
            .then(response => response.json())
            .then(hierarchyData => {
                console.log("Fetched hierarchy data for outliner:", hierarchyData);
                outlinerData = hierarchyData;
                renderOutliner(hierarchyData);
                initializeOutlinerSearch(); // Initialize search after rendering
            })
            .catch(error => {
                console.error("Error loading outliner data:", error);
                clientLogger.error("Failed to load outliner data", { error });
            });
    }
}

// Function to calculate proper depth for filtered data
function calculateDepthForFilteredData(data) {
    // Create a map of nodes by ID
    const nodeMap = new Map();
    data.forEach(node => {
        nodeMap.set(node.id, node);
    });
    
    // Find root nodes (nodes without parents or with parents not in the filtered set)
    const rootNodes = data.filter(node => 
        !node.parent_id || !nodeMap.has(node.parent_id)
    );
    
    // Assign depth 0 to root nodes and calculate depths for their children
    rootNodes.forEach(node => {
        node.depth = 0;
        assignDepthToChildren(node, nodeMap, 1);
    });
}

// Recursive function to assign depth to children
function assignDepthToChildren(node, nodeMap, depth) {
    // Find all children of this node
    const children = Array.from(nodeMap.values()).filter(n => n.parent_id === node.id);
    
    // Assign depth to each child and process their children
    children.forEach(child => {
        child.depth = depth;
        assignDepthToChildren(child, nodeMap, depth + 1);
    });
}

// Function to render the outliner view
function renderOutliner(data) {
    const container = document.getElementById('outliner-content');
    container.innerHTML = '';

    if (!data || data.length === 0) {
        container.innerHTML = '<div class="empty-state">No notes available</div>';
        return;
    }

    // Add expand/collapse all buttons
    const controlsDiv = document.createElement('div');
    controlsDiv.className = 'outliner-controls';
    
    const expandAllBtn = document.createElement('button');
    expandAllBtn.className = 'outliner-control-btn';
    expandAllBtn.textContent = 'Expand All';
    expandAllBtn.addEventListener('click', () => {
        expandCollapseAll(true);
    });
    
    const collapseAllBtn = document.createElement('button');
    collapseAllBtn.className = 'outliner-control-btn';
    collapseAllBtn.textContent = 'Collapse All';
    collapseAllBtn.addEventListener('click', () => {
        expandCollapseAll(false);
    });
    
    controlsDiv.appendChild(expandAllBtn);
    controlsDiv.appendChild(collapseAllBtn);
    container.appendChild(controlsDiv);

    // Build a tree structure from flat data
    const idToNodeMap = new Map();
    const rootNodes = [];

    // First pass: create node objects and store in map
    data.forEach(item => {
        const node = {
            id: item.id,
            content: item.content,
            parent_id: item.parent_id,
            children: [],
            depth: item.depth || 0,
            expanded: false // Start with all nodes collapsed by default
        };
        idToNodeMap.set(node.id, node);
    });

    // Second pass: establish parent-child relationships
    data.forEach(item => {
        const node = idToNodeMap.get(item.id);
        if (item.parent_id && idToNodeMap.has(item.parent_id)) {
            const parent = idToNodeMap.get(item.parent_id);
            parent.children.push(node);
        } else {
            rootNodes.push(node);
        }
    });

    // Make root nodes expanded by default
    rootNodes.forEach(node => {
        node.expanded = true;
    });

    // Function to recursively render a node and its children
    function renderNode(node, container) {
        const itemEl = document.createElement('div');
        itemEl.className = 'outliner-item';
        itemEl.dataset.nodeId = node.id;
        itemEl.style.paddingLeft = `${node.depth * 20}px`;

        // Create toggle button if node has children
        if (node.children && node.children.length > 0) {
            const toggleEl = document.createElement('span');
            toggleEl.className = `outliner-toggle ${node.expanded ? 'expanded' : 'collapsed'}`;
            toggleEl.innerHTML = node.expanded ? '▼' : '▶';
            toggleEl.addEventListener('click', (e) => {
                e.stopPropagation();
                node.expanded = !node.expanded;
                
                // Find the children container for this node
                const childrenContainer = itemEl.nextElementSibling;
                if (childrenContainer && childrenContainer.classList.contains('outliner-children')) {
                    // Toggle visibility instead of re-rendering the entire tree
                    childrenContainer.style.display = node.expanded ? 'block' : 'none';
                    toggleEl.innerHTML = node.expanded ? '▼' : '▶';
                    toggleEl.className = `outliner-toggle ${node.expanded ? 'expanded' : 'collapsed'}`;
                }
            });
            itemEl.appendChild(toggleEl);
        } else {
            // Add spacing for leaf nodes to align with parent nodes
            const spacerEl = document.createElement('span');
            spacerEl.className = 'outliner-spacer';
            spacerEl.innerHTML = '&nbsp;&nbsp;';
            itemEl.appendChild(spacerEl);
        }

        // Add bullet point
        const bulletEl = document.createElement('span');
        bulletEl.className = 'outliner-bullet';
        bulletEl.textContent = '•';
        itemEl.appendChild(bulletEl);

        // Add content
        const contentEl = document.createElement('span');
        contentEl.className = 'outliner-content';
        contentEl.textContent = node.content;
        contentEl.title = `ID: ${node.id}`;
        
        // Make the node clickable to open markdown editor
        contentEl.addEventListener('click', () => {
            handleMarkdownClick(node.id);
        });
        
        itemEl.appendChild(contentEl);
        
        // Create ID element but don't append it by default
        const idEl = document.createElement('span');
        idEl.className = 'outliner-id';
        idEl.textContent = node.id;
        
        // Add hover event to show/hide ID
        itemEl.addEventListener('mouseenter', () => {
            itemEl.appendChild(idEl);
        });
        
        itemEl.addEventListener('mouseleave', () => {
            if (itemEl.contains(idEl)) {
                itemEl.removeChild(idEl);
            }
        });
        
        container.appendChild(itemEl);

        // Recursively render children if expanded
        if (node.children && node.children.length > 0) {
            const childrenContainer = document.createElement('div');
            childrenContainer.className = 'outliner-children';
            childrenContainer.style.display = node.expanded ? 'block' : 'none';
            
            node.children.forEach(child => {
                renderNode(child, childrenContainer);
            });
            
            container.appendChild(childrenContainer);
        }
    }

    // Render all root nodes
    rootNodes.forEach(rootNode => {
        renderNode(rootNode, container);
    });

    // Function to expand or collapse all nodes
    function expandCollapseAll(expand) {
        // Update all toggle buttons
        document.querySelectorAll('.outliner-toggle').forEach(toggle => {
            toggle.innerHTML = expand ? '▼' : '▶';
            toggle.className = `outliner-toggle ${expand ? 'expanded' : 'collapsed'}`;
        });
        
        // Update all children containers
        document.querySelectorAll('.outliner-children').forEach(container => {
            container.style.display = expand ? 'block' : 'none';
        });
    }

    // Add the search functionality
    applyOutlinerSearch();
}

// Initialize the outliner search functionality
function initializeOutlinerSearch() {
    const searchInput = document.getElementById('outliner-search');
    if (searchInput) {
        searchInput.value = ''; // Clear search on init
        searchInput.addEventListener('input', () => {
            applyOutlinerSearch();
        });
    }
}

// Apply search filtering to outliner items
function applyOutlinerSearch() {
    const searchInput = document.getElementById('outliner-search');
    if (!searchInput) return;
    
    const searchTerm = searchInput.value.toLowerCase();
    const items = document.querySelectorAll('.outliner-item');
    
    if (!searchTerm) {
        // If no search term, make everything visible
        items.forEach(item => {
            item.style.display = 'flex';
        });
        
        // Make sure children containers follow their parent's expanded state
        document.querySelectorAll('.outliner-children').forEach(container => {
            const parentToggle = container.previousElementSibling.querySelector('.outliner-toggle');
            if (parentToggle && parentToggle.classList.contains('collapsed')) {
                container.style.display = 'none';
            } else {
                container.style.display = 'block';
            }
        });
        
        return;
    }
    
    // When searching, first hide all items
    items.forEach(item => {
        const content = item.querySelector('.outliner-content').textContent.toLowerCase();
        const id = item.dataset.nodeId.toLowerCase(); // Use dataset instead of looking for the ID element
        
        if (content.includes(searchTerm) || id.includes(searchTerm)) {
            item.style.display = 'flex';
            
            // Make sure all parent containers are visible
            let parent = item.parentElement;
            while (parent && !parent.classList.contains('outliner-content-wrapper')) {
                if (parent.classList.contains('outliner-children')) {
                    parent.style.display = 'block';
                    
                    // Also make sure the parent item's toggle is set to expanded
                    const parentItem = parent.previousElementSibling;
                    if (parentItem) {
                        const toggle = parentItem.querySelector('.outliner-toggle');
                        if (toggle) {
                            toggle.innerHTML = '▼';
                            toggle.className = 'outliner-toggle expanded';
                        }
                    }
                }
                parent = parent.parentElement;
            }
        } else {
            item.style.display = 'none';
        }
    });
    
    console.log(`Search applied with term: "${searchTerm}"`);
}

// Function to update outliner when filter changes
function updateOutlinerWithFilter() {
    if (document.getElementById('outliner-container').style.display === 'block') {
        loadOutliner();
    }
}

// Also make sure to call initializeOutlinerSearch when showing the outliner view
function showOutlinerView() {
    document.getElementById('outliner-container').style.display = 'block';
    loadOutliner();
    initializeOutlinerSearch();
}

// Export the functions to be used in the main script
window.outlinerModule = {
    loadOutliner,
    renderOutliner,
    initializeOutlinerSearch,
    applyOutlinerSearch,
    updateOutlinerWithFilter,
    showOutlinerView
}; 