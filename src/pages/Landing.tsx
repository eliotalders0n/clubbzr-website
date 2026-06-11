'use client'

import {
  Box,
  Container,
  Flex,
  Grid,
  Heading,
  Text,
  Button,
  Image,
  Input,
  Textarea,
  VStack,
  HStack,
  SimpleGrid,
  AspectRatio,
} from '@chakra-ui/react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'

import eventImg1 from '@/assets/images/events/IMG_9994.jpeg'
import eventImg2 from '@/assets/images/events/IMG_9812.jpeg'
import eventImg3 from '@/assets/images/events/IMG_9074.jpeg'
import eventImg4 from '@/assets/images/events/IMG_8408.jpeg'
import logoWhite from '@/assets/logos/Club BZR logo (WHITE).png'

const MotionBox = motion.create(Box)
const MotionFlex = motion.create(Flex)

function ChevronIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 5l7 7-7 7" />
    </svg>
  )
}

function ArrowIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 5l7 7m0 0l-7 7m7-7H3" />
    </svg>
  )
}

function HeroSection() {
  const services = [
    { num: '01', title: 'Art Sessions' },
    { num: '02', title: 'Creative Workshops' },
    { num: '03', title: 'Community Events' },
    { num: '04', title: 'Side Quests' },
  ]

  return (
    <Box as="section" minH="100vh" bg="gray.950" pt={{ base: 24, md: 32 }} pb={20}>
      <Container maxW="1440px" px={{ base: 6, md: 12, lg: 16, xl: 20 }}>
        <MotionBox
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8 }}
          mb={10}
          display="flex"
          justifyContent="center"
        >
          <Image
            src={logoWhite}
            alt="Club BZR"
            w="100%"
            maxW={{ base: '280px', md: '400px', lg: '500px' }}
            objectFit="contain"
          />
        </MotionBox>

        <Box maxW="3xl" mb={12}>

          <MotionBox
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <Text
              color="brand.500"
              fontSize="sm"
              textTransform="uppercase"
              letterSpacing="0.3em"
              mb={6}
            >
              Behind the Art
            </Text>
          </MotionBox>

          <MotionBox
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1 }}
          >
            <Heading
              as="h1"
              fontSize={{ base: '2.5rem', md: '4rem', lg: '4.5rem' }}
              lineHeight={1.1}
              color="white"
              fontFamily="heading"
              mb={8}
            >
              Curious What We've Been Creating?
            </Heading>
          </MotionBox>

          <MotionBox
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <Text color="whiteAlpha.500" fontSize={{ base: 'md', md: 'lg' }} maxW="xl" mb={8}>
              Explore art sessions, creative workshops, and community experiences that bring people together.
            </Text>
          </MotionBox>

          <MotionBox
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <HStack gap={3} flexWrap="wrap">
              <Button
                asChild
                bg="brand.500"
                color="white"
                px={6}
                py={3}
                borderRadius="full"
                fontSize="sm"
                fontWeight="medium"
                _hover={{ bg: 'brand.600' }}
                display="inline-flex"
                alignItems="center"
                gap={3}
              >
                <Link to="/auth/signup">
                  Join Club BZR
                  <Box
                    w={6}
                    h={6}
                    bg="whiteAlpha.200"
                    borderRadius="full"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                  >
                    <ArrowIcon />
                  </Box>
                </Link>
              </Button>

              <Button
                asChild
                bg="whiteAlpha.100"
                color="white"
                px={6}
                py={3}
                borderRadius="full"
                fontSize="sm"
                fontWeight="medium"
                border="1px solid"
                borderColor="whiteAlpha.200"
                _hover={{ bg: 'whiteAlpha.200' }}
                display="inline-flex"
                alignItems="center"
                gap={3}
              >
                <Link to="/sessions">
                  See more Sessions
                  <Box
                    w={6}
                    h={6}
                    bg="whiteAlpha.200"
                    borderRadius="full"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                  >
                    <ChevronIcon />
                  </Box>
                </Link>
              </Button>
            </HStack>
          </MotionBox>
        </Box>

        <MotionBox
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
        >
          <SimpleGrid columns={{ base: 2, md: 4 }} gap={4} mb={16}>
            {[eventImg1, eventImg2, eventImg3, eventImg4].map((img, i) => (
              <AspectRatio key={i} ratio={4 / 3}>
                <Image
                  src={img}
                  alt={`Session ${i + 1}`}
                  objectFit="cover"
                  borderRadius="2xl"
                  transition="transform 0.5s"
                  _hover={{ transform: 'scale(1.05)' }}
                />
              </AspectRatio>
            ))}
          </SimpleGrid>
        </MotionBox>

        <MotionBox
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
        >
          <SimpleGrid
            columns={{ base: 2, md: 4 }}
            gap={6}
            pt={8}
            borderTop="1px solid"
            borderColor="whiteAlpha.100"
          >
            {services.map((service, i) => (
              <Box key={i} cursor="pointer" role="group">
                <Text color="brand.500" fontSize="xs" fontWeight="medium" mb={2}>
                  {service.num}
                </Text>
                <Text
                  color="whiteAlpha.700"
                  fontSize="sm"
                  _groupHover={{ color: 'white' }}
                  transition="color 0.2s"
                >
                  {service.title}
                </Text>
              </Box>
            ))}
          </SimpleGrid>
        </MotionBox>
      </Container>
    </Box>
  )
}

function AboutSection() {
  return (
    <Box as="section" py={{ base: 24, md: 32 }} bg="gray.950">
      <Container maxW="1440px" px={{ base: 6, md: 12, lg: 16, xl: 20 }}>
        <Grid templateColumns={{ base: '1fr', lg: 'repeat(2, 1fr)' }} gap={{ base: 12, lg: 20 }} alignItems="center">
          <MotionBox
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <Text
              color="brand.500"
              fontSize="sm"
              textTransform="uppercase"
              letterSpacing="0.3em"
              mb={6}
            >
              About Us
            </Text>

            <Heading
              as="h2"
              fontSize={{ base: '2.5rem', md: '3.5rem', lg: '4rem' }}
              lineHeight={1.1}
              color="white"
              fontFamily="heading"
              mb={6}
            >
              Community.<br />
              Creativity.<br />
              Connection.
            </Heading>

            <Text color="whiteAlpha.500" fontSize={{ base: 'md', md: 'lg' }} lineHeight="relaxed" mb={4}>
              Blending art and community to build meaningful experiences.
            </Text>

            <Text color="whiteAlpha.400" fontSize={{ base: 'sm', md: 'md' }} lineHeight="relaxed" mb={8}>
              Club BZR is a creative initiative bringing people together through shared artistic experiences. With sessions spanning drawing, photography, collage, and more, we create spaces for experimentation and dialogue between artists working across different mediums.
            </Text>

            <Text color="whiteAlpha.400" fontSize={{ base: 'sm', md: 'md' }} lineHeight="relaxed" mb={10}>
              Using a balance of structure and spontaneity in every session, whether you're a seasoned artist or just curious, we're here to guide you every step of the way.
            </Text>

            <Link to="/community/wall">
              <Box
                display="inline-flex"
                alignItems="center"
                gap={2}
                color="white"
                fontSize="sm"
                fontWeight="medium"
                borderBottom="1px solid"
                borderColor="whiteAlpha.300"
                pb={1}
                _hover={{ borderColor: 'brand.500', color: 'brand.500' }}
                transition="all 0.2s"
              >
                Join the Community
              </Box>
            </Link>
          </MotionBox>

          <MotionBox
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            viewport={{ once: true }}
          >
            <AspectRatio ratio={3 / 4}>
              <Image
                src={eventImg1}
                alt="Creative session"
                objectFit="cover"
                borderRadius="3xl"
              />
            </AspectRatio>
          </MotionBox>
        </Grid>
      </Container>
    </Box>
  )
}

function ProjectsSection() {
  return (
    <Box as="section" py={{ base: 24, md: 32 }} bg="gray.950">
      <Container maxW="1440px" px={{ base: 6, md: 12, lg: 16, xl: 20 }}>
        <Grid templateColumns={{ base: '1fr', lg: '1.2fr 0.8fr' }} gap={6} mb={8}>
          <MotionBox
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
            position="relative"
          >
            <AspectRatio ratio={16 / 10}>
              <Box position="relative" borderRadius="3xl" overflow="hidden">
                <Image src={eventImg2} alt="Featured session" objectFit="cover" w="full" h="full" />
                <Box
                  position="absolute"
                  inset={0}
                  bgGradient="linear(to-t, blackAlpha.700, transparent)"
                />
                <Box position="absolute" bottom={8} left={8}>
                  <Text
                    color="brand.500"
                    fontSize="xs"
                    textTransform="uppercase"
                    letterSpacing="0.2em"
                    mb={3}
                  >
                    Selected Work
                  </Text>
                  <Heading as="h2" fontSize={{ base: '4xl', md: '5xl' }} color="white" fontFamily="heading">
                    Sessions
                  </Heading>
                </Box>
              </Box>
            </AspectRatio>
          </MotionBox>

          <MotionBox
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            viewport={{ once: true }}
          >
            <Grid templateRows="repeat(2, 1fr)" gap={6} h="full">
              <Box position="relative" borderRadius="3xl" overflow="hidden">
                <Image src={eventImg3} alt="Workshop" objectFit="cover" w="full" h="full" />
              </Box>
              <Flex
                direction="column"
                justify="center"
                borderRadius="3xl"
                bg="gray.900"
                p={8}
              >
                <Text color="white" fontSize={{ base: 'lg', md: 'xl' }} fontWeight="medium" mb={2}>
                  Real creativity,
                </Text>
                <Text color="white" fontSize={{ base: 'lg', md: 'xl' }} fontWeight="medium">
                  real connection.
                </Text>
              </Flex>
            </Grid>
          </MotionBox>
        </Grid>

        <Grid templateColumns={{ base: '1fr', lg: 'repeat(2, 1fr)' }} gap={{ base: 12, lg: 20 }} alignItems="center" py={16}>
          <MotionBox
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <Text
              color="brand.500"
              fontSize="sm"
              textTransform="uppercase"
              letterSpacing="0.3em"
              mb={6}
            >
              Featured Sessions
            </Text>

            <Heading
              as="h3"
              fontSize={{ base: '2rem', md: '3rem', lg: '3.5rem' }}
              lineHeight={1.1}
              color="white"
              fontFamily="heading"
              mb={6}
            >
              Bringing People Together Through Art
            </Heading>

            <Text color="whiteAlpha.500" fontSize="md" lineHeight="relaxed" mb={8}>
              A curated collection of art sessions, creative workshops, and community experiences built for connection and growth.
            </Text>

            <Text color="whiteAlpha.300" fontSize="sm" mb={8}>
              Let's build something meaningful together.
            </Text>

            <Link to="/sessions">
              <Button
                bg="brand.500"
                color="white"
                px={6}
                py={3}
                borderRadius="full"
                fontSize="sm"
                fontWeight="medium"
                _hover={{ bg: 'brand.600' }}
                display="inline-flex"
                alignItems="center"
                gap={3}
              >
                Get in touch
                <Box
                  w={6}
                  h={6}
                  bg="whiteAlpha.200"
                  borderRadius="full"
                  display="flex"
                  alignItems="center"
                  justifyContent="center"
                >
                  <ChevronIcon />
                </Box>
              </Button>
            </Link>
          </MotionBox>

          <MotionBox
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            viewport={{ once: true }}
          >
            <AspectRatio ratio={4 / 3}>
              <Image src={eventImg4} alt="Art session" objectFit="cover" borderRadius="3xl" />
            </AspectRatio>
          </MotionBox>
        </Grid>
      </Container>
    </Box>
  )
}

function CommunityHighlightsSection() {
  const highlights = [
    { category: 'Weekly Sessions', title: 'Draw Together', desc: 'Join artists every week for collaborative drawing sessions in relaxed, supportive spaces.' },
    { category: 'Side Quests', title: 'Creative Challenges', desc: 'Push your boundaries with prompts designed to spark new ideas and unexpected directions.' },
    { category: 'Artist Network', title: 'Find Your People', desc: 'Connect with creators across mediums who share your curiosity and creative energy.' },
    { category: 'Open to All', title: 'No Experience Needed', desc: 'Whether you\'re a seasoned artist or picking up a pencil for the first time, you belong here.' },
  ]

  return (
    <Box as="section" py={{ base: 24, md: 32 }} bg="gray.950">
      <Container maxW="1440px" px={{ base: 6, md: 12, lg: 16, xl: 20 }}>
        <Grid templateColumns={{ base: '1fr', lg: 'repeat(2, 1fr)' }} gap={{ base: 12, lg: 20 }}>
          <MotionBox
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
          >
            <Text
              color="brand.500"
              fontSize="sm"
              textTransform="uppercase"
              letterSpacing="0.3em"
              mb={6}
            >
              What We Offer
            </Text>

            <Heading
              as="h2"
              fontSize={{ base: '2rem', md: '3rem', lg: '3.5rem' }}
              lineHeight={1.1}
              color="white"
              fontFamily="heading"
              mb={6}
            >
              Create Together,<br />Grow Together
            </Heading>

            <Text color="whiteAlpha.500" fontSize="md" lineHeight="relaxed">
              Club BZR is built around the belief that creativity thrives in community. Here's what you'll find when you join us.
            </Text>
          </MotionBox>

          <MotionBox
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            viewport={{ once: true }}
          >
            <VStack align="stretch" gap={0}>
              {highlights.map((item, i) => (
                <Flex
                  key={i}
                  justify="space-between"
                  align="flex-start"
                  py={6}
                  borderBottom="1px solid"
                  borderColor="whiteAlpha.100"
                >
                  <Box>
                    <Text
                      color="brand.500"
                      fontSize="xs"
                      textTransform="uppercase"
                      letterSpacing="wider"
                      mb={1}
                    >
                      {item.category}
                    </Text>
                    <Text color="white" fontSize="lg" fontWeight="medium" mb={1}>
                      {item.title}
                    </Text>
                    <Text color="whiteAlpha.400" fontSize="sm" maxW="sm">
                      {item.desc}
                    </Text>
                  </Box>
                </Flex>
              ))}
            </VStack>
          </MotionBox>
        </Grid>
      </Container>
    </Box>
  )
}

function GallerySection() {
  const items = [
    { title: 'Sketch Sessions', desc: 'Drawing explorations in relaxed settings.', image: eventImg1 },
    { title: 'Portrait Series', desc: 'Identity and expression through portraiture.', image: eventImg2 },
    { title: 'Collage Works', desc: 'Mixed media and found materials.', image: eventImg3 },
    { title: 'Live Sessions', desc: 'Real-time creative collaborations.', image: eventImg4 },
  ]

  return (
    <Box as="section" py={{ base: 24, md: 32 }} bg="gray.950">
      <Container maxW="1440px" px={{ base: 6, md: 12, lg: 16, xl: 20 }}>
        <SimpleGrid columns={{ base: 1, md: 2 }} gap={{ base: 6, lg: 8 }}>
          {items.map((item, i) => (
            <MotionBox
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              viewport={{ once: true }}
              role="group"
            >
              <AspectRatio ratio={4 / 3} mb={4}>
                <Image
                  src={item.image}
                  alt={item.title}
                  objectFit="cover"
                  borderRadius="3xl"
                  transition="transform 0.5s"
                  _groupHover={{ transform: 'scale(1.05)' }}
                />
              </AspectRatio>

              <Text color="white" fontSize="lg" fontWeight="medium" mb={2}>
                {item.title}
              </Text>

              <Text color="whiteAlpha.400" fontSize="sm" mb={4}>
                {item.desc}
              </Text>

              <Link to="/sessions">
                <HStack gap={2} color="white" fontSize="sm">
                  <Text>View</Text>
                  <Box
                    w={5}
                    h={5}
                    bg="brand.500"
                    borderRadius="full"
                    display="flex"
                    alignItems="center"
                    justifyContent="center"
                  >
                    <ChevronIcon />
                  </Box>
                </HStack>
              </Link>
            </MotionBox>
          ))}
        </SimpleGrid>
      </Container>
    </Box>
  )
}

function ContactSection() {
  return (
    <Box as="section" py={{ base: 24, md: 32 }} bg="gray.950" position="relative" overflow="hidden">
      <Container maxW="1440px" px={{ base: 6, md: 12, lg: 16, xl: 20 }}>
        <Grid templateColumns={{ base: '1fr', lg: 'repeat(2, 1fr)' }} gap={{ base: 12, lg: 20 }} alignItems="center">
          <MotionBox
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
            viewport={{ once: true }}
            position="relative"
          >
            <AspectRatio ratio={4 / 5}>
              <Box position="relative" borderRadius="3xl" overflow="hidden">
                <Image src={eventImg3} alt="Join community" objectFit="cover" w="full" h="full" />
                <Box
                  position="absolute"
                  inset={0}
                  bgGradient="linear(to-t, blackAlpha.800, blackAlpha.200, transparent)"
                />
                <Box position="absolute" bottom={10} left={10}>
                  <Text
                    color="brand.500"
                    fontSize="sm"
                    textTransform="uppercase"
                    letterSpacing="0.2em"
                    mb={4}
                  >
                    Get in touch
                  </Text>
                  <Heading as="h2" fontSize={{ base: '5xl', md: '6xl' }} color="white" fontFamily="heading">
                    Contact
                  </Heading>
                </Box>
              </Box>
            </AspectRatio>
          </MotionBox>

          <MotionBox
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            viewport={{ once: true }}
          >
            <Heading
              as="h3"
              fontSize={{ base: '1.5rem', md: '2rem', lg: '2.5rem' }}
              lineHeight={1.2}
              color="white"
              fontFamily="heading"
              mb={8}
            >
              Let's build something great together—start the conversation today.
            </Heading>

            <VStack as="form" gap={6} align="stretch">
              <SimpleGrid columns={{ base: 1, md: 2 }} gap={6}>
                <Box>
                  <Text color="whiteAlpha.400" fontSize="xs" textTransform="uppercase" letterSpacing="wider" mb={2}>
                    First name*
                  </Text>
                  <Input
                    placeholder="Jane"
                    variant="flushed"
                    borderColor="whiteAlpha.200"
                    color="white"
                    _placeholder={{ color: 'whiteAlpha.300' }}
                    _focus={{ borderColor: 'brand.500' }}
                    py={3}
                  />
                </Box>
                <Box>
                  <Text color="whiteAlpha.400" fontSize="xs" textTransform="uppercase" letterSpacing="wider" mb={2}>
                    Last name*
                  </Text>
                  <Input
                    placeholder="Doe"
                    variant="flushed"
                    borderColor="whiteAlpha.200"
                    color="white"
                    _placeholder={{ color: 'whiteAlpha.300' }}
                    _focus={{ borderColor: 'brand.500' }}
                    py={3}
                  />
                </Box>
              </SimpleGrid>

              <Box>
                <Text color="whiteAlpha.400" fontSize="xs" textTransform="uppercase" letterSpacing="wider" mb={2}>
                  Email*
                </Text>
                <Input
                  type="email"
                  placeholder="jane@example.com"
                  variant="flushed"
                  borderColor="whiteAlpha.200"
                  color="white"
                  _placeholder={{ color: 'whiteAlpha.300' }}
                  _focus={{ borderColor: 'brand.500' }}
                  py={3}
                />
              </Box>

              <Box>
                <Text color="whiteAlpha.400" fontSize="xs" textTransform="uppercase" letterSpacing="wider" mb={2}>
                  Message
                </Text>
                <Textarea
                  placeholder="Tell us about your creative interests..."
                  variant="flushed"
                  borderColor="whiteAlpha.200"
                  color="white"
                  _placeholder={{ color: 'whiteAlpha.300' }}
                  _focus={{ borderColor: 'brand.500' }}
                  rows={4}
                  resize="none"
                  py={3}
                />
              </Box>

              <Button
                type="submit"
                bg="brand.500"
                color="white"
                px={8}
                py={4}
                borderRadius="full"
                fontSize="sm"
                fontWeight="medium"
                _hover={{ bg: 'brand.600' }}
                display="inline-flex"
                alignItems="center"
                gap={3}
                alignSelf="flex-start"
              >
                Send message
                <ArrowIcon />
              </Button>
            </VStack>
          </MotionBox>
        </Grid>
      </Container>
    </Box>
  )
}

function RecentWorkSection() {
  const projects = [
    { category: 'Drawing Session', title: 'Sketch & Connect', year: '2024', desc: 'A relaxed drawing session for meaningful conversations.' },
    { category: 'Mixed Media', title: 'Collage Collective', year: '2024', desc: 'Community-driven collage workshops.' },
    { category: 'Photography', title: 'Light & Shadow', year: '2023', desc: 'Exploring photography through collaborative exercises.' },
  ]

  return (
    <Box as="section" py={{ base: 24, md: 32 }} bg="gray.950">
      <Container maxW="1440px" px={{ base: 6, md: 12, lg: 16, xl: 20 }}>
        <Grid templateColumns={{ base: '1fr', lg: 'repeat(2, 1fr)' }} gap={{ base: 12, lg: 20 }} mb={16}>
          <MotionBox
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            viewport={{ once: true }}
          >
            <Text
              color="brand.500"
              fontSize="sm"
              textTransform="uppercase"
              letterSpacing="0.3em"
              mb={6}
            >
              Recent Sessions
            </Text>

            <Heading
              as="h2"
              fontSize={{ base: '2rem', md: '3rem', lg: '3.5rem' }}
              lineHeight={1.1}
              color="white"
              fontFamily="heading"
            >
              Latest Experiences & Collaborations
            </Heading>
          </MotionBox>

          <MotionFlex
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            viewport={{ once: true }}
            align="flex-end"
          >
            <Text color="whiteAlpha.500" fontSize="md" lineHeight="relaxed">
              A look at what we've been creating lately—sessions, stories, and creative partnerships.
            </Text>
          </MotionFlex>
        </Grid>

        <VStack align="stretch" gap={0}>
          {projects.map((project, i) => (
            <MotionBox
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              viewport={{ once: true }}
            >
              <Flex
                justify="space-between"
                align="flex-start"
                py={8}
                borderBottom="1px solid"
                borderColor="whiteAlpha.100"
                cursor="pointer"
                role="group"
                _hover={{ borderColor: 'brand.500' }}
                transition="border-color 0.2s"
              >
                <Box flex={1}>
                  <Text
                    color="brand.500"
                    fontSize="xs"
                    textTransform="uppercase"
                    letterSpacing="wider"
                    mb={2}
                  >
                    {project.category}
                  </Text>
                  <Text
                    color="white"
                    fontSize={{ base: 'xl', md: '2xl' }}
                    fontWeight="medium"
                    _groupHover={{ color: 'brand.500' }}
                    transition="color 0.2s"
                  >
                    {project.title}
                  </Text>
                  <Text color="whiteAlpha.400" fontSize="sm" mt={2} maxW="md">
                    {project.desc}
                  </Text>
                </Box>
                <Text color="whiteAlpha.300" fontSize="sm">
                  {project.year}
                </Text>
              </Flex>
            </MotionBox>
          ))}
        </VStack>
      </Container>
    </Box>
  )
}

function Footer() {
  return (
    <Box as="footer" py={16} bg="gray.950" borderTop="1px solid" borderColor="whiteAlpha.100">
      <Container maxW="1440px" px={{ base: 6, md: 12, lg: 16, xl: 20 }}>
        <Flex
          direction={{ base: 'column', md: 'row' }}
          justify="space-between"
          align="center"
          gap={8}
        >
          <Image src={logoWhite} alt="Club BZR" h={{ base: 10, md: 12 }} />

          <HStack as="nav" gap={8} flexWrap="wrap" justify="center">
            <Link to="/sessions">
              <Text color="whiteAlpha.500" fontSize="sm" _hover={{ color: 'white' }} transition="color 0.2s">
                Sessions
              </Text>
            </Link>
            <Link to="/quests">
              <Text color="whiteAlpha.500" fontSize="sm" _hover={{ color: 'white' }} transition="color 0.2s">
                Side Quests
              </Text>
            </Link>
            <Link to="/artists">
              <Text color="whiteAlpha.500" fontSize="sm" _hover={{ color: 'white' }} transition="color 0.2s">
                Artists
              </Text>
            </Link>
            <Link to="/community/wall">
              <Text color="whiteAlpha.500" fontSize="sm" _hover={{ color: 'white' }} transition="color 0.2s">
                Community
              </Text>
            </Link>
          </HStack>

          <Text color="whiteAlpha.300" fontSize="sm">
            © 2026 Club BZR
          </Text>
        </Flex>
      </Container>
    </Box>
  )
}

export default function Landing() {
  return (
    <Box bg="gray.950" minH="100vh" overflowX="hidden">
      <Box as="main">
        <HeroSection />
        <AboutSection />
        <ProjectsSection />
        <CommunityHighlightsSection />
        <GallerySection />
        <ContactSection />
        <RecentWorkSection />
      </Box>

      <Footer />
    </Box>
  )
}
