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

export default function Terms() {
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
            Terms of Service
          </Heading>

          <Text color="whiteAlpha.500" mb={12}>
            Last updated: June 2026
          </Text>

          <VStack align="stretch" gap={8} color="whiteAlpha.700" fontSize="md" lineHeight="tall">
            <Box>
              <Heading as="h2" fontSize="xl" color="white" fontFamily="heading" mb={4}>
                1. Acceptance of Terms
              </Heading>
              <Text>
                By accessing and using Club BZR ("the Platform"), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our services.
              </Text>
            </Box>

            <Box>
              <Heading as="h2" fontSize="xl" color="white" fontFamily="heading" mb={4}>
                2. Description of Service
              </Heading>
              <Text>
                Club BZR is a creative community platform that provides spaces for artists to connect, collaborate, and participate in sessions, workshops, and creative challenges ("Side Quests"). We facilitate community engagement but do not guarantee any specific outcomes from participation.
              </Text>
            </Box>

            <Box>
              <Heading as="h2" fontSize="xl" color="white" fontFamily="heading" mb={4}>
                3. User Accounts
              </Heading>
              <Text mb={3}>
                To access certain features, you may need to create an account. You agree to:
              </Text>
              <VStack align="stretch" gap={2} pl={4}>
                <Text>• Provide accurate and complete information</Text>
                <Text>• Maintain the security of your account credentials</Text>
                <Text>• Notify us immediately of any unauthorized access</Text>
                <Text>• Be responsible for all activities under your account</Text>
              </VStack>
            </Box>

            <Box>
              <Heading as="h2" fontSize="xl" color="white" fontFamily="heading" mb={4}>
                4. User Content
              </Heading>
              <Text mb={3}>
                You retain ownership of content you create and share on Club BZR. By posting content, you grant us a non-exclusive, worldwide license to display, distribute, and promote your content within the Platform and for marketing purposes.
              </Text>
              <Text>
                You are responsible for ensuring your content does not infringe on others' intellectual property rights or violate any laws.
              </Text>
            </Box>

            <Box>
              <Heading as="h2" fontSize="xl" color="white" fontFamily="heading" mb={4}>
                5. Community Guidelines
              </Heading>
              <Text mb={3}>
                Users agree to:
              </Text>
              <VStack align="stretch" gap={2} pl={4}>
                <Text>• Treat all community members with respect</Text>
                <Text>• Not post harmful, offensive, or illegal content</Text>
                <Text>• Not harass, bully, or discriminate against others</Text>
                <Text>• Not spam or engage in deceptive practices</Text>
                <Text>• Respect the creative work of other artists</Text>
              </VStack>
            </Box>

            <Box>
              <Heading as="h2" fontSize="xl" color="white" fontFamily="heading" mb={4}>
                6. Sessions and Events
              </Heading>
              <Text>
                Participation in sessions, workshops, and events is subject to availability. We reserve the right to modify, reschedule, or cancel events. Facilitators and participants are expected to maintain a supportive and inclusive environment.
              </Text>
            </Box>

            <Box>
              <Heading as="h2" fontSize="xl" color="white" fontFamily="heading" mb={4}>
                7. Intellectual Property
              </Heading>
              <Text>
                The Club BZR name, logo, and platform design are our intellectual property. You may not use our branding without written permission. Side Quest prompts and session materials remain the property of their respective creators or Club BZR.
              </Text>
            </Box>

            <Box>
              <Heading as="h2" fontSize="xl" color="white" fontFamily="heading" mb={4}>
                8. Limitation of Liability
              </Heading>
              <Text>
                Club BZR is provided "as is" without warranties of any kind. We are not liable for any indirect, incidental, or consequential damages arising from your use of the Platform. Our total liability shall not exceed the amount you have paid us, if any, in the past twelve months.
              </Text>
            </Box>

            <Box>
              <Heading as="h2" fontSize="xl" color="white" fontFamily="heading" mb={4}>
                9. Termination
              </Heading>
              <Text>
                We may suspend or terminate your account for violations of these terms or for any reason at our discretion. You may delete your account at any time through your account settings.
              </Text>
            </Box>

            <Box>
              <Heading as="h2" fontSize="xl" color="white" fontFamily="heading" mb={4}>
                10. Changes to Terms
              </Heading>
              <Text>
                We may update these terms from time to time. Continued use of the Platform after changes constitutes acceptance of the new terms. We will notify users of significant changes via email or platform notification.
              </Text>
            </Box>

            <Box>
              <Heading as="h2" fontSize="xl" color="white" fontFamily="heading" mb={4}>
                11. Contact
              </Heading>
              <Text>
                For questions about these Terms of Service, please contact us at{' '}
                <Text as="span" color="brand.500">hello@clubbzr.com</Text>
              </Text>
            </Box>

            <Box pt={8} borderTop="1px solid" borderColor="whiteAlpha.100">
              <Text color="whiteAlpha.500">
                See also our{' '}
                <Link to="/privacy-policy">
                  <Text as="span" color="brand.500" _hover={{ textDecoration: 'underline' }}>
                    Privacy Policy
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
