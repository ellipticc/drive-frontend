"use client"

import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

// Fix for default marker icons in Next.js
const iconUrl = 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png';
const iconRetinaUrl = 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png';
const shadowUrl = 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
    iconUrl,
    iconRetinaUrl,
    shadowUrl,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    tooltipAnchor: [16, -28],
    shadowSize: [41, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

function ChangeView({ center, zoom }: { center: [number, number], zoom: number }) {
    const map = useMap();
    useEffect(() => {
        map.setView(center, zoom);
    }, [center, zoom, map]);
    return null;
}

interface MapComponentProps {
    lat: number;
    lng: number;
    popupText?: string;
}

export default function MapComponent({ lat, lng, popupText }: MapComponentProps) {
    // Default to 0,0 if invalid, but parent should ideally control this
    const position: [number, number] = [lat || 0, lng || 0];
    const isDefault = position[0] === 0 && position[1] === 0;

    return (
        <MapContainer
            center={position}
            zoom={isDefault ? 2 : 13}
            style={{ height: '100%', width: '100%' }}
            scrollWheelZoom={false}
        >
            <ChangeView center={position} zoom={isDefault ? 2 : 13} />
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {!isDefault && (
                <Marker position={position}>
                    {popupText && <Popup>{popupText}</Popup>}
                </Marker>
            )}
        </MapContainer>
    )
}
