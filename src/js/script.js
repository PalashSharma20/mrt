fetch("/src/data/pd.json")
  .then((res) => res.json())
  .then((pd) => {
    fetch("/src/data/mrt.json")
      .then((res) => res.json())
      .then((res) => {
        let { tel, stops, lines } = res
        let colors = [
          "#a8e3e5",
          "#71c7d7",
          "#428acb",
          "#2d6bb3",
          "#0c4c9f",
          "#00309f",
          "#521f8b",
          "#700080",
          "#990049",
        ]

        let map = L.map("map").setView([1.3521, 103.8198], 12)
        L.tileLayer(
          "https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
          {
            minZoom: 12,
            maxZoom: 15,
          }
        ).addTo(map)
        L.control.scale().addTo(map)

        let popDensity = L.geoJSON(pd.features, {
          style: (feature) => {
            let color = 0
            for (let i = 0; i < colors.length; i++) {
              let x = feature.properties["Total Population"],
                min = i * 5000,
                max = i === 9 ? Infinity : min + 5000
              if (x > min && x <= max) {
                color = i
              }
            }
            return {
              color: colors[color],
              weight: 2,
              opacity: 0.5,
              dashArray: "3",
              fillOpacity: 0.5,
            }
          },
        }).addTo(map)

        const legend = L.control({ position: "bottomright" })

        legend.onAdd = function (map) {
          let div = L.DomUtil.create("div", "info legend")
          for (var i = 0; i < colors.length; i++) {
            div.innerHTML += `<i style="background:${colors[i]}"></i> ${
              i * 5000
            }${colors[i + 1] ? "&ndash;" + (i + 1) * 5000 + "<br>" : "+"}`
          }
          return div
        }

        legend.addTo(map)

        let sgClip = []
        const sgClipOverlay = L.d3SvgOverlay((voronoiSvg, proj) => {
          const draw = () => {
            let bounds = map.getBounds(),
              topLeft = map.latLngToLayerPoint(bounds.getNorthWest())

            document
              .querySelectorAll(".overlay")
              .forEach((elem) => elem.remove())

            const latlng = (stop) => {
              let latlng = new L.LatLng(stop.coord[0], stop.coord[1])
              stop["latlng"] = latlng
              stop["pt"] = map.latLngToLayerPoint(latlng)
            }

            stops.forEach(latlng)
            tel.forEach(latlng)

            voronoiSvg
              .append("clipPath")
              .attr("id", "clip")
              .selectAll("path")
              .data(sgClip)
              .enter()
              .append("path")
              .attr("d", proj.pathFromGeojson)

            let voronoiSvgPoints = voronoiSvg
              .attr("clip-path", "url(#clip)")
              .selectAll("g")
              .data(stops)
              .enter()
              .append("g")
              .attr("transform", `translate(${-topLeft.x}, ${-topLeft.y})`)

            let transform = d3.geo.transform({
              point(y, x) {
                let point = map.latLngToLayerPoint(new L.LatLng(y, x))
                this.stream.point(point.x, point.y)
              },
            })

            let path = d3.geo.path().projection(transform)

            let svg = d3
              .select(map.getPanes().overlayPane)
              .append("svg")
              .attr("class", "overlay leaflet-zoom-hide")
              .style("width", `${map.getSize().x}px`)
              .style("height", `${map.getSize().y}px`)
              .style("margin-left", `${topLeft.x}px`)
              .style("margin-top", `${topLeft.y}px`)

            let feature = svg
              .selectAll("path")
              .data(lines)
              .enter()
              .append("path")

            feature
              .attr("d", (d) =>
                path({
                  type: "Feature",
                  geometry: {
                    type: "LineString",
                    coordinates: d.points,
                  },
                })
              )
              .attr("fill", "none")
              .attr("stroke", (d) => d.color)
              .attr("stroke-width", map.getZoom() / 3)
              .attr("transform", `translate(${-topLeft.x}, ${-topLeft.y})`)

            let voronoi = d3.geom
              .voronoi()
              .x((d) => d.pt.x)
              .y((d) => d.pt.y)

            let voronoiPolygons = voronoi(stops)

            voronoiPolygons.forEach((polygon) => (polygon.point.cell = polygon))

            voronoiSvgPoints
              .append("path")
              .attr("d", (point) => `M${point.cell.join("L")}Z`)
              .attr("fill", "none")
              .attr("fill-opacity", "0.5")
              .attr("stroke", "#000")
              .attr("stroke-width", map.getZoom() / 6)

            let mrtSvgPoints = svg
              .selectAll(".mrt")
              .data(stops)
              .enter()
              .append("g")
              .attr("class", "mrt")
              .attr("transform", `translate(${-topLeft.x}, ${-topLeft.y})`)

            mrtSvgPoints
              .append("circle")
              .attr("transform", (d) => `translate(${d.pt.x}, ${d.pt.y})`)
              .attr("fill", "white")
              .attr("stroke", "black")
              .attr("stroke-width", map.getZoom() / 3)
              .attr("r", (e) => map.getZoom() / 3)
              .append("svg:title")
              .text((d) => d.ref)

            let telSvgPoints = svg
              .selectAll(".tel")
              .data(tel)
              .enter()
              .append("g")
              .attr("class", "tel")
              .attr("transform", `translate(${-topLeft.x}, ${-topLeft.y})`)

            telSvgPoints
              .append("circle")
              .attr("transform", (d) => `translate(${d.pt.x}, ${d.pt.y})`)
              .attr("fill", "#654321")
              .attr("stroke", "yellow")
              .attr("stroke-width", map.getZoom() / 3)
              .attr("r", (e) => map.getZoom() / 3)
              .append("svg:title")
              .text((d) => d.ref)
          }

          map.on("viewreset moveend", draw)
          draw()
        })

        L.control
          .layers(
            { "Population Density": popDensity },
            { Voronoi: sgClipOverlay }
          )
          .addTo(map)

        sgClip = pd.features
        sgClipOverlay.addTo(map)
      })
  })
