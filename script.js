let leafletMap = null;
let markerLayer = null; 
const svg = d3.select("#chart");
const tooltip = d3.select(".tooltip");
const margin = { top: 40, right: 20, bottom: 100, left: 100 },
      width = +svg.attr("width") - margin.left - margin.right,
      height = +svg.attr("height") - margin.top - margin.bottom;

const chartGroup = svg.append("g")
  .attr("transform", `translate(${margin.left},${margin.top})`);

const yearFilter = document.getElementById("yearFilter");
const mapDiv = d3.select("#map");
let rawData = [], filteredData = [], currentChart = "neighbourhood";


function parseGeoPoint(geoString) {
  if (!geoString || !geoString.includes(",")) return null;
  const parts = geoString.split(",").map(s => parseFloat(s.trim()));
  return parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1]) ? [parts[1], parts[0]] : null;
}

function getDecade(year) {
  const num = parseInt(year);
  if (isNaN(num)) return "Unknown";
  return `${Math.floor(num / 10) * 10}s`;
}

function populateYearFilter(data) {
  const decades = Array.from(new Set(data.map(d => getDecade(d.YearOfInstallation))))
    .filter(Boolean)
    .sort();
  decades.forEach(decade => {
    const option = document.createElement("option");
    option.value = decade;
    option.textContent = decade;
    yearFilter.appendChild(option);
  });
}

function filterByYear(decade) {
  if (decade === "All") return rawData;
  return rawData.filter(d => getDecade(d.YearOfInstallation) === decade);
}

function updateChartData() {
  const selectedYear = yearFilter.value;
  filteredData = filterByYear(selectedYear);
  showChart(currentChart);
}

yearFilter.addEventListener("change", updateChartData);

function drawBarChart(groupedData, label) {
  chartGroup.selectAll("*").remove();
  svg.classed("hidden", false);
  mapDiv.classed("hidden", true);

  const x = d3.scaleBand()
    .domain(groupedData.map(d => d[0]))
    .range([0, width])
    .padding(0.2);

  const y = d3.scaleLinear()
    .domain([0, d3.max(groupedData, d => d[1])])
    .nice()
    .range([height, 0]);

  chartGroup.append("g")
    .attr("transform", `translate(0, ${height})`)
    .call(d3.axisBottom(x))
    .selectAll("text")
    .attr("transform", "rotate(-45)")
    .style("text-anchor", "end");

  chartGroup.append("g").call(d3.axisLeft(y));

  chartGroup.selectAll("rect")
    .data(groupedData)
    .enter()
    .append("rect")
    .attr("x", d => x(d[0]))
    .attr("y", d => y(d[1]))
    .attr("width", x.bandwidth())
    .attr("height", d => height - y(d[1]))
    .attr("fill", "#3498db")
    .on("mouseover", (event, d) => {
      tooltip.classed("hidden", false)
             .style("left", (event.pageX + 10) + "px")
             .style("top", (event.pageY - 20) + "px")
             .html(`<strong>${label}:</strong> ${d[0]}<br><strong>Count:</strong> ${d[1]}`);
    })
    .on("mouseout", () => tooltip.classed("hidden", true));

  chartGroup.append("text")
    .attr("x", width / 2)
    .attr("y", -10)
    .attr("text-anchor", "middle")
    .style("font-size", "18px")
    .text(`Public Art by ${label}`);
}

function drawMap(data) {
  svg.classed("hidden", true);
  mapDiv.classed("hidden", false);

  // Initialize the map only once
  if (!leafletMap) {
    leafletMap = L.map("map").setView([49.28, -123.12], 13);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(leafletMap);

    markerLayer = L.layerGroup().addTo(leafletMap);
  } else {
    // ✅ Delay resize fix to allow DOM to render
    setTimeout(() => {
      leafletMap.invalidateSize();
    }, 200);
    markerLayer.clearLayers();
  }

  // Add new markers
  data.forEach(d => {
    const point = parseGeoPoint(d.geo_point_2d);
    if (point) {
      L.circleMarker([point[1], point[0]], {
        radius: 4,
        color: "orange",
        fillColor: "orange",
        fillOpacity: 0.7
      }).addTo(markerLayer);
    }
  });
}


function drawYearTrend(data) {
  const grouped = d3.rollups(data, v => v.length, d => getDecade(d.YearOfInstallation))
    .filter(d => d[0])
    .sort((a, b) => d3.ascending(a[0], b[0]));
  drawBarChart(grouped, "Decade");
}

function showChart(which) {
  currentChart = which;
  if (which === 'neighbourhood') {
    const grouped = d3.rollups(filteredData, v => v.length, d => d.Neighbourhood || "Unknown")
      .sort((a, b) => d3.descending(a[1], b[1]));
    drawBarChart(grouped, "Neighbourhood");
  } else if (which === 'type') {
    const grouped = d3.rollups(filteredData, v => v.length, d => d.Type || "Unknown")
      .sort((a, b) => d3.descending(a[1], b[1]));
    drawBarChart(grouped, "Type");
  } else if (which === 'year') {
    drawYearTrend(filteredData);
  } else if (which === 'map') {
    drawMap(filteredData);
  }
}

d3.csv("public-art.csv").then(data => {
  data.forEach(d => {
    d.Neighbourhood = d.Neighbourhood?.trim() || "Unknown";
    d.Type = d.Type?.trim() || "Unknown";
    d.YearOfInstallation = d.YearOfInstallation?.trim();
  });
  rawData = data;
  filteredData = data;
  populateYearFilter(data);
  showChart(currentChart);
});