import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useStoreQuery } from '@/hooks/useStoreQuery'
import { StoreLoading, StoreNotice } from './StoreShell'
import { storeAmount, type StoreCursor, type StoreOrder } from '../../../../lib/store'

export function OrderList({ mode }: { mode: 'purchases' | 'sales' | 'admin_orders' | 'admin_disputes' }) {
  const [cursors, setCursors] = useState<StoreCursor[]>([null])
  const { data, loading, error } = useStoreQuery<{ items: StoreOrder[]; cursor: StoreCursor }>('getStoreWorkspace', { mode, cursor: cursors.at(-1) })
  return <>{loading && <StoreLoading />}{error && <StoreNotice error>{error}</StoreNotice>}{data?.items.length === 0 && <StoreNotice>No orders here yet.</StoreNotice>}<div className="store-stack">{data?.items.map((order) => <Link key={order.id} to={`/store/orders/${order.id}`} className="store-panel"><div className="store-actions" style={{ justifyContent: 'space-between' }}><strong>{order.listing.title}</strong><span className="store-tag">{order.status.replaceAll('_', ' ')}</span></div><div className="store-actions" style={{ marginTop: 16, justifyContent: 'space-between' }}><span>{storeAmount(order.price.buyerTotal, order.paymentRail)}</span><span className="store-muted">{new Date(order.createdAt).toLocaleDateString()} · View order →</span></div></Link>)}</div><div className="store-actions" style={{ marginTop: 24 }}>{cursors.length > 1 && <button className="store-button" onClick={() => setCursors(cursors.slice(0, -1))}>Previous</button>}{data?.cursor && <button className="store-button" onClick={() => setCursors([...cursors, data.cursor])}>Next orders</button>}</div></>
}
