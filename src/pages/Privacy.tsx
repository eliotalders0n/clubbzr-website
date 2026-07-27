'use client'

import { Link } from 'react-router-dom'
import {
  Box,
  Container,
  Heading,
  Text,
  VStack,
} from '@chakra-ui/react'

import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'

export default function Privacy() {
  return (
    <Box bg="gray.950" minH="100vh">
      <Header />

      <Box as="main" pt={32} pb={20}>
        <Container maxW="800px" px={{ base: 6, md: 12 }}>
          <Heading
            as="h1"
            fontSize={{ base: '2.5rem', md: '3.5rem' }}
            color="white"
            fontFamily="heading"
            mb={4}
          >
            Privacy Policy
          </Heading>

          <Text color="whiteAlpha.500" mb={12}>
            Last updated: June 2026
          </Text>

          <VStack align="stretch" gap={8} color="whiteAlpha.700" fontSize="md" lineHeight="tall">
            <Box>
              <Heading as="h2" fontSize="xl" color="white" fontFamily="heading" mb={4}>
                Overview
              </Heading>
              <Text>
                At Club BZR, we respect your privacy and are committed to protecting your personal data. This policy explains how we collect, use, and safeguard your information when you use our platform.
              </Text>
            </Box>

            <Box>
              <Heading as="h2" fontSize="xl" color="white" fontFamily="heading" mb={4}>
                Information We Collect
              </Heading>
              <Text mb={3}>
                We collect information you provide directly:
              </Text>
              <VStack align="stretch" gap={2} pl={4} mb={4}>
                <Text>• Account information (name, email, profile details)</Text>
                <Text>• Content you create and share (artwork, posts, comments)</Text>
                <Text>• Session registrations and participation history</Text>
                <Text>• Communications with us and other users</Text>
              </VStack>
              <Text mb={3}>
                We automatically collect:
              </Text>
              <VStack align="stretch" gap={2} pl={4}>
                <Text>• Device information and browser type</Text>
                <Text>• Usage data (pages visited, features used)</Text>
                <Text>• IP address and general location</Text>
              </VStack>
            </Box>

            <Box>
              <Heading as="h2" fontSize="xl" color="white" fontFamily="heading" mb={4}>
                How We Use Your Information
              </Heading>
              <VStack align="stretch" gap={2} pl={4}>
                <Text>• To provide and improve our services</Text>
                <Text>• To personalize your experience</Text>
                <Text>• To communicate about sessions, events, and updates</Text>
                <Text>• To facilitate connections with other artists</Text>
                <Text>• To ensure platform safety and security</Text>
                <Text>• To analyze usage and improve features</Text>
              </VStack>
            </Box>

            <Box>
              <Heading as="h2" fontSize="xl" color="white" fontFamily="heading" mb={4}>
                Information Sharing
              </Heading>
              <Text mb={3}>
                We do not sell your personal information. We may share data with:
              </Text>
              <VStack align="stretch" gap={2} pl={4}>
                <Text>• Other users (profile information, public content)</Text>
                <Text>• Service providers who help operate our platform</Text>
                <Text>• Legal authorities when required by law</Text>
              </VStack>
            </Box>

            <Box>
              <Heading as="h2" fontSize="xl" color="white" fontFamily="heading" mb={4}>
                Your Content
              </Heading>
              <Text>
                Artwork and content you share may be visible to other community members based on your privacy settings. You can control the visibility of your profile and submissions. Even if you delete content, it may persist in backups for a limited time.
              </Text>
            </Box>

            <Box>
              <Heading as="h2" fontSize="xl" color="white" fontFamily="heading" mb={4}>
                Data Security
              </Heading>
              <Text>
                We implement appropriate security measures to protect your data, including encryption, secure servers, and access controls. However, no method of transmission over the internet is 100% secure, and we cannot guarantee absolute security.
              </Text>
            </Box>

            <Box>
              <Heading as="h2" fontSize="xl" color="white" fontFamily="heading" mb={4}>
                Cookies and Tracking
              </Heading>
              <Text>
                We use cookies and similar technologies to remember your preferences, analyze usage, and improve our services. You can manage cookie preferences through your browser settings, though some features may not work properly without cookies.
              </Text>
            </Box>

            <Box>
              <Heading as="h2" fontSize="xl" color="white" fontFamily="heading" mb={4}>
                Your Rights
              </Heading>
              <Text mb={3}>
                You have the right to:
              </Text>
              <VStack align="stretch" gap={2} pl={4}>
                <Text>• Access your personal data</Text>
                <Text>• Correct inaccurate information</Text>
                <Text>• Delete your account and data</Text>
                <Text>• Export your data</Text>
                <Text>• Opt out of marketing communications</Text>
              </VStack>
            </Box>

            <Box>
              <Heading as="h2" fontSize="xl" color="white" fontFamily="heading" mb={4}>
                Data Retention
              </Heading>
              <Text>
                We retain your data as long as your account is active or as needed to provide services. After account deletion, we may retain certain data for legal compliance, dispute resolution, or legitimate business purposes for a limited period.
              </Text>
            </Box>

            <Box>
              <Heading as="h2" fontSize="xl" color="white" fontFamily="heading" mb={4}>
                Children's Privacy
              </Heading>
              <Text>
                Club BZR is not intended for users under 13 years of age. We do not knowingly collect personal information from children under 13. If we become aware of such collection, we will delete the information promptly.
              </Text>
            </Box>

            <Box>
              <Heading as="h2" fontSize="xl" color="white" fontFamily="heading" mb={4}>
                Changes to This Policy
              </Heading>
              <Text>
                We may update this Privacy Policy from time to time. We will notify you of significant changes via email or platform notification. Your continued use after changes indicates acceptance of the updated policy.
              </Text>
            </Box>

            <Box>
              <Heading as="h2" fontSize="xl" color="white" fontFamily="heading" mb={4}>
                Contact Us
              </Heading>
              <Text>
                For privacy-related questions or to exercise your rights, contact us at{' '}
                <Text as="span" color="brand.500">privacy@clubbzr.com</Text>
              </Text>
            </Box>

            <Box pt={8} borderTop="1px solid" borderColor="whiteAlpha.100">
              <Text color="whiteAlpha.500">
                See also our{' '}
                <Link to="/terms-of-service">
                  <Text as="span" color="brand.500" _hover={{ textDecoration: 'underline' }}>
                    Terms of Service
                  </Text>
                </Link>
              </Text>
            </Box>
          </VStack>
        </Container>
      </Box>

      <Footer />
    </Box>
  )
}
