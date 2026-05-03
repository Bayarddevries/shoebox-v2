import { useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import type { Photo } from '../types'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

/** Encode each path segment to handle spaces, apostrophes, ampersands etc. */
function encodePath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/')
}

// Fix for default marker icons in Leaflet with Vite
const icon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

interface MapViewProps {
  photos: Photo[]
  onPhotoClick: (photo: Photo) => void
}

function MapUpdater({ photos }: { photos: Photo[] }) {
  const map = useMap()
  
  useEffect(() => {
    const validPhotos = photos.filter(p => p.lat && p.lng)
    if (validPhotos.length > 0) {
      const bounds = L.latLngBounds(validPhotos.map(p => [p.lat!, p.lng!]))
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 })
    }
  }, [photos, map])
  
  return null
}

export default function MapView({ photos, onPhotoClick }: MapViewProps) {
  const photosWithCoords = useMemo(() => 
    photos.filter(p => p.lat && p.lng),
    [photos]
  )

  if (photosWithCoords.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-73px)] text-center p-8">
        <div className="text-6xl mb-4">🗺️</div>
        <h2 className="text-2xl font-serif mb-2">No Location Data</h2>
        <p className="text-sm" style={{ color: 'var(--color-charcoal-light)' }}>
          Photos with GPS coordinates will appear on the map
        </p>
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-73px)]">
      <MapContainer
        center={[49.895, -97.138]}
        zoom={6}
        style={{ height: '100%', width: '100%' }}
        className="z-0"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <MapUpdater photos={photosWithCoords} />
        
        {photosWithCoords.map((photo) => (
          <Marker
            key={photo.id}
            position={[photo.lat!, photo.lng!]}
            icon={icon}
            eventHandlers={{
              click: () => onPhotoClick(photo),
            }}
          >
            <Popup>
              <div className="min-w-[200px]">
                <img 
                  src={encodePath(photo.src)} 
                  alt={photo.alt} 
                  className="w-full h-32 object-cover rounded mb-2"
                />
                <h4 className="font-medium text-sm">{photo.title || photo.alt}</h4>
                {photo.location && (
                  <p className="text-xs text-gray-600">{photo.location}</p>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}