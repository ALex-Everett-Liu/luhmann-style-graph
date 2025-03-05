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
        renderOutliner(hierarchyData);
    } else {
        // Add language parameter to the API call
        fetch(`${apiBase}/hierarchy?lang=${currentLanguage}`)
            .then(response => response.json())
            .then(hierarchyData => {
                console.log("Fetched hierarchy data for outliner:", hierarchyData);
                outlinerData = hierarchyData;
                renderOutliner(hierarchyData);
            })
            .catch(error => {
                console.error("Error loading outliner data:", error);
                clientLogger.error("Failed to load outliner data", { error });
            });
    }
}

// Function to render the outliner view
function renderOutliner(data) {
    const container = document.getElementById('outliner-content');
    container.innerHTML = '';

    if (!data || data.length === 0) {
        container.innerHTML = '<div class="empty-state">No notes available</div>';
        return;
    }

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
            expanded: true // Start with all nodes expanded
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

        // Add ID label
        const idEl = document.createElement('span');
        idEl.className = 'outliner-id';
        idEl.textContent = node.id;
        
        itemEl.appendChild(contentEl);
        itemEl.appendChild(idEl);
        
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
        const id = item.querySelector('.outliner-id').textContent.toLowerCase();
        
        if (content.includes(searchTerm) || id.includes(searchTerm)) {
            item.style.display = 'flex';
            
            // Make sure all parent containers are visible
            let parent = item.parentElement;
            while (parent && !parent.classList.contains('outliner-content-wrapper')) {
                if (parent.classList.contains('outliner-children')) {
                    parent.style.display = 'block';
                }
                parent = parent.parentElement;
            }
        } else {
            item.style.display = 'none';
        }
    });
}

// Function to update outliner when filter changes
function updateOutlinerWithFilter() {
    if (document.getElementById('outliner-container').style.display === 'block') {
        loadOutliner();
    }
}

// Export the functions to be used in the main script
window.outlinerModule = {
    loadOutliner,
    renderOutliner,
    initializeOutlinerSearch,
    applyOutlinerSearch,
    updateOutlinerWithFilter
}; 