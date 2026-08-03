'use client'

import { useMemo, useRef, useState } from 'react'
import { Box, Button, Flex, Input, SimpleGrid, Text, VStack } from '@chakra-ui/react'
import { LocateFixed, MapPin, Search } from 'lucide-react'

import { searchZambianLocations, type GeocodingSearchResult } from '../../../lib/geocoding'
import type { ArtLocation } from '../../../lib/schema'
import { OpenStreetArtMap, type MapVenue } from './OpenStreetArtMap'

export interface LocationPickerValue {
  name: string
  address: string
  city: string
  latitude: number | null
  longitude: number | null
  artLocationId?: string
  source: 'art_location' | 'custom'
}

interface LocationPickerProps {
  value: LocationPickerValue
  places: ArtLocation[]
  onChange: (value: LocationPickerValue) => void
}

const venueType = (type: ArtLocation['type']): MapVenue['type'] => {
  if (type === 'gallery' || type === 'museum' || type === 'studio') return type
  if (type === 'pop_up' || type === 'installation') return 'event'
  return 'other'
}

const fieldProps = {
  minH: '40px',
  bg: 'rgba(255,255,255,0.045)',
  color: 'white',
  borderColor: 'rgba(255,255,255,0.08)',
  borderRadius: 'xl',
  _placeholder: { color: 'whiteAlpha.400' },
  _hover: { borderColor: 'rgba(255,255,255,0.14)' },
  _focusVisible: { borderColor: 'brand.400', boxShadow: '0 0 0 1px var(--chakra-colors-brand-400)' },
} as const

export function LocationPicker({ value, places, onChange }: LocationPickerProps) {
  const [search, setSearch] = useState('')
  const [locationError, setLocationError] = useState<string | null>(null)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [searchStatus, setSearchStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [searchResults, setSearchResults] = useState<GeocodingSearchResult[]>([])
  const searchCache = useRef(new Map<string, GeocodingSearchResult[]>())
  const searchRequest = useRef<AbortController | null>(null)

  const venues = useMemo<MapVenue[]>(() => places
    .filter((place) => Number.isFinite(place.coordinates?.latitude) && Number.isFinite(place.coordinates?.longitude))
    .map((place) => ({
      id: place.id,
      name: place.name,
      type: venueType(place.type),
      coordinates: {
        lat: place.coordinates.latitude,
        lng: place.coordinates.longitude,
      },
      address: [place.address, place.city].filter(Boolean).join(', '),
      description: place.description,
      image: place.thumbnailUrl || place.images?.[0],
    })), [places])

  const filteredPlaces = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return places.slice(0, 6)
    return places.filter((place) => [place.name, place.address, place.city, place.neighborhood]
      .filter(Boolean)
      .some((item) => String(item).toLowerCase().includes(query)))
      .slice(0, 6)
  }, [places, search])

  const choosePlace = (place: ArtLocation) => {
    onChange({
      name: place.name,
      address: place.address,
      city: place.city,
      latitude: place.coordinates.latitude,
      longitude: place.coordinates.longitude,
      artLocationId: place.id,
      source: 'art_location',
    })
    setSearch(place.name)
    setSearchResults([])
    setSearchStatus('idle')
    setSearchError(null)
    setLocationError(null)
  }

  const chooseSearchResult = (result: GeocodingSearchResult) => {
    onChange({
      name: result.name,
      address: result.address,
      city: result.city,
      latitude: Number(result.latitude.toFixed(6)),
      longitude: Number(result.longitude.toFixed(6)),
      artLocationId: undefined,
      source: 'custom',
    })
    setSearch(result.name)
    setSearchResults([])
    setSearchStatus('idle')
    setSearchError(null)
    setLocationError(null)
  }

  const searchLocations = async () => {
    const query = search.trim()
    if (query.length < 2) {
      setSearchStatus('error')
      setSearchError('Enter at least two characters to search for a location.')
      return
    }

    const cacheKey = query.toLowerCase()
    const cached = searchCache.current.get(cacheKey)
    if (cached) {
      setSearchResults(cached)
      setSearchStatus('ready')
      setSearchError(null)
      return
    }

    searchRequest.current?.abort()
    const controller = new AbortController()
    searchRequest.current = controller
    setSearchStatus('loading')
    setSearchError(null)

    try {
      const results = await searchZambianLocations(query, controller.signal)
      searchCache.current.set(cacheKey, results)
      setSearchResults(results)
      setSearchStatus('ready')
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setSearchResults([])
      setSearchStatus('error')
      setSearchError('Location search could not be completed. Try again, or place the pin manually.')
    }
  }

  const chooseCoordinates = ({ lat, lng }: { lat: number; lng: number }) => {
    onChange({
      ...value,
      latitude: Number(lat.toFixed(6)),
      longitude: Number(lng.toFixed(6)),
      artLocationId: undefined,
      source: 'custom',
    })
    setLocationError(null)
  }

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Location is not available in this browser.')
      return
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => chooseCoordinates({ lat: coords.latitude, lng: coords.longitude }),
      () => setLocationError('Allow location access or place the pin manually.'),
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  return (
    <VStack align="stretch" gap={4}>
      <Flex maxW="760px" gap={2} align="stretch">
        <Box position="relative" flex={1}>
          <Box position="absolute" left={3.5} top="50%" transform="translateY(-50%)" color="whiteAlpha.450" zIndex={1}>
            <Search size={16} />
          </Box>
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setSearchResults([])
              setSearchStatus('idle')
              setSearchError(null)
            }}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return
              event.preventDefault()
              event.stopPropagation()
              void searchLocations()
            }}
            pl={10}
            placeholder="Search venues, landmarks, or addresses"
            aria-label="Search for a session location"
            {...fieldProps}
          />
        </Box>
        <Button
          type="button"
          h="40px"
          px={{ base: 3.5, sm: 5 }}
          border={0}
          borderRadius="xl"
          bg="brand.500"
          color="white"
          loading={searchStatus === 'loading'}
          loadingText="Searching"
          _hover={{ bg: 'brand.400' }}
          onClick={() => void searchLocations()}
        >
          <Search size={15} />
          <Text display={{ base: 'none', sm: 'block' }}>Search</Text>
        </Button>
      </Flex>

      {searchError && (
        <Text maxW="760px" color="red.300" fontSize="sm" role="alert">
          {searchError}
        </Text>
      )}

      {filteredPlaces.length > 0 && search.trim() && (
        <Box>
          <Text color="whiteAlpha.400" fontSize="xs" fontWeight="semibold" letterSpacing="0.08em" mb={2}>CLUB BZR PLACES</Text>
          <Flex gap={2} flexWrap="wrap">
            {filteredPlaces.map((place) => (
              <Button
                key={place.id}
                type="button"
                h="36px"
                px={3.5}
                borderRadius="lg"
                bg={value.artLocationId === place.id ? 'brand.500/20' : 'whiteAlpha.50'}
                color={value.artLocationId === place.id ? 'brand.200' : 'whiteAlpha.700'}
                border={0}
                _hover={{ bg: 'whiteAlpha.100', color: 'white' }}
                onClick={() => choosePlace(place)}
              >
                <MapPin size={14} />
                {place.name}
              </Button>
            ))}
          </Flex>
        </Box>
      )}

      {searchStatus === 'ready' && (
        <Box maxW="760px" bg="rgba(255,255,255,0.035)" borderRadius="xl" overflow="hidden">
          <Text px={4} pt={3} pb={2} color="whiteAlpha.400" fontSize="xs" fontWeight="semibold" letterSpacing="0.08em">
            {searchResults.length ? 'LOCATION RESULTS' : 'NO LOCATIONS FOUND'}
          </Text>
          {searchResults.map((result) => (
            <Button
              key={result.id}
              type="button"
              w="full"
              h="auto"
              minH="58px"
              px={4}
              py={3}
              justifyContent="flex-start"
              textAlign="left"
              border={0}
              borderRadius={0}
              bg="transparent"
              color="white"
              borderTop="1px solid"
              borderTopColor="whiteAlpha.70"
              _hover={{ bg: 'whiteAlpha.70' }}
              onClick={() => chooseSearchResult(result)}
            >
              <MapPin size={16} color="var(--chakra-colors-brand-400)" />
              <Box minW={0}>
                <Text fontSize="sm" fontWeight="semibold" lineClamp={1}>{result.name}</Text>
                <Text color="whiteAlpha.500" fontSize="xs" fontWeight="normal" lineClamp={1}>{result.displayName}</Text>
              </Box>
            </Button>
          ))}
          <Text px={4} py={2.5} color="whiteAlpha.350" fontSize="2xs">Search results © OpenStreetMap contributors</Text>
        </Box>
      )}

      <Box h={{ base: '220px', md: '280px' }} overflow="hidden" borderRadius="xl" bg="#090909">
        <OpenStreetArtMap
          venues={venues}
          selectedVenueId={value.artLocationId || null}
          pickerLocation={value.latitude !== null && value.longitude !== null
            ? { lat: value.latitude, lng: value.longitude }
            : null}
          onVenueSelect={(venue) => {
            const place = places.find((item) => item.id === venue.id)
            if (place) choosePlace(place)
          }}
          onLocationPick={chooseCoordinates}
        />
      </Box>

      <Flex justify="space-between" align={{ base: 'stretch', sm: 'center' }} direction={{ base: 'column', sm: 'row' }} gap={3}>
        <Box>
          <Text color="whiteAlpha.700" fontSize="sm" fontWeight="medium">
            {value.latitude !== null && value.longitude !== null
              ? `${value.latitude.toFixed(6)}, ${value.longitude.toFixed(6)}`
              : 'Click the map to place the session pin'}
          </Text>
          <Text color="whiteAlpha.400" fontSize="xs" mt={1}>
            {value.source === 'art_location' ? 'Linked to a Community Map place' : 'Custom session location'}
          </Text>
        </Box>
        <Button type="button" h="38px" px={4} border={0} borderRadius="lg" bg="whiteAlpha.70" color="whiteAlpha.750" _hover={{ bg: 'whiteAlpha.120', color: 'white' }} onClick={useCurrentLocation}>
          <LocateFixed size={15} />
          Use current location
        </Button>
      </Flex>

      {locationError && <Text color="red.300" fontSize="sm">{locationError}</Text>}

      <SimpleGrid columns={{ base: 1, md: 2 }} gap={4}>
        <Box>
          <Text color="whiteAlpha.550" fontSize="sm" fontWeight="medium" mb={2}>Venue name</Text>
          <Input value={value.name} onChange={(event) => onChange({ ...value, name: event.target.value })} {...fieldProps} />
        </Box>
        <Box>
          <Text color="whiteAlpha.550" fontSize="sm" fontWeight="medium" mb={2}>City</Text>
          <Input value={value.city} onChange={(event) => onChange({ ...value, city: event.target.value })} {...fieldProps} />
        </Box>
      </SimpleGrid>
      <Box>
        <Text color="whiteAlpha.550" fontSize="sm" fontWeight="medium" mb={2}>Street address or landmark</Text>
        <Input value={value.address} onChange={(event) => onChange({ ...value, address: event.target.value })} {...fieldProps} />
      </Box>
    </VStack>
  )
}
