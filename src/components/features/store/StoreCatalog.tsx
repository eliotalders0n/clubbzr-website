import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Box, Button, Flex, Heading, SimpleGrid, Text } from '@chakra-ui/react'
import { useStoreQuery } from '@/hooks/useStoreQuery'
import { useAuth } from '@/contexts/AuthContext'
import { ListingCard } from './ListingCard'
import { StoreLoading, StoreNotice } from './StoreShell'
import { storeLabels, type StoreCursor, type StoreListing } from '../../../../lib/store'

type Page = { listings: StoreListing[]; cursor: StoreCursor; disabled: boolean }
export function StoreCatalog({ sellerId, featured = false }: { sellerId?: string; featured?: boolean }) {
  const [filters, setFilters] = useState({ productType: 'all', paymentRail: 'all', sort: 'newest', search: '', availability: 'all' })
  const [search, setSearch] = useState('')
  const [cursors, setCursors] = useState<StoreCursor[]>([null])
  const { data, error, loading } = useStoreQuery<Page>('browseStore', { ...filters, sellerId, featured, cursor: cursors.at(-1) })
  function change(key: keyof typeof filters, value: string) { setFilters({ ...filters, [key]: value, ...(key === 'sort' && value === 'price_points' ? { paymentRail: 'POINT' } : {}), ...(key === 'paymentRail' && value !== 'POINT' && filters.sort === 'price_points' ? { sort: 'newest' } : {}) }); setCursors([null]) }
  return <Box>
    {!featured && <><Flex gap={2} wrap="wrap" mb={5}>{[['all', 'All'], ...Object.entries(storeLabels)].map(([value, label]) => <Button key={value} variant="outline" color="white" px={4} rounded="full" borderColor={filters.productType === value ? 'brand.500' : 'whiteAlpha.200'} bg={filters.productType === value ? 'brand.500' : 'transparent'} onClick={() => change('productType', value)}>{label}</Button>)}</Flex>
      <div className="store-grid" style={{ marginBottom: 28 }}><form onSubmit={(e) => { e.preventDefault(); change('search', search) }}><label>Search a title, artist or tag word<div style={{ display: 'flex', gap: 8 }}><input type="search" minLength={2} maxLength={24} value={search} placeholder="Try portrait" onChange={(e) => setSearch(e.target.value)} /><button className="store-button" type="submit">Search</button></div></label></form>
        <label>Payment method<select value={filters.paymentRail} onChange={(e) => change('paymentRail', e.target.value)}><option value="all">Any method</option><option value="POINT">Club BZR Points</option><option value="ZMW">ZMW through Lenco</option></select></label>
        <label>Availability<select value={filters.availability} onChange={(e) => change('availability', e.target.value)}><option value="all">All available releases</option><option value="limited">Limited quantity</option></select></label>
        <label>Sort by<select value={filters.sort} onChange={(e) => change('sort', e.target.value)}><option value="newest">Newest</option><option value="price">ZMW price: low to high</option><option value="price_points">Points price: low to high</option></select></label>
      </div></>}
    {loading && <StoreLoading />}{error && <StoreNotice error>{error}</StoreNotice>}
    {data?.disabled && <StoreNotice>The Store is preparing to open. Come back soon for releases from the Club BZR community.</StoreNotice>}
    {data && !data.disabled && !data.listings.length && <StoreNotice>{sellerId ? 'No releases are available from this artist yet.' : 'No releases match these filters yet.'}</StoreNotice>}
    <SimpleGrid columns={{ base: 1, sm: 2, lg: 3 }} gap={6}>{data?.listings.map((listing) => <ListingCard key={listing.id} listing={listing} />)}</SimpleGrid>
    <Flex justify="space-between" mt={6} gap={3}>{cursors.length > 1 && <Button variant="outline" onClick={() => setCursors(cursors.slice(0, -1))}>Previous page</Button>}{data?.cursor && <Button variant="outline" onClick={() => setCursors([...cursors, data.cursor])}>Next releases</Button>}</Flex>
  </Box>
}
export function ArtistShop({ sellerId }: { sellerId: string }) {
  const { firebaseUser } = useAuth()
  const { data } = useStoreQuery<{ profile: { displayName: string; verified: boolean; available: boolean } | null }>('getStoreSeller', { sellerId })
  if (!data?.profile && firebaseUser?.uid !== sellerId) return null
  return <Box as="section" mt={12} className="store-ui"><Flex justify="space-between" align="center" gap={4} wrap="wrap" mb={6}><Box><Heading as="h2" size="xl">Shop</Heading><Text color="whiteAlpha.600" mt={2}>{data?.profile?.verified ? 'Verified seller' : 'Community seller'} · {data?.profile?.available ? 'Open for orders' : 'Currently unavailable'}</Text></Box>{firebaseUser?.uid === sellerId && <Link className="store-button" to="/store/manage">Manage Shop</Link>}</Flex><StoreCatalog sellerId={sellerId} /></Box>
}
