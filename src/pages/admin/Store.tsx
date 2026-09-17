import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Heading } from '@chakra-ui/react'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { useStoreQuery } from '@/hooks/useStoreQuery'
import { StoreLoading, StoreNotice } from '@/components/features/store/StoreShell'
import { OrderList } from '@/components/features/store/OrderList'
import { storeAmount, storeCall, type StoreConfig, type StoreCursor } from '../../../lib/store'

function Controls() {
  const query = useStoreQuery<StoreConfig>('getStoreConfig')
  if (query.loading) return <StoreLoading />
  if (!query.data) return <StoreNotice error>{query.error}</StoreNotice>
  return <ControlsForm initial={query.data} />
}
function ControlsForm({ initial }: { initial: StoreConfig }) {
  const zmwAvailable = initial.zmwCheckoutAvailable ?? initial.zmwCheckoutEnabled
  const payoutsAvailable = initial.sellerPayoutsAvailable ?? initial.sellerPayoutsEnabled
  const [form, setForm] = useState({ ...initial, zmwCheckoutEnabled: initial.zmwCheckoutEnabled && zmwAvailable, sellerPayoutsEnabled: initial.sellerPayoutsEnabled && payoutsAvailable })
  const [reason, setReason] = useState('')
  const [feedback, setFeedback] = useState('')
  const [busy, setBusy] = useState(false)
  return <form className="store-panel store-stack" onSubmit={async (e) => { e.preventDefault(); setBusy(true); try { await storeCall('adminUpdateStoreSettings', { ...form, reason }); setFeedback('Store controls saved and audited.') } catch (cause) { setFeedback(cause instanceof Error ? cause.message : 'Save failed.') } finally { setBusy(false) } }}>
    <Heading as="h2" size="lg">Store capabilities</Heading><p className="store-muted">Enable Store open to allow shop setup and listings. ZMW checkout and verified seller payouts have separate controls. These settings start disabled. Turning off new sales preserves recovery and refund access for existing orders. Lenco marketplace approval is required before enabling ZMW.</p>
    {(!zmwAvailable || !payoutsAvailable) && <StoreNotice>{initial.zmwCheckoutAvailable === undefined ? 'Deploy the latest Store Functions to load ZMW availability.' : !zmwAvailable ? 'ZMW checkout and seller payouts are unavailable until Lenco marketplace approval is recorded in server configuration.' : 'Seller payouts are unavailable until the approved Lenco payout account is configured.'} You can still enable Store open and save the other controls.</StoreNotice>}
    {([['storeEnabled', 'Store open'], ['zmwCheckoutEnabled', 'ZMW checkout'], ['sellerPayoutsEnabled', 'Verified seller payouts'], ['physicalProductsEnabled', 'Physical products'], ['gatedCollectionsEnabled', 'One-time collections'], ['autoApprovalEnabled', 'Automatic approval after submission']] as const).map(([key, label]) => <label key={key}><input type="checkbox" checked={form[key]} disabled={busy || (key === 'zmwCheckoutEnabled' && !zmwAvailable) || (key === 'sellerPayoutsEnabled' && !payoutsAvailable)} onChange={(e) => setForm({ ...form, [key]: e.target.checked })} />{label}</label>)}
    <div className="store-grid">{([['minimumPriceNgwee', 'Minimum listing price (ngwee)'], ['minimumPricePoints', 'Minimum Points price'], ['minimumPayoutNgwee', 'Minimum payout (ngwee)'], ['autoApprovalHours', 'Automatic approval period (hours)']] as const).map(([key, label]) => <label key={key}>{label}<input type="number" min="1" step="1" value={form[key]} onChange={(e) => setForm({ ...form, [key]: Number(e.target.value) })} /></label>)}</div><label>Supported Zambian regions, separated by commas<input value={form.deliveryRegions.join(', ')} onChange={(e) => setForm({ ...form, deliveryRegions: e.target.value.split(',').map((v) => v.trim()) })} /></label><label>Reason for this change<textarea required minLength={10} value={reason} onChange={(e) => setReason(e.target.value)} /></label><button type="submit" className="store-button primary" disabled={busy}>{busy ? 'Saving…' : 'Save audited controls'}</button>{feedback && <StoreNotice>{feedback}</StoreNotice>}<Link to="/admin/economy">Set the platform fee in Economy →</Link>
  </form>
}
const PUBLISH_REASON = 'Published by Club BZR administration from the Store console.'
function PostingControls() {
  const query = useStoreQuery<StoreConfig>('getStoreConfig')
  const closed = query.data ? query.data.storeEnabled !== true : false
  return <div className="store-panel store-stack">
    <div className="store-actions" style={{ justifyContent: 'space-between' }}><Heading as="h2" size="lg">Releases</Heading><Link className="store-button primary" to="/admin/store/new">Create a release</Link></div>
    <p className="store-muted">Only administrators can create and publish Store releases. Everything posts under the shared Club BZR shop.</p>
    {closed && <StoreNotice>The Store is closed, so releases cannot be created or published. Open it under Controls first.</StoreNotice>}
  </div>
}
type AdminItem = { id: string; title?: string; status?: string; sellerId?: string; legalName?: string; phone?: string; operator?: string; adminApproved?: boolean; identityVerified?: boolean; amountNgwee?: number; reason?: string; actorId?: string; createdAt?: number; event?: string; error?: string; before?: { tradeFeeBasisPoints?: number }; after?: { tradeFeeBasisPoints?: number } }
function Records({ mode }: { mode: string }) {
  const [cursor, setCursor] = useState<StoreCursor>(null)
  const [status, setStatus] = useState('draft')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const query = useStoreQuery<{ items: AdminItem[]; cursor: StoreCursor }>('getStoreWorkspace', { mode, cursor, status: mode === 'admin_listings' ? status : undefined })
  async function act(name: string, input: unknown) { setBusy(true); setError(''); try { await storeCall(name, input); query.reload() } catch (cause) { setError(cause instanceof Error ? cause.message : 'Action failed.') } finally { setBusy(false) } }
  return <div className="store-stack">{mode === 'admin_listings' && <PostingControls />}{mode === 'admin_listings' && <label>Listing status<select value={status} onChange={(e) => { setStatus(e.target.value); setCursor(null) }}>{['pending_review', 'published', 'paused', 'sold_out', 'draft', 'archived'].map((s) => <option key={s} value={s}>{s.replaceAll('_', ' ')}</option>)}</select></label>}{['admin_listings', 'admin_sellers'].includes(mode) && <label>Reason for the moderation / verification action<textarea value={reason} minLength={10} onChange={(e) => setReason(e.target.value)} /></label>}{query.loading && <StoreLoading />}{(query.error || error) && <StoreNotice error>{query.error || error}</StoreNotice>}{query.data?.items.length === 0 && <StoreNotice>No records match this view.</StoreNotice>}{query.data?.items.map((item) => <div className="store-panel store-stack" key={item.id}>
    <div className="store-actions" style={{ justifyContent: 'space-between' }}><strong>{item.title || item.legalName || item.event || (item.amountNgwee !== undefined ? storeAmount(item.amountNgwee, 'ZMW') : 'Economy setting change')}</strong><span className="store-tag">{item.status || (item.adminApproved ? 'Approved seller' : mode === 'admin_sellers' ? 'Awaiting verification' : 'Audit record')}</span></div>
    {item.createdAt && <p className="store-muted">{new Date(item.createdAt).toLocaleString()}</p>}{item.error && <p>{item.error}</p>}
    {mode === 'fee_history' && <><p>{(item.before?.tradeFeeBasisPoints ?? 500) / 100}% → {(item.after?.tradeFeeBasisPoints ?? 500) / 100}%</p><p>Administrator: {item.actorId}</p><p>{item.reason || 'No platform fee change recorded.'}</p></>}
    {mode === 'admin_sellers' && <><p>{item.phone} · {item.operator}</p><p className="store-muted">Confirm identity and mobile-money account ownership using your verification procedure before approving.</p><div className="store-actions">{[true, false].map((approved) => <button key={String(approved)} className="store-button" disabled={busy || reason.length < 10} onClick={() => act('adminVerifyStoreSeller', { sellerId: item.id, approved, reason })}>{approved ? 'Verify and approve' : 'Revoke approval'}</button>)}</div></>}
    {mode === 'admin_listings' && <div className="store-actions"><Link to={`/store/${item.id}`} className="store-button">Review release</Link>
      {['draft', 'paused', 'sold_out'].includes(item.status || '') && <Link to={`/admin/store/${item.id}/edit`} className="store-button">Edit</Link>}
      {['draft', 'paused', 'sold_out', 'pending_review'].includes(item.status || '') && <button className="store-button primary" disabled={busy} onClick={() => act('moderateStoreListing', { listingId: item.id, action: 'publish', reason: reason.trim().length >= 10 ? reason : PUBLISH_REASON })}>Publish now</button>}
      {(item.status === 'pending_review' ? ['approve', 'reject', 'archive'] : item.status === 'published' ? ['pause', 'feature', 'unfeature', 'archive'] : item.status === 'archived' ? [] : ['archive']).map((action) => <button className="store-button" key={action} disabled={busy || reason.length < 10} onClick={() => act('moderateStoreListing', { listingId: item.id, action, reason })}>{action.charAt(0).toUpperCase() + action.slice(1)}</button>)}</div>}
    {mode === 'admin_payouts' && !['paid', 'failed'].includes(item.status || '') && <button disabled={busy} className="store-button" onClick={() => act('checkStorePayout', { payoutId: item.id })}>Reconcile transfer</button>}
  </div>)}<div className="store-actions">{cursor && <button className="store-button" onClick={() => setCursor(null)}>First page</button>}{query.data?.cursor && <button className="store-button" onClick={() => setCursor(query.data!.cursor)}>Next records</button>}</div></div>
}
function Summary() {
  const query = useStoreQuery<{ sales: Record<string, number>; refunds: { total: number; feesReversed: number }; pendingRefunds: number; liabilities: Record<string, number>; costs: { providerFees: number }; reconciliationDifference: number; issues: Array<{ id: string; error: string }> }>('adminStoreSummary')
  if (query.loading) return <StoreLoading />
  if (!query.data) return <StoreNotice error>{query.error}</StoreNotice>
  const d = query.data
  return <div className="store-stack"><Heading as="h2" size="lg">ZMW marketplace reconciliation</Heading><div className="store-grid">{[['Gross collected', d.sales.grossSales], ['Seller product allocation', d.sales.sellerProductPayable], ['Delivery allocation', d.sales.delivery], ['Platform fees before refunds', d.sales.platformFees], ['Confirmed refunds', d.refunds.total], ['Platform fee reversals', d.refunds.feesReversed], ['Pending refunds', d.pendingRefunds], ['Provider costs (Club BZR expense)', d.costs.providerFees], ['Seller pending', d.liabilities.pending], ['Seller available', d.liabilities.available], ['Payout pending', d.liabilities.payoutPending], ['Paid to sellers', d.liabilities.paid]].map(([label, value]) => <div className="store-panel store-stack" key={label}><span>{label}</span><strong className="store-price">{storeAmount(Number(value || 0), 'ZMW')}</strong></div>)}</div><StoreNotice error={d.reconciliationDifference !== 0}>Gross sales minus seller product allocation, delivery and platform fees: {storeAmount(d.reconciliationDifference, 'ZMW')}. Provider costs are paid by Club BZR and accounted for separately. Confirmed refunds reverse both seller allocation and platform fees.</StoreNotice><Link to="/admin/payments">View the authoritative Lenco account balance in Payments →</Link><Heading as="h2" size="lg">Recovery requiring attention</Heading>{d.issues.map((issue) => <StoreNotice error key={issue.id}>{issue.id}: {issue.error}</StoreNotice>)}{!d.issues.length && <p className="store-muted">No open Store recovery issues.</p>}</div>
}
export default function StoreAdmin() {
  const [params, setParams] = useSearchParams()
  const requestedTab = params.get('tab') || 'admin_listings'
  const tab = ['admin_listings', 'admin_orders', 'admin_disputes', 'summary', 'admin_payouts', 'admin_sellers', 'admin_events', 'fee_history', 'controls'].includes(requestedTab) ? requestedTab : 'admin_listings'
  const setTab = (next: string) => setParams({ tab: next }, { replace: true })
  return <AdminLayout><div className="store-ui" style={{ padding: '32px 24px', color: '#faf9f6' }}><Heading as="h1" size="2xl" mb={3}>Store administration</Heading><p className="store-muted">Review releases, fulfilment, seller liabilities and the controls that govern new orders.</p><div className="store-actions" style={{ margin: '28px 0' }}>{[['admin_listings', 'Listings'], ['admin_orders', 'Orders'], ['admin_disputes', 'Disputes'], ['summary', 'ZMW reconciliation'], ['admin_payouts', 'Payouts'], ['admin_sellers', 'Seller verification'], ['admin_events', 'Provider events'], ['fee_history', 'Fee history'], ['controls', 'Controls']].map(([key, label]) => <button key={key} className={`store-button ${tab === key ? 'primary' : ''}`} onClick={() => setTab(key)}>{label}</button>)}</div>{tab === 'controls' ? <Controls /> : tab === 'summary' ? <Summary /> : tab === 'admin_orders' || tab === 'admin_disputes' ? <OrderList mode={tab} /> : <Records key={tab} mode={tab} />}</div></AdminLayout>
}
