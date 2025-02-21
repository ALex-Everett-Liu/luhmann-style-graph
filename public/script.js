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
    showView('graph');
    fetch(`${apiBase}/graph`)
      .then((response) => response.json())
      .then((graph) => {
        const svg = d3.select("svg");
        svg.selectAll("*").remove();
  
        const width = +svg.attr("width");
        const height = +svg.attr("height");
  
        const simulation = d3.forceSimulation(graph.nodes)
          .force("link", d3.forceLink(graph.links).id((d) => d.id))
          .force("charge", d3.forceManyBody().strength(-500))
          .force("center", d3.forceCenter(width / 2, height / 2));
  
        // Draw links (lines)
        const link = svg
          .append("g")
          .selectAll("line")
          .data(graph.links)
          .enter()
          .append("line")
          .attr("stroke", "#999")
          .attr("stroke-width", 2);
  
        // Draw nodes (circles)
        const node = svg
          .append("g")
          .selectAll("circle")
          .data(graph.nodes)
          .enter()
          .append("circle")
          .attr("r", 10)
          .attr("fill", "skyblue")
          .call(
            d3.drag()
              .on("start", (event, d) => {
                if (!event.active) simulation.alphaTarget(0.3).restart();
                d.fx = d.x;
                d.fy = d.y;
              })
              .on("drag", (event, d) => {
                d.fx = event.x;
                d.fy = event.y;
              })
              .on("end", (event, d) => {
                if (!event.active) simulation.alphaTarget(0);
                d.fx = null;
                d.fy = null;
              })
          );
  
        // Add tooltips to nodes
        node.append("title").text((d) => d.content);
  
        // Update positions on each tick
        simulation.on("tick", () => {
          link
            .attr("x1", (d) => d.source.x)
            .attr("y1", (d) => d.source.y)
            .attr("x2", (d) => d.target.x)
            .attr("y2", (d) => d.target.y);
  
          node.attr("cx", (d) => d.x).attr("cy", (d) => d.y);
        });
      });

}
  

// Load and display the parent-child table
function loadNotesTable() {
    const url = currentFilter 
      ? `${apiBase}/filter/${currentFilter}` 
      : `${apiBase}/notes-table`;
  
    fetch(url)
      .then((response) => response.json())
      .then((data) => {
        const rows = currentFilter ? data.nodes : data;
        const tableBody = document.querySelector("#notesTable tbody");
        tableBody.innerHTML = "";
  
        rows.forEach((row) => {
          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td>${row.child_id}</td>
            <td>${row.child_content}</td>
            <td>${row.parent_id || "-"}</td>
            <td>${row.parent_content || "-"}</td>
          `;
          tableBody.appendChild(tr);
        });
      });
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
  
    fetch(`${apiBase}/filter/${nodeId}`)
      .then(response => {
        if (!response.ok) throw new Error('Filter failed');
        return response.json();
      })
      .then(data => {
        if (data.nodes.length === 0) {
          alert('No nodes found for this filter');
          return;
        }
  
        // Highlight the hierarchy in table
        updateTable(data.nodes, data.rootId);
        
        // Update graph with filtered data
        updateGraph(data.nodes, data.links, data.rootId);
      })
      .catch(error => {
        console.error('Filter error:', error);
        alert(error.message);
      });
  }

function clearFilter() {
  currentFilter = null;
  document.getElementById('filterInput').value = '';
  loadGraph();
  loadNotesTable();
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
  
function updateGraph(nodes, links, rootId) {
    const svg = d3.select("svg");
    svg.selectAll("*").remove();
  
    const width = +svg.attr("width");
    const height = +svg.attr("height");
  
    // Create force simulation with filtered data
    const simulation = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links)
        .id(d => d.child_id)
        .distance(100)
      )
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("x", d3.forceX().x(d => d.child_id === rootId ? width/2 : null))
      .force("y", d3.forceY().y(d => d.child_id === rootId ? height/2 : null));
  
    // Draw links with weight-based styling
    const link = svg.append("g")
        .selectAll("line")
        .data(links)
        .enter().append("line")
        .attr("stroke", d => `hsl(200, 70%, ${70 - (d.weight * 0.5)}%)`) // Darker with higher weight
        .attr("stroke-width", d => d.weight * 0.1) // Scale width for 0-100 range
        .attr("opacity", 0.8);

    // Add weight labels with 1 decimal place
    const linkLabels = svg.append("g")
        .selectAll("text")
        .data(links)
        .enter().append("text")
        .text(d => d.weight.toFixed(1)) // Show one decimal
        .attr("font-size", "10px")
        .attr("fill", "#666");

  
    // Draw nodes with hierarchy coloring
    const node = svg.append("g")
      .selectAll("circle")
      .data(nodes)
      .enter().append("circle")
      .attr("r", 10)
      .attr("fill", d => d.child_id === rootId ? "#ff5722" : 
        d.parent_id === rootId ? "#2196f3" : "#4caf50")
      .call(d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended));
  
    // Add labels
    const labels = svg.append("g")
      .selectAll("text")
      .data(nodes)
      .enter().append("text")
      .text(d => d.child_id)
      .attr("font-size", "12px")
      .attr("dx", 15)
      .attr("dy", 4);
  
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
}

let mindmapData = null;

function showView(viewName) {
  document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
  document.getElementById(
    viewName === 'mindmap' ? 'mindmap-container' : 
    viewName === 'table' ? 'notesTable' : 'graph'
  ).classList.add('active');
  
  if (viewName === 'mindmap' && !mindmapData) loadMindMap();
}

function loadMindMap() {
  fetch(`${apiBase}/hierarchy`)
    .then(response => response.json())
    .then(data => {
      mindmapData = data;
      drawMindMap(data);
    });
}

function drawMindMap(data) {
  const svg = d3.select("#mindmap");
  svg.selectAll("*").remove();

  // Convert flat data to hierarchy
  const root = d3.stratify()
    .id(d => d.id)
    .parentId(d => d.parent_id)(data);

  // Create tree layout
  const treeLayout = d3.tree()
    .size([1000, 700])
    .separation((a, b) => (a.parent === b.parent ? 2 : 3));

  treeLayout(root);

  // Draw links
  svg.selectAll(".link")
    .data(root.links())
    .enter().append("path")
    .attr("class", "link")
    .attr("d", d3.linkVertical()
      .x(d => d.x)
      .y(d => d.y));

  // Draw nodes
  const nodes = svg.selectAll(".node")
    .data(root.descendants())
    .enter().append("g")
    .attr("transform", d => `translate(${d.x},${d.y})`);

  nodes.append("circle")
    .attr("class", "node-circle")
    .attr("r", 10)
    .attr("fill", d => d.depth === 0 ? "#ff5722" : "#2196f3");

  nodes.append("text")
    .attr("class", "node-text")
    .attr("dx", d => d.children ? -15 : 15)
    .attr("dy", 5)
    .style("text-anchor", d => d.children ? "end" : "start")
    .text(d => d.data.content);

  // Add zoom capability
  const zoom = d3.zoom()
    .scaleExtent([0.5, 5])
    .on("zoom", (event) => {
      svg.attr("transform", event.transform);
    });

  svg.call(zoom);

  nodes.on("click", (event, d) => {
    // Toggle children visibility
    if (d.children) {
      d._children = d.children;
      d.children = null;
    } else {
      d.children = d._children;
      d._children = null;
    }
    drawMindMap(data);
  });

  // Add tooltips
  nodes.append("title")
    .text(d => `ID: ${d.data.id}\nDepth: ${d.depth}`);
}

// script.js (modified fetchNotes() and table rendering functions)

let currentPage = 1; // Keep track of the current page
const notesPerPage = 10; // You can make this configurable if needed

async function fetchNotes(page = currentPage, pageSize = notesPerPage) { // Function now accepts page and pageSize
    try {
        const response = await fetch(`/api/notes?page=${page}&pageSize=${pageSize}`); // Add query parameters
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        currentNotes = data.notes; // Update currentNotes
        renderTable(currentNotes); // Render the current page's notes
        updatePaginationControls(data.page, data.totalPages); // Update pagination UI
    } catch (error) {
        console.error('Failed to fetch notes:', error);
        // Handle error display in UI if needed
    }
}

function renderTable(notes) { // Takes notes array as argument
    const tableBody = document.querySelector('#noteTable tbody');
    tableBody.innerHTML = ''; // Clear existing table rows

    notes.forEach(note => { // Iterate over the provided 'notes' array
        const row = tableBody.insertRow();
        row.insertCell().textContent = note.child_id || '';
        row.insertCell().textContent = note.child_content || '';
        row.insertCell().textContent = note.parent_id || '';
        row.insertCell().textContent = note.parent_content || '';
        row.insertCell().textContent = note.weight || '';
    });
}

function updatePaginationControls(currentPage, totalPages) {
    const paginationDiv = document.getElementById('pagination');
    paginationDiv.innerHTML = '';

    if (totalPages <= 1) return;

    const prevButton = document.createElement('button');
    prevButton.textContent = 'Previous';
    prevButton.disabled = currentPage === 1;
    prevButton.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            fetchNotes(currentPage);
        }
    });
    paginationDiv.appendChild(prevButton);

    // **Page Number Links**
    const pageLinksContainer = document.createElement('div'); // Container for page links
    pageLinksContainer.style.display = 'inline-block'; // To keep links in line
    pageLinksContainer.style.margin = '0 10px';

    for (let i = 1; i <= totalPages; i++) {
        const pageLink = document.createElement('button');
        pageLink.textContent = i;
        pageLink.classList.add('page-number-button'); // Add a class for styling
        if (i === currentPage) {
            pageLink.classList.add('active'); // Highlight the current page number
            pageLink.disabled = true; // Disable current page link
        }
        pageLink.addEventListener('click', () => {
            currentPage = i;
            fetchNotes(currentPage);
        });
        pageLinksContainer.appendChild(pageLink);
    }
    paginationDiv.appendChild(pageLinksContainer);


    const nextButton = document.createElement('button');
    nextButton.textContent = 'Next';
    nextButton.disabled = currentPage === totalPages;
    nextButton.addEventListener('click', () => {
        if (currentPage < totalPages) {
            currentPage++;
            fetchNotes(currentPage);
        }
    });
    paginationDiv.appendChild(nextButton);
}


// Initial fetch to load the first page when the page loads
document.addEventListener('DOMContentLoaded', () => {
    fetchNotes(); // Fetch the first page of notes on page load
});


// Initial load
loadGraph();
loadNotesTable(); // Add this line