const apiBase = "http://localhost:3060/api";
  

document.getElementById("linkForm").addEventListener("submit", (e) => {
  e.preventDefault();

  const from_id = document.getElementById("fromId").value;
  const to_id = document.getElementById("toId").value;

  fetch(`${apiBase}/links`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ from_id, to_id }),
  }).then(() => {
    alert("Link added!");
    loadGraph();
  });
});

// Load and visualize the graph
function loadGraph() {
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
  const nodeId = document.getElementById('filterInput').value;
  if (!nodeId) return;

  fetch(`${apiBase}/filter/${nodeId}`)
    .then(response => response.json())
    .then(data => {
      currentFilter = nodeId;
      updateTable(data.nodes);
      updateGraph(data.nodes, data.links);
    })
    .catch(error => console.error('Filter error:', error));
}

function clearFilter() {
  currentFilter = null;
  document.getElementById('filterInput').value = '';
  loadGraph();
  loadNotesTable();
}

function updateTable(filteredNodes) {
    const tableBody = document.querySelector("#notesTable tbody");
    tableBody.innerHTML = "";
  
    filteredNodes.forEach(row => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${row.child_id}</td>
        <td>${row.child_content}</td>
        <td>${row.parent_id || "-"}</td>
        <td>${row.parent_content || "-"}</td>
      `;
      tableBody.appendChild(tr);
    });
  }
  
  function updateGraph(nodes, links) {
    const svg = d3.select("svg");
    svg.selectAll("*").remove();
  
    // Use the same visualization code from loadGraph()
    // but with the filtered nodes and links
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
}

// Initial load
loadGraph();
loadNotesTable(); // Add this line