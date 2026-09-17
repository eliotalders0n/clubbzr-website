import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Box, Button, Flex, Heading, SimpleGrid, Text } from '@chakra-ui/react'
import { useStoreQuery } from '@/hooks/useStoreQuery'
import { useAuth } from '@/contexts/AuthContext'
import { ListingCard } from './ListingCard'
import { StoreLoading, StoreNotice } from './StoreShell'
import { storeLabels, type StoreCursor, type StoreListing } from '../../../../lib/store'

type Page = { listings: StoreListing[]; cursor: StoreCursor; disabled: boolean }
export function StoreCatalog({ sellerId, featured = false, heading }: { sellerId?: string; featured?: boolean; heading?: string }) {
  const [filters, setFilters] = useState({ productType: 'all', paymentRail: 'all', sort: 'newest', search: '', availability: 'all' })
  const [search, setSearch] = useState('')
  const [cursors, setCursors] = useState<StoreCursor[]>([null])
  const { data, error, loading } = useStoreQuery<Page>('browseStore', { ...filters, sellerId, featured, cursor: cursors.at(-1) })
  const [showRefinements, setShowRefinements] = useState(false)
  const refinementCount = [filters.paymentRail !== 'all', filters.availability !== 'all', filters.sort !== 'newest'].filter(Boolean).length
  const applied = useRef('')
  function change(key: keyof typeof filters, value: string) { setFilters({ ...filters, [key]: value, ...(key === 'sort' && value === 'price_points' ? { paymentRail: 'POINT' } : {}), ...(key === 'paymentRail' && value !== 'POINT' && filters.sort === 'price_points' ? { sort: 'newest' } : {}) }); setCursors([null]) }
  // Search applies as you type. A single character is skipped because the
  // catalogue only accepts a token of two characters or more.
  useEffect(() => {
    const term = search.trim()
    if (term.length === 1 || term === applied.current) return
    const timer = setTimeout(() => {
      applied.current = term
      setFilters((prev) => ({ ...prev, search: term }))
      setCursors([null])
    }, 350)
    return () => clearTimeout(timer)
  }, [search])
  // A featured strip is supplementary, so it claims no space at all until it
  // has something to show.
  if (featured && (!data || !data.listings.length)) return null
  return <Box mb={featured ? 12 : 0}>
    {heading && <Heading as="h2" size="xl" mb={6}>{heading}</Heading>}
    {!featured && !sellerId && <div className="store-filters">
      <div className="store-filters__types" role="group" aria-label="Release type">
        {[['all', 'All'], ...Object.entries(storeLabels)].map(([value, label]) => <button key={value} type="button" className="store-chip" aria-pressed={filters.productType === value} onClick={() => change('productType', value)}>{label}</button>)}
      </div>
      <div className="store-filters__controls">
        <div className="store-filters__search-row">
          <form onSubmit={(e) => { e.preventDefault(); change('search', search.trim()) }}><label htmlFor="store-search">Search</label><input id="store-search" type="search" maxLength={24} value={search} placeholder="Title, tag or artist" onChange={(e) => setSearch(e.target.value)} /></form>
          <button type="button" className="store-filters__toggle" aria-expanded={showRefinements} aria-controls="store-refinements" onClick={() => setShowRefinements((open) => !open)}>Filters{refinementCount > 0 && <span className="store-filters__count">{refinementCount}</span>}</button>
        </div>
        <div className="store-filters__advanced" id="store-refinements" data-open={showRefinements}>
          <div><label htmlFor="store-payment">Payment</label><select id="store-payment" value={filters.paymentRail} onChange={(e) => change('paymentRail', e.target.value)}><option value="all">Any method</option><option value="POINT">Club BZR Points</option><option value="ZMW">ZMW through Lenco</option></select></div>
          <div><label htmlFor="store-availability">Availability</label><select id="store-availability" value={filters.availability} onChange={(e) => change('availability', e.target.value)}><option value="all">All releases</option><option value="limited">Limited quantity</option></select></div>
          <div><label htmlFor="store-sort">Sort by</label><select id="store-sort" value={filters.sort} onChange={(e) => change('sort', e.target.value)}><option value="newest">Newest</option><option value="price">ZMW price: low to high</option><option value="price_points">Points price: low to high</option></select></div>
        </div>
      </div>
    </div>}
    {loading && <StoreLoading />}{error && <StoreNotice error>{error}</StoreNotice>}
    {data?.disabled && <StoreNotice>The Store is preparing to open. Come back soon for releases from the Club BZR community.</StoreNotice>}
    {data && !data.disabled && !data.listings.length && <StoreNotice>{sellerId ? 'No releases are available from this artist yet.' : 'No releases match these filters yet.'}</StoreNotice>}
    <SimpleGrid columns={{ base: 1, sm: 2, lg: 3 }} gap={6}>{data?.listings.map((listing) => <ListingCard key={listing.id} listing={listing} />)}</SimpleGrid>
    <Flex justify="space-between" mt={6} gap={3}>{cursors.length > 1 && <Button variant="outline" onClick={() => setCursors(cursors.slice(0, -1))}>Previous page</Button>}{data?.cursor && <Button variant="outline" onClick={() => setCursors([...cursors, data.cursor])}>Next releases</Button>}</Flex>
  </Box>
}
export function ArtistShop({ sellerId }: { sellerId: string }) {
  const { firebaseUser, hasRole } = useAuth()
  const { data } = useStoreQuery<{ profile: { displayName: string; verified: boolean; available: boolean } | null }>('getStoreSeller', { sellerId })
  if (!data?.profile && firebaseUser?.uid !== sellerId) return null
  return <Box as="section" mt={12} className="store-ui"><Flex justify="space-between" align="center" gap={4} wrap="wrap" mb={6}><Box><Heading as="h2" size="xl">Shop</Heading><Text color="whiteAlpha.600" mt={2}>{data?.profile?.verified ? 'Verified seller' : 'Community seller'} · {data?.profile?.available ? 'Open for orders' : 'Currently unavailable'}</Text></Box>{hasRole(['admin']) && <Link className="store-button" to="/admin/store">Store admin</Link>}</Flex><StoreCatalog sellerId={sellerId} /></Box>
}
