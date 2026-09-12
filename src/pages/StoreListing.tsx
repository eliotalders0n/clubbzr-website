import { useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Box, Flex, Grid, Heading, Image, Text } from '@chakra-ui/react'
import { useAuth } from '@/contexts/AuthContext'
import { useStoreQuery } from '@/hooks/useStoreQuery'
import { StoreLoading, StoreNotice, StoreShell } from '@/components/features/store/StoreShell'
import { StoreCatalog } from '@/components/features/store/StoreCatalog'
import { BriefFields } from '@/components/features/store/BriefFields'
import { storeAmount, storeCall, storeKey, storeLabels, type CheckoutInput, type PaymentRail, type PriceSnapshot, type StoreConfig, type StoreListing as Listing } from '../../lib/store'

function Checkout({ listing }: { listing: Listing }) {
  const { firebaseUser } = useAuth()
  const navigate = useNavigate()
  const { data: config } = useStoreQuery<StoreConfig>('getStoreConfig')
  const [rail, setRail] = useState<PaymentRail>(listing.acceptedPaymentMethods.includes('POINT') ? 'POINT' : 'ZMW')
  const [addOnIds, setAddOnIds] = useState<string[]>([])
  const [brief, setBrief] = useState<CheckoutInput['brief']>({})
  const [delivery, setDelivery] = useState({ recipient: '', phone: '', region: listing.fulfilment.pickup ? 'pickup' : listing.fulfilment.deliveryOptions[0]?.region || '', address: '', instructions: '' })
  const [phone, setPhone] = useState('')
  const [operator, setOperator] = useState('mtn')
  const [terms, setTerms] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const pending = useRef<{ key: string; fingerprint: string } | null>(null)
  const { data: quotation, error: quoteError, loading: quoting } = useStoreQuery<{ price: PriceSnapshot }>('quoteStoreOrder', { listingId: listing.id, paymentRail: rail, addOnIds, delivery: listing.productType === 'physical_original' ? delivery : null }, !!firebaseUser && listing.status === 'published')
  const allowed = config?.storeEnabled && listing.sellerAvailable !== false && listing.status === 'published' && (rail === 'POINT' ? config.pointsCheckoutEnabled : config.zmwCheckoutEnabled)
  return <form className="store-panel store-stack" onSubmit={async (event) => {
    event.preventDefault(); if (busy || !allowed) return
    const input = { listingId: listing.id, listingVersion: listing.version, paymentRail: rail, addOnIds, brief, delivery: listing.productType === 'physical_original' ? delivery : null, termsAccepted: terms, phone, operator }
    const fingerprint = JSON.stringify(input)
    if (!pending.current || pending.current.fingerprint !== fingerprint) pending.current = { key: storeKey(), fingerprint }
    setBusy(true); setError('')
    try { const result = await storeCall<{ orderId: string }>('checkoutStoreOrder', { ...input, idempotencyKey: pending.current.key }); navigate(`/store/orders/${result.orderId}`) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Checkout failed. You can safely retry this request.') }
    finally { setBusy(false) }
  }}>
    <Heading as="h2" size="lg">{listing.productType === 'bespoke_request' ? 'Request artwork' : 'Make it yours'}</Heading>
    <fieldset><legend>Pay with</legend>{listing.acceptedPaymentMethods.map((method) => <label key={method} className="store-inline" style={{ marginBottom: 12 }}><input type="radio" name="rail" checked={rail === method} onChange={() => setRail(method)} />{method === 'POINT' ? 'Club BZR Points' : 'ZMW · mobile money'}</label>)}</fieldset>
    {listing.fulfilment.addOns.length > 0 && <fieldset><legend>Optional additions</legend>{listing.fulfilment.addOns.map((a) => <label key={a.id} className="store-inline" style={{ marginBottom: 12 }}><input type="checkbox" checked={addOnIds.includes(a.id)} onChange={(e) => setAddOnIds(e.target.checked ? [...addOnIds, a.id] : addOnIds.filter((id) => id !== a.id))} />{a.title} + {storeAmount(rail === 'POINT' ? a.pricePoints : a.priceNgwee, rail)}</label>)}</fieldset>}
    <BriefFields listing={listing} brief={brief} onChange={setBrief} />
    {listing.productType === 'physical_original' && <fieldset className="store-stack"><legend>Delivery / collection</legend><label>Region<select value={delivery.region} onChange={(e) => setDelivery({ ...delivery, region: e.target.value })}>{listing.fulfilment.pickup && <option value="pickup">Lusaka pickup</option>}{listing.fulfilment.deliveryOptions.map((d) => <option key={d.region}>{d.region}</option>)}</select></label>
      <label>Recipient name<input required value={delivery.recipient} autoComplete="name" onChange={(e) => setDelivery({ ...delivery, recipient: e.target.value })} /></label><label>Recipient phone<input required type="tel" value={delivery.phone} autoComplete="tel" onChange={(e) => setDelivery({ ...delivery, phone: e.target.value })} /></label><label>{delivery.region === 'pickup' ? 'Pickup arrangement' : 'Delivery address'}<textarea required value={delivery.address} onChange={(e) => setDelivery({ ...delivery, address: e.target.value })} /></label><label>Instructions (optional)<input value={delivery.instructions} onChange={(e) => setDelivery({ ...delivery, instructions: e.target.value })} /></label><p className="store-muted">Shared privately with the artist to fulfil your order.</p></fieldset>}
    {rail === 'ZMW' && <div className="store-stack"><label>Mobile-money number<input type="tel" required value={phone} placeholder="097…" onChange={(e) => setPhone(e.target.value)} /></label><label>Operator<select value={operator} onChange={(e) => setOperator(e.target.value)}><option value="mtn">MTN</option><option value="airtel">Airtel</option><option value="zamtel">Zamtel</option></select></label><p className="store-muted">Authorize the payment on your phone. Access follows verified payment. Club BZR covers the Lenco collection fee.</p></div>}
    {quotation && <Box as="dl" className="store-stack" fontSize="sm"><Flex justify="space-between"><dt>Product and add-ons</dt><dd>{storeAmount(quotation.price.productSubtotal, rail)}</dd></Flex><Flex justify="space-between"><dt>Delivery</dt><dd>{storeAmount(quotation.price.deliveryCharge, rail)}</dd></Flex><Flex justify="space-between" fontWeight="bold"><dt>Your total</dt><dd>{storeAmount(quotation.price.buyerTotal, rail)}</dd></Flex><Text color="whiteAlpha.500">The artist receives {storeAmount(quotation.price.sellerPayable, rail)}. Club BZR’s {quotation.price.feeBasisPoints / 100}% platform fee is included in the product price.</Text></Box>}
    <label className="store-inline"><input required type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} /><span>I accept the {listing.licence.kind} licence and <Link to="/terms" target="_blank" rel="noreferrer">Club BZR terms</Link>.</span></label>
    {quoteError && <StoreNotice error>{quoteError}</StoreNotice>}{error && <StoreNotice error>{error}</StoreNotice>}
    {!firebaseUser ? <Link className="store-button primary" to="/auth/login">Sign in to purchase</Link> : firebaseUser.uid === listing.sellerId ? <StoreNotice>This is your release. <Link to="/store/manage">Manage Shop</Link></StoreNotice> : <><button className="store-button primary" disabled={busy || quoting || !quotation || !terms || !allowed} type="submit">{busy ? 'Creating your order…' : listing.productType === 'bespoke_request' ? 'Fund artwork request' : 'Confirm purchase'}</button>{!allowed && <p className="store-muted">{listing.sellerAvailable === false ? 'The artist is currently unavailable for new orders.' : 'This payment method is currently unavailable.'}</p>}</>}
    {rail === 'POINT' && <p className="store-muted">Points are platform units and cannot be withdrawn or converted to ZMW.</p>}
  </form>
}
export default function StoreListing() {
  const { listingId = '' } = useParams()
  const { data, loading, error } = useStoreQuery<{ listing: Listing | null; unavailable?: string }>('getStoreListing', { listingId })
  const listing = data?.listing
  return <StoreShell title={listing?.title || 'Artist release'} description={listing ? `${storeLabels[listing.productType]} · by ${listing.sellerName}` : undefined}>
    {loading && <StoreLoading />}{error && <StoreNotice error>{error}</StoreNotice>}{data && !listing && <StoreNotice>{data.unavailable || 'Release unavailable.'}</StoreNotice>}
    {listing && <><Grid templateColumns={{ base: '1fr', lg: 'minmax(0,1.35fr) minmax(0,1fr)' }} gap={{ base: 7, lg: 12 }} alignItems="start"><Box><Image src={listing.coverImage} alt={listing.title} w="full" maxH="650px" objectFit="contain" bg="gray.900" rounded="xl" /><Flex gap={3} mt={4} wrap="wrap">{listing.images.map((image) => <a key={image} href={image} target="_blank" rel="noreferrer"><Image src={image} alt={`${listing.title} additional view`} boxSize="100px" objectFit="cover" rounded="lg" /></a>)}</Flex>
      <Flex align="center" gap={3} my={7}>{listing.sellerPhotoURL && <Image src={listing.sellerPhotoURL} alt="" boxSize="44px" rounded="full" />}<Link to={`/members/${listing.sellerId}`}>{listing.sellerName} · View artist</Link></Flex><Text whiteSpace="pre-wrap" color="whiteAlpha.800" lineHeight="tall">{listing.description}</Text>
      <Box mt={8}><Heading as="h2" size="lg" mb={3}>Included in this release</Heading>{listing.files.map((file, i) => <Text key={i} color="whiteAlpha.600">{file.name} · {Math.ceil(file.size / 1024)} KB</Text>)}{listing.productType === 'bespoke_request' && <Text color="whiteAlpha.600">Estimated delivery: {listing.fulfilment.estimatedDays} days · {listing.fulfilment.revisionRounds} revision rounds. The artist has 72 hours to accept your funded brief.</Text>}{listing.productType === 'physical_original' && <Text color="whiteAlpha.600">{listing.fulfilment.dimensions} · {listing.fulfilment.materials} · {listing.fulfilment.framed ? 'Framed' : 'Unframed'} · {listing.fulfilment.condition}. Preparation: {listing.fulfilment.estimatedDays} days.</Text>}{listing.productType === 'gated_collection' && <Text color="whiteAlpha.600">One purchase unlocks this collection and its published updates while it remains available.</Text>}</Box>
      <Box mt={8}><Heading as="h2" size="lg" mb={3}>{listing.licence.kind === 'personal' ? 'Personal' : 'Commercial'} licence</Heading><Text color="whiteAlpha.600">{listing.licence.text}</Text></Box>
    </Box><Checkout key={`${listing.id}:${listing.version}`} listing={listing} /></Grid><Box mt={16}><Heading as="h2" size="xl" mb={6}>More from {listing.sellerName}</Heading><StoreCatalog sellerId={listing.sellerId} /></Box></>}
  </StoreShell>
}
