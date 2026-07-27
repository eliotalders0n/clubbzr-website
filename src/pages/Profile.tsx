'use client'

import { useMemo, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'
import { Link, Navigate } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Mail,
  MessageCircle,
  Phone,
  Save,
  Tags,
  UserRound,
} from 'lucide-react'
import {
  Box,
  Button,
  Container,
  Flex,
  Heading,
  HStack,
  Input,
  SimpleGrid,
  Spinner,
  Text,
  VStack,
} from '@chakra-ui/react'

import { Footer } from '@/components/layout/Footer'
import { Header } from '@/components/layout/Header'
import { useAuth, type AuthContextValue } from '@/contexts/AuthContext'
import { useDocument } from '@/hooks/useFirestore'
import { createDefaultCreativePassport } from '@/lib/passportDefaults'
import { createDocumentWithId, updateDocument } from '../../lib/firestore'
import type { CreativePassport } from '../../lib/schema'

type Feedback = { type: 'success' | 'error'; message: string } | null

type ProfileForm = {
  displayName: string
  phone: string
  gender: string
  interests: string[]
  customInterests: string
}

const interestOptions = [
  'Visual art',
  'Photography',
  'Digital art',
  'Music',
  'Film',
  'Fashion',
  'Design',
  'Writing',
  'Performance',
  'Culture',
  'Technology',
  'Workshops',
  'Exhibitions',
  'Collaborations',
]

const interestOptionKeys = new Set(interestOptions.map((interest) => interest.toLowerCase()))

const genderOptions = [
  { value: '', label: 'Select gender' },
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'non_binary', label: 'Non-binary' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
]

const fieldStyles = {
  bg: 'gray.900',
  border: '1px solid',
  borderColor: 'whiteAlpha.200',
  color: 'white',
  minH: '48px',
  px: 4,
  borderRadius: 'xl',
  _placeholder: { color: 'whiteAlpha.400' },
  _hover: { borderColor: 'whiteAlpha.300' },
  _focus: { borderColor: 'brand.500', boxShadow: '0 0 0 1px var(--chakra-colors-brand-500)' },
}

const selectStyle: CSSProperties = {
  width: '100%',
  minHeight: '48px',
  padding: '0 16px',
  backgroundColor: 'var(--chakra-colors-gray-900)',
  border: '1px solid rgba(255,255,255,0.2)',
  borderRadius: '12px',
  color: 'white',
  outline: 'none',
}

const normalizeList = (items: string[]) => {
  const seen = new Set<string>()

  return items
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => {
      const key = item.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}

const splitList = (value: string) => normalizeList(value.split(/[\n,]/))

const buildInitialForm = (
  user: AuthContextValue['user'],
  firebaseUser: NonNullable<AuthContextValue['firebaseUser']>,
  passport: CreativePassport | null
): ProfileForm => ({
  displayName: user?.displayName || firebaseUser.displayName || '',
  phone: user?.whatsappPhone || user?.phone || '',
  gender: user?.gender || '',
  interests: normalizeList(passport?.interests || []),
  customInterests: '',
})

function Field({ label, helper, icon, children }: { label: string; helper?: string; icon: ReactNode; children: ReactNode }) {
  return (
    <Box>
      <HStack gap={2} mb={2} color="whiteAlpha.700">
        {icon}
        <Text color="white" fontWeight="semibold" fontSize="sm">
          {label}
        </Text>
      </HStack>
      {children}
      {helper && (
        <Text color="whiteAlpha.500" fontSize="xs" mt={2} lineHeight="tall">
          {helper}
        </Text>
      )}
    </Box>
  )
}

function InterestChip({ active, children, onClick }: { active: boolean; children: ReactNode; onClick: () => void }) {
  return (
    <Button
      type="button"
      h="40px"
      px={4}
      borderRadius="full"
      bg={active ? 'brand.500' : 'whiteAlpha.50'}
      color={active ? 'white' : 'whiteAlpha.800'}
      border="1px solid"
      borderColor={active ? 'brand.400' : 'whiteAlpha.200'}
      fontSize="sm"
      fontWeight="semibold"
      _hover={{ bg: active ? 'brand.600' : 'whiteAlpha.100', borderColor: active ? 'brand.500' : 'whiteAlpha.300' }}
      onClick={onClick}
    >
      {children}
    </Button>
  )
}

export default function Profile() {
  const { user, firebaseUser, initialized, loading: authLoading, updateProfile, refreshUser } = useAuth()
  const {
    data: passport,
    loading: passportLoading,
    refetch: refetchPassport,
  } = useDocument('creativePassports', firebaseUser?.uid, { skip: !firebaseUser?.uid })

  if (!initialized || authLoading || (firebaseUser && passportLoading)) {
    return (
      <Box bg="gray.950" minH="100vh">
        <Header />
        <Flex as="main" pt={32} pb={20} minH="100vh" align="center" justify="center">
          <HStack gap={3} color="whiteAlpha.600">
            <Spinner size="sm" color="brand.500" />
            <Text>Loading profile...</Text>
          </HStack>
        </Flex>
      </Box>
    )
  }

  if (!firebaseUser) {
    return <Navigate to="/auth/login" replace />
  }

  return (
    <ProfileFormScreen
      key={firebaseUser.uid}
      user={user}
      firebaseUser={firebaseUser}
      passport={passport}
      initialForm={buildInitialForm(user, firebaseUser, passport)}
      updateProfile={updateProfile}
      refreshUser={refreshUser}
      refetchPassport={refetchPassport}
    />
  )
}

function ProfileFormScreen({
  user,
  firebaseUser,
  passport,
  initialForm,
  updateProfile,
  refreshUser,
  refetchPassport,
}: {
  user: AuthContextValue['user']
  firebaseUser: NonNullable<AuthContextValue['firebaseUser']>
  passport: CreativePassport | null
  initialForm: ProfileForm
  updateProfile: AuthContextValue['updateProfile']
  refreshUser: AuthContextValue['refreshUser']
  refetchPassport: () => Promise<void>
}) {
  const [form, setForm] = useState<ProfileForm>(initialForm)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<Feedback>(null)

  const customInterests = useMemo(() => splitList(form.customInterests), [form.customInterests])
  const savedInterests = useMemo(
    () => normalizeList([...form.interests, ...customInterests]),
    [customInterests, form.interests]
  )
  const extraSavedInterests = useMemo(
    () => form.interests.filter((interest) => !interestOptionKeys.has(interest.toLowerCase())),
    [form.interests]
  )
  const saveSucceeded = feedback?.type === 'success'

  const toggleInterest = (interest: string) => {
    setFeedback(null)
    setForm((current) => ({
      ...current,
      interests: current.interests.some((item) => item.toLowerCase() === interest.toLowerCase())
        ? current.interests.filter((item) => item.toLowerCase() !== interest.toLowerCase())
        : [...current.interests, interest],
    }))
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!firebaseUser?.uid) return

    const displayName = form.displayName.trim()
    const phone = form.phone.trim()

    if (!displayName) {
      setFeedback({ type: 'error', message: 'Full names are required.' })
      return
    }

    if (!phone) {
      setFeedback({ type: 'error', message: 'WhatsApp number is required for session registrations and confirmations.' })
      return
    }

    setSaving(true)
    setFeedback(null)

    try {
      const profileResult = await updateProfile({
        displayName,
        phone,
        whatsappPhone: phone,
        gender: form.gender,
      })

      if (!profileResult.success) {
        setFeedback({
          type: 'error',
          message: profileResult.error?.message || 'Could not save your profile details.',
        })
        return
      }

      const passportResult = passport
        ? await updateDocument('creativePassports', firebaseUser.uid, { interests: savedInterests })
        : await createDocumentWithId('creativePassports', firebaseUser.uid, {
            ...createDefaultCreativePassport(firebaseUser.uid),
            interests: savedInterests,
          })

      if (!passportResult.success) {
        setFeedback({
          type: 'error',
          message: passportResult.error?.message || 'Profile saved, but interests could not be updated.',
        })
        return
      }

      await Promise.all([refreshUser(), refetchPassport()])
      setForm((current) => ({ ...current, interests: savedInterests, customInterests: '' }))
      setFeedback({ type: 'success', message: 'Your profile details have been saved.' })
    } catch (error) {
      console.error('Profile save failed:', error)
      setFeedback({ type: 'error', message: 'Could not save your profile details. Please try again.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Box bg="gray.950" minH="100vh">
      <Header />

      <Box as="main" pt={{ base: 28, md: 32 }} pb={20}>
        <Container maxW="1040px" px={{ base: 5, md: 10 }}>
          <HStack justify="space-between" align={{ base: 'start', md: 'center' }} gap={4} mb={8}>
            <Box>
              <Link to="/passport">
                <HStack gap={2} color="whiteAlpha.600" _hover={{ color: 'white' }} mb={4}>
                  <ArrowLeft size={16} />
                  <Text fontSize="sm" fontWeight="semibold">
                    Passport
                  </Text>
                </HStack>
              </Link>
              <Heading as="h1" color="white" fontSize={{ base: '3xl', md: '5xl' }} letterSpacing="normal">
                Profile
              </Heading>
              <Text color="whiteAlpha.600" mt={3} maxW="2xl">
                Manage the details Club BZR uses to identify you, contact you, and personalize creative recommendations.
              </Text>
            </Box>
          </HStack>

          {feedback && (
            <Box
              p={4}
              borderRadius="xl"
              bg={feedback.type === 'success' ? 'green.500/12' : 'red.500/12'}
              border="1px solid"
              borderColor={feedback.type === 'success' ? 'green.400/30' : 'red.400/30'}
              color={feedback.type === 'success' ? 'green.200' : 'red.200'}
              mb={6}
            >
              <HStack gap={3}>
                {feedback.type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
                <Text fontSize="sm" fontWeight="semibold">
                  {feedback.message}
                </Text>
              </HStack>
            </Box>
          )}

          <form onSubmit={handleSubmit}>
            <SimpleGrid columns={{ base: 1, lg: 3 }} gap={6} alignItems="start">
              <Box
                p={{ base: 5, md: 6 }}
                borderRadius="xl"
                bg="gray.900"
                border="1px solid"
                borderColor="whiteAlpha.100"
              >
                <VStack gap={5} align="stretch">
                  <Flex
                    w={24}
                    h={24}
                    borderRadius="2xl"
                    bg="brand.500"
                    align="center"
                    justify="center"
                    overflow="hidden"
                    border="1px solid"
                    borderColor="whiteAlpha.200"
                  >
                    {user?.photoURL || firebaseUser.photoURL ? (
                      <img
                        src={user?.photoURL || firebaseUser.photoURL || undefined}
                        alt={form.displayName || 'Profile'}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      <Text color="white" fontSize="3xl" fontWeight="bold">
                        {(form.displayName || user?.email || firebaseUser.email || 'U').charAt(0).toUpperCase()}
                      </Text>
                    )}
                  </Flex>

                  <Box>
                    <Text color="white" fontWeight="bold" fontSize="lg" lineClamp={1}>
                      {form.displayName || 'Your profile'}
                    </Text>
                    <HStack gap={2} color="whiteAlpha.500" mt={1}>
                      <Mail size={14} />
                      <Text fontSize="sm" lineClamp={1}>
                        {user?.email || firebaseUser.email}
                      </Text>
                    </HStack>
                  </Box>

                  <Box p={4} borderRadius="xl" bg="blackAlpha.300" border="1px solid" borderColor="whiteAlpha.100">
                    <HStack gap={2} color="brand.300" mb={2}>
                      <MessageCircle size={17} />
                      <Text color="white" fontSize="sm" fontWeight="semibold">
                        WhatsApp contact
                      </Text>
                    </HStack>
                    <Text color="whiteAlpha.500" fontSize="sm" lineHeight="tall">
                      This number is for Club BZR updates and direct event communication.
                    </Text>
                  </Box>
                </VStack>
              </Box>

              <Box
                gridColumn={{ base: 'auto', lg: 'span 2' }}
                p={{ base: 5, md: 6 }}
                borderRadius="xl"
                bg="gray.900"
                border="1px solid"
                borderColor="whiteAlpha.100"
              >
                <VStack gap={6} align="stretch">
                  <SimpleGrid columns={{ base: 1, md: 2 }} gap={5}>
                    <Field label="Full names" icon={<UserRound size={17} />}>
                      <Input
                        value={form.displayName}
                        onChange={(event) => {
                          setFeedback(null)
                          setForm((current) => ({ ...current, displayName: event.target.value }))
                        }}
                        placeholder="Your full names"
                        autoComplete="name"
                        {...fieldStyles}
                      />
                    </Field>

                    <Field
                      label="WhatsApp number"
                      icon={<Phone size={17} />}
                      helper="Required for session registrations and Club BZR confirmation messages. Use an international format where possible, for example +260..."
                    >
                      <Input
                        value={form.phone}
                        onChange={(event) => {
                          setFeedback(null)
                          setForm((current) => ({ ...current, phone: event.target.value }))
                        }}
                        placeholder="+260..."
                        autoComplete="tel"
                        inputMode="tel"
                        {...fieldStyles}
                      />
                    </Field>
                  </SimpleGrid>

                  <Field label="Gender" icon={<UserRound size={17} />}>
                    <select
                      value={form.gender}
                      onChange={(event) => {
                        setFeedback(null)
                        setForm((current) => ({ ...current, gender: event.target.value }))
                      }}
                      style={selectStyle}
                    >
                      {genderOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Box>
                    <HStack gap={2} mb={3} color="whiteAlpha.700">
                      <Tags size={17} />
                      <Text color="white" fontWeight="semibold" fontSize="sm">
                        Interests
                      </Text>
                    </HStack>
                    <HStack gap={2} flexWrap="wrap">
                      {interestOptions.map((interest) => (
                        <InterestChip
                          key={interest}
                          active={form.interests.some((item) => item.toLowerCase() === interest.toLowerCase())}
                          onClick={() => toggleInterest(interest)}
                        >
                          {interest}
                        </InterestChip>
                      ))}
                      {extraSavedInterests.map((interest) => (
                        <InterestChip key={interest} active onClick={() => toggleInterest(interest)}>
                          {interest}
                        </InterestChip>
                      ))}
                    </HStack>
                    <Box mt={4}>
                      <Input
                        value={form.customInterests}
                        onChange={(event) => {
                          setFeedback(null)
                          setForm((current) => ({ ...current, customInterests: event.target.value }))
                        }}
                        placeholder="Add other interests separated by commas"
                        {...fieldStyles}
                      />
                    </Box>
                    {savedInterests.length > 0 && (
                      <Text color="whiteAlpha.500" fontSize="xs" mt={3}>
                        {savedInterests.length} {savedInterests.length === 1 ? 'interest' : 'interests'} selected
                      </Text>
                    )}
                  </Box>

                  {feedback && (
                    <Box
                      p={3}
                      borderRadius="xl"
                      bg={feedback.type === 'success' ? 'green.500/12' : 'red.500/12'}
                      border="1px solid"
                      borderColor={feedback.type === 'success' ? 'green.400/30' : 'red.400/30'}
                      color={feedback.type === 'success' ? 'green.200' : 'red.200'}
                    >
                      <HStack gap={2}>
                        {feedback.type === 'success' ? <CheckCircle2 size={17} /> : <AlertTriangle size={17} />}
                        <Text fontSize="sm" fontWeight="semibold">
                          {feedback.message}
                        </Text>
                      </HStack>
                    </Box>
                  )}

                  <HStack justify="flex-end" gap={3} pt={2} flexWrap="wrap">
                    <Link to="/passport">
                      <Button
                        type="button"
                        h="46px"
                        px={5}
                        borderRadius="full"
                        bg="whiteAlpha.50"
                        color="whiteAlpha.800"
                        border="1px solid"
                        borderColor="whiteAlpha.200"
                        _hover={{ bg: 'whiteAlpha.100' }}
                      >
                        Cancel
                      </Button>
                    </Link>
                    <Button
                      type="submit"
                      h="46px"
                      px={6}
                      gap={2}
                      borderRadius="full"
                      bg={saveSucceeded ? 'green.500' : 'brand.500'}
                      color="white"
                      disabled={saving}
                      _hover={{ bg: saveSucceeded ? 'green.600' : 'brand.600' }}
                    >
                      {saving ? <Spinner size="sm" /> : saveSucceeded ? <CheckCircle2 size={17} /> : <Save size={17} />}
                      {saving ? 'Saving...' : saveSucceeded ? 'Saved' : 'Save Profile'}
                    </Button>
                  </HStack>
                </VStack>
              </Box>
            </SimpleGrid>
          </form>
        </Container>
      </Box>

      <Footer />
    </Box>
  )
}
