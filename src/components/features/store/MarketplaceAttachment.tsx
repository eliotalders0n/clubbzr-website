import { useStoreQuery } from '@/hooks/useStoreQuery'
import { ListingCard } from './ListingCard'
import { StoreNotice } from './StoreShell'
import type { StoreListing } from '../../../../lib/store'
export function MarketplaceAttachment({ listingId }: { listingId: string }) {
  const { data, error, loading } = useStoreQuery<{ listing: StoreListing | null; unavailable?: string }>('getStoreListing', { listingId })
  if (loading) return <StoreNotice>Loading release…</StoreNotice>
  if (error || !data?.listing) return <StoreNotice>{data?.unavailable || 'This release is currently unavailable.'}</StoreNotice>
  return <div style={{ margin: '16px 0' }}><ListingCard listing={data.listing} /></div>
}
