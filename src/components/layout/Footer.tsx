'use client'

import { Link } from 'react-router-dom'
import {
  Box,
  Container,
  Flex,
  HStack,
  Text,
  Image,
} from '@chakra-ui/react'

import logoWhite from '@/assets/logos/Club BZR logo (WHITE).png'

const NAV_LINKS = [
  { label: 'Community', href: '/community/wall' },
  { label: 'Sessions', href: '/sessions' },
  { label: 'Side Quests', href: '/quests' },
  { label: 'Artists', href: '/artists' },
  { label: 'About', href: '/about' },
]

const LEGAL_LINKS = [
  { label: 'Privacy Policy', href: '/privacy-policy' },
  { label: 'Terms of Service', href: '/terms-of-service' },
]

export function Footer() {
  return (
    <Box as="footer" py={16} bg="gray.950" borderTop="1px solid" borderColor="whiteAlpha.100">
      <Container maxW="1440px" px={{ base: 6, md: 12, lg: 16, xl: 20 }}>
        <Flex
          direction={{ base: 'column', md: 'row' }}
          justify="space-between"
          align="center"
          gap={8}
        >
          <Image src={logoWhite} alt="Club BZR" h={{ base: 20, md: 22 }} />

          <HStack as="nav" gap={8} flexWrap="wrap" justify="center">
            {NAV_LINKS.map((link) => (
              <Link key={link.href} to={link.href}>
                <Text color="whiteAlpha.500" fontSize="sm" _hover={{ color: 'white' }}>
                  {link.label}
                </Text>
              </Link>
            ))}
          </HStack>

          <Flex direction="column" align={{ base: 'center', md: 'flex-end' }} gap={3}>
            <Text color="whiteAlpha.300" fontSize="sm">
              © 2026 Club BZR
            </Text>
            <HStack as="nav" gap={5} flexWrap="wrap" justify={{ base: 'center', md: 'flex-end' }}>
              {LEGAL_LINKS.map((link) => (
                <Link key={link.href} to={link.href}>
                  <Text color="whiteAlpha.450" fontSize="xs" _hover={{ color: 'white' }}>
                    {link.label}
                  </Text>
                </Link>
              ))}
            </HStack>
          </Flex>
        </Flex>
      </Container>
    </Box>
  )
}
