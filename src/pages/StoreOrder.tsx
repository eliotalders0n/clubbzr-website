import { useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Box, Flex, Grid, Heading, Text } from '@chakra-ui/react'
import { useAuth } from '@/contexts/AuthContext'
import { useStoreQuery } from '@/hooks/useStoreQuery'
import { StoreLoading, StoreNotice, StoreShell } from '@/components/features/store/StoreShell'
import { StoreFiles } from '@/components/features/store/StoreFiles'
import { parseStorePrice, storeAmount, storeCall, storeKey, type StoreAsset, type StoreOrder as Order } from '../../lib/store'

type Detail = { resources: { files: Array<{ name: string; size: number; contentType: string }>; posts: Array<{ id: string; title: string; body: string }> } | null; order: Order; events: Array<{ id: string; from: string; to: string; createdAt: number; detail: { message?: string } }>; messages: Array<{ id: string; authorId: string; content: string; createdAt: number }> }
export default function StoreOrder() {
  const { orderId = '' } = useParams()
  const { firebaseUser, initialized, hasRole } = useAuth()
  const query = useStoreQuery<Detail>('getStoreOrder', { orderId }, !!firebaseUser)
  const order = query.data?.order
  const [action, setAction] = useState('')
  const [message, setMessage] = useState('')
  const [category, setCategory] = useState('quality')
  const [files, setFiles] = useState<StoreAsset[]>([])
  const [proof, setProof] = useState<StoreAsset[]>([])
  const [method, setMethod] = useState('')
  const [reference, setReference] = useState('')
  const [refundFee, setRefundFee] = useState('')
  const [chat, setChat] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const key = useRef(storeKey())
  async function run(name: string, input: unknown) {
    if (busy) return
    setBusy(true); setError('')
    try { await storeCall(name, input); key.current = storeKey(); setAction(''); setMessage(''); setChat(''); setFiles([]); setProof([]); query.reload() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'The action could not be completed.') }
    finally { setBusy(false) }
  }
  const buyer = order?.buyerId === firebaseUser?.uid
  const seller = order?.sellerId === firebaseUser?.uid
  const isAdmin = hasRole(['admin'])
  const actions: Array<[string, string]> = []
  if (order) {
    if (order.status === 'pending_acceptance') { if (seller) actions.push(['accept', 'Accept order'], ['reject', 'Reject and refund']); if (buyer) actions.push(['cancel', 'Cancel request']) }
    if (seller && order.status === 'accepted') actions.push(['start', 'Start work'])
    if (seller && order.kind === 'bespoke_request' && ['accepted', 'in_progress', 'revision_requested'].includes(order.status)) actions.push(['submit', 'Submit artwork'])
    if (buyer && order.status === 'submitted' && order.revisionCount < order.listing.fulfilment.revisionRounds) actions.push(['revise', 'Request revision'])
    if (seller && order.kind === 'physical_original' && ['accepted', 'preparing'].includes(order.status)) actions.push(order.delivery?.region === 'pickup' ? ['ready', 'Ready for collection'] : ['dispatch', 'Mark dispatched'])
    if (buyer && ['submitted', 'dispatched', 'ready_for_collection', 'delivered'].includes(order.status)) actions.push(['approve', order.kind === 'physical_original' ? 'Confirm received' : 'Approve final artwork'])
    if ((buyer || seller) && ['accepted', 'in_progress', 'preparing', 'submitted', 'revision_requested', 'dispatched', 'ready_for_collection', 'delivered'].includes(order.status)) actions.push(['dispute', 'Open dispute'])
    if (isAdmin && order.status === 'disputed') actions.push(['resolve_release', 'Resolve: release payment'], ['resolve_refund', 'Resolve: full refund'])
    if (isAdmin && ['paid', 'completed'].includes(order.status)) actions.push(['resolve_refund', 'Full refund'])
    if (isAdmin && order.status === 'refund_pending') actions.push(['confirm_refund', 'Record confirmed refund'])
  }
  const privateFile = async (section: string, index: number) => {
    try { const result = await storeCall<{ url: string }>('getStoreOrderAsset', { orderId, section, index }); window.open(result.url, '_blank', 'noopener,noreferrer') }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'File access unavailable.') }
  }
  return <StoreShell title={order?.listing.title || 'Your order'} description={order ? `Order ${order.id.slice(0, 12)} · ${order.status.replaceAll('_', ' ')}` : undefined}>
    {(!initialized || query.loading) && <StoreLoading />}{initialized && !firebaseUser && <StoreNotice><Link to="/auth/login">Sign in to view this order.</Link></StoreNotice>}{(error || query.error) && <StoreNotice error>{error || query.error}</StoreNotice>}
    {order && <Grid templateColumns={{ base: '1fr', lg: 'minmax(0,1.5fr) minmax(0,1fr)' }} gap={7}><div className="store-stack">
      {order.status === 'payment_pending' && <StoreNotice>Authorize the mobile-money request on your phone. Your order is waiting for verified payment.<div className="store-actions" style={{ marginTop: 16 }}><button disabled={busy} className="store-button" onClick={() => run('checkStorePayment', { orderId })}>Check payment</button></div></StoreNotice>}
      {order.status === 'paid' && <StoreNotice>Payment received. Delivery is waiting for recovery.<button className="store-button" disabled={busy} onClick={() => run('retryStoreFulfilment', { orderId })}>Retry fulfilment</button></StoreNotice>}
      {order.status === 'refund_pending' && <StoreNotice>A full refund is being arranged. This order will show refunded after the provider or an administrator confirms the return.</StoreNotice>}
      {order.status === 'pending_acceptance' && <StoreNotice>The artist has until {new Date(order.expiresAt).toLocaleString()} to accept. Unaccepted requests are refunded automatically; ZMW refunds await confirmation.</StoreNotice>}
      {order.status === 'completed' && buyer && ['digital_release', 'bespoke_request', 'gated_collection'].includes(order.kind) && <div className="store-panel store-stack"><Heading as="h2" size="lg">Your files</Heading>{(query.data?.resources?.files || []).map((file, i) => <button key={i} className="store-button" disabled={busy} onClick={async () => {
        setBusy(true); setError('')
        try { const result = await storeCall<{ url: string }>('downloadStoreAsset', { orderId, fileIndex: i, idempotencyKey: storeKey() }); window.location.assign(result.url) }
        catch (cause) { setError(cause instanceof Error ? cause.message : 'Download unavailable.') }
        finally { setBusy(false) }
      }}>Download {file.name}</button>)}{query.data?.resources?.posts.map((post) => <article key={post.id}><Heading as="h3" size="md" mb={3}>{post.title}</Heading><Text whiteSpace="pre-wrap">{post.body}</Text></article>)}{!query.data?.resources && <p className="store-muted">This collection is currently unavailable. Your purchase record is preserved.</p>}</div>}
      {order.submission && <div className="store-panel store-stack"><Heading as="h2" size="lg">Artist submission</Heading><p>{order.submission.message}</p><p className="store-muted">Submitted {new Date(order.submission.submittedAt).toLocaleString()} · revision {order.revisionCount} of {order.listing.fulfilment.revisionRounds}</p>{order.submission.preview && <button className="store-button" onClick={() => privateFile('preview', 0)}>View final preview</button>}</div>}
      {order.dispatch && <div className="store-panel"><strong>{order.dispatch.method}</strong><p>{order.dispatch.reference}</p>{order.dispatch.proof && <button className="store-button" onClick={() => privateFile('dispatch', 0)}>View dispatch proof</button>}</div>}
      {order.dispute && <StoreNotice><strong>Dispute: {order.dispute.category}</strong><p>{order.dispute.explanation}</p>{order.dispute.evidence.map((_, i) => <button key={i} className="store-button" onClick={() => privateFile('dispute', i)}>View evidence {i + 1}</button>)}</StoreNotice>}
      <div className="store-actions">{actions.map(([value, label]) => <button disabled={busy} className="store-button" key={value} onClick={() => { setAction(value); key.current = storeKey(); setError('') }}>{label}</button>)}</div>
      {action && <form className="store-panel store-stack" onSubmit={(event) => { event.preventDefault(); try { void run('actOnStoreOrder', { orderId, action, idempotencyKey: key.current, message, reason: message, category, files, proof: proof[0] || null, evidence: action === 'dispute' ? files : [], method, reference, providerRefundId: reference, refundFeeNgwee: action === 'confirm_refund' && refundFee ? parseStorePrice(refundFee) : null }) } catch (cause) { setError(cause instanceof Error ? cause.message : 'Invalid refund fee.') } }}>
        <Heading as="h2" size="lg">{actions.find(([value]) => value === action)?.[1]}</Heading>{action === 'approve' && <p>Approval releases the held payment to the artist. Confirm that you received the item or are satisfied with the final artwork.</p>}
        {['submit', 'revise', 'dispute', 'resolve_release', 'resolve_refund', 'confirm_refund'].includes(action) && <label>{action.startsWith('resolve') || action === 'confirm_refund' ? 'Decision and reason' : 'Message / instructions'}<textarea required minLength={action === 'dispute' ? 20 : 10} value={message} onChange={(e) => setMessage(e.target.value)} /></label>}
        {action === 'dispute' && <><label>Reason category<select value={category} onChange={(e) => setCategory(e.target.value)}><option value="quality">Quality / scope</option><option value="not_received">Not received</option><option value="damaged">Damaged item</option><option value="conduct">Conduct</option></select></label><StoreFiles orderId={orderId} label="Private evidence" files={files} onChange={setFiles} /></>}
        {action === 'submit' && <><StoreFiles orderId={orderId} label="Protected final files" files={files} onChange={setFiles} /><StoreFiles orderId={orderId} multiple={false} label="Final preview" files={proof} onChange={setProof} /></>}
        {action === 'dispatch' && <><label>Carrier or delivery method<input required value={method} onChange={(e) => setMethod(e.target.value)} /></label><label>Tracking / reference (optional)<input value={reference} onChange={(e) => setReference(e.target.value)} /></label><StoreFiles orderId={orderId} multiple={false} label="Dispatch photo or receipt" files={proof} onChange={setProof} /></>}
        {action === 'confirm_refund' && <><label>Confirmed Lenco / manual refund reference<input required value={reference} onChange={(e) => setReference(e.target.value)} /></label><label>Provider refund cost in ZMW, if confirmed<input inputMode="decimal" placeholder="Leave blank if unknown" value={refundFee} onChange={(e) => setRefundFee(e.target.value)} /></label><p className="store-muted">Club BZR covers this cost. It does not reduce the buyer’s full refund.</p></>}
        <div className="store-actions"><button className="store-button primary" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Confirm action'}</button><button className="store-button" type="button" onClick={() => setAction('')}>Back</button></div>
      </form>}
      <div className="store-panel store-stack"><Heading as="h2" size="lg">Order messages</Heading><form onSubmit={(event) => { event.preventDefault(); void run('messageStoreOrder', { orderId, content: chat, idempotencyKey: key.current }) }}><label>Message the {buyer ? 'artist' : 'buyer'}<textarea required maxLength={4000} value={chat} onChange={(e) => setChat(e.target.value)} /></label><button className="store-button" disabled={busy || !chat.trim()} style={{ marginTop: 12 }}>Send message</button></form>{query.data?.messages.map((m) => <Box key={m.id} borderTop="1px solid" borderColor="whiteAlpha.200" pt={4}><Text fontSize="xs" color="whiteAlpha.500">{m.authorId === firebaseUser?.uid ? 'You' : m.authorId === order.sellerId ? 'Artist' : 'Buyer'} · {new Date(m.createdAt).toLocaleString()}</Text><Text whiteSpace="pre-wrap" mt={2}>{m.content}</Text></Box>)}</div>
    </div><div className="store-stack"><div className="store-panel store-stack"><Heading as="h2" size="lg">Purchase breakdown</Heading>{[['Product', order.price.productSubtotal], ['Delivery', order.price.deliveryCharge], ['Platform fee (included)', order.price.platformFee], ['Buyer total', order.price.buyerTotal], ['Seller receives', order.price.sellerPayable]].map(([label, value]) => <Flex key={label} justify="space-between" gap={4}><span>{label}</span><strong>{storeAmount(Number(value), order.paymentRail)}</strong></Flex>)}<p className="store-muted">Fee locked at {order.price.feeBasisPoints / 100}%. {order.paymentRail === 'POINT' ? 'Points cannot be withdrawn.' : 'ZMW is held as an internal seller payable until completion.'}</p><p>{order.listing.licence.text}</p><Link to={`/store/${order.listingId}`}>View release</Link></div>
      {Object.keys(order.brief).length > 0 && <div className="store-panel store-stack"><Heading as="h2" size="md">Agreed brief</Heading>{order.listing.fulfilment.questions.map((q, i) => <div key={q.id}><strong>{q.label}</strong><p>{typeof order.brief[q.id] === 'object' && !Array.isArray(order.brief[q.id]) ? <button className="store-button" onClick={() => privateFile('brief', i)}>View reference image</button> : Array.isArray(order.brief[q.id]) ? (order.brief[q.id] as string[]).join(', ') : String(order.brief[q.id] || '—')}</p></div>)}</div>}
      {order.delivery && <div className="store-panel store-stack"><Heading as="h2" size="md">Private delivery details</Heading><p>{order.delivery.recipient} · {order.delivery.phone}</p><p>{order.delivery.region} · {order.delivery.address}</p><p>{order.delivery.instructions}</p></div>}
      <div className="store-panel store-stack"><Heading as="h2" size="md">Order history</Heading>{query.data?.events.map((e) => <div key={e.id}><p>{e.to.replaceAll('_', ' ')}</p><p className="store-muted">{new Date(e.createdAt).toLocaleString()}</p>{e.detail.message && <p>{e.detail.message}</p>}</div>)}</div>
    </div></Grid>}
  </StoreShell>
}
