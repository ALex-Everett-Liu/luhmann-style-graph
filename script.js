const apiBase = "http://localhost:3060/api";

// Form submission handlers
document.getElementById("noteForm").addEventListener("submit", (e) => {
  e.preventDefault();

  const id = document.getElementById("noteId").value;
  const content = document.getElementById("noteContent").value;

  fetch(`${apiBase}/notes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, content }),
  }).then(() => {
    alert("Note added!");
    loadGraph();
  });
});

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

      const link = svg
        .append("g")
        .selectAll("line")
        .data(graph.links)
        .enter()
        .append("line")
        .attr("stroke", "#999")
        .attr("stroke-width", 2);

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

      node.append("title").text((d) => d.content);

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

// Initial load
loadGraph();
