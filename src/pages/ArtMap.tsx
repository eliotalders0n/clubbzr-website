'use client';

import React, { useState, useCallback, Suspense, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Canvas } from '@react-three/fiber';
import { arrayUnion, arrayRemove, increment } from 'firebase/firestore';
import { Header } from '@/components/layout/Header';
import { Section } from '@/components/layout/Section';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Input, SearchInput } from '@/components/ui/Input';
import { Modal, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { ArtMapGlobe, type Venue } from '@/components/three/ArtMapGlobe';
import { useCollection, useMutation } from '@/hooks/useFirestore';
import { useAuth } from '@/contexts/AuthContext';
import type { ArtLocation, ArtLocationType } from '../../lib/schema';

const venueTypeLabels: Record<Venue['type'], { label: string; color: string }> = {
  gallery: { label: 'Gallery', color: 'bg-red-500' },
  museum: { label: 'Museum', color: 'bg-teal-500' },
  studio: { label: 'Studio', color: 'bg-yellow-500' },
  event: { label: 'Event', color: 'bg-purple-500' },
  other: { label: 'Other', color: 'bg-green-500' },
};

type VenueFilter = Venue['type'] | 'all';

// Map ArtLocationType to Venue type
const mapLocationTypeToVenueType = (type: ArtLocationType): Venue['type'] => {
  switch (type) {
    case 'gallery':
      return 'gallery';
    case 'museum':
      return 'museum';
    case 'studio':
      return 'studio';
    case 'pop_up':
    case 'installation':
      return 'event';
    case 'street_art':
    case 'public_art':
    case 'cafe':
    case 'community_space':
    case 'other':
    default:
      return 'other';
  }
};

// Extended venue type with ArtLocation reference
interface ExtendedVenue extends Venue {
  artLocation: ArtLocation;
}

const ArtMap: React.FC = () => {
  const [selectedVenue, setSelectedVenue] = useState<ExtendedVenue | null>(null);
  const [hoveredVenue, setHoveredVenue] = useState<Venue | null>(null);
  const [filter, setFilter] = useState<VenueFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [savingLocation, setSavingLocation] = useState(false);
  const [markingVisited, setMarkingVisited] = useState(false);

  const { user } = useAuth();

  // Fetch art locations from Firebase
  const { data: artLocations, loading, error, refetch } = useCollection('artLocations', {
    where: [{ field: 'isActive', operator: '==', value: true }],
  });

  const { update: updateLocation } = useMutation('artLocations');

  // Convert ArtLocations to Venues for the globe
  const venues: ExtendedVenue[] = useMemo(() => {
    return artLocations.map((location) => ({
      id: location.id,
      name: location.name,
      type: mapLocationTypeToVenueType(location.type),
      coordinates: {
        lat: location.coordinates.latitude,
        lng: location.coordinates.longitude,
      },
      address: `${location.address}, ${location.city}, ${location.country}`,
      description: location.description,
      image: location.thumbnailUrl || location.images?.[0],
      artLocation: location,
    }));
  }, [artLocations]);

  const filteredVenues = venues.filter((venue) => {
    const matchesFilter = filter === 'all' || venue.type === filter;
    const matchesSearch =
      venue.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      venue.address?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  // Check if current user has saved/visited the selected location
  const userHasSaved = useMemo(() => {
    if (!user || !selectedVenue) return false;
    return selectedVenue.artLocation.savedBy?.includes(user.uid) ?? false;
  }, [user, selectedVenue]);

  const userHasVisited = useMemo(() => {
    if (!user || !selectedVenue) return false;
    return selectedVenue.artLocation.visitedBy?.includes(user.uid) ?? false;
  }, [user, selectedVenue]);

  // Handle save location
  const handleSaveLocation = useCallback(async () => {
    if (!user || !selectedVenue) return;

    setSavingLocation(true);
    try {
      const isSaved = userHasSaved;
      await updateLocation(selectedVenue.id, {
        savedBy: isSaved ? arrayRemove(user.uid) : arrayUnion(user.uid),
        savesCount: isSaved ? increment(-1) : increment(1),
      } as any);
      await refetch();
    } catch (err) {
      console.error('Failed to save location:', err);
    } finally {
      setSavingLocation(false);
    }
  }, [user, selectedVenue, userHasSaved, updateLocation, refetch]);

  // Handle mark as visited
  const handleMarkVisited = useCallback(async () => {
    if (!user || !selectedVenue) return;

    setMarkingVisited(true);
    try {
      const hasVisited = userHasVisited;
      await updateLocation(selectedVenue.id, {
        visitedBy: hasVisited ? arrayRemove(user.uid) : arrayUnion(user.uid),
        visitsCount: hasVisited ? increment(-1) : increment(1),
      } as any);
      await refetch();
    } catch (err) {
      console.error('Failed to mark as visited:', err);
    } finally {
      setMarkingVisited(false);
    }
  }, [user, selectedVenue, userHasVisited, updateLocation, refetch]);

  // Update selected venue when artLocations data changes (after save/visit)
  useEffect(() => {
    if (selectedVenue) {
      const updatedVenue = venues.find((v) => v.id === selectedVenue.id);
      if (updatedVenue && updatedVenue.artLocation !== selectedVenue.artLocation) {
        setSelectedVenue(updatedVenue);
      }
    }
  }, [venues, selectedVenue]);

  const handleVenueClick = useCallback((venue: Venue) => {
    // Find the extended venue with artLocation data
    const extendedVenue = venues.find((v) => v.id === venue.id);
    setSelectedVenue(extendedVenue || null);
  }, [venues]);

  const handleVenueHover = useCallback((venue: Venue | null) => {
    setHoveredVenue(venue);
  }, []);

  const filters: { value: VenueFilter; label: string }[] = [
    { value: 'all', label: 'All Locations' },
    { value: 'gallery', label: 'Galleries' },
    { value: 'museum', label: 'Museums' },
    { value: 'studio', label: 'Studios' },
    { value: 'event', label: 'Events' },
  ];

  return (
    <div className="min-h-screen bg-bzr-black">
      <Header />

      {/* Main Content */}
      <div className="relative h-screen">
        {/* 3D Map */}
        <div className="absolute inset-0">
          <Canvas
            camera={{ position: [0, 0, 10], fov: 60 }}
            className="bg-bzr-black"
          >
            <Suspense fallback={null}>
              <ArtMapGlobe
                venues={filteredVenues}
                onVenueClick={handleVenueClick}
                onVenueHover={handleVenueHover}
                mapStyle="neon"
                showLabels={false}
                enableZoom
                animateConnections
              />
            </Suspense>
          </Canvas>

          {/* Loading Overlay */}
          {loading && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center bg-bzr-black/50 transition-opacity">
              <div className="text-white">Loading...</div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <AnimatePresence>
          <motion.aside
            initial={{ x: -320 }}
            animate={{ x: sidebarCollapsed ? -280 : 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="absolute left-0 top-0 bottom-0 w-80 z-20 flex"
          >
            {/* Sidebar Content */}
            <div className="flex-1 bg-bzr-black/90 backdrop-blur-xl border-r border-bzr-gray-800 flex flex-col">
              {/* Header */}
              <div className="p-6 border-b border-bzr-gray-800">
                <h2 className="text-2xl font-display font-bold text-bzr-white mb-2">
                  Art Map
                </h2>
                <p className="text-sm text-bzr-gray-400">
                  Discover creative spaces worldwide
                </p>
              </div>

              {/* Search */}
              <div className="p-4 border-b border-bzr-gray-800">
                <SearchInput
                  placeholder="Search locations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  size="sm"
                />
              </div>

              {/* Filters */}
              <div className="p-4 border-b border-bzr-gray-800">
                <div className="flex flex-wrap gap-2">
                  {filters.map((f) => (
                    <Badge
                      key={f.value}
                      variant={filter === f.value ? 'blue' : 'gray'}
                      interactive
                      onClick={() => setFilter(f.value)}
                      size="sm"
                    >
                      {f.label}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Location List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {loading && (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-white text-sm">Loading...</div>
                  </div>
                )}

                {error && (
                  <div className="text-center py-8">
                    <p className="text-bzr-red-400 mb-2">Failed to load locations</p>
                    <Button variant="ghost" size="sm" onClick={refetch}>
                      Try Again
                    </Button>
                  </div>
                )}

                {!loading && !error && filteredVenues.map((venue) => (
                  <motion.div
                    key={venue.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    whileHover={{ scale: 1.02 }}
                    onClick={() => handleVenueClick(venue)}
                    className={`
                      p-4 rounded-xl cursor-pointer
                      border transition-all duration-200
                      ${
                        selectedVenue?.id === venue.id
                          ? 'bg-bzr-blue/20 border-bzr-blue'
                          : hoveredVenue?.id === venue.id
                          ? 'bg-bzr-gray-800/50 border-bzr-gray-700'
                          : 'bg-bzr-gray-900/50 border-bzr-gray-800 hover:border-bzr-gray-700'
                      }
                    `}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-display font-semibold text-bzr-white text-sm">
                        {venue.name}
                      </h3>
                      <span
                        className={`w-2 h-2 rounded-full ${
                          venueTypeLabels[venue.type].color
                        }`}
                      />
                    </div>
                    <p className="text-xs text-bzr-gray-400 mb-2">
                      {venue.address}
                    </p>
                    <div className="flex items-center gap-2">
                      {venue.artLocation.verified && (
                        <Badge variant="green" size="sm">Verified</Badge>
                      )}
                      <span className="text-xs text-bzr-gray-500">
                        {venue.artLocation.savesCount || 0} saves
                      </span>
                    </div>
                  </motion.div>
                ))}

                {!loading && !error && filteredVenues.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-bzr-gray-400">No locations found</p>
                  </div>
                )}
              </div>

              {/* Submit CTA */}
              <div className="p-4 border-t border-bzr-gray-800">
                <Button
                  variant="primary"
                  size="sm"
                  className="w-full"
                  onClick={() => setShowSubmitModal(true)}
                >
                  Submit Location
                </Button>
              </div>
            </div>

            {/* Collapse Toggle */}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="w-10 flex-shrink-0 bg-bzr-gray-900/80 border-r border-bzr-gray-800 flex items-center justify-center hover:bg-bzr-gray-800 transition-colors"
            >
              <motion.svg
                animate={{ rotate: sidebarCollapsed ? 180 : 0 }}
                className="w-5 h-5 text-bzr-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </motion.svg>
            </button>
          </motion.aside>
        </AnimatePresence>

        {/* Legend */}
        <div className="absolute bottom-6 right-6 z-10">
          <Card glass padding="sm" className="w-48">
            <h4 className="text-xs font-semibold text-bzr-white mb-3 uppercase tracking-wider">
              Legend
            </h4>
            <div className="space-y-2">
              {Object.entries(venueTypeLabels).map(([type, { label, color }]) => (
                <div key={type} className="flex items-center gap-2">
                  <span className={`w-3 h-3 rounded-full ${color}`} />
                  <span className="text-xs text-bzr-gray-300">{label}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Venue Detail Modal */}
        <Modal
          isOpen={!!selectedVenue}
          onClose={() => setSelectedVenue(null)}
          title={selectedVenue?.name}
          size="md"
        >
          {selectedVenue && (
            <>
              <ModalBody>
                <div className="space-y-4">
                  {/* Location image */}
                  {selectedVenue.image && (
                    <div className="aspect-video rounded-lg overflow-hidden bg-bzr-gray-800">
                      <img
                        src={selectedVenue.image}
                        alt={selectedVenue.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  {/* Type and stats */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-3 h-3 rounded-full ${
                          venueTypeLabels[selectedVenue.type].color
                        }`}
                      />
                      <span className="text-sm text-bzr-gray-400 capitalize">
                        {selectedVenue.artLocation.type.replace('_', ' ')}
                      </span>
                      {selectedVenue.artLocation.verified && (
                        <Badge variant="green" size="sm">Verified</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-bzr-gray-400">
                      <span>{selectedVenue.artLocation.savesCount || 0} saves</span>
                      <span>{selectedVenue.artLocation.visitsCount || 0} visits</span>
                    </div>
                  </div>

                  {selectedVenue.address && (
                    <div>
                      <h4 className="text-xs text-bzr-gray-500 uppercase tracking-wider mb-1">
                        Address
                      </h4>
                      <p className="text-bzr-white">{selectedVenue.address}</p>
                      {selectedVenue.artLocation.neighborhood && (
                        <p className="text-sm text-bzr-gray-400">
                          {selectedVenue.artLocation.neighborhood}
                        </p>
                      )}
                    </div>
                  )}

                  {selectedVenue.description && (
                    <div>
                      <h4 className="text-xs text-bzr-gray-500 uppercase tracking-wider mb-1">
                        About
                      </h4>
                      <p className="text-bzr-gray-300">{selectedVenue.description}</p>
                    </div>
                  )}

                  {/* Contact info */}
                  {(selectedVenue.artLocation.website || selectedVenue.artLocation.phone || selectedVenue.artLocation.email) && (
                    <div>
                      <h4 className="text-xs text-bzr-gray-500 uppercase tracking-wider mb-1">
                        Contact
                      </h4>
                      <div className="space-y-1">
                        {selectedVenue.artLocation.website && (
                          <a
                            href={selectedVenue.artLocation.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block text-sm text-bzr-blue hover:underline"
                          >
                            {selectedVenue.artLocation.website}
                          </a>
                        )}
                        {selectedVenue.artLocation.email && (
                          <p className="text-sm text-bzr-gray-300">{selectedVenue.artLocation.email}</p>
                        )}
                        {selectedVenue.artLocation.phone && (
                          <p className="text-sm text-bzr-gray-300">{selectedVenue.artLocation.phone}</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Tags */}
                  {selectedVenue.artLocation.tags && selectedVenue.artLocation.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {selectedVenue.artLocation.tags.map((tag) => (
                        <Badge key={tag} variant="outline" size="sm">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </ModalBody>
              <ModalFooter>
                <Button variant="ghost" onClick={() => setSelectedVenue(null)}>
                  Close
                </Button>
                {user && (
                  <>
                    <Button
                      variant={userHasVisited ? 'secondary' : 'ghost'}
                      onClick={handleMarkVisited}
                      disabled={markingVisited}
                    >
                      {markingVisited ? 'Updating...' : userHasVisited ? 'Visited' : 'Mark Visited'}
                    </Button>
                    <Button
                      variant={userHasSaved ? 'secondary' : 'primary'}
                      onClick={handleSaveLocation}
                      disabled={savingLocation}
                    >
                      {savingLocation ? 'Saving...' : userHasSaved ? 'Saved' : 'Save Location'}
                    </Button>
                  </>
                )}
                <Button
                  variant="primary"
                  onClick={() => {
                    const { lat, lng } = selectedVenue.coordinates;
                    window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
                  }}
                >
                  Get Directions
                </Button>
              </ModalFooter>
            </>
          )}
        </Modal>

        {/* Submit Location Modal */}
        <Modal
          isOpen={showSubmitModal}
          onClose={() => setShowSubmitModal(false)}
          title="Submit a New Location"
          description="Help us grow the art map by adding creative spaces"
          size="lg"
        >
          <ModalBody>
            <form className="space-y-4">
              <Input label="Location Name" placeholder="e.g. Downtown Art Gallery" />
              <Input label="Address" placeholder="Full street address" />
              <div className="grid grid-cols-2 gap-4">
                <Input label="Latitude" placeholder="e.g. 40.7128" type="number" />
                <Input label="Longitude" placeholder="e.g. -74.006" type="number" />
              </div>
              <div>
                <label className="text-sm text-bzr-gray-400 mb-2 block">Type</label>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(venueTypeLabels).map(([type, { label }]) => (
                    <Badge key={type} variant="outline" interactive>
                      {label}
                    </Badge>
                  ))}
                </div>
              </div>
              <Input label="Description" placeholder="Tell us about this space..." />
            </form>
          </ModalBody>
          <ModalFooter>
            <Button variant="ghost" onClick={() => setShowSubmitModal(false)}>
              Cancel
            </Button>
            <Button variant="primary">Submit Location</Button>
          </ModalFooter>
        </Modal>
      </div>
    </div>
  );
};

export default ArtMap;
