// This file contains all the Leaflet map logic.

// Initialize the map
var map = L.map('map', {
    center: [47.8095, 13.0550],
    zoom: 12
});

// --- Part 1: Base Maps ---
var osmap = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
});

var positron = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://carto.com/attributions">CartoDB</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map); // Add positron as default base layer

// --- Part 2: Global variables for GeoJSON layers ---
var kindergartenLayer;
var cityLayer;

// --- Part 3: Adding a scale bar ---
L.control.scale({position:'bottomleft',imperial:false}).addTo(map);

// --- Part 4: Adding GeoJSON point features (Kindergartens) ---
// Define funny kindergarten icon
var kindergartenIcon = L.icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/201/201818.png',
    iconSize: [32, 32],      // size of the icon
    iconAnchor: [16, 32],    // point of the icon which will correspond to marker's location
    popupAnchor: [0, -32]    // point from which the popup should open relative to the iconAnchor
});

const fetchKindergartens = fetch('data/kindergarden_last.geojson')
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status} for kindergarden_last.geojson`);
        }
        return response.json();
    })
    .then(data => {
        kindergartenLayer = L.geoJSON(data, {
            pointToLayer: function (feature, latlng) {
                return L.marker(latlng, { icon: kindergartenIcon });
            },
            onEachFeature: function (feature, layer) {
                let props = feature.properties;
                let popupContent = "<b>Kindergarten Info</b><br><table>";

                for (let key in props) {
                    let value = props[key];
                    if (
                        value !== null &&
                        value !== undefined &&
                        value !== "" &&
                        key !== "@id"
                    ) {
                        popupContent += `<tr><td><strong>${key}</strong></td><td>${value}</td></tr>`;
                    }
                }
                popupContent += "</table>";

                if (popupContent === "<b>Kindergarten Info</b><br><table></table>") {
                    popupContent = "<i>No available data</i>";
                }
                layer.bindPopup(popupContent);
            }
        });
        console.log('Kindergartens GeoJSON loaded successfully.');
        return kindergartenLayer;
    })
    .catch(error => {
        console.error('Error loading kindergarden_last.geojson:', error);
        return null; // Return null if loading fails
    });

// --- Part 5: Adding GeoJSON features and interactivity (City Boundary) ---
function highlightFeature(e) {
    var layer = e.target;
    layer.setStyle({
        weight: 4,
        color: '#5C3317', // Darker brown on hover
        fillOpacity: 0.7
    });

    if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
        layer.bringToFront();
    }
}

function resetHighlight(e) {
    // Use cityLayer.resetStyle to revert to original style
    if (cityLayer) { // Ensure cityLayer is defined
        cityLayer.resetStyle(e.target);
    }
}

function zoomToFeature(e) {
    map.fitBounds(e.target.getBounds());
}

function onEachCityFeature(feature, layer) {
    const props = feature.properties;
    let popupContent = "<b>City Info</b><br><table>";
    ["NAME", "Shape__Len", "Shape__Are"].forEach(key => {
        if (props[key]) {
            popupContent += `<tr><td><strong>${key}</strong></td><td>${props[key]}</td></tr>`;
        }
    });
    popupContent += "</table>";

    layer.bindPopup(popupContent);

    layer.on({
        mouseover: highlightFeature,
        mouseout: resetHighlight,
        click: zoomToFeature
    });
}

const cityStyle = {
    color: "#8B4513",    // brown border
    weight: 3,
    fillColor: "#DEB887", // light brown fill
    fillOpacity: 0.5
};

const fetchCity = fetch('data/City.geojson')
    .then(res => {
        if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status} for City.geojson`);
        }
        return res.json();
    })
    .then(data => {
        cityLayer = L.geoJSON(data, {
            style: cityStyle,
            onEachFeature: onEachCityFeature
        });
        console.log('City GeoJSON loaded successfully.');
        return cityLayer;
    })
    .catch(error => {
        console.error("Error loading City.geojson:", error);
        return null; // Return null if loading fails
    });

// --- Part 6: Adding a layer control for base maps and feature layers and custom legend ---

// Use Promise.all to ensure both GeoJSON layers are loaded before adding controls
Promise.all([fetchKindergartens, fetchCity]).then(([loadedKindergartenLayer, loadedCityLayer]) => {
    var baseMaps = {
        "OpenStreetMap": osmap,
        "CartoDB Positron": positron
    };

    var overlays = {};
    if (loadedKindergartenLayer) {
        overlays["Kindergartens"] = loadedKindergartenLayer.addTo(map); // Add to map here
    }
    if (loadedCityLayer) {
        overlays["City Boundary"] = loadedCityLayer.addTo(map); // Add to map here
    }

    // Add the Layer Control
    L.control.layers(baseMaps, overlays, {
        position: 'topleft',
        collapsed: false
    }).addTo(map);

    // Custom Legend Control - now that layers are loaded
    var legend = L.control({ position: "bottomright" });

    legend.onAdd = function(map) {
        var div = L.DomUtil.create("div", "info legend");

        div.innerHTML += "<h4>Legend</h4>";
        if (loadedKindergartenLayer) { // Only show if kindergarten layer loaded
            div.innerHTML += '<i style="background: transparent;"><img src="https://cdn-icons-png.flaticon.com/512/201/201818.png" width="20" height="20"></i> Kindergarten<br>';
        }
        if (loadedCityLayer) { // Only show if city layer loaded
             div.innerHTML += '<i style="background: #DEB887; width: 12px; height: 12px; display: inline-block; margin-right: 5px; border: 1px solid #8B4513;"></i> Salzburg City Boundary<br>';
        }

        return div;
    };
    legend.addTo(map);

    // Optional: zoom to city boundary when loaded and if city layer is available
    if (loadedCityLayer) {
        try {
            map.fitBounds(loadedCityLayer.getBounds());
        } catch (error) {
            console.error("Error fitting map bounds to city layer:", error);
        }
    }
});

// --- Part 7: Add Search Control ---
// This uses Nominatim (OpenStreetMap) by default for geocoding
L.Control.geocoder({
    defaultMarkGeocode: false, // Prevents default marker, we might want to add custom behavior
    placeholder: "Search for places..." // Custom placeholder text
})
.on('markgeocode', function(e) {
    // When a search result is selected, zoom to its bounding box
    map.fitBounds(e.geocode.bbox)
})
.addTo(map);

// --- Part 8: Add Geolocation Functionality ---
// Custom icon for your location
var userIcon = L.icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/3534/3534038.png',
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -30]
});

var locationMarker, locationCircle;

// Button click triggers location
document.getElementById("locate-btn").addEventListener("click", function () {
    map.locate({ setView: true, maxZoom: 16 });
});

// When location is found
map.on('locationfound', function (e) {
    // Remove previous marker/circle
    if (locationMarker) map.removeLayer(locationMarker);
    if (locationCircle) map.removeLayer(locationCircle);

    // Marker at your position
    locationMarker = L.marker(e.latlng, { icon: userIcon })
        .addTo(map)
        .bindPopup(`<b>You are here!</b><br>Lat: ${e.latitude.toFixed(5)}<br>Lng: ${e.longitude.toFixed(5)}`)
        .openPopup();

    // Accuracy circle
    locationCircle = L.circle(e.latlng, {
        radius: e.accuracy,
        color: "#4B0082",
        fillColor: "#9370DB",
        fillOpacity: 0.2
    }).addTo(map);
});

// If there's a problem
map.on('locationerror', function (e) {
    alert("Geolocation failed: " + e.message);
});

// Create a custom Leaflet control in bottom left
var locateControl = L.control({ position: 'bottomleft' });

locateControl.onAdd = function (map) {
    var div = L.DomUtil.create('div', 'leaflet-control-locate');
    div.innerHTML = '📍 Locate Me';

    // Prevent click events from propagating to the map
    L.DomEvent.disableClickPropagation(div);

    // Add click event
    div.onclick = function () {
        map.locate({ setView: true, maxZoom: 16 });
    };

    return div;
};

locateControl.addTo(map)
