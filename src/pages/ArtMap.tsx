'use client'

import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  arrayRemove,
  arrayUnion,
  GeoPoint,
  increment,
  Timestamp,
} from 'firebase/firestore'
import {
  ArrowRight,
  ArrowLeft,
  BadgeCheck,
  Bookmark,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  Compass,
  Globe2,
  List,
  LocateFixed,
  Map as MapIcon,
  MapPin,
  Navigation,
  Phone,
  Plus,
  RotateCcw,
  Search,
  SlidersHorizontal,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'

import { Header } from '@/components/layout/Header'
import {
  OpenStreetArtMap,
  type MapVenue,
  type OpenStreetArtMapHandle,
} from '@/components/map'
import { Button } from '@/components/ui/Button'
import { Modal, ModalBody, ModalFooter } from '@/components/ui/Modal'
import { useAuth } from '@/contexts/AuthContext'
import { useCollection, useMutation } from '@/hooks/useFirestore'
import type { ArtLocation, ArtLocationType, Session } from '../../lib/schema'
import './art-map-page.css'

type VenueFilter = MapVenue['type'] | 'sessions' | 'all'
type ViewMode = 'map' | 'list'

interface ExtendedVenue extends MapVenue {
  artLocation: ArtLocation
  session?: Session
  demo?: boolean
}

interface SuggestionForm {
  name: string
  type: ArtLocationType
  address: string
  city: string
  latitude: string
  longitude: string
  description: string
}

const venueTypeMeta: Record<
  MapVenue['type'],
  { label: string; dot: string; text: string }
> = {
  gallery: { label: 'Gallery', dot: 'bg-[#ff6b35]', text: 'text-[#ff8a5f]' },
  museum: { label: 'Museum', dot: 'bg-[#f4f1eb]', text: 'text-[#f4f1eb]' },
  studio: { label: 'Studio', dot: 'bg-[#f3a15f]', text: 'text-[#f3a15f]' },
  event: { label: 'Event', dot: 'bg-[#a3a3a3]', text: 'text-[#c4c4c4]' },
  other: { label: 'Other', dot: 'bg-[#595959]', text: 'text-[#8c8c8c]' },
}

const filterTypeMeta: Record<
  Exclude<VenueFilter, 'all'>,
  { label: string; dot: string; text: string }
> = {
  ...venueTypeMeta,
  sessions: { label: 'Session', dot: 'bg-[#ff6b35]', text: 'text-[#ff8a5f]' },
}

const getVenueTypeMeta = (type: MapVenue['type'] | undefined) =>
  venueTypeMeta[type || 'other'] || venueTypeMeta.other

const filters: Array<{ value: VenueFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'gallery', label: 'Gallery' },
  { value: 'museum', label: 'Museum' },
  { value: 'studio', label: 'Studio' },
  { value: 'event', label: 'Events' },
  { value: 'sessions', label: 'Sessions' },
]

const initialSuggestion: SuggestionForm = {
  name: '',
  type: 'gallery',
  address: '',
  city: 'Lusaka',
  latitude: '',
  longitude: '',
  description: '',
}

const fallbackImageByType: Record<MapVenue['type'], string> = {
  gallery: '/map/henry-tayali-gallery.png',
  museum: '/map/national-museum.png',
  studio: '/map/nchima-studios.png',
  event: '/map/the-project-space.png',
  other: '/map/the-project-space.png',
}

const createDemoLocation = ({
  id,
  name,
  type,
  latitude,
  longitude,
  address,
  neighborhood,
  description,
  image,
  saves,
  visits,
}: {
  id: string
  name: string
  type: ArtLocationType
  latitude: number
  longitude: number
  address: string
  neighborhood: string
  description: string
  image: string
  saves: number
  visits: number
}): ExtendedVenue => {
  const venueType = mapLocationTypeToVenueType(type)
  const artLocation = {
    id,
    name,
    type,
    coordinates: new GeoPoint(latitude, longitude),
    address,
    city: 'Lusaka',
    country: 'Zambia',
    neighborhood,
    description,
    images:
      id === 'demo-henry-tayali'
        ? [
            image,
            '/map/henry-tayali-gallery-wall.png',
            '/map/henry-tayali-gallery-corridor.png',
          ]
        : [image],
    thumbnailUrl: image,
    submittedBy: 'club-bzr',
    submittedByName: 'Club BZR',
    verified: true,
    savedBy: [],
    savesCount: saves,
    visitedBy: [],
    visitsCount: visits,
    featured: true,
    tags: ['contemporary art', 'lusaka'],
    isActive: true,
    hours: {
      monday: { open: '10:00', close: '17:00' },
      tuesday: { open: '10:00', close: '17:00' },
      wednesday: { open: '10:00', close: '17:00' },
      thursday: { open: '10:00', close: '17:00' },
      friday: { open: '10:00', close: '17:00' },
      saturday: { open: '10:00', close: '14:00' },
      sunday: { open: '', close: '', closed: true },
    },
  } as unknown as ArtLocation

  return {
    id,
    name,
    type: venueType,
    coordinates: { lat: latitude, lng: longitude },
    address: `${address}, Lusaka, Zambia`,
    description,
    image,
    artLocation,
    demo: true,
  }
}

const demoVenues: ExtendedVenue[] = [
  createDemoLocation({
    id: 'demo-henry-tayali',
    name: 'Henry Tayali Gallery',
    type: 'gallery',
    latitude: -15.3956,
    longitude: 28.2787,
    address: 'Lusaka Showgrounds',
    neighborhood: 'Showgrounds',
    description:
      'A landmark visual arts centre presenting established and emerging Zambian artists through rotating exhibitions.',
    image: '/map/henry-tayali-gallery.png',
    saves: 128,
    visits: 74,
  }),
  createDemoLocation({
    id: 'demo-project-space',
    name: 'The Project Space',
    type: 'pop_up',
    latitude: -15.4163,
    longitude: 28.3321,
    address: 'Ibex Hill',
    neighborhood: 'Ibex Hill',
    description:
      'An independent project space for experimental shows, artist talks, and cross-disciplinary encounters.',
    image: '/map/the-project-space.png',
    saves: 84,
    visits: 39,
  }),
  createDemoLocation({
    id: 'demo-nchima',
    name: 'Nchima Studios',
    type: 'studio',
    latitude: -15.3885,
    longitude: 28.3194,
    address: 'Off Church Road',
    neighborhood: 'Roma',
    description:
      'A working studio and creative workshop supporting artists, printmakers, and collaborative projects.',
    image: '/map/nchima-studios.png',
    saves: 63,
    visits: 31,
  }),
  createDemoLocation({
    id: 'demo-national-museum',
    name: 'Lusaka National Museum',
    type: 'museum',
    latitude: -15.4169,
    longitude: 28.2825,
    address: 'Independence Avenue',
    neighborhood: 'Central Lusaka',
    description:
      'Zambia’s cultural history and contemporary practice meet in a broad programme of exhibitions and public learning.',
    image: '/map/national-museum.png',
    saves: 215,
    visits: 168,
  }),
]

function mapLocationTypeToVenueType(type: ArtLocationType): MapVenue['type'] {
  if (type === 'gallery' || type === 'museum' || type === 'studio') return type
  if (type === 'pop_up' || type === 'installation') return 'event'
  return 'other'
}

const toVenue = (location: ArtLocation): ExtendedVenue => ({
  id: location.id,
  name: location.name,
  type: mapLocationTypeToVenueType(location.type),
  coordinates: {
    lat: location.coordinates.latitude,
    lng: location.coordinates.longitude,
  },
  address: [location.address, location.city, location.country]
    .filter(Boolean)
    .join(', '),
  description: location.description,
  image:
    location.thumbnailUrl ||
    location.images?.[0] ||
    fallbackImageByType[mapLocationTypeToVenueType(location.type)],
  artLocation: location,
})

const toSessionVenue = (session: Session): ExtendedVenue | null => {
  const coordinates = session.location?.coordinates
  if (!coordinates || session.isOnline || session.location.showOnCommunityMap === false) return null
  const address = session.location.address || session.location.name
  const syntheticLocation = {
    id: `session:${session.id}`,
    name: session.title,
    type: 'pop_up',
    coordinates,
    address,
    city: session.location.city || 'Lusaka',
    country: 'Zambia',
    neighborhood: session.location.name,
    description: session.description,
    images: [session.coverImage, ...(session.gallery || []).map((item) => item.thumbnailUrl || item.url)].filter(Boolean),
    thumbnailUrl: session.coverImage,
    submittedBy: session.facilitator?.userId || 'admin',
    submittedByName: session.facilitator?.name || 'Club BZR',
    verified: true,
    savedBy: [],
    savesCount: 0,
    visitedBy: [],
    visitsCount: 0,
    featured: session.featured,
    tags: session.tags || [],
    isActive: true,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  } as ArtLocation

  return {
    id: `session:${session.id}`,
    name: session.title,
    type: 'event',
    coordinates: { lat: coordinates.latitude, lng: coordinates.longitude },
    address,
    description: session.description,
    image: session.coverImage || fallbackImageByType.event,
    artLocation: syntheticLocation,
    session,
  }
}

const getDistance = (venue: MapVenue): string => {
  const lusaka = { lat: -15.4167, lng: 28.2833 }
  const toRadians = (value: number) => (value * Math.PI) / 180
  const latDelta = toRadians(venue.coordinates.lat - lusaka.lat)
  const lngDelta = toRadians(venue.coordinates.lng - lusaka.lng)
  const a =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(toRadians(lusaka.lat)) *
      Math.cos(toRadians(venue.coordinates.lat)) *
      Math.sin(lngDelta / 2) ** 2
  const distance = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return `${distance < 10 ? distance.toFixed(1) : Math.round(distance)} km`
}

const getTodayHours = (venue: ExtendedVenue): string => {
  if (venue.session) {
    const start = venue.session.date instanceof Timestamp
      ? venue.session.date.toDate()
      : new Date(venue.session.date as never)
    return start.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }
  const dayKey = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
  })
    .format(new Date())
    .toLowerCase() as
    | 'monday'
    | 'tuesday'
    | 'wednesday'
    | 'thursday'
    | 'friday'
    | 'saturday'
    | 'sunday'
  const hours = venue.artLocation.hours?.[dayKey]
  if (!hours || hours.closed) return 'Closed today'
  return `Open ${hours.open}–${hours.close}`
}

const getVenueGalleryImages = (venue: ExtendedVenue): string[] => {
  const images = [
    venue.image,
    ...(venue.artLocation.images || []),
  ].filter((image): image is string => Boolean(image))

  return Array.from(new Set(images)).slice(0, 3)
}

const SuggestionField = ({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) => (
  <label className="art-map-suggestion-field">
    <span>
      {label}
    </span>
    {children}
  </label>
)

const getFocusedSessionVenueId = () => {
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(window.location.search)
  const sessionId = params.get('focus') === 'session' ? params.get('sessionId') : null
  return sessionId ? `session:${sessionId}` : null
}

export default function ArtMap() {
  const mapRef = useRef<OpenStreetArtMapHandle>(null)
  const [initialSessionVenueId] = useState(getFocusedSessionVenueId)
  const [mapLoadedAtMs] = useState(() => Date.now())
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(initialSessionVenueId)
  const [hoveredVenue, setHoveredVenue] = useState<MapVenue | null>(null)
  const [filter, setFilter] = useState<VenueFilter>(initialSessionVenueId ? 'sessions' : 'all')
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('map')
  const [listInspectorOpen, setListInspectorOpen] = useState(false)
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false)
  const [savingLocation, setSavingLocation] = useState(false)
  const [markingVisited, setMarkingVisited] = useState(false)
  const [demoSavedIds, setDemoSavedIds] = useState<string[]>([])
  const [demoVisitedIds, setDemoVisitedIds] = useState<string[]>([])
  const [userLocation, setUserLocation] = useState<{
    lat: number
    lng: number
  } | null>(null)
  const [tileStatus, setTileStatus] = useState<
    'loading' | 'ready' | 'error'
  >('loading')
  const [locationStatus, setLocationStatus] = useState<string | null>(null)
  const [suggestion, setSuggestion] =
    useState<SuggestionForm>(initialSuggestion)
  const [suggestionError, setSuggestionError] = useState<string | null>(null)
  const [suggestionComplete, setSuggestionComplete] = useState(false)

  const { user, firebaseUser } = useAuth()
  const {
    data: artLocations,
    loading,
    error,
    refetch,
  } = useCollection('artLocations', {
    where: [{ field: 'isActive', operator: '==', value: true }],
  })
  const { data: sessions } = useCollection('sessions', {
    where: [{ field: 'status', operator: '==', value: 'published' }],
  })
  const {
    update: updateLocation,
    create: createLocation,
    loading: mutationLoading,
  } = useMutation('artLocations')

  const venues = useMemo<ExtendedVenue[]>(() => {
    const places = artLocations.length > 0 ? artLocations.map(toVenue) : demoVenues
    const sessionLocations = sessions
      .filter((session) => {
        const date = session.date instanceof Timestamp ? session.date.toMillis() : new Date(session.date as never).getTime()
        return Number.isFinite(date) && date >= mapLoadedAtMs
      })
      .map(toSessionVenue)
      .filter((venue): venue is ExtendedVenue => Boolean(venue))
    return [...places, ...sessionLocations]
  }, [artLocations, mapLoadedAtMs, sessions])

  const filteredVenues = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return venues.filter((venue) => {
      const matchesFilter = filter === 'all' || (filter === 'sessions' ? Boolean(venue.session) : venue.type === filter)
      const matchesSearch =
        !query ||
        [
          venue.name,
          venue.address,
          venue.artLocation.neighborhood,
          venueTypeMeta[venue.type].label,
          ...(venue.artLocation.tags || []),
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query))
      return matchesFilter && matchesSearch
    })
  }, [filter, searchQuery, venues])

  const selectedVenue = useMemo(
    () =>
      filteredVenues.find(({ id }) => id === selectedVenueId) ||
      filteredVenues[0] ||
      null,
    [filteredVenues, selectedVenueId]
  )

  const userHasSaved = Boolean(
    selectedVenue &&
      (selectedVenue.demo
        ? demoSavedIds.includes(selectedVenue.id)
        : user &&
          selectedVenue.artLocation.savedBy?.includes(user.uid))
  )

  const userHasVisited = Boolean(
    selectedVenue &&
      (selectedVenue.demo
        ? demoVisitedIds.includes(selectedVenue.id)
        : user &&
          selectedVenue.artLocation.visitedBy?.includes(user.uid))
  )

  const selectVenue = useCallback(
    (venue: MapVenue, openMobileDetail = false) => {
      const extendedVenue = venues.find(({ id }) => id === venue.id) || null
      setSelectedVenueId(extendedVenue?.id || null)
      setMobileDetailOpen(openMobileDetail)
    },
    [venues]
  )

  const handleSaveLocation = useCallback(async () => {
    if (!selectedVenue) return
    if (selectedVenue.session) {
      window.location.href = `/sessions/${selectedVenue.session.id}`
      return
    }

    if (selectedVenue.demo) {
      setDemoSavedIds((current) =>
        current.includes(selectedVenue.id)
          ? current.filter((id) => id !== selectedVenue.id)
          : [...current, selectedVenue.id]
      )
      return
    }

    if (!user) {
      window.location.href = '/auth/login'
      return
    }

    setSavingLocation(true)
    try {
      await updateLocation(selectedVenue.id, {
        savedBy: userHasSaved ? arrayRemove(user.uid) : arrayUnion(user.uid),
        savesCount: increment(userHasSaved ? -1 : 1),
      } as never)
      await refetch()
    } finally {
      setSavingLocation(false)
    }
  }, [refetch, selectedVenue, updateLocation, user, userHasSaved])

  const handleMarkVisited = useCallback(async () => {
    if (!selectedVenue) return
    if (selectedVenue.session) return

    if (selectedVenue.demo) {
      setDemoVisitedIds((current) =>
        current.includes(selectedVenue.id)
          ? current.filter((id) => id !== selectedVenue.id)
          : [...current, selectedVenue.id]
      )
      return
    }

    if (!user) {
      window.location.href = '/auth/login'
      return
    }

    setMarkingVisited(true)
    try {
      await updateLocation(selectedVenue.id, {
        visitedBy: userHasVisited ? arrayRemove(user.uid) : arrayUnion(user.uid),
        visitsCount: increment(userHasVisited ? -1 : 1),
      } as never)
      await refetch()
    } finally {
      setMarkingVisited(false)
    }
  }, [refetch, selectedVenue, updateLocation, user, userHasVisited])

  const locateUser = () => {
    if (!navigator.geolocation) {
      setLocationStatus('Location is not available in this browser.')
      return
    }

    setLocationStatus('Finding your nearest creative place…')
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setUserLocation({
          lat: coords.latitude,
          lng: coords.longitude,
        })
        const nearest = [...venues].sort((a, b) => {
          const aDistance =
            (a.coordinates.lat - coords.latitude) ** 2 +
            (a.coordinates.lng - coords.longitude) ** 2
          const bDistance =
            (b.coordinates.lat - coords.latitude) ** 2 +
            (b.coordinates.lng - coords.longitude) ** 2
          return aDistance - bDistance
        })[0]
        if (nearest) {
          setSelectedVenueId(nearest.id)
          setLocationStatus(`${nearest.name} is the closest place on the map.`)
        } else {
          setLocationStatus('Your position is now shown on the map.')
        }
      },
      () => setLocationStatus('Allow location access to find nearby places.'),
      { enableHighAccuracy: false, timeout: 8000 }
    )
  }

  const getDirections = () => {
    if (!selectedVenue) return
    const { lat, lng } = selectedVenue.coordinates
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
      '_blank',
      'noopener,noreferrer'
    )
  }

  const changeViewMode = useCallback(
    (nextMode: ViewMode) => {
      setViewMode(nextMode)
      setListInspectorOpen(nextMode === 'list' && Boolean(selectedVenue))
      setMobileDetailOpen(false)
    },
    [selectedVenue]
  )

  const viewVenueOnMap = useCallback(
    (venue: ExtendedVenue) => {
      selectVenue(venue)
      setViewMode('map')
      setListInspectorOpen(false)
      setMobileDetailOpen(false)
    },
    [selectVenue]
  )

  const submitSuggestion = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSuggestionError(null)

    if (!firebaseUser) {
      window.location.href = '/auth/login'
      return
    }

    const latitude = Number(suggestion.latitude)
    const longitude = Number(suggestion.longitude)
    if (
      !suggestion.name.trim() ||
      !suggestion.address.trim() ||
      !suggestion.description.trim() ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ) {
      setSuggestionError('Add the place details and valid coordinates.')
      return
    }

    const result = await createLocation({
      name: suggestion.name.trim(),
      type: suggestion.type,
      coordinates: new GeoPoint(latitude, longitude),
      address: suggestion.address.trim(),
      city: suggestion.city.trim() || 'Lusaka',
      country: 'Zambia',
      description: suggestion.description.trim(),
      images: [],
      submittedBy: firebaseUser.uid,
      submittedByName:
        user?.displayName || firebaseUser.displayName || 'Club BZR member',
      verified: false,
      savedBy: [],
      savesCount: 0,
      visitedBy: [],
      visitsCount: 0,
      featured: false,
      tags: [],
      isActive: true,
    })

    if (!result.success) {
      setSuggestionError(
        result.error?.message || 'We could not send this place yet.'
      )
      return
    }

    setSuggestionComplete(true)
    setSuggestion(initialSuggestion)
    await refetch()
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <Header />

      <main className="art-map-main fixed inset-x-0 bottom-[76px] top-[64px] overflow-hidden bg-[#0a0a0a] md:bottom-0 md:top-[80px]">
        <div
          className={`art-map-frame ${
            viewMode === 'list' ? 'art-map-frame--list' : ''
          }`}
        >
          <motion.aside
            layout
            transition={{
              layout: {
                duration: 0.42,
                ease: [0.22, 1, 0.36, 1],
              },
            }}
            className="art-map-sidebar relative z-20 min-h-0 flex-col overflow-hidden bg-[#101010]"
          >
            <AnimatePresence initial={false} mode="wait">
              {viewMode === 'list' && listInspectorOpen && selectedVenue ? (
                <VenueInspector
                  key={`inspector-${selectedVenue.id}`}
                  venue={selectedVenue}
                  saved={userHasSaved}
                  visited={userHasVisited}
                  saving={savingLocation}
                  markingVisited={markingVisited}
                  onBack={() => setListInspectorOpen(false)}
                  onViewMap={() => viewVenueOnMap(selectedVenue)}
                  onSave={handleSaveLocation}
                  onVisited={handleMarkVisited}
                  onDirections={getDirections}
                />
              ) : (
                <motion.div
                  key="discovery-sidebar"
                  initial={{ opacity: 0, x: viewMode === 'list' ? 24 : -24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: viewMode === 'list' ? 18 : -18 }}
                  transition={{ duration: 0.22, ease: 'easeOut' }}
                  className="art-map-discovery-panel"
                >
            <div className="art-map-sidebar__intro">
              <div className="art-map-sidebar__eyebrow font-mono font-medium uppercase text-bzr-orange">
                Community map
              </div>
              <h1 className="sr-only">Community map</h1>
              <p className="art-map-sidebar__copy text-white/46">
                Discover galleries, studios, museums, and creative gatherings
                across Lusaka.
              </p>
            </div>

            <div className="art-map-sidebar__discovery">
              <label className="group relative block">
                <span className="sr-only">Search creative places</span>
                <Search
                  size={18}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/45 transition-colors group-focus-within:text-bzr-orange"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search places, studios, galleries…"
                  className="art-map-search w-full border border-white/[0.1] bg-white/[0.045] pl-11 pr-12 text-[14px] text-white outline-none transition placeholder:text-white/34 hover:border-white/20 focus:border-bzr-orange/70 focus:bg-bzr-orange/[0.045]"
                />
                <SlidersHorizontal
                  size={16}
                  className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-white/35"
                  aria-hidden="true"
                />
              </label>

              <div
                className="art-map-filters"
                aria-label="Venue type"
              >
                {filters.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setFilter(item.value)}
                    aria-pressed={filter === item.value}
                    className={`inline-flex h-9 flex-none items-center gap-2 rounded-full border px-3.5 text-[12px] font-medium transition ${
                      filter === item.value
                        ? 'border-bzr-orange bg-bzr-orange text-white shadow-[0_8px_24px_rgba(255,107,53,0.18)]'
                        : 'border-white/[0.12] bg-transparent text-white/65 hover:border-white/25 hover:text-white'
                    }`}
                  >
                    {item.value !== 'all' && (
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${filterTypeMeta[item.value].dot}`}
                      />
                    )}
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="art-map-sidebar__meta flex items-center justify-between border-b border-t border-white/[0.08]">
              <div className="flex items-center gap-2 text-[12px] text-white/58">
                <Compass size={14} aria-hidden="true" />
                <span>
                  {filteredVenues.length}{' '}
                  {filteredVenues.length === 1 ? 'place' : 'places'} around Lusaka
                </span>
              </div>
              <button className="flex items-center gap-1 text-xs text-white/45 transition hover:text-white">
                Nearest
                <ChevronDown size={13} aria-hidden="true" />
              </button>
            </div>

            <div className="art-map-venue-list min-h-0 flex-1 overflow-y-auto">
              {loading && venues.length === 0 ? (
                <LocationListSkeleton />
              ) : filteredVenues.length > 0 ? (
                filteredVenues.map((venue) => (
                  <LocationRow
                    key={venue.id}
                    venue={venue}
                    selected={selectedVenue?.id === venue.id}
                    hovered={hoveredVenue?.id === venue.id}
                    onSelect={() => selectVenue(venue)}
                  />
                ))
              ) : (
                <EmptyLocations
                  query={searchQuery}
                  onClear={() => {
                    setSearchQuery('')
                    setFilter('all')
                  }}
                />
              )}
            </div>

            <div className="art-map-sidebar__footer border-t border-white/[0.08]">
              <button
                type="button"
                onClick={() => {
                  setSuggestionComplete(false)
                  setShowSubmitModal(true)
                }}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-bzr-orange text-sm font-semibold text-white transition hover:bg-[#ec5b28] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bzr-orange focus-visible:ring-offset-2 focus-visible:ring-offset-[#101010]"
              >
                <MapPin size={18} aria-hidden="true" />
                Suggest a place
              </button>
            </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.aside>

          <motion.section
            layout
            transition={{
              layout: {
                duration: 0.42,
                ease: [0.22, 1, 0.36, 1],
              },
            }}
            className="art-map-map-pane relative h-full min-h-0 overflow-hidden bg-[#090909]"
          >
            <div className="absolute inset-0">
              <OpenStreetArtMap
                ref={mapRef}
                venues={filteredVenues}
                selectedVenueId={selectedVenue?.id}
                userLocation={userLocation}
                onVenueSelect={(venue) => selectVenue(venue)}
                onVenueHover={setHoveredVenue}
                onTileStatusChange={setTileStatus}
              />
            </div>

            <div className="absolute left-5 right-5 top-4 z-20 lg:hidden">
              <div className="flex items-center gap-2">
                <label className="group relative min-w-0 flex-1">
                  <span className="sr-only">Search creative places</span>
                  <Search
                    size={17}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/55"
                    aria-hidden="true"
                  />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search creative places"
                    className="h-11 w-full rounded-full border border-white/[0.14] bg-black/75 pl-10 pr-4 text-sm text-white outline-none backdrop-blur-xl placeholder:text-white/40 focus:border-bzr-orange"
                  />
                </label>
                <button
                  type="button"
                  onClick={() =>
                    changeViewMode(viewMode === 'map' ? 'list' : 'map')
                  }
                  className="grid h-11 w-11 flex-none place-items-center rounded-full border border-white/[0.14] bg-black/75 text-white backdrop-blur-xl"
                  aria-label={
                    viewMode === 'map'
                      ? 'Show location list'
                      : 'Show map'
                  }
                >
                  {viewMode === 'map' ? <List size={18} /> : <MapIcon size={18} />}
                </button>
              </div>

              <div className="mt-2 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {filters.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setFilter(item.value)}
                    className={`h-8 flex-none rounded-full border px-3 text-[11px] font-semibold backdrop-blur-xl ${
                      filter === item.value
                        ? 'border-bzr-orange bg-bzr-orange text-white'
                        : 'border-white/[0.14] bg-black/70 text-white/65'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="absolute left-6 top-6 z-20 hidden items-center gap-3 lg:flex">
              <div className="rounded-xl border border-white/[0.1] bg-black/68 px-4 py-3 font-mono text-[11px] text-white/45 shadow-[0_12px_36px_rgba(0,0,0,0.28)] backdrop-blur-xl">
                <span className="text-white/75">World</span>
                <span className="px-2.5">/</span>
                <span className="text-white/75">Zambia</span>
                <span className="px-2.5">/</span>
                <span className="text-bzr-orange">Lusaka</span>
              </div>
              <ViewToggle value={viewMode} onChange={changeViewMode} />
            </div>

            <div className="absolute right-4 top-[126px] z-20 flex flex-col gap-2 lg:right-6 lg:top-6">
              <MapControl
                label="Find nearby places"
                onClick={locateUser}
                icon={<LocateFixed size={17} />}
              />
              <MapControl
                label="Reset map"
                onClick={() => mapRef.current?.reset()}
                icon={<RotateCcw size={17} />}
              />
              <div className="overflow-hidden rounded-xl border border-white/[0.12] bg-black/65 backdrop-blur-xl">
                <button
                  type="button"
                  onClick={() => mapRef.current?.zoomIn()}
                  className="grid h-10 w-10 place-items-center text-white/70 transition hover:bg-white/10 hover:text-white"
                  aria-label="Zoom in"
                >
                  <ZoomIn size={17} />
                </button>
                <div className="h-px bg-white/10" />
                <button
                  type="button"
                  onClick={() => mapRef.current?.zoomOut()}
                  className="grid h-10 w-10 place-items-center text-white/70 transition hover:bg-white/10 hover:text-white"
                  aria-label="Zoom out"
                >
                  <ZoomOut size={17} />
                </button>
              </div>
            </div>

            {tileStatus !== 'ready' && (
              <div
                className={`absolute left-1/2 top-24 z-30 -translate-x-1/2 rounded-full border px-4 py-2 text-[10px] font-medium backdrop-blur-xl md:top-6 ${
                  tileStatus === 'error'
                    ? 'border-red-400/30 bg-red-950/80 text-red-200'
                    : 'border-bzr-orange/20 bg-black/80 text-white/65'
                }`}
                role={tileStatus === 'error' ? 'alert' : 'status'}
              >
                {tileStatus === 'error'
                  ? 'Map tiles are unavailable. Venue controls still work.'
                  : 'Loading OpenStreetMap…'}
              </div>
            )}

            <AnimatePresence>
              {locationStatus && (
                <motion.button
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  onClick={() => setLocationStatus(null)}
                  className="absolute right-16 top-24 z-30 max-w-[280px] rounded-xl border border-white/[0.12] bg-black/80 px-4 py-3 text-left text-xs text-white/75 backdrop-blur-xl md:right-20 md:top-6"
                >
                  {locationStatus}
                </motion.button>
              )}
            </AnimatePresence>

            <AnimatePresence mode="wait">
              {viewMode === 'list' && (
                <motion.div
                  key="list-view"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="art-map-list-view absolute inset-0 z-30 overflow-y-auto bg-[#0a0a0a]/95 backdrop-blur-xl"
                >
                  <div className="art-map-list-shell">
                    <div className="art-map-list-header">
                      <div className="art-map-list-heading">
                        <p className="font-mono uppercase text-bzr-orange">
                          Browse all
                        </p>
                        <h2 className="font-display font-semibold text-white">
                          Creative places around Lusaka
                        </h2>
                        <p className="art-map-list-summary">
                          {filteredVenues.length} curated places to discover
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => changeViewMode('map')}
                        className="art-map-list-back"
                      >
                        <ArrowLeft size={17} />
                        <span>Back to map</span>
                      </button>
                    </div>
                    <div className="art-map-list-tools">
                      <label className="art-map-list-search">
                        <span className="sr-only">
                          Search creative places
                        </span>
                        <Search size={17} aria-hidden="true" />
                        <input
                          type="search"
                          value={searchQuery}
                          onChange={(event) =>
                            setSearchQuery(event.target.value)
                          }
                          placeholder="Search places, studios, galleries…"
                        />
                        <SlidersHorizontal size={16} aria-hidden="true" />
                      </label>
                      <div
                        className="art-map-list-filters"
                        aria-label="Filter creative places"
                      >
                        {filters.map((item) => (
                          <button
                            key={item.value}
                            type="button"
                            onClick={() => setFilter(item.value)}
                            aria-pressed={filter === item.value}
                            data-active={filter === item.value}
                          >
                            {item.value !== 'all' && (
                              <span
                                className={filterTypeMeta[item.value].dot}
                              />
                            )}
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="art-map-list-grid">
                      {filteredVenues.map((venue) => (
                        <VenueGridCard
                          key={venue.id}
                          venue={venue}
                          selected={selectedVenue?.id === venue.id}
                          onSelect={() => {
                            selectVenue(venue)
                            setListInspectorOpen(true)
                            setMobileDetailOpen(true)
                          }}
                          onViewMap={() => viewVenueOnMap(venue)}
                        />
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="absolute bottom-0 left-0 right-0 z-20 hidden lg:block">
              {selectedVenue ? (
                <DesktopVenueSheet
                  venue={selectedVenue}
                  saved={userHasSaved}
                  visited={userHasVisited}
                  saving={savingLocation}
                  markingVisited={markingVisited}
                  onSave={handleSaveLocation}
                  onVisited={handleMarkVisited}
                  onDirections={getDirections}
                />
              ) : (
                <div className="m-6 max-w-[520px] rounded-2xl border border-white/[0.1] bg-black/75 p-6 text-sm text-white/55 backdrop-blur-2xl">
                  Choose a place to see its story and plan your visit.
                </div>
              )}
            </div>

            {viewMode === 'map' && (
              <div className="absolute bottom-3 left-0 right-0 z-20 lg:hidden">
                <div className="art-map-mobile-carousel__header mb-1 flex items-end justify-between gap-4 px-5">
                  <div>
                    <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-bzr-orange">
                      Nearby Lusaka
                    </p>
                    <p className="mt-1 text-[15px] font-medium tracking-[-0.01em] text-white/80">
                      {filteredVenues.length} places to explore
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSuggestionComplete(false)
                      setShowSubmitModal(true)
                    }}
                    className="inline-flex h-9 flex-none items-center gap-1.5 rounded-xl border border-bzr-orange/35 bg-[#21140f]/90 px-3.5 text-[11px] font-semibold text-bzr-orange shadow-lg backdrop-blur-xl transition hover:border-bzr-orange/65 hover:bg-[#2c1a13]"
                  >
                    <Plus size={13} />
                    Suggest
                  </button>
                </div>
                <div className="art-map-mobile-carousel__track flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-3 pt-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {filteredVenues.map((venue) => (
                    <MobileVenueCard
                      key={venue.id}
                      venue={venue}
                      selected={selectedVenue?.id === venue.id}
                      onSelect={() => selectVenue(venue)}
                      onOpen={() => selectVenue(venue, true)}
                    />
                  ))}
                </div>
              </div>
            )}

            <AnimatePresence>
              {mobileDetailOpen && selectedVenue && (
                <MobileVenueSheet
                  venue={selectedVenue}
                  saved={userHasSaved}
                  visited={userHasVisited}
                  saving={savingLocation}
                  markingVisited={markingVisited}
                  onClose={() => setMobileDetailOpen(false)}
                  onViewMap={() => viewVenueOnMap(selectedVenue)}
                  onSave={handleSaveLocation}
                  onVisited={handleMarkVisited}
                  onDirections={getDirections}
                />
              )}
            </AnimatePresence>

            {error && artLocations.length === 0 && (
              <div className="absolute bottom-4 right-4 z-30 hidden rounded-full border border-white/10 bg-black/70 px-3 py-1.5 text-[10px] text-white/45 backdrop-blur-lg lg:block">
                Showing Club BZR recommendations while live places reconnect
              </div>
            )}
          </motion.section>
        </div>
      </main>

      <Modal
        isOpen={showSubmitModal}
        onClose={() => setShowSubmitModal(false)}
        title={suggestionComplete ? 'Place suggested' : 'Suggest a creative place'}
        description={
          suggestionComplete
            ? 'Thanks for helping the community map grow.'
            : 'Share a gallery, studio, museum, event space, or creative landmark.'
        }
        size="lg"
        mobileSheet
        className="art-map-suggestion-modal"
      >
        {suggestionComplete ? (
          <>
            <ModalBody>
              <div className="flex flex-col items-center py-8 text-center">
                <div className="mb-4 grid h-14 w-14 place-items-center rounded-full bg-bzr-orange/15 text-bzr-orange">
                  <Check size={26} aria-hidden="true" />
                </div>
                <h3 className="font-display text-xl font-semibold text-white">
                  It’s on the curators’ radar.
                </h3>
                <p className="mt-2 max-w-sm text-sm leading-6 text-white/55">
                  The Club BZR team will review the details before the place
                  appears publicly.
                </p>
              </div>
            </ModalBody>
            <ModalFooter>
              <Button
                variant="primary"
                className="bg-bzr-orange shadow-none hover:bg-[#e95b2a]"
                onClick={() => setShowSubmitModal(false)}
              >
                Back to the map
              </Button>
            </ModalFooter>
          </>
        ) : (
          <form
            onSubmit={submitSuggestion}
            className="art-map-suggestion-form"
          >
            <ModalBody className="art-map-suggestion-modal__body">
              <div className="art-map-suggestion-fields">
                <SuggestionField label="Place name">
                  <input
                    name="placeName"
                    autoComplete="organization"
                    placeholder="e.g. Nchima Studios"
                    required
                  value={suggestion.name}
                  onChange={(event) =>
                    setSuggestion((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  />
                </SuggestionField>
                <div className="art-map-suggestion-grid">
                  <SuggestionField label="Type">
                    <select
                      name="placeType"
                      value={suggestion.type}
                      onChange={(event) =>
                        setSuggestion((current) => ({
                          ...current,
                          type: event.target.value as ArtLocationType,
                        }))
                      }
                      className="h-12 w-full rounded-lg border-2 border-bzr-gray-700 bg-bzr-gray-900/50 px-4 text-sm text-white outline-none focus:border-bzr-orange"
                    >
                      <option value="gallery">Gallery</option>
                      <option value="museum">Museum</option>
                      <option value="studio">Studio</option>
                      <option value="pop_up">Event space</option>
                      <option value="community_space">Community space</option>
                      <option value="public_art">Public art</option>
                      <option value="other">Other</option>
                    </select>
                  </SuggestionField>
                  <SuggestionField label="City">
                    <input
                      name="city"
                      autoComplete="address-level2"
                      placeholder="Lusaka"
                      required
                    value={suggestion.city}
                    onChange={(event) =>
                      setSuggestion((current) => ({
                        ...current,
                        city: event.target.value,
                      }))
                    }
                    />
                  </SuggestionField>
                </div>
                <SuggestionField label="Street address or landmark">
                  <input
                    name="address"
                    autoComplete="street-address"
                    placeholder="Road, neighbourhood, or landmark"
                    required
                  value={suggestion.address}
                  onChange={(event) =>
                    setSuggestion((current) => ({
                      ...current,
                      address: event.target.value,
                    }))
                  }
                  />
                </SuggestionField>
                <div className="art-map-suggestion-grid art-map-suggestion-grid--coordinates">
                  <SuggestionField label="Latitude">
                    <input
                      name="latitude"
                    type="number"
                    step="any"
                      inputMode="decimal"
                      placeholder="-15.4167"
                      required
                    value={suggestion.latitude}
                    onChange={(event) =>
                      setSuggestion((current) => ({
                        ...current,
                        latitude: event.target.value,
                      }))
                    }
                    />
                  </SuggestionField>
                  <SuggestionField label="Longitude">
                    <input
                      name="longitude"
                    type="number"
                    step="any"
                      inputMode="decimal"
                      placeholder="28.2833"
                      required
                    value={suggestion.longitude}
                    onChange={(event) =>
                      setSuggestion((current) => ({
                        ...current,
                        longitude: event.target.value,
                      }))
                    }
                    />
                  </SuggestionField>
                </div>
                <SuggestionField label="Why should people visit?">
                  <textarea
                    name="description"
                    placeholder="What makes this place worth discovering?"
                    rows={3}
                    required
                  value={suggestion.description}
                  onChange={(event) =>
                    setSuggestion((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  />
                </SuggestionField>
                {suggestionError && (
                  <p role="alert" className="text-sm text-red-400">
                    {suggestionError}
                  </p>
                )}
              </div>
            </ModalBody>
            <ModalFooter className="art-map-suggestion-modal__footer">
              <button
                type="button"
                onClick={() => setShowSubmitModal(false)}
                className="art-map-suggestion-cancel"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={mutationLoading}
                className="art-map-suggestion-submit"
              >
                {mutationLoading
                  ? 'Sending…'
                  : firebaseUser
                    ? 'Send for review'
                    : 'Sign in to suggest'}
              </button>
            </ModalFooter>
          </form>
        )}
      </Modal>
    </div>
  )
}

function ViewToggle({
  value,
  onChange,
}: {
  value: ViewMode
  onChange: (value: ViewMode) => void
}) {
  return (
    <div className="inline-flex rounded-xl border border-white/[0.1] bg-black/68 p-1 shadow-[0_12px_36px_rgba(0,0,0,0.28)] backdrop-blur-xl">
      {[
        { value: 'map' as const, label: 'Map', icon: MapIcon },
        { value: 'list' as const, label: 'List', icon: List },
      ].map((item) => {
        const Icon = item.icon
        return (
          <button
            key={item.value}
            type="button"
            onClick={() => onChange(item.value)}
            className={`inline-flex h-9 items-center gap-2 rounded-lg px-3.5 text-xs font-medium transition ${
              value === item.value
                ? 'bg-bzr-orange text-white'
                : 'text-white/55 hover:text-white'
            }`}
          >
            <Icon size={14} />
            {item.label}
          </button>
        )
      })}
    </div>
  )
}

function MapControl({
  label,
  icon,
  onClick,
}: {
  label: string
  icon: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="grid h-11 w-11 place-items-center rounded-xl border border-white/[0.1] bg-black/68 text-white/70 shadow-[0_12px_36px_rgba(0,0,0,0.28)] backdrop-blur-xl transition hover:border-bzr-orange/50 hover:text-bzr-orange"
      aria-label={label}
      title={label}
    >
      {icon}
    </button>
  )
}

function LocationRow({
  venue,
  selected,
  hovered,
  onSelect,
}: {
  venue: ExtendedVenue
  selected: boolean
  hovered: boolean
  onSelect: () => void
}) {
  const meta = getVenueTypeMeta(venue.type)
  return (
    <button
      type="button"
      onClick={onSelect}
      data-selected={selected}
      className={`art-map-venue-row group relative flex w-full gap-4 text-left transition ${
        selected
          ? 'bg-white/[0.045]'
          : hovered
            ? 'bg-white/[0.025]'
            : 'hover:bg-white/[0.025]'
      }`}
    >
      <span
        className={`art-map-venue-row__accent absolute inset-y-0 left-0 w-0.5 bg-bzr-orange transition-opacity ${
          selected ? 'opacity-100' : 'opacity-0'
        }`}
      />
      <img
        src={venue.image || fallbackImageByType[venue.type]}
        alt=""
        className="h-[78px] w-[96px] flex-none rounded-xl object-cover"
      />
      <span className="min-w-0 flex-1 py-0.5">
        <span className="flex items-start gap-1.5">
          <span className="line-clamp-2 font-display text-[16px] font-semibold leading-5 text-white">
            {venue.name}
          </span>
          {venue.artLocation.verified && !venue.session && (
            <BadgeCheck
              size={15}
              className="mt-0.5 flex-none fill-bzr-orange text-[#0b0b0b]"
              aria-label="Verified"
            />
          )}
        </span>
        <span className="mt-1.5 flex items-center gap-1.5 truncate text-xs text-white/50">
          <MapPin size={12} aria-hidden="true" />
          {venue.artLocation.neighborhood || venue.artLocation.city}
        </span>
        <span className="mt-3 flex items-center gap-2 text-[11px] text-white/42">
          <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
          <span>{venue.session ? 'Session' : meta.label}</span>
          {!venue.session && <><span className="text-white/15">|</span><Bookmark size={12} aria-hidden="true" /><span>{venue.artLocation.savesCount || 0}</span></>}
          <span className="ml-auto">{getDistance(venue)}</span>
        </span>
      </span>
    </button>
  )
}

function VenueInspector({
  venue,
  saved,
  visited,
  saving,
  markingVisited,
  onBack,
  onViewMap,
  onSave,
  onVisited,
  onDirections,
}: {
  venue: ExtendedVenue
  saved: boolean
  visited: boolean
  saving: boolean
  markingVisited: boolean
  onBack: () => void
  onViewMap: () => void
  onSave: () => void
  onVisited: () => void
  onDirections: () => void
}) {
  const meta = getVenueTypeMeta(venue.type)
  const images = getVenueGalleryImages(venue)
  const phone = venue.artLocation.phone?.trim()
  const website = venue.artLocation.website?.trim()
  const hours = getTodayHours(venue)
  const isOpen = hours.startsWith('Open')

  const openWebsite = () => {
    if (!website) return
    const url = /^https?:\/\//i.test(website) ? website : `https://${website}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 28 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className="art-map-inspector"
    >
      <div className="art-map-inspector__media">
        <button
          type="button"
          onClick={onBack}
          className="art-map-inspector__back"
        >
          <ArrowLeft size={16} />
          Back to places
        </button>
        <img
          src={images[0] || fallbackImageByType[venue.type]}
          alt={`${venue.name} interior`}
          className="art-map-inspector__hero"
        />
        {images.length > 1 && (
          <div className="art-map-inspector__collage">
            {images.slice(1, 3).map((image, index) => (
              <img
                key={image}
                src={image}
                alt={`${venue.name} gallery view ${index + 2}`}
              />
            ))}
          </div>
        )}
      </div>

      <div className="art-map-inspector__content">
        <div className="art-map-inspector__heading">
          <h2>{venue.name}</h2>
          {venue.artLocation.verified && !venue.session && (
            <BadgeCheck
              size={18}
              className="fill-bzr-orange text-[#101010]"
              aria-label="Verified"
            />
          )}
        </div>

        <div className="art-map-inspector__meta">
          <span>
            <MapPin size={13} />
            {venue.artLocation.neighborhood || venue.artLocation.city}
          </span>
          <i aria-hidden="true" />
          <span>
            <b className={meta.dot} />
            {venue.session ? 'Session' : meta.label}
          </span>
        </div>

        <div
          className={`art-map-inspector__hours ${
            isOpen ? 'is-open' : 'is-closed'
          }`}
        >
          <span />
          {hours}
        </div>

        <p className="art-map-inspector__description">
          {venue.description}
        </p>

        <button
          type="button"
          onClick={onViewMap}
          className="art-map-inspector__primary"
        >
          <span>View on map</span>
          <ArrowRight size={18} />
        </button>
      </div>

      <div className="art-map-inspector__actions">
        <InspectorAction
          label="Directions"
          icon={<Navigation size={19} />}
          onClick={onDirections}
        />
        <InspectorAction
          label="Call"
          icon={<Phone size={19} />}
          onClick={() => {
            if (phone) window.location.href = `tel:${phone}`
          }}
          disabled={!phone}
        />
        <InspectorAction
          label="Website"
          icon={<Globe2 size={19} />}
          onClick={openWebsite}
          disabled={!website}
        />
        <InspectorAction
          label={saving ? 'Saving…' : saved ? 'Saved' : 'Save'}
          icon={<Bookmark size={19} fill={saved ? 'currentColor' : 'none'} />}
          onClick={onSave}
          active={saved}
          disabled={saving}
        />
        <InspectorAction
          label={
            markingVisited ? 'Updating…' : visited ? 'Visited' : 'Mark visited'
          }
          icon={<CheckCircle2 size={19} />}
          onClick={onVisited}
          active={visited}
          disabled={markingVisited}
        />
      </div>
    </motion.div>
  )
}

function InspectorAction({
  label,
  icon,
  onClick,
  active = false,
  disabled = false,
}: {
  label: string
  icon: React.ReactNode
  onClick: () => void
  active?: boolean
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-active={active}
      className="art-map-inspector-action"
      title={disabled ? `${label} is not available for this place yet` : label}
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}

function DesktopVenueSheet({
  venue,
  saved,
  visited,
  saving,
  markingVisited,
  onSave,
  onVisited,
  onDirections,
}: {
  venue: ExtendedVenue
  saved: boolean
  visited: boolean
  saving: boolean
  markingVisited: boolean
  onSave: () => void
  onVisited: () => void
  onDirections: () => void
}) {
  const meta = getVenueTypeMeta(venue.type)
  return (
    <motion.div
      key={venue.id}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      className="art-map-detail-card m-6 grid grid-cols-1 rounded-[22px] border border-white/[0.11] bg-[#111111]/95 shadow-[0_24px_80px_rgba(0,0,0,0.5)] backdrop-blur-2xl"
    >
      <img
        src={venue.image || fallbackImageByType[venue.type]}
        alt={`${venue.name} interior`}
        className="art-map-detail-card__image hidden rounded-2xl object-cover"
      />
      <div className="flex min-w-0 flex-col py-1 pr-1">
        <div className="flex items-start gap-2">
          <h2 className="art-map-detail-card__title font-display text-[24px] font-semibold leading-tight tracking-[-0.03em] text-white">
            {venue.name}
          </h2>
          {venue.artLocation.verified && !venue.session && (
            <BadgeCheck
              size={21}
              className="mt-1 flex-none fill-bzr-orange text-[#101010]"
              aria-label="Verified"
            />
          )}
        </div>
        <div className="art-map-detail-card__meta mt-2 flex flex-wrap items-center gap-3 text-xs text-white/55">
          <span className="inline-flex items-center gap-1.5">
            <MapPin size={13} />
            {venue.artLocation.neighborhood || venue.artLocation.city}
          </span>
          <span className="text-white/20">|</span>
          <span className="inline-flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
            {venue.session ? 'Session' : meta.label}
          </span>
          <span className="text-white/20">|</span>
          <span className="text-emerald-400">{getTodayHours(venue)}</span>
        </div>
        <p className="art-map-detail-card__description mt-3 line-clamp-2 max-w-2xl text-[13px] leading-5 text-white/58">
          {venue.description}
        </p>
        <div className={`art-map-detail-card__actions mt-auto grid gap-3 pt-4 ${venue.session ? 'grid-cols-2' : 'grid-cols-[minmax(92px,0.7fr)_minmax(125px,0.9fr)_minmax(150px,1.1fr)]'}`}>
          {venue.session ? (
            <button
              type="button"
              onClick={() => { window.location.href = `/sessions/${venue.session?.id}` }}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-bzr-orange/45 bg-bzr-orange/10 px-4 text-[13px] font-semibold text-bzr-orange transition hover:bg-bzr-orange/20"
            >
              <CalendarDays size={17} />
              View session
            </button>
          ) : (
            <>
              <SheetAction
                active={saved}
                disabled={saving}
                onClick={onSave}
                icon={<Bookmark size={17} fill={saved ? 'currentColor' : 'none'} />}
                label={saving ? 'Saving…' : saved ? 'Saved' : 'Save'}
              />
              <SheetAction
                active={visited}
                disabled={markingVisited}
                onClick={onVisited}
                icon={<CheckCircle2 size={17} />}
                label={markingVisited ? 'Updating…' : visited ? 'Visited' : 'Mark visited'}
              />
            </>
          )}
          <button
            type="button"
            onClick={onDirections}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-bzr-orange px-4 text-[13px] font-semibold text-white transition hover:bg-[#ec5b28] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bzr-orange focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          >
            <Navigation size={18} />
            Get directions
          </button>
        </div>
      </div>
    </motion.div>
  )
}

function SheetAction({
  active,
  disabled,
  onClick,
  icon,
  label,
}: {
  active: boolean
  disabled?: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl border px-3 text-[13px] font-medium transition disabled:opacity-50 ${
        active
          ? 'border-bzr-orange/55 bg-bzr-orange/10 text-bzr-orange'
          : 'border-white/[0.14] text-white/75 hover:bg-white/[0.06] hover:text-white'
      }`}
    >
      {icon}
      {label}
    </button>
  )
}

function MobileVenueCard({
  venue,
  selected,
  onSelect,
  onOpen,
}: {
  venue: ExtendedVenue
  selected: boolean
  onSelect: () => void
  onOpen: () => void
}) {
  const meta = getVenueTypeMeta(venue.type)
  return (
    <article
      onClick={onSelect}
      className={`art-map-mobile-card w-[84vw] max-w-[344px] flex-none snap-start overflow-hidden rounded-[22px] border bg-[#1c130f]/[0.98] text-left shadow-[0_20px_55px_rgba(0,0,0,0.72)] backdrop-blur-2xl transition ${
        selected
          ? 'border-bzr-orange/55 shadow-[0_20px_55px_rgba(0,0,0,0.75),0_0_0_1px_rgba(255,107,53,0.1)]'
          : 'border-bzr-orange/20'
      }`}
    >
      <img
        src={venue.image || fallbackImageByType[venue.type]}
        alt=""
        className="art-map-mobile-card__image h-[140px] w-full object-cover"
      />
      <div className="art-map-mobile-card__body relative min-h-[100px] border-t border-white/[0.07] p-4 pr-[68px]">
        <div className="flex items-start gap-1.5">
          <h3 className="line-clamp-1 font-display text-[17px] font-semibold leading-5 tracking-[-0.02em] text-white">
            {venue.name}
          </h3>
          {venue.artLocation.verified && !venue.session && (
            <BadgeCheck
              size={15}
              className="mt-0.5 flex-none fill-bzr-orange text-[#1c130f]"
              aria-label="Verified"
            />
          )}
        </div>
        <p className="mt-2 flex items-center gap-1.5 truncate text-xs text-white/52">
          <MapPin size={13} className="flex-none" />
          {venue.artLocation.neighborhood || venue.artLocation.city}
        </p>
        <div className="mt-2 flex items-center gap-2 text-[11px] text-white/52">
          <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
          <span>{venue.session ? 'Session' : meta.label}</span>
          <span className="text-white/20">·</span>
          <span>{getDistance(venue)}</span>
        </div>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onOpen()
          }}
          className="absolute bottom-4 right-4 grid h-11 w-11 place-items-center rounded-full bg-bzr-orange text-[#160d09] shadow-[0_8px_24px_rgba(255,107,53,0.28)] transition hover:scale-105 hover:bg-[#ff7d4e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
          aria-label={`View ${venue.name}`}
        >
          <ArrowRight size={20} strokeWidth={2} />
        </button>
      </div>
    </article>
  )
}

function MobileVenueSheet({
  venue,
  saved,
  visited,
  saving,
  markingVisited,
  onClose,
  onViewMap,
  onSave,
  onVisited,
  onDirections,
}: {
  venue: ExtendedVenue
  saved: boolean
  visited: boolean
  saving: boolean
  markingVisited: boolean
  onClose: () => void
  onViewMap: () => void
  onSave: () => void
  onVisited: () => void
  onDirections: () => void
}) {
  const meta = getVenueTypeMeta(venue.type)
  const images = getVenueGalleryImages(venue)
  const phone = venue.artLocation.phone?.trim()
  const website = venue.artLocation.website?.trim()

  const openWebsite = () => {
    if (!website) return
    const url = /^https?:\/\//i.test(website) ? website : `https://${website}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', stiffness: 310, damping: 31 }}
      className="absolute inset-x-0 bottom-0 z-40 max-h-[82%] overflow-y-auto rounded-t-[28px] border-t border-white/[0.14] bg-[#111111]/98 p-5 pb-[calc(20px+env(safe-area-inset-bottom))] shadow-[0_-24px_80px_rgba(0,0,0,0.65)] backdrop-blur-2xl lg:hidden"
      role="dialog"
      aria-modal="true"
      aria-label={venue.name}
    >
      <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-black/50 text-white/65"
        aria-label="Close place details"
      >
        <X size={17} />
      </button>
      <div className="grid h-52 grid-cols-3 gap-1 overflow-hidden rounded-2xl">
        <img
          src={images[0] || fallbackImageByType[venue.type]}
          alt={`${venue.name} interior`}
          className="col-span-2 h-full w-full object-cover"
        />
        <div className="grid min-w-0 grid-rows-2 gap-1">
          {(images.slice(1, 3).length > 0
            ? images.slice(1, 3)
            : [images[0], images[0]]
          ).map((image, index) => (
            <img
              key={`${image}-${index}`}
              src={image || fallbackImageByType[venue.type]}
              alt={`${venue.name} gallery view ${index + 2}`}
              className="h-full min-h-0 w-full object-cover"
            />
          ))}
        </div>
      </div>
      <div className="mt-4 flex items-start gap-2 pr-10">
        <h2 className="font-display text-2xl font-semibold leading-tight text-white">
          {venue.name}
        </h2>
        {venue.artLocation.verified && !venue.session && (
          <BadgeCheck
            size={19}
            className="mt-1 flex-none fill-bzr-orange text-[#111]"
          />
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-white/50">
        <MapPin size={12} />
        {venue.artLocation.neighborhood || venue.artLocation.city}
        <span className="text-white/15">|</span>
        <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
        {venue.session ? 'Session' : meta.label}
        <span className="text-emerald-400">{getTodayHours(venue)}</span>
      </div>
      <p className="mt-4 text-sm leading-6 text-white/60">{venue.description}</p>
      <div className="mt-5 grid grid-cols-2 gap-2">
        {venue.session ? (
          <button
            type="button"
            onClick={() => { window.location.href = `/sessions/${venue.session?.id}` }}
            className="col-span-2 inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-bzr-orange/45 bg-bzr-orange/10 text-sm font-semibold text-bzr-orange"
          >
            <CalendarDays size={17} />
            View session
          </button>
        ) : (
          <>
            <SheetAction
              active={saved}
              disabled={saving}
              onClick={onSave}
              icon={<Bookmark size={16} fill={saved ? 'currentColor' : 'none'} />}
              label={saving ? 'Saving…' : saved ? 'Saved' : 'Save'}
            />
            <SheetAction
              active={visited}
              disabled={markingVisited}
              onClick={onVisited}
              icon={<CheckCircle2 size={16} />}
              label={visited ? 'Visited' : 'Mark visited'}
            />
          </>
        )}
        <button
          type="button"
          onClick={onViewMap}
          className="col-span-2 inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-bzr-orange text-sm font-semibold text-white"
        >
          <MapPin size={17} />
          View on map
        </button>
        <button
          type="button"
          onClick={onDirections}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/[0.14] text-xs font-medium text-white/75"
        >
          <Navigation size={16} />
          Directions
        </button>
        <button
          type="button"
          disabled={!phone || Boolean(venue.session)}
          onClick={() => {
            if (phone) window.location.href = `tel:${phone}`
          }}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/[0.14] text-xs font-medium text-white/75 disabled:opacity-35"
        >
          <Phone size={16} />
          Call
        </button>
        <button
          type="button"
          disabled={!website || Boolean(venue.session)}
          onClick={openWebsite}
          className="col-span-2 inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/[0.14] text-xs font-medium text-white/75 disabled:opacity-35"
        >
          <Globe2 size={16} />
          Website
        </button>
      </div>
    </motion.div>
  )
}

function VenueGridCard({
  venue,
  selected,
  onSelect,
  onViewMap,
}: {
  venue: ExtendedVenue
  selected: boolean
  onSelect: () => void
  onViewMap: () => void
}) {
  const meta = getVenueTypeMeta(venue.type)
  return (
    <article
      className="art-map-grid-card"
      data-selected={selected}
    >
      <button
        type="button"
        onClick={onSelect}
        className="art-map-grid-card__select"
        aria-label={`Open details for ${venue.name}`}
      >
        <div className="art-map-grid-card__media">
          <img
            src={venue.image || fallbackImageByType[venue.type]}
            alt=""
          />
          <span className="art-map-grid-card__type">
            <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
            {venue.session ? 'Session' : meta.label}
          </span>
        </div>
        <div className="art-map-grid-card__body">
          <div className="flex items-start gap-1.5">
            <h3 className="min-w-0 flex-1 font-display font-semibold text-white">
              {venue.name}
            </h3>
            {venue.artLocation.verified && !venue.session && (
              <BadgeCheck
                size={16}
                className="mt-0.5 flex-none fill-bzr-orange text-[#111]"
                aria-label="Verified"
              />
            )}
          </div>
          <p className="art-map-grid-card__location">
            <MapPin size={12} />
            {venue.artLocation.neighborhood || venue.artLocation.city}
          </p>
          <div className="art-map-grid-card__facts">
            <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
            <span>{venue.session ? 'Session' : meta.label}</span>
            {!venue.session && <><i aria-hidden="true" /><Bookmark size={12} /><span>{venue.artLocation.savesCount || 0}</span></>}
            <span>{getDistance(venue)}</span>
          </div>
        </div>
      </button>
      <div className="art-map-grid-card__footer">
          <span>{getDistance(venue)} away</span>
          <button
            type="button"
            onClick={onViewMap}
            className="inline-flex items-center gap-1.5 text-bzr-orange"
          >
            View on map
            <ArrowRight size={14} />
          </button>
      </div>
    </article>
  )
}

function LocationListSkeleton() {
  return (
    <div aria-label="Loading places">
      {[0, 1, 2, 3].map((item) => (
        <div
          key={item}
          className="flex animate-pulse gap-4 border-b border-white/[0.07] px-6 py-4"
        >
          <div className="h-[84px] w-[112px] rounded-lg bg-white/[0.07]" />
          <div className="flex-1 py-1">
            <div className="h-4 w-4/5 rounded bg-white/[0.08]" />
            <div className="mt-3 h-3 w-3/5 rounded bg-white/[0.05]" />
            <div className="mt-6 h-3 w-full rounded bg-white/[0.05]" />
          </div>
        </div>
      ))}
    </div>
  )
}

function EmptyLocations({
  query,
  onClear,
}: {
  query: string
  onClear: () => void
}) {
  return (
    <div className="flex min-h-[260px] flex-col items-center justify-center px-8 text-center">
      <div className="grid h-11 w-11 place-items-center rounded-full bg-white/[0.05] text-white/45">
        <MapPin size={19} />
      </div>
      <h3 className="mt-4 font-display text-base font-semibold text-white">
        No places match yet
      </h3>
      <p className="mt-2 text-sm leading-6 text-white/45">
        {query
          ? `Try a broader search than “${query}”.`
          : 'Try another venue type or explore the whole map.'}
      </p>
      <button
        type="button"
        onClick={onClear}
        className="mt-4 text-xs font-semibold text-bzr-orange"
      >
        Clear filters
      </button>
    </div>
  )
}
