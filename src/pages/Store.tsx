import { Box, Heading } from '@chakra-ui/react'
import { StoreShell } from '@/components/features/store/StoreShell'
import { StoreCatalog } from '@/components/features/store/StoreCatalog'
export default function Store() {
  return <StoreShell title="Made by our community." description="Digital releases, original art and work made just for you. Discover the artists behind each piece, and support what they make.">
    <Box mb={12}><Heading as="h2" size="xl" mb={6}>Featured releases</Heading><StoreCatalog featured /></Box>
    <Heading as="h2" size="xl" mb={6}>Explore recent releases</Heading><StoreCatalog />
  </StoreShell>
}
