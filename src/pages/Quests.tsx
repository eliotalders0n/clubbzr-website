'use client'

import { useState, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Box,
  Container,
  Flex,
  Grid,
  Heading,
  Text,
  Button,
  Input,
  VStack,
  HStack,
  SimpleGrid,
  Badge,
  Spinner,
  Center,
  AspectRatio,
  Image,
} from '@chakra-ui/react'
import { Modal, ModalBody } from '@/components/ui/Modal'
import { motion } from 'framer-motion'

import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { useCollection } from '@/hooks/useFirestore'
import type { Quest, QuestCategory, QuestDifficulty } from '../../lib/schema'

const MotionBox = motion.create(Box)

const isUsableImageReference = (url: string) => {
  const value = url.trim()
  if (!value) return false
  if (value.startsWith('/') || value.startsWith('data:image/') || value.startsWith('blob:')) return true

  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

const getQuestImageCandidates = (quest: Quest) => {
  const candidates = [...(quest.inspirationLinks || []), ...(quest.exampleImages || [])]
    .map((url) => url.trim())
    .filter(isUsableImageReference)

  return [...new Set(candidates)]
}

const CATEGORIES: { id: QuestCategory | 'all'; label: string }[] = [
  { id: 'all', label: 'All Categories' },
  { id: 'daily_prompt', label: 'Daily Prompt' },
  { id: 'weekly_challenge', label: 'Weekly Challenge' },
  { id: 'experimental', label: 'Experimental' },
  { id: 'skill_building', label: 'Skill Building' },
  { id: 'collaboration', label: 'Collaboration' },
  { id: 'exploration', label: 'Exploration' },
  { id: 'community', label: 'Community' },
]

const DIFFICULTIES: { id: QuestDifficulty | 'all'; label: string }[] = [
  { id: 'all', label: 'All Levels' },
  { id: 'beginner', label: 'Beginner' },
  { id: 'intermediate', label: 'Intermediate' },
  { id: 'advanced', label: 'Advanced' },
]

function QuestCard({ quest, featured = false }: { quest: Quest; featured?: boolean }) {
  const imageCandidates = useMemo(() => getQuestImageCandidates(quest), [quest])
  const [failedImages, setFailedImages] = useState<Record<string, true>>({})
  const questImage = imageCandidates.find((candidate) => !failedImages[candidate])

  const difficultyColor = {
    beginner: 'green',
    intermediate: 'yellow',
    advanced: 'red',
    any: 'blue',
  }[quest.difficulty]

  return (
    <Link to={`/quests/${quest.id}`}>
      <MotionBox
        whileHover={{ y: -8 }}
        transition={{ duration: 0.3 }}
        p={featured ? 8 : 6}
        borderRadius="2xl"
        bg="gray.900"
        border="1px solid"
        borderColor={featured ? 'green.500' : 'whiteAlpha.100'}
        role="group"
        cursor="pointer"
        h="full"
        _hover={{ borderColor: 'brand.500' }}
      >
        {questImage && (
          <AspectRatio
            ratio={featured ? 21 / 9 : 16 / 9}
            mb={5}
            borderRadius="xl"
            overflow="hidden"
            bg="whiteAlpha.100"
            border="1px solid"
            borderColor="whiteAlpha.100"
          >
            <Image
              src={questImage}
              alt={quest.title}
              w="full"
              h="full"
              objectFit="cover"
              transition="transform 0.35s ease"
              _groupHover={{ transform: 'scale(1.04)' }}
              onError={() => setFailedImages((current) => ({ ...current, [questImage]: true }))}
            />
          </AspectRatio>
        )}

        <HStack gap={2} mb={4}>
          <Badge
            bg="green.500"
            color="white"
            px={2}
            py={0.5}
            borderRadius="full"
            fontSize="xs"
            textTransform="capitalize"
          >
            {quest.category.replace('_', ' ')}
          </Badge>
          <Badge
            bg={`${difficultyColor}.500`}
            color="white"
            px={2}
            py={0.5}
            borderRadius="full"
            fontSize="xs"
            textTransform="capitalize"
          >
            {quest.difficulty}
          </Badge>
        </HStack>

        <Heading
          as="h3"
          fontSize={featured ? '2xl' : 'xl'}
          color="white"
          fontFamily="heading"
          mb={3}
          _groupHover={{ color: 'green.400' }}
          transition="color 0.2s"
        >
          {quest.title}
        </Heading>

        <Text color="whiteAlpha.500" fontSize="sm" mb={4} lineClamp={featured ? 3 : 2}>
          {quest.description}
        </Text>

        <HStack gap={4} flexWrap="wrap">
          {quest.estimatedTime && (
            <Text color="whiteAlpha.400" fontSize="xs">
              {quest.estimatedTime}
            </Text>
          )}
          <Text color="whiteAlpha.400" fontSize="xs">
            {quest.submissionCount} submissions
          </Text>
          <Text color="green.400" fontSize="xs" fontWeight="medium">
            {quest.points} pts
          </Text>
        </HStack>
      </MotionBox>
    </Link>
  )
}

// Random creative prompts for when no quests exist or user wants inspiration
const RANDOM_PROMPTS = [
  "Create a piece using only three colors from your surroundings",
  "Draw or photograph something that represents 'change'",
  "Make art inspired by a song you've never heard before",
  "Create something using materials you find in nature",
  "Express your current mood using only shapes and lines",
  "Recreate a childhood memory in your preferred medium",
  "Create a self-portrait without showing your face",
  "Make art inspired by a random word: 'Ephemeral'",
  "Document a stranger's story through your art",
  "Create something that would make a child laugh",
  "Express 'silence' through visual art",
  "Make art using only tools you don't normally use",
  "Create a piece inspired by your favorite texture",
  "Draw something from an unusual perspective",
  "Create art that represents where you want to be in 5 years",
]

export default function Quests() {
  const navigate = useNavigate()
  const [selectedCategory, setSelectedCategory] = useState<QuestCategory | 'all'>('all')
  const [selectedDifficulty, setSelectedDifficulty] = useState<QuestDifficulty | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [randomPrompt, setRandomPrompt] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Fetch quests from Firebase - filter client-side to avoid composite index requirement
  const { data: allQuests, loading, error } = useCollection('quests', {
    orderBy: 'createdAt',
    orderDirection: 'desc',
  })

  // Filter to only active quests client-side
  const quests = useMemo(() =>
    allQuests.filter(q => q.isActive !== false),
    [allQuests]
  )

  // Filter quests client-side for search and category/difficulty filters
  const filteredQuests = useMemo(() => {
    return quests.filter((quest) => {
      const matchesCategory = selectedCategory === 'all' || quest.category === selectedCategory
      const matchesDifficulty = selectedDifficulty === 'all' || quest.difficulty === selectedDifficulty
      const matchesSearch =
        searchQuery === '' ||
        quest.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        quest.description.toLowerCase().includes(searchQuery.toLowerCase())
      return matchesCategory && matchesDifficulty && matchesSearch
    })
  }, [quests, selectedCategory, selectedDifficulty, searchQuery])

  const featuredQuest = quests.find((q) => q.featured)

  // Get random prompt handler
  const handleGetRandomPrompt = () => {
    const randomIndex = Math.floor(Math.random() * RANDOM_PROMPTS.length)
    setRandomPrompt(RANDOM_PROMPTS[randomIndex])
    setIsModalOpen(true)
  }

  // Log errors for debugging but don't show error UI
  if (error) {
    console.error('Quests fetch error:', error)
  }

  return (
    <Box bg="gray.950" minH="100vh">
      <Header />

      <Box as="main" pt={{ base: '76px', md: '112px' }} pb={20}>
        <Container maxW="1680px" px={{ base: 4, md: 8, lg: 10 }}>
          {/* Hero */}
          <MotionBox
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            mb={{ base: 5, md: 6 }}
          >
            <Flex justify="space-between" align={{ base: 'start', md: 'center' }} gap={{ base: 4, md: 8 }} direction={{ base: 'column', md: 'row' }}>
              <Box maxW="3xl">
                <Text color="brand.500" fontSize="xs" fontWeight="semibold" textTransform="uppercase" letterSpacing="0.18em" mb={2}>
                  Creative Challenges
                </Text>
                <Heading
                  as="h1"
                  fontSize={{ base: '2.35rem', md: '3rem', lg: '3.5rem' }}
                  lineHeight={0.98}
                  color="white"
                  fontFamily="heading"
                  mb={3}
                >
                  Side Quests
                </Heading>
                <Text color="whiteAlpha.500" fontSize={{ base: 'sm', md: 'md' }} maxW="2xl">
                  Creative challenges to inspire, challenge, and transform your artistic practice
                </Text>
              </Box>

              <HStack gap={3} flexShrink={0}>
                <Button
                  size="sm"
                  bg="green.500"
                  color="white"
                  borderRadius="full"
                  px={5}
                  _hover={{ bg: 'green.600' }}
                  onClick={() => document.getElementById('quests-grid')?.scrollIntoView({ behavior: 'smooth' })}
                >
                  Explore Quests
                </Button>
                <Button
                  size="sm"
                  bg="transparent"
                  color="whiteAlpha.800"
                  border="1px solid"
                  borderColor="whiteAlpha.300"
                  borderRadius="full"
                  px={5}
                  _hover={{ bg: 'whiteAlpha.50' }}
                  onClick={handleGetRandomPrompt}
                >
                  Random Prompt
                </Button>
              </HStack>
            </Flex>
          </MotionBox>

          {/* Loading State */}
          {loading && (
            <Center py={20}>
              <Spinner size="xl" color="green.500" />
            </Center>
          )}

          {!loading && (
            <>
              {/* Featured Quest */}
              {featuredQuest && (
                <MotionBox
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                  mb={16}
                >
                  <Flex justify="space-between" align="center" mb={6}>
                    <Box>
                      <Heading as="h2" fontSize="2xl" color="white" fontFamily="heading" mb={2}>
                        Featured Quest
                      </Heading>
                      <Text color="whiteAlpha.500">This week's highlighted creative challenge</Text>
                    </Box>
                    <Badge bg="green.500" color="white" px={3} py={1} borderRadius="full" fontSize="xs">
                      Active Now
                    </Badge>
                  </Flex>

                  <QuestCard quest={featuredQuest} featured />
                </MotionBox>
              )}

              {/* Mobile Filters */}
              <MotionBox
                display={{ base: 'block', lg: 'none' }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                mb={6}
              >
                <Input
                  placeholder="Search quests..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  bg="gray.900"
                  border="1px solid"
                  borderColor="whiteAlpha.200"
                  borderRadius="lg"
                  color="white"
                  _placeholder={{ color: 'whiteAlpha.400' }}
                  _focus={{ borderColor: 'green.500' }}
                  py={5}
                  mb={4}
                />
                <HStack gap={2} overflowX="auto" pb={2} css={{ '&::-webkit-scrollbar': { display: 'none' } }}>
                  {CATEGORIES.map((cat) => (
                    <Button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      size="sm"
                      flexShrink={0}
                      px={4}
                      bg={selectedCategory === cat.id ? 'green.500' : 'transparent'}
                      color={selectedCategory === cat.id ? 'white' : 'whiteAlpha.600'}
                      border="1px solid"
                      borderColor={selectedCategory === cat.id ? 'green.500' : 'whiteAlpha.200'}
                      borderRadius="full"
                      _hover={{
                        bg: selectedCategory === cat.id ? 'green.600' : 'whiteAlpha.50',
                      }}
                    >
                      {cat.label}
                    </Button>
                  ))}
                </HStack>
                <HStack gap={2} mt={3} overflowX="auto" pb={2} css={{ '&::-webkit-scrollbar': { display: 'none' } }}>
                  {DIFFICULTIES.map((diff) => (
                    <Button
                      key={diff.id}
                      onClick={() => setSelectedDifficulty(diff.id)}
                      size="sm"
                      flexShrink={0}
                      px={4}
                      bg={selectedDifficulty === diff.id ? 'green.500' : 'transparent'}
                      color={selectedDifficulty === diff.id ? 'white' : 'whiteAlpha.600'}
                      border="1px solid"
                      borderColor={selectedDifficulty === diff.id ? 'green.500' : 'whiteAlpha.200'}
                      borderRadius="full"
                      _hover={{
                        bg: selectedDifficulty === diff.id ? 'green.600' : 'whiteAlpha.50',
                      }}
                    >
                      {diff.label}
                    </Button>
                  ))}
                </HStack>
              </MotionBox>

              {/* Desktop Filters & Quest Grid */}
              <MotionBox
                id="quests-grid"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                mb={8}
              >
                <Grid templateColumns={{ base: '1fr', lg: '280px 1fr' }} gap={8}>
                  {/* Desktop Sidebar */}
                  <Box
                    display={{ base: 'none', lg: 'block' }}
                    p={6}
                    borderRadius="2xl"
                    bg="gray.900"
                    border="1px solid"
                    borderColor="whiteAlpha.100"
                    h="fit-content"
                  >
                    <VStack align="stretch" gap={6} position="sticky" top={24}>
                      <Input
                        placeholder="Search quests..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        bg="gray.900"
                        border="1px solid"
                        borderColor="whiteAlpha.200"
                        borderRadius="lg"
                        color="white"
                        _placeholder={{ color: 'whiteAlpha.400' }}
                        _focus={{ borderColor: 'green.500' }}
                        py={6}
                      />

                      <Box>
                        <Text color="whiteAlpha.600" fontSize="sm" fontWeight="medium" mb={3}>
                          Category
                        </Text>
                        <VStack align="stretch" gap={1}>
                          {CATEGORIES.map((cat) => (
                            <Button
                              key={cat.id}
                              onClick={() => setSelectedCategory(cat.id)}
                              size="sm"
                              justifyContent="flex-start"
                              px={4}
                              py={5}
                              bg={selectedCategory === cat.id ? 'green.500' : 'transparent'}
                              color={selectedCategory === cat.id ? 'white' : 'whiteAlpha.600'}
                              _hover={{
                                bg: selectedCategory === cat.id ? 'green.600' : 'whiteAlpha.50',
                              }}
                            >
                              {cat.label}
                            </Button>
                          ))}
                        </VStack>
                      </Box>

                      <Box>
                        <Text color="whiteAlpha.600" fontSize="sm" fontWeight="medium" mb={3}>
                          Difficulty
                        </Text>
                        <VStack align="stretch" gap={1}>
                          {DIFFICULTIES.map((diff) => (
                            <Button
                              key={diff.id}
                              onClick={() => setSelectedDifficulty(diff.id)}
                              size="sm"
                              justifyContent="flex-start"
                              px={4}
                              py={5}
                              bg={selectedDifficulty === diff.id ? 'green.500' : 'transparent'}
                              color={selectedDifficulty === diff.id ? 'white' : 'whiteAlpha.600'}
                              _hover={{
                                bg: selectedDifficulty === diff.id ? 'green.600' : 'whiteAlpha.50',
                              }}
                            >
                              {diff.label}
                            </Button>
                          ))}
                        </VStack>
                      </Box>
                    </VStack>
                  </Box>

                  {/* Quest Grid */}
                  <Box>
                    <Flex justify="space-between" align="center" mb={6}>
                      <Heading as="h2" fontSize="2xl" color="white" fontFamily="heading">
                        All Quests
                      </Heading>
                      <Text color="whiteAlpha.400" fontSize="sm">
                        {filteredQuests.length} quest{filteredQuests.length !== 1 ? 's' : ''} found
                      </Text>
                    </Flex>

                    {filteredQuests.length > 0 ? (
                      <SimpleGrid columns={{ base: 1, md: 2 }} gap={6}>
                        {filteredQuests.map((quest, i) => (
                          <MotionBox
                            key={quest.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: 0.4 + i * 0.05 }}
                          >
                            <QuestCard quest={quest} />
                          </MotionBox>
                        ))}
                      </SimpleGrid>
                    ) : (
                      <Box textAlign="center" py={12}>
                        <Text color="whiteAlpha.500" fontSize="lg">
                          {quests.length === 0
                            ? 'No quests available yet. Check back soon!'
                            : 'No quests match your filters. Try adjusting your search criteria.'}
                        </Text>
                      </Box>
                    )}
                  </Box>
                </Grid>
              </MotionBox>

              {/* CTA */}
              <MotionBox
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
                viewport={{ once: true }}
                textAlign="center"
                py={16}
                mt={16}
                borderRadius="2xl"
                bg="gray.900"
                border="1px solid"
                borderColor="whiteAlpha.100"
              >
                <Heading
                  as="h2"
                  fontSize={{ base: '2xl', md: '3xl' }}
                  color="white"
                  fontFamily="heading"
                  mb={4}
                >
                  Ready to Start Creating?
                </Heading>

                <Text color="whiteAlpha.500" mb={8} maxW="lg" mx="auto">
                  Join thousands of artists pushing their creative boundaries
                </Text>

                <Button
                  bg="brand.500"
                  color="white"
                  borderRadius="full"
                  px={8}
                  _hover={{ bg: 'brand.600' }}
                  onClick={() => navigate('/auth/signup')}
                >
                  Join Club BZR
                </Button>
              </MotionBox>
            </>
          )}
        </Container>
      </Box>

      <Footer />

      {/* Random Prompt Modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Your Creative Prompt" size="md">
        <ModalBody>
          <Box
            p={6}
            borderRadius="xl"
            bg="bzr-gray-800"
            border="1px solid"
            borderColor="bzr-green"
            mb={6}
          >
            <Text color="white" fontSize="lg" fontWeight="medium" lineHeight="tall" className="text-bzr-white">
              {randomPrompt}
            </Text>
          </Box>
          <HStack gap={4} justify="center">
            <Button
              bg="green.500"
              color="white"
              borderRadius="full"
              px={6}
              _hover={{ bg: 'green.600' }}
              onClick={handleGetRandomPrompt}
            >
              Get Another
            </Button>
            <Button
              bg="transparent"
              color="white"
              border="1px solid"
              borderColor="whiteAlpha.300"
              borderRadius="full"
              px={6}
              _hover={{ bg: 'whiteAlpha.50' }}
              onClick={() => {
                setIsModalOpen(false)
                navigate('/community/wall', { state: { prompt: randomPrompt } })
              }}
            >
              Share on Community
            </Button>
          </HStack>
        </ModalBody>
      </Modal>
    </Box>
  )
}
