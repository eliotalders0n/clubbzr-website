'use client'

import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  Box,
  Flex,
  Heading,
  Text,
  Button,
  Input,
  VStack,
  HStack,
  Image,
} from '@chakra-ui/react'
import { motion, AnimatePresence } from 'framer-motion'

import logoWhite from '@/assets/logos/Club BZR logo (RED).png'
import { useAuth } from '@/contexts/AuthContext'

const MotionBox = motion.create(Box)

type AuthMode = 'login' | 'signup' | 'forgot-password'

export default function Auth() {
  const location = useLocation()
  const navigate = useNavigate()
  const {
    signInWithEmail,
    signUpWithEmail,
    signInWithGoogle,
    resetPassword,
    loading: authLoading,
    error: authError,
    clearError,
    user,
  } = useAuth()

  const getInitialMode = (): AuthMode => {
    if (location.pathname.includes('signup')) return 'signup'
    if (location.pathname.includes('forgot')) return 'forgot-password'
    return 'login'
  }

  const [mode, setMode] = useState<AuthMode>(getInitialMode())
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Redirect if already authenticated
  useEffect(() => {
    if (user) {
      navigate('/passport')
    }
  }, [user, navigate])

  useEffect(() => {
    setMode(getInitialMode())
  }, [location.pathname])

  // Clear errors when switching modes
  useEffect(() => {
    clearError()
    setLocalError(null)
    setSuccessMessage(null)
  }, [mode, clearError])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLocalError(null)
    setSuccessMessage(null)

    if (mode === 'signup') {
      // Validate password confirmation
      if (password !== confirmPassword) {
        setLocalError('Passwords do not match.')
        return
      }
      if (password.length < 6) {
        setLocalError('Password must be at least 6 characters.')
        return
      }

      const result = await signUpWithEmail({ email, password, displayName })
      if (result.success) {
        navigate('/passport')
      }
    } else if (mode === 'login') {
      const result = await signInWithEmail({ email, password })
      if (result.success) {
        navigate('/passport')
      }
    } else if (mode === 'forgot-password') {
      const result = await resetPassword(email)
      if (result.success) {
        setSuccessMessage('Password reset email sent! Check your inbox.')
      }
    }
  }

  const handleGoogleSignIn = async () => {
    setLocalError(null)
    const result = await signInWithGoogle()
    if (result.success) {
      navigate('/passport')
    }
  }

  const errorMessage = localError || authError?.message

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode)
    const path =
      newMode === 'login'
        ? '/auth/login'
        : newMode === 'signup'
          ? '/auth/signup'
          : '/auth/forgot-password'
    window.history.pushState({}, '', path)
  }

  const features = [
    'Access exclusive quests and challenges',
    'Connect with artists globally',
    'Build your creative passport',
    'Earn badges and achievements',
  ]

  return (
    <Box bg="gray.950" minH="100vh">
      <Flex minH="100vh">
        {/* Left Side - Branding */}
        <Box
          display={{ base: 'none', lg: 'flex' }}
          w="50%"
          position="relative"
          overflow="hidden"
          flexDirection="column"
          justifyContent="center"
          px={16}
        >
          {/* Background gradient */}
          <Box
            position="absolute"
            inset={0}
            bgGradient="linear(to-br, brand.500/20, gray.950, green.500/10)"
          />

          {/* Floating circles */}
          <Box position="absolute" inset={0} overflow="hidden">
            {[...Array(5)].map((_, i) => (
              <MotionBox
                key={i}
                position="absolute"
                borderRadius="full"
                opacity={0.1}
                border="1px solid"
                borderColor="whiteAlpha.200"
                w={`${200 + i * 100}px`}
                h={`${200 + i * 100}px`}
                left={`${20 + i * 10}%`}
                top={`${10 + i * 15}%`}
                animate={{
                  scale: [1, 1.2, 1],
                  rotate: [0, 180, 360],
                }}
                transition={{
                  duration: 20 + i * 5,
                  repeat: Infinity,
                  ease: 'linear',
                }}
              />
            ))}
          </Box>

          {/* Content */}
          <Box position="relative" zIndex={2}>
            <Link to="/">
              <Image src={logoWhite} alt="Club BZR" h={420} mb={12} />
            </Link>

            <MotionBox
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Heading
                as="h2"
                fontSize={{ base: '3xl', xl: '4xl' }}
                color="white"
                fontFamily="heading"
                mb={6}
                lineHeight={1.2}
              >
                Join the creative<br />revolution
              </Heading>
              <Text color="whiteAlpha.600" fontSize="lg" maxW="md">
                Connect with artists worldwide. Create, collaborate, and explore digital art like never before.
              </Text>
            </MotionBox>

            <VStack align="stretch" gap={4} mt={12}>
              {features.map((feature, i) => (
                <MotionBox
                  key={feature}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + i * 0.1 }}
                >
                  <HStack gap={3}>
                    <Box
                      w={5}
                      h={5}
                      borderRadius="full"
                      bg="green.500/20"
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3">
                        <path d="M5 13l4 4L19 7" />
                      </svg>
                    </Box>
                    <Text color="whiteAlpha.700">{feature}</Text>
                  </HStack>
                </MotionBox>
              ))}
            </VStack>
          </Box>
        </Box>

        {/* Right Side - Auth Form */}
        <Flex
          w={{ base: '100%', lg: '50%' }}
          alignItems="center"
          justifyContent="center"
          px={6}
          py={12}
        >
          <Box w="full" maxW="md">
            {/* Mobile Logo */}
            <Box display={{ base: 'block', lg: 'none' }} mb={8} textAlign="center">
              <Link to="/">
                <Image src={logoWhite} alt="Club BZR" h={110} mx="auto" />
              </Link>
            </Box>

            {/* Form Container */}
            <MotionBox
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              p={8}
              borderRadius="2xl"
              bg="gray.900"
              border="1px solid"
              borderColor="whiteAlpha.100"
            >
              {/* Header */}
              <Box textAlign="center" mb={8}>
                <AnimatePresence mode="wait">
                  <MotionBox
                    key={mode}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                  >
                    <Heading as="h2" fontSize="2xl" color="white" fontFamily="heading" mb={2}>
                      {mode === 'login' && 'Welcome back'}
                      {mode === 'signup' && 'Create account'}
                      {mode === 'forgot-password' && 'Reset password'}
                    </Heading>
                    <Text color="whiteAlpha.500">
                      {mode === 'login' && 'Sign in to continue your creative journey'}
                      {mode === 'signup' && 'Join the Club BZR community'}
                      {mode === 'forgot-password' && "We'll send you a reset link"}
                    </Text>
                  </MotionBox>
                </AnimatePresence>
              </Box>

              {/* Form */}
              <VStack as="form" onSubmit={handleSubmit} gap={5} align="stretch">
                {/* Display Name (Signup only) */}
                {mode === 'signup' && (
                  <Box>
                    <Text color="whiteAlpha.600" fontSize="sm" mb={2}>
                      Display Name
                    </Text>
                    <Input
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Your name"
                      bg="gray.800"
                      border="1px solid"
                      borderColor="whiteAlpha.200"
                      borderRadius="xl"
                      color="white"
                      py={6}
                      px={4}
                      _placeholder={{ color: 'whiteAlpha.400' }}
                      _focus={{ borderColor: 'brand.500' }}
                      required
                    />
                  </Box>
                )}

                {/* Email */}
                <Box>
                  <Text color="whiteAlpha.600" fontSize="sm" mb={2}>
                    Email
                  </Text>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    bg="gray.800"
                    border="1px solid"
                    borderColor="whiteAlpha.200"
                    borderRadius="xl"
                    color="white"
                    py={6}
                    px={4}
                    _placeholder={{ color: 'whiteAlpha.400' }}
                    _focus={{ borderColor: 'brand.500' }}
                    required
                  />
                </Box>

                {/* Password */}
                {mode !== 'forgot-password' && (
                  <Box>
                    <Text color="whiteAlpha.600" fontSize="sm" mb={2}>
                      Password
                    </Text>
                    <Box position="relative">
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        bg="gray.800"
                        border="1px solid"
                        borderColor="whiteAlpha.200"
                        borderRadius="xl"
                        color="white"
                        py={6}
                        px={4}
                        pr={12}
                        _placeholder={{ color: 'whiteAlpha.400' }}
                        _focus={{ borderColor: 'brand.500' }}
                        required
                      />
                      <Button
                        position="absolute"
                        right={2}
                        top="50%"
                        transform="translateY(-50%)"
                        size="sm"
                        variant="ghost"
                        color="whiteAlpha.500"
                        _hover={{ color: 'white', bg: 'transparent' }}
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      </Button>
                    </Box>
                  </Box>
                )}

                {/* Confirm Password (Signup only) */}
                {mode === 'signup' && (
                  <Box>
                    <Text color="whiteAlpha.600" fontSize="sm" mb={2}>
                      Confirm Password
                    </Text>
                    <Box position="relative">
                      <Input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        bg="gray.800"
                        border="1px solid"
                        borderColor="whiteAlpha.200"
                        borderRadius="xl"
                        color="white"
                        py={6}
                        px={4}
                        pr={12}
                        _placeholder={{ color: 'whiteAlpha.400' }}
                        _focus={{ borderColor: 'brand.500' }}
                        required
                      />
                      <Button
                        position="absolute"
                        right={2}
                        top="50%"
                        transform="translateY(-50%)"
                        size="sm"
                        variant="ghost"
                        color="whiteAlpha.500"
                        _hover={{ color: 'white', bg: 'transparent' }}
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      </Button>
                    </Box>
                  </Box>
                )}

                {/* Forgot Password Link (Login only) */}
                {mode === 'login' && (
                  <Box textAlign="right">
                    <Button
                      variant="ghost"
                      color="brand.500"
                      fontSize="sm"
                      fontWeight="normal"
                      onClick={() => switchMode('forgot-password')}
                      _hover={{ color: 'brand.400' }}
                    >
                      Forgot password?
                    </Button>
                  </Box>
                )}

                {/* Error Message */}
                {errorMessage && (
                  <Box
                    bg="red.500/10"
                    border="1px solid"
                    borderColor="red.500/30"
                    borderRadius="xl"
                    px={4}
                    py={3}
                  >
                    <Text color="red.400" fontSize="sm">
                      {errorMessage}
                    </Text>
                  </Box>
                )}

                {/* Success Message */}
                {successMessage && (
                  <Box
                    bg="green.500/10"
                    border="1px solid"
                    borderColor="green.500/30"
                    borderRadius="xl"
                    px={4}
                    py={3}
                  >
                    <Text color="green.400" fontSize="sm">
                      {successMessage}
                    </Text>
                  </Box>
                )}

                {/* Submit Button */}
                <Button
                  type="submit"
                  bg="brand.500"
                  color="white"
                  w="full"
                  py={6}
                  borderRadius="xl"
                  fontSize="md"
                  fontWeight="medium"
                  _hover={{ bg: 'brand.600' }}
                  loading={authLoading}
                >
                  {mode === 'login' && 'Sign In'}
                  {mode === 'signup' && 'Create Account'}
                  {mode === 'forgot-password' && 'Send Reset Link'}
                </Button>

                {/* Divider */}
                {mode !== 'forgot-password' && (
                  <Flex align="center" gap={4}>
                    <Box flex={1} h="1px" bg="whiteAlpha.200" />
                    <Text color="whiteAlpha.400" fontSize="sm">
                      or continue with
                    </Text>
                    <Box flex={1} h="1px" bg="whiteAlpha.200" />
                  </Flex>
                )}

                {/* Google Sign In */}
                {mode !== 'forgot-password' && (
                  <Button
                    type="button"
                    bg="transparent"
                    color="white"
                    w="full"
                    py={6}
                    borderRadius="xl"
                    border="1px solid"
                    borderColor="whiteAlpha.200"
                    fontSize="md"
                    fontWeight="medium"
                    _hover={{ bg: 'whiteAlpha.50' }}
                    onClick={handleGoogleSignIn}
                    loading={authLoading}
                  >
                    <HStack gap={3}>
                      <svg width="20" height="20" viewBox="0 0 24 24">
                        <path
                          fill="#4285F4"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        />
                      </svg>
                      <Text>Google</Text>
                    </HStack>
                  </Button>
                )}
              </VStack>

              {/* Mode Toggle */}
              <Box mt={8} textAlign="center">
                {mode === 'login' && (
                  <Text color="whiteAlpha.500">
                    Don't have an account?{' '}
                    <Button
                      variant="ghost"
                      color="brand.500"
                      fontWeight="medium"
                      onClick={() => switchMode('signup')}
                      _hover={{ color: 'brand.400' }}
                    >
                      Sign up
                    </Button>
                  </Text>
                )}
                {mode === 'signup' && (
                  <Text color="whiteAlpha.500">
                    Already have an account?{' '}
                    <Button
                      variant="ghost"
                      color="brand.500"
                      fontWeight="medium"
                      onClick={() => switchMode('login')}
                      _hover={{ color: 'brand.400' }}
                    >
                      Sign in
                    </Button>
                  </Text>
                )}
                {mode === 'forgot-password' && (
                  <Text color="whiteAlpha.500">
                    Remember your password?{' '}
                    <Button
                      variant="ghost"
                      color="brand.500"
                      fontWeight="medium"
                      onClick={() => switchMode('login')}
                      _hover={{ color: 'brand.400' }}
                    >
                      Sign in
                    </Button>
                  </Text>
                )}
              </Box>

              {/* Terms */}
              {mode === 'signup' && (
                <Text mt={6} fontSize="xs" color="whiteAlpha.400" textAlign="center">
                  By creating an account, you agree to our{' '}
                  <Link to="/terms">
                    <Text as="span" color="brand.500" _hover={{ textDecoration: 'underline' }}>
                      Terms of Service
                    </Text>
                  </Link>{' '}
                  and{' '}
                  <Link to="/privacy">
                    <Text as="span" color="brand.500" _hover={{ textDecoration: 'underline' }}>
                      Privacy Policy
                    </Text>
                  </Link>
                </Text>
              )}
            </MotionBox>

            {/* Back to Home */}
            <Box mt={8} textAlign="center">
              <Link to="/">
                <HStack gap={2} justify="center" color="whiteAlpha.500" _hover={{ color: 'white' }} transition="color 0.2s">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  <Text fontSize="sm">Back to home</Text>
                </HStack>
              </Link>
            </Box>
          </Box>
        </Flex>
      </Flex>
    </Box>
  )
}
