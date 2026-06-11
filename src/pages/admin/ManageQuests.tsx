'use client'

import { useMemo, useState, type CSSProperties, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  Box,
  Flex,
  Heading,
  Text,
  Button,
  Input,
  Textarea,
  VStack,
  HStack,
  SimpleGrid,
  Badge,
  Spinner,
} from '@chakra-ui/react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  Download,
  Pencil,
  Plus,
  Search,
  Star,
  Trash2,
} from 'lucide-react'

import { AdminLayout } from '@/components/layout/AdminLayout'
import { useAuth } from '@/contexts/AuthContext'
import { useCollection } from '@/hooks'
import { QUEST_BADGES, type BadgeCategory } from '../../../lib/badges'
import { createDocument, deleteDocument, updateDocument } from '../../../lib/firestore'
import type {
  CreateDocument,
  Quest,
  QuestCategory,
  QuestConstraint,
  QuestDifficulty,
  QuestSubmission,
  UpdateDocument,
} from '../../../lib/schema'

const MotionBox = motion.create(Box)

type QuestStatusFilter = 'all' | 'active' | 'draft'
type FeedbackType = 'success' | 'error' | 'info'

interface Feedback {
  type: FeedbackType
  message: string
}

interface QuestForm {
  title: string
  description: string
  category: QuestCategory
  difficulty: QuestDifficulty
  estimatedTime: string
  points: string
  constraints: string
  inspirationLinks: string
  tags: string
  badges: string
  status: 'active' | 'draft'
}

const CATEGORIES: Array<{ id: QuestCategory | 'all'; label: string }> = [
  { id: 'all', label: 'All Categories' },
  { id: 'daily_prompt', label: 'Daily Prompt' },
  { id: 'weekly_challenge', label: 'Weekly Challenge' },
  { id: 'collaboration', label: 'Collaboration' },
  { id: 'exploration', label: 'Exploration' },
  { id: 'skill_building', label: 'Skill Building' },
  { id: 'community', label: 'Community' },
  { id: 'experimental', label: 'Experimental' },
]

const DIFFICULTIES: Array<{ id: QuestDifficulty | 'all'; label: string }> = [
  { id: 'all', label: 'All Difficulties' },
  { id: 'beginner', label: 'Beginner' },
  { id: 'intermediate', label: 'Intermediate' },
  { id: 'advanced', label: 'Advanced' },
  { id: 'any', label: 'Any Level' },
]

const STATUS_FILTERS: Array<{ id: QuestStatusFilter; label: string }> = [
  { id: 'all', label: 'All Status' },
  { id: 'active', label: 'Active' },
  { id: 'draft', label: 'Draft' },
]

const difficultyStyles: Record<QuestDifficulty, { bg: string; color: string; borderColor: string }> = {
  beginner: { bg: 'green.500/15', color: 'green.200', borderColor: 'green.400/40' },
  intermediate: { bg: 'yellow.500/15', color: 'yellow.200', borderColor: 'yellow.400/40' },
  advanced: { bg: 'red.500/15', color: 'red.200', borderColor: 'red.400/40' },
  any: { bg: 'blue.500/15', color: 'blue.200', borderColor: 'blue.400/40' },
}

const categoryStyles: Record<QuestCategory, { bg: string; color: string; borderColor: string }> = {
  daily_prompt: { bg: 'green.500/12', color: 'green.200', borderColor: 'green.400/30' },
  weekly_challenge: { bg: 'purple.500/12', color: 'purple.200', borderColor: 'purple.400/30' },
  collaboration: { bg: 'pink.500/12', color: 'pink.200', borderColor: 'pink.400/30' },
  exploration: { bg: 'cyan.500/12', color: 'cyan.200', borderColor: 'cyan.400/30' },
  skill_building: { bg: 'blue.500/12', color: 'blue.200', borderColor: 'blue.400/30' },
  community: { bg: 'orange.500/12', color: 'orange.200', borderColor: 'orange.400/30' },
  experimental: { bg: 'brand.500/12', color: 'brand.200', borderColor: 'brand.400/30' },
}

const badgeCategoryMeta: Record<BadgeCategory, { label: string; color: string }> = {
  art: { label: 'Art', color: 'brand' },
  music: { label: 'Music', color: 'purple' },
  photography: { label: 'Photography', color: 'cyan' },
}

const selectStyle: CSSProperties = {
  width: '100%',
  height: '44px',
  padding: '0 14px',
  backgroundColor: '#111111',
  border: '1px solid rgba(255,255,255,0.14)',
  borderRadius: '12px',
  color: 'white',
  outline: 'none',
}

const emptyForm: QuestForm = {
  title: '',
  description: '',
  category: 'daily_prompt',
  difficulty: 'beginner',
  estimatedTime: '',
  points: '50',
  constraints: '',
  inspirationLinks: '',
  tags: '',
  badges: '',
  status: 'draft',
}

const toDate = (value: unknown): Date | null => {
  if (!value) return null
  if (value instanceof Date) return value
  if (typeof value === 'string') {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
  }
  if (typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate()
  }
  return null
}

const toMillis = (value: unknown): number => toDate(value)?.getTime() || 0

const formatDate = (value: unknown): string => {
  const date = toDate(value)
  if (!date) return 'Not recorded'
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const labelize = (value: string): string => value.replace(/_/g, ' ')

const splitList = (value: string): string[] =>
  value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean)

const setBadgeSelection = (current: string, badgeId: string): string => {
  const selected = splitList(current)
  const next = selected.includes(badgeId)
    ? selected.filter((id) => id !== badgeId)
    : [...selected, badgeId]
  return next.join(', ')
}

const parseConstraints = (value: string): QuestConstraint[] =>
  value
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((description) => ({
      type: 'other',
      description,
      required: true,
    }))

const questToForm = (quest: Quest): QuestForm => ({
  title: quest.title,
  description: quest.description,
  category: quest.category,
  difficulty: quest.difficulty,
  estimatedTime: quest.estimatedTime || '',
  points: String(quest.points || 50),
  constraints: (quest.constraints || []).map((constraint) => constraint.description).join('\n'),
  inspirationLinks: (quest.inspirationLinks || []).join('\n'),
  tags: (quest.tags || []).join(', '),
  badges: (quest.badges || []).join(', '),
  status: quest.isActive ? 'active' : 'draft',
})

const buildQuestPayload = (
  form: QuestForm,
  currentUserId: string,
  existing?: Quest
): CreateDocument<Quest> | UpdateDocument<Quest> => ({
  title: form.title.trim(),
  description: form.description.trim(),
  category: form.category,
  difficulty: form.difficulty,
  estimatedTime: form.estimatedTime.trim() || undefined,
  constraints: parseConstraints(form.constraints),
  inspirationLinks: splitList(form.inspirationLinks),
  exampleImages: existing?.exampleImages || [],
  isActive: form.status === 'active',
  submissions: existing?.submissions || [],
  submissionCount: existing?.submissionCount || 0,
  points: Number.parseInt(form.points, 10) || 50,
  badges: splitList(form.badges),
  featured: existing?.featured || false,
  createdBy: existing?.createdBy || currentUserId,
  tags: splitList(form.tags),
})

function FeedbackBanner({ feedback }: { feedback: Feedback | null }) {
  if (!feedback) return null

  const styles = {
    success: { bg: 'green.500/12', borderColor: 'green.400/30', color: 'green.200', icon: <CheckCircle2 size={18} /> },
    error: { bg: 'red.500/12', borderColor: 'red.400/30', color: 'red.200', icon: <AlertTriangle size={18} /> },
    info: { bg: 'blue.500/12', borderColor: 'blue.400/30', color: 'blue.200', icon: <CheckCircle2 size={18} /> },
  }[feedback.type]

  return (
    <HStack
      gap={3}
      p={4}
      mb={6}
      borderRadius="xl"
      bg={styles.bg}
      border="1px solid"
      borderColor={styles.borderColor}
      color={styles.color}
    >
      {styles.icon}
      <Text fontSize="sm" fontWeight="medium">{feedback.message}</Text>
    </HStack>
  )
}

function StatCard({ label, value, accent }: { label: string; value: string | number; accent: string }) {
  return (
    <Box p={5} borderRadius="xl" bg="gray.900" border="1px solid" borderColor="whiteAlpha.100">
      <Text color="whiteAlpha.500" fontSize="sm" mb={2}>{label}</Text>
      <Text color={accent} fontSize="2xl" fontWeight="bold">{value}</Text>
    </Box>
  )
}

function ModalBackdrop({
  title,
  children,
  onClose,
}: {
  title: string
  children: React.ReactNode
  onClose: () => void
}) {
  return (
    <Box position="fixed" inset={0} zIndex={100} display="flex" alignItems="center" justifyContent="center" p={4}>
      <Box position="absolute" inset={0} bg="blackAlpha.800" onClick={onClose} />
      <MotionBox
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        position="relative"
        w="full"
        maxW="960px"
        maxH="90vh"
        overflow="auto"
        p={{ base: 5, md: 7 }}
        borderRadius="2xl"
        bg="gray.950"
        border="1px solid"
        borderColor="whiteAlpha.200"
      >
        <Heading as="h2" fontSize="xl" color="white" mb={5}>{title}</Heading>
        {children}
      </MotionBox>
    </Box>
  )
}

function QuestFormFields({
  form,
  setForm,
  onSubmit,
  onCancel,
  submitLabel,
  isSaving,
}: {
  form: QuestForm
  setForm: (form: QuestForm) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onCancel: () => void
  submitLabel: string
  isSaving: boolean
}) {
  const selectedBadges = splitList(form.badges)
  const catalogBadgeIds = QUEST_BADGES.map((badge) => badge.id)
  const customBadges = selectedBadges.filter((badgeId) => !catalogBadgeIds.includes(badgeId))

  return (
    <form onSubmit={onSubmit}>
      <VStack align="stretch" gap={4}>
        <Box>
          <Text color="whiteAlpha.600" fontSize="sm" mb={2}>Title</Text>
          <Input
            value={form.title}
            onChange={(event) => setForm({ ...form, title: event.target.value })}
            placeholder="Quest title"
            bg="gray.900"
            borderColor="whiteAlpha.200"
            color="white"
            required
          />
        </Box>

        <Box>
          <Text color="whiteAlpha.600" fontSize="sm" mb={2}>Description</Text>
          <Textarea
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
            placeholder="Describe the creative challenge"
            bg="gray.900"
            borderColor="whiteAlpha.200"
            color="white"
            rows={4}
            required
          />
        </Box>

        <SimpleGrid columns={{ base: 1, md: 2 }} gap={4}>
          <Box>
            <Text color="whiteAlpha.600" fontSize="sm" mb={2}>Category</Text>
            <select
              style={selectStyle}
              value={form.category}
              onChange={(event) => setForm({ ...form, category: event.target.value as QuestCategory })}
            >
              {CATEGORIES.filter((category) => category.id !== 'all').map((category) => (
                <option key={category.id} value={category.id}>{category.label}</option>
              ))}
            </select>
          </Box>

          <Box>
            <Text color="whiteAlpha.600" fontSize="sm" mb={2}>Difficulty</Text>
            <select
              style={selectStyle}
              value={form.difficulty}
              onChange={(event) => setForm({ ...form, difficulty: event.target.value as QuestDifficulty })}
            >
              {DIFFICULTIES.filter((difficulty) => difficulty.id !== 'all').map((difficulty) => (
                <option key={difficulty.id} value={difficulty.id}>{difficulty.label}</option>
              ))}
            </select>
          </Box>
        </SimpleGrid>

        <SimpleGrid columns={{ base: 1, md: 3 }} gap={4}>
          <Box>
            <Text color="whiteAlpha.600" fontSize="sm" mb={2}>Status</Text>
            <select
              style={selectStyle}
              value={form.status}
              onChange={(event) => setForm({ ...form, status: event.target.value as QuestForm['status'] })}
            >
              <option value="draft">Draft</option>
              <option value="active">Active</option>
            </select>
          </Box>

          <Box>
            <Text color="whiteAlpha.600" fontSize="sm" mb={2}>Estimated Time</Text>
            <Input
              value={form.estimatedTime}
              onChange={(event) => setForm({ ...form, estimatedTime: event.target.value })}
              placeholder="30-60 mins"
              bg="gray.900"
              borderColor="whiteAlpha.200"
              color="white"
            />
          </Box>

          <Box>
            <Text color="whiteAlpha.600" fontSize="sm" mb={2}>Points</Text>
            <Input
              type="number"
              min={0}
              value={form.points}
              onChange={(event) => setForm({ ...form, points: event.target.value })}
              bg="gray.900"
              borderColor="whiteAlpha.200"
              color="white"
            />
          </Box>
        </SimpleGrid>

        <Box>
          <Text color="whiteAlpha.600" fontSize="sm" mb={2}>Constraints</Text>
          <Textarea
            value={form.constraints}
            onChange={(event) => setForm({ ...form, constraints: event.target.value })}
            placeholder="One constraint per line"
            bg="gray.900"
            borderColor="whiteAlpha.200"
            color="white"
            rows={3}
          />
        </Box>

        <Box>
          <Text color="whiteAlpha.600" fontSize="sm" mb={2}>Tags</Text>
          <Input
            value={form.tags}
            onChange={(event) => setForm({ ...form, tags: event.target.value })}
            placeholder="drawing, prompt, community"
            bg="gray.900"
            borderColor="whiteAlpha.200"
            color="white"
          />
        </Box>

        <Box>
          <Flex justify="space-between" align={{ base: 'start', sm: 'center' }} gap={2} mb={3} flexWrap="wrap">
            <Box>
              <Text color="whiteAlpha.600" fontSize="sm">Reward Badges</Text>
              <Text color="whiteAlpha.400" fontSize="xs">Select one or more badges earned by completing this quest.</Text>
            </Box>
            {selectedBadges.length > 0 && (
              <Badge bg="brand.500/15" color="brand.200" border="1px solid" borderColor="brand.400/40">
                {selectedBadges.length} selected
              </Badge>
            )}
          </Flex>

          <VStack align="stretch" gap={4}>
            {(['art', 'music', 'photography'] as BadgeCategory[]).map((category) => {
              const meta = badgeCategoryMeta[category]
              const options = QUEST_BADGES.filter((badge) => badge.category === category)

              return (
                <Box key={category} p={3} borderRadius="xl" bg="whiteAlpha.50" border="1px solid" borderColor="whiteAlpha.100">
                  <HStack gap={2} mb={3}>
                    <Badge bg={`${meta.color}.500/18`} color={`${meta.color}.200`} border="1px solid" borderColor={`${meta.color}.400/40`}>
                      {meta.label}
                    </Badge>
                  </HStack>

                  <SimpleGrid columns={{ base: 1, md: 3 }} gap={3}>
                    {options.map((badge) => {
                      const isSelected = selectedBadges.includes(badge.id)

                      return (
                        <Button
                          key={badge.id}
                          type="button"
                          h="auto"
                          minH="76px"
                          justifyContent="flex-start"
                          alignItems="flex-start"
                          textAlign="left"
                          whiteSpace="normal"
                          p={3}
                          bg={isSelected ? `${meta.color}.500/18` : 'blackAlpha.200'}
                          color={isSelected ? `${meta.color}.100` : 'whiteAlpha.800'}
                          border="1px solid"
                          borderColor={isSelected ? `${meta.color}.400/60` : 'whiteAlpha.100'}
                          _hover={{ bg: isSelected ? `${meta.color}.500/24` : 'whiteAlpha.100' }}
                          onClick={() => setForm({ ...form, badges: setBadgeSelection(form.badges, badge.id) })}
                        >
                          <VStack align="start" gap={1}>
                            <Text fontSize="sm" fontWeight="semibold">{badge.label}</Text>
                            <Text fontSize="xs" color={isSelected ? `${meta.color}.100` : 'whiteAlpha.500'}>
                              {badge.description}
                            </Text>
                          </VStack>
                        </Button>
                      )
                    })}
                  </SimpleGrid>
                </Box>
              )
            })}
          </VStack>

          {customBadges.length > 0 && (
            <HStack gap={2} flexWrap="wrap" mt={3}>
              <Text color="whiteAlpha.500" fontSize="xs">Existing custom IDs:</Text>
              {customBadges.map((badgeId) => (
                <Badge key={badgeId} bg="whiteAlpha.100" color="whiteAlpha.700">
                  {badgeId}
                </Badge>
              ))}
            </HStack>
          )}
        </Box>

        <Box>
          <Text color="whiteAlpha.600" fontSize="sm" mb={2}>Inspiration Links</Text>
          <Textarea
            value={form.inspirationLinks}
            onChange={(event) => setForm({ ...form, inspirationLinks: event.target.value })}
            placeholder="One URL per line"
            bg="gray.900"
            borderColor="whiteAlpha.200"
            color="white"
            rows={3}
          />
        </Box>

        <HStack justify="flex-end" gap={3} pt={3}>
          <Button
            type="button"
            bg="transparent"
            color="whiteAlpha.700"
            border="1px solid"
            borderColor="whiteAlpha.200"
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button type="submit" bg="brand.500" color="white" disabled={isSaving}>
            {isSaving ? 'Saving...' : submitLabel}
          </Button>
        </HStack>
      </VStack>
    </form>
  )
}

function QuestCard({
  quest,
  submissionCount,
  onEdit,
  onDelete,
  onToggleActive,
  onToggleFeatured,
}: {
  quest: Quest
  submissionCount: number
  onEdit: (quest: Quest) => void
  onDelete: (quest: Quest) => void
  onToggleActive: (quest: Quest) => void
  onToggleFeatured: (quest: Quest) => void
}) {
  const difficultyStyle = difficultyStyles[quest.difficulty]
  const categoryStyle = categoryStyles[quest.category]

  return (
    <MotionBox
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -3 }}
      transition={{ duration: 0.2 }}
      p={5}
      borderRadius="2xl"
      bg="gray.900"
      border="1px solid"
      borderColor={quest.featured ? 'brand.500/70' : 'whiteAlpha.100'}
    >
      <Flex justify="space-between" align="start" gap={3} mb={4}>
        <HStack gap={2} flexWrap="wrap">
          <Badge bg={categoryStyle.bg} color={categoryStyle.color} border="1px solid" borderColor={categoryStyle.borderColor}>
            {labelize(quest.category)}
          </Badge>
          <Badge bg={difficultyStyle.bg} color={difficultyStyle.color} border="1px solid" borderColor={difficultyStyle.borderColor}>
            {labelize(quest.difficulty)}
          </Badge>
          <Badge
            bg={quest.isActive ? 'green.500/15' : 'whiteAlpha.100'}
            color={quest.isActive ? 'green.200' : 'whiteAlpha.700'}
            border="1px solid"
            borderColor={quest.isActive ? 'green.400/40' : 'whiteAlpha.200'}
          >
            {quest.isActive ? 'Active' : 'Draft'}
          </Badge>
        </HStack>
        <Button
          size="xs"
          variant="ghost"
          color={quest.featured ? 'brand.300' : 'whiteAlpha.500'}
          onClick={() => onToggleFeatured(quest)}
        >
          <Star size={16} fill={quest.featured ? 'currentColor' : 'none'} />
        </Button>
      </Flex>

      <Heading as="h3" color="white" fontSize="lg" mb={2}>{quest.title}</Heading>
      <Text color="whiteAlpha.700" fontSize="sm" minH="44px" mb={4}>{quest.description}</Text>

      <SimpleGrid columns={3} gap={3} mb={4}>
        <Box p={3} bg="whiteAlpha.50" borderRadius="lg" textAlign="center">
          <Text color="white" fontWeight="bold" fontSize="lg">{submissionCount}</Text>
          <Text color="whiteAlpha.500" fontSize="xs">Submissions</Text>
        </Box>
        <Box p={3} bg="whiteAlpha.50" borderRadius="lg" textAlign="center">
          <Text color="brand.300" fontWeight="bold" fontSize="lg">{quest.points}</Text>
          <Text color="whiteAlpha.500" fontSize="xs">Points</Text>
        </Box>
        <Box p={3} bg="whiteAlpha.50" borderRadius="lg" textAlign="center">
          <Text color="whiteAlpha.800" fontWeight="bold" fontSize="sm">{quest.estimatedTime || 'Open'}</Text>
          <Text color="whiteAlpha.500" fontSize="xs">Time</Text>
        </Box>
      </SimpleGrid>

      <Text color="whiteAlpha.400" fontSize="xs" mb={4}>
        Created {formatDate(quest.createdAt)}
      </Text>

      <HStack gap={2} flexWrap="wrap">
        <Link to={`/admin/quests/${quest.id}/submissions`}>
          <Button size="sm" bg="whiteAlpha.100" color="white" _hover={{ bg: 'whiteAlpha.200' }}>
            View Submissions
          </Button>
        </Link>
        <Button size="sm" bg="transparent" color="whiteAlpha.800" border="1px solid" borderColor="whiteAlpha.200" onClick={() => onEdit(quest)}>
          <Pencil size={15} />
          Edit
        </Button>
        <Button size="sm" bg="transparent" color="orange.300" border="1px solid" borderColor="orange.400/40" onClick={() => onToggleActive(quest)}>
          <Archive size={15} />
          {quest.isActive ? 'Deactivate' : 'Activate'}
        </Button>
        <Button size="sm" bg="transparent" color="red.300" border="1px solid" borderColor="red.400/40" onClick={() => onDelete(quest)}>
          <Trash2 size={15} />
          Delete
        </Button>
      </HStack>
    </MotionBox>
  )
}

export default function ManageQuests() {
  const { user, firebaseUser } = useAuth()
  const questsQuery = useCollection('quests', { orderBy: 'createdAt', orderDirection: 'desc' })
  const submissionsQuery = useCollection('questSubmissions')
  const [selectedCategory, setSelectedCategory] = useState<QuestCategory | 'all'>('all')
  const [selectedDifficulty, setSelectedDifficulty] = useState<QuestDifficulty | 'all'>('all')
  const [selectedStatus, setSelectedStatus] = useState<QuestStatusFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [form, setForm] = useState<QuestForm>(emptyForm)
  const [editingQuest, setEditingQuest] = useState<Quest | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const currentUserId = firebaseUser?.uid || user?.uid || 'admin'

  const quests = useMemo(
    () => [...questsQuery.data].sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt)),
    [questsQuery.data]
  )

  const submissionCounts = useMemo(() => {
    return submissionsQuery.data.reduce<Record<string, number>>((counts, submission: QuestSubmission) => {
      counts[submission.questId] = (counts[submission.questId] || 0) + 1
      return counts
    }, {})
  }, [submissionsQuery.data])

  const filteredQuests = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return quests.filter((quest) => {
      const matchesCategory = selectedCategory === 'all' || quest.category === selectedCategory
      const matchesDifficulty = selectedDifficulty === 'all' || quest.difficulty === selectedDifficulty
      const matchesStatus =
        selectedStatus === 'all' ||
        (selectedStatus === 'active' && quest.isActive) ||
        (selectedStatus === 'draft' && !quest.isActive)
      const matchesSearch =
        !query ||
        quest.title.toLowerCase().includes(query) ||
        quest.description.toLowerCase().includes(query) ||
        quest.tags.some((tag) => tag.toLowerCase().includes(query))
      return matchesCategory && matchesDifficulty && matchesStatus && matchesSearch
    })
  }, [quests, selectedCategory, selectedDifficulty, selectedStatus, searchQuery])

  const stats = useMemo(() => ({
    total: quests.length,
    active: quests.filter((quest) => quest.isActive).length,
    draft: quests.filter((quest) => !quest.isActive).length,
    featured: quests.filter((quest) => quest.featured).length,
    submissions: quests.reduce((sum, quest) => sum + (submissionCounts[quest.id] ?? quest.submissionCount ?? 0), 0),
  }), [quests, submissionCounts])

  const showFeedback = (nextFeedback: Feedback) => {
    setFeedback(nextFeedback)
    window.setTimeout(() => setFeedback(null), 4000)
  }

  const refetch = async () => {
    await Promise.all([questsQuery.refetch(), submissionsQuery.refetch()])
  }

  const closeModals = () => {
    setIsCreateOpen(false)
    setIsEditOpen(false)
    setEditingQuest(null)
    setForm(emptyForm)
  }

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSaving(true)
    const result = await createDocument('quests', buildQuestPayload(form, currentUserId) as CreateDocument<Quest>)
    setIsSaving(false)

    if (!result.success) {
      showFeedback({ type: 'error', message: result.error?.message || 'Quest could not be created.' })
      return
    }

    closeModals()
    await refetch()
    showFeedback({ type: 'success', message: 'Quest created in Firestore.' })
  }

  const handleEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editingQuest) return

    setIsSaving(true)
    const result = await updateDocument('quests', editingQuest.id, buildQuestPayload(form, currentUserId, editingQuest) as UpdateDocument<Quest>)
    setIsSaving(false)

    if (!result.success) {
      showFeedback({ type: 'error', message: result.error?.message || 'Quest could not be updated.' })
      return
    }

    closeModals()
    await refetch()
    showFeedback({ type: 'success', message: 'Quest updated.' })
  }

  const handleDelete = async (quest: Quest) => {
    if (!window.confirm(`Delete "${quest.title}"? This cannot be undone.`)) return

    const result = await deleteDocument('quests', quest.id)
    if (!result.success) {
      showFeedback({ type: 'error', message: result.error?.message || 'Quest could not be deleted.' })
      return
    }

    await questsQuery.refetch()
    showFeedback({ type: 'success', message: 'Quest deleted.' })
  }

  const handleToggleActive = async (quest: Quest) => {
    const result = await updateDocument('quests', quest.id, { isActive: !quest.isActive } as UpdateDocument<Quest>)
    if (!result.success) {
      showFeedback({ type: 'error', message: result.error?.message || 'Status could not be updated.' })
      return
    }

    await questsQuery.refetch()
    showFeedback({ type: 'success', message: quest.isActive ? 'Quest deactivated.' : 'Quest activated.' })
  }

  const handleToggleFeatured = async (quest: Quest) => {
    const result = await updateDocument('quests', quest.id, { featured: !quest.featured } as UpdateDocument<Quest>)
    if (!result.success) {
      showFeedback({ type: 'error', message: result.error?.message || 'Featured status could not be updated.' })
      return
    }

    await questsQuery.refetch()
    showFeedback({ type: 'success', message: quest.featured ? 'Quest removed from featured.' : 'Quest marked as featured.' })
  }

  const openEdit = (quest: Quest) => {
    setEditingQuest(quest)
    setForm(questToForm(quest))
    setIsEditOpen(true)
  }

  const exportCsv = () => {
    const rows = [
      ['Title', 'Category', 'Difficulty', 'Status', 'Featured', 'Points', 'Submissions', 'Created'],
      ...filteredQuests.map((quest) => [
        quest.title,
        quest.category,
        quest.difficulty,
        quest.isActive ? 'active' : 'draft',
        quest.featured ? 'yes' : 'no',
        String(quest.points),
        String(submissionCounts[quest.id] ?? quest.submissionCount ?? 0),
        formatDate(quest.createdAt),
      ]),
    ]

    const csv = rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `quests-${new Date().toISOString().slice(0, 10)}.csv`
    link.click()
    URL.revokeObjectURL(url)
    showFeedback({ type: 'info', message: 'Quest export downloaded.' })
  }

  const isLoading = questsQuery.loading || submissionsQuery.loading
  const errorMessage = questsQuery.error?.message || submissionsQuery.error?.message

  return (
    <AdminLayout>
      <Box px={{ base: 5, md: 10, xl: 16 }} py={8} maxW="1440px" mx="auto">
        <Flex justify="space-between" align={{ base: 'start', md: 'center' }} gap={4} flexWrap="wrap" mb={6}>
          <Box>
            <Heading as="h1" size="lg" color="white" mb={2}>Manage Quests</Heading>
            <Text color="whiteAlpha.600">Create and manage Firestore-backed creative challenges.</Text>
          </Box>
          <HStack gap={3}>
            <Button
              bg="transparent"
              color="whiteAlpha.800"
              border="1px solid"
              borderColor="whiteAlpha.200"
              onClick={exportCsv}
            >
              <Download size={17} />
              Export
            </Button>
            <Button
              bg="brand.500"
              color="white"
              onClick={() => {
                setForm(emptyForm)
                setIsCreateOpen(true)
              }}
            >
              <Plus size={17} />
              New Quest
            </Button>
          </HStack>
        </Flex>

        <FeedbackBanner feedback={feedback} />

        {errorMessage && (
          <HStack mb={6} p={4} borderRadius="xl" bg="red.500/12" border="1px solid" borderColor="red.400/30" color="red.200">
            <AlertTriangle size={18} />
            <Text fontSize="sm">{errorMessage}</Text>
          </HStack>
        )}

        <SimpleGrid columns={{ base: 2, lg: 5 }} gap={4} mb={6}>
          <StatCard label="Total Quests" value={stats.total} accent="white" />
          <StatCard label="Active" value={stats.active} accent="green.300" />
          <StatCard label="Draft" value={stats.draft} accent="whiteAlpha.800" />
          <StatCard label="Featured" value={stats.featured} accent="brand.300" />
          <StatCard label="Submissions" value={stats.submissions} accent="blue.300" />
        </SimpleGrid>

        <Box p={4} borderRadius="2xl" bg="gray.900" border="1px solid" borderColor="whiteAlpha.100" mb={6}>
          <Flex gap={3} flexWrap="wrap" align="center">
            <Box position="relative" flex="1 1 280px">
              <Box position="absolute" left={3} top="50%" transform="translateY(-50%)" color="whiteAlpha.400">
                <Search size={18} />
              </Box>
              <Input
                pl={10}
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search quests..."
                bg="blackAlpha.300"
                borderColor="whiteAlpha.200"
                color="white"
              />
            </Box>

            <Box flex="1 1 180px">
              <select
                style={selectStyle}
                value={selectedCategory}
                onChange={(event) => setSelectedCategory(event.target.value as QuestCategory | 'all')}
              >
                {CATEGORIES.map((category) => (
                  <option key={category.id} value={category.id}>{category.label}</option>
                ))}
              </select>
            </Box>

            <Box flex="1 1 180px">
              <select
                style={selectStyle}
                value={selectedDifficulty}
                onChange={(event) => setSelectedDifficulty(event.target.value as QuestDifficulty | 'all')}
              >
                {DIFFICULTIES.map((difficulty) => (
                  <option key={difficulty.id} value={difficulty.id}>{difficulty.label}</option>
                ))}
              </select>
            </Box>

            <Box flex="1 1 160px">
              <select
                style={selectStyle}
                value={selectedStatus}
                onChange={(event) => setSelectedStatus(event.target.value as QuestStatusFilter)}
              >
                {STATUS_FILTERS.map((status) => (
                  <option key={status.id} value={status.id}>{status.label}</option>
                ))}
              </select>
            </Box>
          </Flex>
        </Box>

        {isLoading ? (
          <Flex justify="center" align="center" minH="240px">
            <Spinner color="brand.400" size="lg" />
          </Flex>
        ) : filteredQuests.length === 0 ? (
          <Box p={12} textAlign="center" borderRadius="2xl" bg="gray.900" border="1px solid" borderColor="whiteAlpha.100">
            <Text color="whiteAlpha.600">No quests match the current filters.</Text>
          </Box>
        ) : (
          <SimpleGrid columns={{ base: 1, xl: 2 }} gap={5}>
            {filteredQuests.map((quest) => (
              <QuestCard
                key={quest.id}
                quest={quest}
                submissionCount={submissionCounts[quest.id] ?? quest.submissionCount ?? 0}
                onEdit={openEdit}
                onDelete={handleDelete}
                onToggleActive={handleToggleActive}
                onToggleFeatured={handleToggleFeatured}
              />
            ))}
          </SimpleGrid>
        )}
      </Box>

      <AnimatePresence>
        {isCreateOpen && (
          <ModalBackdrop title="Create Quest" onClose={closeModals}>
            <QuestFormFields
              form={form}
              setForm={setForm}
              onSubmit={handleCreate}
              onCancel={closeModals}
              submitLabel="Create Quest"
              isSaving={isSaving}
            />
          </ModalBackdrop>
        )}

        {isEditOpen && editingQuest && (
          <ModalBackdrop title="Edit Quest" onClose={closeModals}>
            <QuestFormFields
              form={form}
              setForm={setForm}
              onSubmit={handleEdit}
              onCancel={closeModals}
              submitLabel="Save Changes"
              isSaving={isSaving}
            />
          </ModalBackdrop>
        )}
      </AnimatePresence>
    </AdminLayout>
  )
}
