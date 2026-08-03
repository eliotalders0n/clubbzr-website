'use client'

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from 'react'
import L, {
  type CircleMarker,
  type LayerGroup,
  type Map as LeafletMap,
  type TileLayer,
} from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './open-street-art-map.css'

export type MapVenueType =
  | 'gallery'
  | 'museum'
  | 'studio'
  | 'event'
  | 'other'

export interface MapVenue {
  id: string
  name: string
  type: MapVenueType
  coordinates: {
    lat: number
    lng: number
  }
  address?: string
  description?: string
  image?: string
}

export interface OpenStreetArtMapHandle {
  zoomIn: () => void
  zoomOut: () => void
  reset: () => void
  fitVenues: () => void
}

interface OpenStreetArtMapProps {
  venues: MapVenue[]
  selectedVenueId?: string | null
  userLocation?: { lat: number; lng: number } | null
  pickerLocation?: { lat: number; lng: number } | null
  onVenueSelect?: (venue: MapVenue) => void
  onVenueHover?: (venue: MapVenue | null) => void
  onLocationPick?: (coordinates: { lat: number; lng: number }) => void
  onTileStatusChange?: (status: 'loading' | 'ready' | 'error') => void
  className?: string
}

const DEFAULT_CENTER: L.LatLngExpression = [-15.4167, 28.2833]
const DEFAULT_ZOOM = 13
const DEFAULT_TILE_URL =
  'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const DEFAULT_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors'

const markerColors: Record<MapVenueType, string> = {
  gallery: '#ff6b35',
  museum: '#f4f1eb',
  studio: '#f3a15f',
  event: '#a3a3a3',
  other: '#595959',
}

const venueBounds = (venues: MapVenue[]) =>
  L.latLngBounds(
    venues.map(({ coordinates }) => [
      coordinates.lat,
      coordinates.lng,
    ])
  )

const createTooltip = (venue: MapVenue) => {
  const container = document.createElement('div')
  container.className = 'bzr-map-tooltip'

  const type = document.createElement('span')
  type.className = 'bzr-map-tooltip__type'
  type.textContent = venue.type

  const title = document.createElement('strong')
  title.className = 'bzr-map-tooltip__title'
  title.textContent = venue.name

  const address = document.createElement('span')
  address.className = 'bzr-map-tooltip__address'
  address.textContent = venue.address || 'Lusaka, Zambia'

  container.append(type, title, address)
  return container
}

export const OpenStreetArtMap = forwardRef<
  OpenStreetArtMapHandle,
  OpenStreetArtMapProps
>(function OpenStreetArtMap(
  {
    venues,
    selectedVenueId,
    userLocation,
    pickerLocation,
    onVenueSelect,
    onVenueHover,
    onLocationPick,
    onTileStatusChange,
    className,
  },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<LeafletMap | null>(null)
  const tileLayerRef = useRef<TileLayer | null>(null)
  const venueLayerRef = useRef<LayerGroup | null>(null)
  const venueMarkersRef = useRef(new Map<string, CircleMarker>())
  const selectionHaloRef = useRef<L.CircleMarker | null>(null)
  const userMarkerRef = useRef<L.CircleMarker | null>(null)
  const pickerMarkerRef = useRef<L.CircleMarker | null>(null)
  const venuesRef = useRef(venues)
  const callbacksRef = useRef({
    onVenueSelect,
    onVenueHover,
    onLocationPick,
    onTileStatusChange,
  })

  venuesRef.current = venues
  callbacksRef.current = {
    onVenueSelect,
    onVenueHover,
    onLocationPick,
    onTileStatusChange,
  }

  const fitCurrentVenues = () => {
    const map = mapRef.current
    const currentVenues = venuesRef.current
    if (!map) return

    if (currentVenues.length === 0) {
      map.flyTo(DEFAULT_CENTER, DEFAULT_ZOOM, { duration: 0.6 })
      return
    }

    if (currentVenues.length === 1) {
      const [venue] = currentVenues
      map.flyTo(
        [venue.coordinates.lat, venue.coordinates.lng],
        15,
        { duration: 0.65 }
      )
      return
    }

    map.flyToBounds(venueBounds(currentVenues).pad(0.26), {
      maxZoom: 14,
      duration: 0.65,
      paddingTopLeft: [32, 32],
      paddingBottomRight: [32, 140],
    })
  }

  useImperativeHandle(
    ref,
    () => ({
      zoomIn: () => mapRef.current?.zoomIn(),
      zoomOut: () => mapRef.current?.zoomOut(),
      reset: () =>
        mapRef.current?.flyTo(DEFAULT_CENTER, DEFAULT_ZOOM, {
          duration: 0.65,
        }),
      fitVenues: fitCurrentVenues,
    }),
    []
  )

  useEffect(() => {
    const container = containerRef.current
    if (!container || mapRef.current) return
    const venueMarkers = venueMarkersRef.current

    const map = L.map(container, {
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      minZoom: 3,
      maxZoom: 19,
      zoomControl: false,
      attributionControl: true,
      keyboard: true,
      scrollWheelZoom: true,
      preferCanvas: true,
      worldCopyJump: true,
    })

    map.attributionControl.setPosition('bottomright')
    L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(map)

    const tileUrl =
      import.meta.env.VITE_MAP_TILE_URL?.trim() || DEFAULT_TILE_URL
    const attribution =
      import.meta.env.VITE_MAP_TILE_ATTRIBUTION?.trim() ||
      DEFAULT_ATTRIBUTION

    callbacksRef.current.onTileStatusChange?.('loading')
    const tileLayer = L.tileLayer(tileUrl, {
      attribution,
      minZoom: 3,
      maxZoom: 19,
      maxNativeZoom: 19,
      crossOrigin: true,
      className: 'bzr-neon-map__tiles',
      updateWhenIdle: true,
      keepBuffer: 2,
    })
      .on('load', () =>
        callbacksRef.current.onTileStatusChange?.('ready')
      )
      .on('tileerror', () =>
        callbacksRef.current.onTileStatusChange?.('error')
      )
      .addTo(map)

    const venueLayer = L.layerGroup().addTo(map)
    map.on('click', ({ latlng }) => {
      callbacksRef.current.onLocationPick?.({
        lat: latlng.lat,
        lng: latlng.lng,
      })
    })
    mapRef.current = map
    tileLayerRef.current = tileLayer
    venueLayerRef.current = venueLayer

    const observer = new ResizeObserver(() => map.invalidateSize(false))
    observer.observe(container)

    requestAnimationFrame(() => map.invalidateSize(false))

    return () => {
      observer.disconnect()
      venueMarkers.clear()
      selectionHaloRef.current = null
      userMarkerRef.current = null
      pickerMarkerRef.current = null
      tileLayerRef.current = null
      venueLayerRef.current = null
      mapRef.current = null
      map.remove()
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const venueLayer = venueLayerRef.current
    if (!map || !venueLayer) return

    venueLayer.clearLayers()
    venueMarkersRef.current.clear()
    selectionHaloRef.current = null

    venues.forEach((venue) => {
      const selected = venue.id === selectedVenueId
      const color = markerColors[venue.type]
      const marker = L.circleMarker(
        [venue.coordinates.lat, venue.coordinates.lng],
        {
          renderer: L.canvas({ padding: 0.5 }),
          radius: selected ? 11 : 8,
          color: '#070b18',
          weight: selected ? 4 : 3,
          fillColor: color,
          fillOpacity: 1,
          opacity: 1,
          bubblingMouseEvents: false,
          className: `bzr-map-marker bzr-map-marker--${venue.type}`,
        }
      )

      marker.bindTooltip(createTooltip(venue), {
        direction: 'top',
        offset: [0, -12],
        opacity: 1,
        className: 'bzr-map-tooltip-shell',
      })
      marker.on('click', () =>
        callbacksRef.current.onVenueSelect?.(venue)
      )
      marker.on('mouseover', () => {
        marker.setStyle({
          radius: selected ? 12 : 10,
          weight: 4,
          color: '#ffffff',
        })
        callbacksRef.current.onVenueHover?.(venue)
      })
      marker.on('mouseout', () => {
        marker.setStyle({
          radius: selected ? 11 : 8,
          weight: selected ? 4 : 3,
          color: '#070b18',
        })
        callbacksRef.current.onVenueHover?.(null)
      })
      marker.addTo(venueLayer)
      venueMarkersRef.current.set(venue.id, marker)

      if (selected) {
        selectionHaloRef.current = L.circleMarker(
          [venue.coordinates.lat, venue.coordinates.lng],
          {
            renderer: L.canvas({ padding: 0.5 }),
            radius: 20,
            color,
            weight: 2,
            opacity: 0.65,
            fillColor: color,
            fillOpacity: 0.1,
            interactive: false,
            className: 'bzr-map-marker-halo',
          }
        ).addTo(venueLayer)
      }
    })
  }, [selectedVenueId, venues])

  useEffect(() => {
    const map = mapRef.current
    if (!map || venues.length === 0) return
    fitCurrentVenues()
  }, [venues])

  useEffect(() => {
    const map = mapRef.current
    const selected = venues.find(({ id }) => id === selectedVenueId)
    if (!map || !selected) return

    map.flyTo(
      [selected.coordinates.lat, selected.coordinates.lng],
      Math.max(map.getZoom(), 14),
      { duration: 0.55 }
    )
    venueMarkersRef.current.get(selected.id)?.openTooltip()
  }, [selectedVenueId, venues])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    if (!userLocation) {
      if (userMarkerRef.current) {
        map.removeLayer(userMarkerRef.current)
        userMarkerRef.current = null
      }
      return
    }

    if (userMarkerRef.current) {
      userMarkerRef.current.setLatLng(userLocation)
    } else {
      userMarkerRef.current = L.circleMarker(userLocation, {
        radius: 7,
        color: '#ffffff',
        weight: 3,
        fillColor: '#14e6f1',
        fillOpacity: 1,
        className: 'bzr-map-user-marker',
      })
        .bindTooltip('You are here', {
          direction: 'top',
          offset: [0, -10],
          className: 'bzr-map-tooltip-shell',
        })
        .addTo(map)
    }

    map.flyTo(userLocation, Math.max(map.getZoom(), 14), {
      duration: 0.65,
    })
  }, [userLocation])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    if (!pickerLocation) {
      if (pickerMarkerRef.current) {
        map.removeLayer(pickerMarkerRef.current)
        pickerMarkerRef.current = null
      }
      return
    }

    if (pickerMarkerRef.current) {
      pickerMarkerRef.current.setLatLng(pickerLocation)
    } else {
      pickerMarkerRef.current = L.circleMarker(pickerLocation, {
        radius: 10,
        color: '#ffffff',
        weight: 3,
        fillColor: '#ff6b35',
        fillOpacity: 1,
        className: 'bzr-map-picker-marker',
      })
        .bindTooltip('Selected location', {
          direction: 'top',
          offset: [0, -12],
          className: 'bzr-map-tooltip-shell',
        })
        .addTo(map)
    }

    map.flyTo(pickerLocation, Math.max(map.getZoom(), 15), {
      duration: 0.55,
    })
  }, [pickerLocation])

  return (
    <div
      ref={containerRef}
      className={`bzr-neon-map h-full w-full ${className || ''}`}
      role="application"
      aria-label="Interactive map of creative places"
    />
  )
})
