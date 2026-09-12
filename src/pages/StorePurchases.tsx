import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useStoreQuery } from '@/hooks/useStoreQuery'
import { OrderList } from '@/components/features/store/OrderList'
import { StoreLoading, StoreNotice, StoreShell } from '@/components/features/store/StoreShell'
import type { StoreCursor } from '../../lib/store'
function Library() {
  const [cursor, setCursor] = useState<StoreCursor>(null)
  const { data, loading, error } = useStoreQuery<{ items: Array<{ id: string; title: string; listingId: string; version: number; revokedAt: number | null; downloadCount: number; grantedAt: number }>; cursor: StoreCursor }>('getStoreWorkspace', { mode: 'library', cursor })
  return <>{loading && <StoreLoading />}{error && <StoreNotice error>{error}</StoreNotice>}{data?.items.length === 0 && <StoreNotice>Your completed digital releases, bespoke files and collections will appear here.</StoreNotice>}<div className="store-grid">{data?.items.map((g) => <div className="store-panel store-stack" key={g.id}><strong>{g.revokedAt ? 'Access revoked' : g.title} · version {g.version}</strong><span className="store-muted">Purchased {new Date(g.grantedAt).toLocaleDateString()} · {g.downloadCount} download requests</span><Link to={`/store/orders/${g.id}`} className="store-button">Open files and purchase</Link></div>)}</div><div className="store-actions" style={{ marginTop: 24 }}>{cursor && <button className="store-button" onClick={() => setCursor(null)}>First page</button>}{data?.cursor && <button className="store-button" onClick={() => setCursor(data.cursor)}>Next purchases</button>}</div></>
}
export default function StorePurchases() {
  const { firebaseUser, initialized } = useAuth()
  const library = useLocation().pathname.endsWith('/library')
  return <StoreShell title={library ? 'Your download library.' : 'Your purchases.'} description={library ? 'Access the releases you have purchased and the latest published updates to your collections.' : 'Follow your requests, approve artwork and keep track of delivery.'}>{!initialized ? <StoreLoading /> : !firebaseUser ? <StoreNotice><Link to="/auth/login">Sign in to view your purchases.</Link></StoreNotice> : library ? <Library /> : <OrderList mode="purchases" />}</StoreShell>
}
