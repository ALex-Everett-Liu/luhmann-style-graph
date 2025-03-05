// Outliner Module for Zettelkasten System
let outlinerData = null;
let linkData = null; // Store link data for references

// Function to load outliner data
function loadOutliner() {
    if (currentFilter && filteredData) {
        console.log("Using filtered data for outliner:", filteredData);
        const hierarchyData = filteredData.nodes.map(node => ({
            id: node.child_id,
            content: node.child_content,
            parent_id: node.parent_id
        }));
        
        // Use link data from filtered data
        linkData = filteredData.links;
        
        // Calculate proper depth for filtered data
        calculateDepthForFilteredData(hierarchyData);
        renderOutliner(hierarchyData);
        initializeOutlinerSearch(); // Initialize search after rendering
    } else {
        // Load both hierarchy and graph data to get links
        Promise.all([
            fetch(`${apiBase}/hierarchy?lang=${currentLanguage}`).then(response => response.json()),
            fetch(`${apiBase}/graph?lang=${currentLanguage}`).then(response => response.json())
        ])
        .then(([hierarchyData, graphData]) => {
            console.log("Fetched hierarchy data for outliner:", hierarchyData);
            outlinerData = hierarchyData;
            linkData = graphData.links;
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

    // Create a wrapper for the outliner items to allow for better positioning
    const outlinerItemsWrapper = document.createElement('div');
    outlinerItemsWrapper.className = 'outliner-items-wrapper';
    container.appendChild(outlinerItemsWrapper);

    // Function to recursively render a node and its children
    function renderNode(node, container) {
        const itemEl = document.createElement('div');
        itemEl.className = 'outliner-item';
        itemEl.dataset.nodeId = node.id;
        
        // Adjust padding to center the content better
        itemEl.style.paddingLeft = `${node.depth * 20 + 10}px`;

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

        // Add links section with toggle
        if (linkData && linkData.length > 0) {
            const linksContainer = addLinksSection(node.id, itemEl);
            container.appendChild(linksContainer);
        }

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

    // Function to add links section for a node
    function addLinksSection(nodeId, parentEl) {
        // Filter links for this node
        const outgoingLinks = linkData.filter(link => link.source === nodeId);
        const incomingLinks = linkData.filter(link => link.target === nodeId);
        
        // Create container only if there are links
        if (outgoingLinks.length === 0 && incomingLinks.length === 0) {
            return document.createDocumentFragment(); // Return empty fragment if no links
        }
        
        const linksContainer = document.createElement('div');
        linksContainer.className = 'outliner-links-container';
        
        // Calculate proper indentation based on parent's depth
        const depth = parseInt(parentEl.style.paddingLeft) || 0;
        linksContainer.style.marginLeft = `${depth}px`;
        linksContainer.style.display = 'none'; // Hidden by default
        
        // Create toggle button for links
        const linksToggleBtn = document.createElement('button');
        linksToggleBtn.className = 'outliner-links-toggle';
        
        // Show count of each type
        const outCount = outgoingLinks.length;
        const inCount = incomingLinks.length;
        linksToggleBtn.innerHTML = `<span class="outliner-link-icon">🔗</span> Links (${outCount + inCount})`;
        
        linksToggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isVisible = linksContainer.style.display === 'block';
            linksContainer.style.display = isVisible ? 'none' : 'block';
            linksToggleBtn.classList.toggle('active');
        });
        
        // Add links toggle button to parent
        const linksToggleContainer = document.createElement('div');
        linksToggleContainer.className = 'outliner-links-toggle-container';
        linksToggleContainer.style.marginLeft = `${depth}px`;
        linksToggleContainer.appendChild(linksToggleBtn);
        
        // Add outgoing links
        if (outgoingLinks.length > 0) {
            const outgoingSection = document.createElement('div');
            outgoingSection.className = 'outliner-links-section outgoing';
            
            const outgoingHeader = document.createElement('div');
            outgoingHeader.className = 'outliner-links-header';
            outgoingHeader.innerHTML = `<span class="outliner-link-icon">→</span> Links (${outgoingLinks.length})`;
            outgoingSection.appendChild(outgoingHeader);
            
            const outgoingList = document.createElement('ul');
            outgoingList.className = 'outliner-links-list';
            
            outgoingLinks.forEach(link => {
                const linkItem = createLinkItem(link.target, link.description, 'outgoing');
                outgoingList.appendChild(linkItem);
            });
            
            outgoingSection.appendChild(outgoingList);
            linksContainer.appendChild(outgoingSection);
        }
        
        // Add incoming links (backlinks)
        if (incomingLinks.length > 0) {
            const incomingSection = document.createElement('div');
            incomingSection.className = 'outliner-links-section incoming';
            
            const incomingHeader = document.createElement('div');
            incomingHeader.className = 'outliner-links-header';
            incomingHeader.innerHTML = `<span class="outliner-link-icon">←</span> Backlinks (${incomingLinks.length})`;
            incomingSection.appendChild(incomingHeader);
            
            const incomingList = document.createElement('ul');
            incomingList.className = 'outliner-links-list';
            
            incomingLinks.forEach(link => {
                const linkItem = createLinkItem(link.source, link.description, 'incoming');
                incomingList.appendChild(linkItem);
            });
            
            incomingSection.appendChild(incomingList);
            linksContainer.appendChild(incomingSection);
        }
        
        // Insert toggle button after parent element
        parentEl.after(linksToggleContainer);
        
        return linksContainer;
    }

    // Function to create a link item
    function createLinkItem(nodeId, description, linkType) {
        const item = document.createElement('li');
        item.className = `outliner-link-item ${linkType}`;
        
        // Find the node content
        const targetNode = data.find(n => n.id === nodeId);
        const nodeContent = targetNode ? targetNode.content : `Node ${nodeId}`;
        
        // Create link element
        const linkEl = document.createElement('a');
        linkEl.className = 'outliner-link';
        linkEl.href = '#';
        
        // Use different arrow symbols based on link type
        const icon = linkType === 'outgoing' ? '→' : '←';
        linkEl.innerHTML = `<span class="outliner-link-icon">${icon}</span> ${nodeContent} <span class="outliner-link-id">${nodeId}</span>`;
        
        linkEl.title = description || `${linkType === 'outgoing' ? 'Link to' : 'Referenced by'} ${nodeId}`;
        
        // Add click event to navigate to the linked node
        linkEl.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Find the target node element and scroll to it
            const targetElement = document.querySelector(`.outliner-item[data-node-id="${nodeId}"]`);
            if (targetElement) {
                // Ensure all parent containers are expanded
                expandParentsOf(nodeId);
                
                // Scroll to the target element
                targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                
                // Highlight the target element briefly
                targetElement.classList.add('outliner-highlight');
                setTimeout(() => {
                    targetElement.classList.remove('outliner-highlight');
                }, 2000);
            } else {
                console.log(`Node ${nodeId} not found in the current view`);
            }
        });
        
        item.appendChild(linkEl);
        
        // Add description if available
        if (description) {
            const descEl = document.createElement('span');
            descEl.className = 'outliner-link-description';
            descEl.textContent = description;
            item.appendChild(descEl);
        }
        
        return item;
    }

    // Function to expand all parent containers of a node
    function expandParentsOf(nodeId) {
        // Find the node in the data
        const findParentPath = (id, nodes) => {
            for (const node of nodes) {
                if (node.id === id) {
                    return [node.id];
                }
                if (node.children && node.children.length > 0) {
                    const path = findParentPath(id, node.children);
                    if (path) {
                        return [node.id, ...path];
                    }
                }
            }
            return null;
        };
        
        // Get the path from root to the target node
        const rootNodes = data.filter(node => !node.parent_id);
        let parentPath = null;
        
        for (const root of rootNodes) {
            const path = findParentPath(nodeId, [root]);
            if (path) {
                parentPath = path;
                break;
            }
        }
        
        if (!parentPath) return;
        
        // Expand all nodes in the path
        for (let i = 0; i < parentPath.length - 1; i++) {
            const parentId = parentPath[i];
            const parentEl = document.querySelector(`.outliner-item[data-node-id="${parentId}"]`);
            if (parentEl) {
                const toggleEl = parentEl.querySelector('.outliner-toggle');
                if (toggleEl && toggleEl.classList.contains('collapsed')) {
                    toggleEl.click(); // Simulate click to expand
                }
            }
        }
    }

    // Render all root nodes
    rootNodes.forEach(rootNode => {
        renderNode(rootNode, outlinerItemsWrapper);
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