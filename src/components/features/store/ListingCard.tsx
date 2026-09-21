import { Link } from 'react-router-dom'
import { Box, Flex, Heading, Text } from '@chakra-ui/react'
import { ArrowUpRight } from 'lucide-react'
import { STORE_SHOP_NAME, storeAmount, storeLabels, type StoreListing } from '../../../../lib/store'
import { SafeImage } from '@/components/ui/SafeImage'

export function ListingCard({ listing }: { listing: StoreListing }) {
  return <Box as="article" border="1px solid" borderColor="whiteAlpha.200" rounded="xl" overflow="hidden" bg="gray.900">
    <Link to={`/store/${listing.id}`}><Box aspectRatio={4 / 3} bg="gray.800" overflow="hidden"><SafeImage loading="lazy" src={listing.coverImage} alt={listing.title} w="full" h="full" objectFit="cover" /></Box></Link>
    <Box p={5}><Flex justify="space-between" gap={3} mb={3}><Text color="brand.400" fontSize="xs" textTransform="uppercase" letterSpacing="wide">{storeLabels[listing.productType]}</Text><Text color="whiteAlpha.600" fontSize="xs">{listing.sellerAvailable === false ? 'Artist unavailable' : listing.status === 'published' ? listing.inventory === null ? 'Available' : `${listing.inventory} available` : listing.status.replaceAll('_', ' ')}</Text></Flex>
      <Link to={`/store/${listing.id}`}><Heading as="h3" size="md" lineClamp={2}>{listing.title}</Heading></Link>
      <Text color="whiteAlpha.600" fontSize="sm" mt={2}>By {STORE_SHOP_NAME}</Text>
      <Flex justify="space-between" align="end" mt={5} gap={3}><Box>{listing.acceptedPaymentMethods.includes('ZMW') && <Text fontWeight="semibold">{storeAmount(listing.priceNgwee, 'ZMW')}</Text>}{listing.acceptedPaymentMethods.includes('POINT') && listing.pricePoints !== null && <Text color="green.300" fontSize="sm">{storeAmount(listing.pricePoints, 'POINT')}</Text>}</Box><Link aria-label={`View ${listing.title}`} to={`/store/${listing.id}`}><ArrowUpRight size={20} /></Link></Flex>
    </Box>
  </Box>
}
