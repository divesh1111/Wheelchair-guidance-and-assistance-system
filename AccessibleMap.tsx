
'use client';

import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useState, useCallback, useRef } from 'react';
// Updated import for the new cluster library
import MarkerClusterGroup from 'react-leaflet-cluster';
// CSS for react-leaflet-cluster is typically handled differently or might not be needed explicitly depending on setup
// Ensure necessary CSS is loaded, potentially via globals.css or specific component styling if required by the library.

// Fix for default marker icon issue with webpack
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom wheelchair icon
const wheelchairIcon = L.divIcon({
  html: '<span style="font-size: 1.5em; color: blue;">♿</span>',
  className: 'bg-transparent border-0',
  iconSize: [24, 24],
  iconAnchor: [12, 24],
  popupAnchor: [0, -24]
});

interface Venue {
  id: number;
  type: 'node' | 'way' | 'relation';
  lat: number;
  lon: number;
  tags: { [key: string]: string };
}

interface OverpassElement {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number; // Present for nodes
  lon?: number; // Present for nodes
  center?: { lat: number; lon: number }; // Present for ways/relations if requested
  tags: { [key: string]: string };
}

interface AccessibleMapProps {
  // Props can be added later
}

// Debounce function
function debounce<F extends (...args: any[]) => any>(func: F, waitFor: number) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<F>): Promise<ReturnType<F>> =>
    new Promise((resolve) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      timeoutId = setTimeout(() => resolve(func(...args)), waitFor);
    });
}

function MapContent() {
  const map = useMap();
  const [venues, setVenues] = useState<Venue[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const isFetching = useRef(false); // Ref to prevent concurrent fetches

  const fetchVenues = useCallback(async () => {
    if (isFetching.current) return; // Prevent concurrent fetches
    isFetching.current = true;
    setIsLoading(true);
    setError(null);

    const bounds = map.getBounds();
    const boundsStr = `${bounds.getSouth()},${bounds.getWest()},${bounds.getNorth()},${bounds.getEast()}`;
    // Increased timeout, added more venue types, query ways/relations with center
    const overpassQuery = `
      [out:json][timeout:30];
      (
        node["wheelchair"~"yes|limited"](if:t["amenity"] || t["shop"] || t["tourism"] || t["leisure"] || t["office"] || t["public_transport"])(${boundsStr});
        way["wheelchair"~"yes|limited"](if:t["amenity"] || t["shop"] || t["tourism"] || t["leisure"] || t["office"] || t["public_transport"])(${boundsStr});
        relation["wheelchair"~"yes|limited"](if:t["amenity"] || t["shop"] || t["tourism"] || t["leisure"] || t["office"] || t["public_transport"])(${boundsStr});
      );
      out center;
    `;
    const overpassUrl = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(overpassQuery)}`;

    try {
      console.log("Fetching from Overpass API...");
      const response = await fetch(overpassUrl);
      if (!response.ok) {
        throw new Error(`Overpass API request failed: ${response.statusText}`);
      }
      const data = await response.json();
      console.log("Overpass Data Received:", data.elements.length, "elements");

      const processedVenues: Venue[] = data.elements.map((el: OverpassElement) => ({
        id: el.id,
        type: el.type,
        lat: el.lat ?? el.center?.lat ?? 0,
        lon: el.lon ?? el.center?.lon ?? 0,
        tags: el.tags,
      })).filter(venue => venue.lat !== 0 && venue.lon !== 0); // Filter out elements without coordinates

      setVenues(processedVenues);
    } catch (err: any) {
      console.error('Error fetching Overpass data:', err);
      setError(`Failed to load venue data: ${err.message}`);
      setVenues([]); // Clear venues on error
    } finally {
      setIsLoading(false);
      isFetching.current = false;
    }
  }, [map]);

  // Debounced fetch function
  const debouncedFetchVenues = useCallback(debounce(fetchVenues, 1000), [fetchVenues]);

  useEffect(() => {
    // Fetch on initial load
    fetchVenues();

    // Fetch when map stops moving (debounced)
    map.on('moveend', debouncedFetchVenues);

    // Cleanup listener on component unmount
    return () => {
      map.off('moveend', debouncedFetchVenues);
    };
  }, [map, fetchVenues, debouncedFetchVenues]);

  return (
    <>
      {isLoading && <div style={{ position: 'absolute', top: '10px', left: '50%', transform: 'translateX(-50%)', zIndex: 1000, background: 'white', padding: '5px 10px', borderRadius: '5px', boxShadow: '0 0 5px rgba(0,0,0,0.3)' }}>Loading venues...</div>}
      {error && <div style={{ position: 'absolute', top: '10px', left: '50%', transform: 'translateX(-50%)', zIndex: 1000, background: 'red', color: 'white', padding: '5px 10px', borderRadius: '5px', boxShadow: '0 0 5px rgba(0,0,0,0.3)' }}>{error}</div>}
      {/* Use the new MarkerClusterGroup component. Props might differ, check react-leaflet-cluster docs if needed. */}
      <MarkerClusterGroup chunkedLoading>
        {venues.map((venue) => (
          <Marker key={`${venue.type}-${venue.id}`} position={[venue.lat, venue.lon]} icon={wheelchairIcon}>
            <Popup>
              <strong>{venue.tags.name || 'Unnamed Venue'}</strong><br />
              Type: {venue.tags.amenity || venue.tags.shop || venue.tags.tourism || venue.tags.leisure || 'N/A'}<br />
              Accessibility: {venue.tags.wheelchair}<br />
              {venue.tags['wheelchair:description'] && `(${venue.tags['wheelchair:description']})<br />`}
              {venue.tags['ramp:wheelchair'] === 'yes' && 'Ramp Available<br />'}
              {venue.tags['toilets:wheelchair'] === 'yes' && 'Accessible Toilet<br />'}
              {/* Basic check for elevator association - might need refinement */}
              {venue.tags['building:levels'] && 'Elevator Likely (Multi-level)<br />'}
              <a href={`https://www.openstreetmap.org/${venue.type}/${venue.id}`} target="_blank" rel="noopener noreferrer">View on OSM</a>
            </Popup>
          </Marker>
        ))}
      </MarkerClusterGroup>
    </>
  );
}

export default function AccessibleMap({}: AccessibleMapProps) {
  const position: L.LatLngExpression = [51.505, -0.09]; // Default center (London)

  return (
    <MapContainer center={position} zoom={13} scrollWheelZoom={true} style={{ height: 'calc(100vh - 100px)', width: '100%' }}> {/* Adjust height as needed */}
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapContent />
    </MapContainer>
  );
}

