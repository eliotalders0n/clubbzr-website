'use client'

import { Link } from 'react-router-dom'
import {
  Box,
  Button,
  Container,
  Grid,
  Heading,
  HStack,
  SimpleGrid,
  Text,
  VStack,
} from '@chakra-ui/react'
import { ArrowRight, Mail, Phone } from 'lucide-react'

import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { SITE_CONFIG } from '@/lib/constants'

const CONTACT_EMAIL = 'clubbzrzm@gmail.com'
const CONTACT_PHONE = '0770891661'
const TIKTOK_URL = 'https://www.tiktok.com/@clubbzr'

export default function About() {
  return (
    <Box bg="gray.950" minH="100vh">
      <Header />

      <Box as="main" pt={32} pb={20}>
        <Container maxW="1180px" px={{ base: 6, md: 12 }}>
          <Text color="brand.500" fontSize="sm" textTransform="uppercase" letterSpacing="0.16em" mb={4}>
            About us
          </Text>
          <Heading as="h1" color="white" fontFamily="heading" fontSize={{ base: '3rem', md: '5rem' }} lineHeight={1} mb={8}>
            What is Club BZR?
          </Heading>

          <Grid templateColumns={{ base: '1fr', lg: '1.35fr 0.65fr' }} gap={{ base: 10, lg: 16 }} alignItems="start">
            <VStack align="stretch" gap={6}>
              <Text color="whiteAlpha.800" fontSize={{ base: 'lg', md: 'xl' }} lineHeight="tall">
                Club BZR is an art initiative and creative community platform dedicated to bringing people together
                through shared creative experiences.
              </Text>
              <Text color="whiteAlpha.700" lineHeight="tall">
                The project was created as a space for experimentation, collaboration, and dialogue between artists
                working across different mediums. While the platform supports artists in developing their practices, it
                also intentionally welcomes non-artists and art enthusiasts who are curious about creativity and wish to
                engage with art in a more accessible and hands-on way.
              </Text>

              <Box pt={6}>
                <Heading as="h2" color="white" fontFamily="heading" fontSize="2xl" mb={4}>
                  Founders
                </Heading>
                <VStack align="stretch" gap={3} color="whiteAlpha.750">
                  <Text>Bdoublex (Baxter Mwamba) - Fine Artist</Text>
                  <Text>Retro 99 (Tiyamika Msanide) - Musician and Fine Artist</Text>
                </VStack>
              </Box>
            </VStack>

            <Box bg="gray.900" border="1px solid" borderColor="whiteAlpha.100" borderRadius="lg" p={6}>
              <Heading as="h2" color="white" fontFamily="heading" fontSize="xl" mb={5}>
                Contact information
              </Heading>
              <VStack align="stretch" gap={4}>
                <HStack gap={3} color="whiteAlpha.800">
                  <Mail size={18} />
                  <a href={`mailto:${CONTACT_EMAIL}`}>
                    <Text as="span" color="brand.500">
                      {CONTACT_EMAIL}
                    </Text>
                  </a>
                </HStack>
                <HStack gap={3} color="whiteAlpha.800">
                  <Phone size={18} />
                  <a href={`tel:${CONTACT_PHONE}`}>
                    <Text as="span" color="brand.500">
                      {CONTACT_PHONE}
                    </Text>
                  </a>
                </HStack>
              </VStack>

              <SimpleGrid columns={2} gap={3} mt={8}>
                <Button asChild bg="whiteAlpha.100" color="white" borderRadius="full" _hover={{ bg: 'whiteAlpha.200' }}>
                  <a href={SITE_CONFIG.social.instagram} target="_blank" rel="noreferrer">
                    Instagram
                  </a>
                </Button>
                <Button asChild bg="whiteAlpha.100" color="white" borderRadius="full" _hover={{ bg: 'whiteAlpha.200' }}>
                  <a href={TIKTOK_URL} target="_blank" rel="noreferrer">
                    TikTok
                  </a>
                </Button>
              </SimpleGrid>
            </Box>
          </Grid>

          <Box mt={16} pt={10} borderTop="1px solid" borderColor="whiteAlpha.100">
            <Button asChild bg="brand.500" color="white" borderRadius="full" px={6} _hover={{ bg: 'brand.600' }}>
              <Link to="/">
                Back to home
                <ArrowRight size={18} />
              </Link>
            </Button>
          </Box>
        </Container>
      </Box>

      <Footer />
    </Box>
  )
}
