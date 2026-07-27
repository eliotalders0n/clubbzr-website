'use client'

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  Box,
  Button,
  Flex,
  Heading,
  HStack,
  Input,
  Spinner,
  Text,
  VStack,
} from '@chakra-ui/react'
import { CheckCircle2, Loader2, Smartphone, X } from 'lucide-react'

import {
  chargeSessionMobileMoney,
  checkSessionMomoStatus,
  type MobileMoneyOperator,
  type SessionMobileMoneyResponse,
} from '../../../../lib/lenco'

interface SessionPaymentModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  sessionId: string
  registrationId: string
  sessionTitle: string
  amount: number
  currency: string
  defaultPhoneNumber?: string
  existingTransactionId?: string
  existingReference?: string
}

type PaymentUiStatus = 'idle' | 'initiating' | 'pending' | 'success'

const normalizePhoneNumber = (value: string): string => value.replace(/[^\d+]/g, '')

const createPaymentReference = (): string => {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = new Uint8Array(4)
    crypto.getRandomValues(bytes)
    const suffix = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
    return `club_bzr_${Date.now()}_${suffix}`
  }

  return `club_bzr_${Date.now()}_${Math.random().toString(16).slice(2, 10).padEnd(8, '0')}`
}

const getPaymentErrorCode = (error: unknown): string => {
  if (typeof error === 'object' && error && 'code' in error) {
    const code = (error as { code?: unknown }).code
    return typeof code === 'string' ? code : ''
  }

  return ''
}

const isRecoverablePaymentError = (error: unknown): boolean => {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true

  const code = getPaymentErrorCode(error)
  if (!code) return true

  return [
    'deadline-exceeded',
    'functions/deadline-exceeded',
    'functions/internal',
    'functions/resource-exhausted',
    'functions/unavailable',
    'internal',
    'resource-exhausted',
    'unavailable',
  ].includes(code)
}

const isValidPhoneNumber = (value: string): boolean => {
  const digits = value.replace(/\D/g, '')
  return digits.length >= 9 && digits.length <= 12
}

export function SessionPaymentModal({
  isOpen,
  onClose,
  onSuccess,
  sessionId,
  registrationId,
  sessionTitle,
  amount,
  currency,
  defaultPhoneNumber,
  existingTransactionId,
  existingReference,
}: SessionPaymentModalProps) {
  const [phoneNumber, setPhoneNumber] = useState(() => normalizePhoneNumber(defaultPhoneNumber || ''))
  const [operator, setOperator] = useState<MobileMoneyOperator>('airtel')
  const [status, setStatus] = useState<PaymentUiStatus>('idle')
  const [error, setError] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [transaction, setTransaction] = useState<SessionMobileMoneyResponse | null>(null)
  const [clientReference, setClientReference] = useState('')

  const handleClose = useCallback(() => {
    setPhoneNumber(normalizePhoneNumber(defaultPhoneNumber || ''))
    setOperator('airtel')
    setStatus('idle')
    setError('')
    setStatusMessage('')
    setTransaction(null)
    setClientReference('')
    onClose()
  }, [defaultPhoneNumber, onClose])

  const resumableTransaction = useMemo<SessionMobileMoneyResponse | null>(() => {
    if (!isOpen || transaction || (!existingTransactionId && !existingReference)) return null

    return {
      success: false,
      transactionId: existingTransactionId || existingReference || '',
      reference: existingReference || existingTransactionId || '',
      status: 'pending',
      message: 'Checking existing mobile money payment.',
    }
  }, [existingReference, existingTransactionId, isOpen, transaction])

  const activeTransaction = transaction || resumableTransaction

  useEffect(() => {
    if (!activeTransaction || (status !== 'pending' && !resumableTransaction)) return

    let cancelled = false
    let attempts = 0

    const pollStatus = async () => {
      attempts += 1

      try {
        const result = await checkSessionMomoStatus({
          transactionId: activeTransaction.transactionId,
          reference: activeTransaction.reference,
        })

        if (cancelled) return

        if (result.status === 'completed') {
          setClientReference('')
          setStatus('success')
          setStatusMessage(result.message || 'Payment completed successfully.')
          window.setTimeout(() => {
            void Promise.resolve(onSuccess()).finally(handleClose)
          }, 1200)
          return
        }

        if (result.status === 'failed') {
          setClientReference('')
          setStatus('idle')
          setError(result.failureReason || result.message || 'Payment failed.')
          return
        }

        setStatusMessage(result.message || 'Waiting for mobile money confirmation.')
        setError(result.recoverable ? 'Temporary connection issue. Your payment is still pending.' : '')

        if (attempts >= 12) {
          setStatusMessage('Payment is still pending. You can keep this open, or close it and check again later.')
          setError('')
        }
      } catch (pollError) {
        if (cancelled) return
        const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false
        setStatusMessage(
          isOffline
            ? 'You appear to be offline. Your payment is still pending and will be checked again when the connection returns.'
            : 'Could not reach the payment provider. Your payment is still pending and we will keep checking.'
        )
        setError(pollError instanceof Error ? pollError.message : 'Temporary connection issue.')
      }
    }

    void pollStatus()
    const intervalId = window.setInterval(() => {
      void pollStatus()
    }, 5000)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [activeTransaction, handleClose, onSuccess, resumableTransaction, status])

  const formattedAmount = useMemo(
    () => `${currency} ${amount.toFixed(2)}`,
    [amount, currency]
  )
  const paymentInProgress = status === 'initiating' || status === 'pending' || Boolean(resumableTransaction)

  if (!isOpen) return null

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()

    if (!isValidPhoneNumber(phoneNumber)) {
      setError('Enter a valid Zambian mobile money number before continuing.')
      return
    }

    setError('')
    setStatusMessage('')
    setStatus('initiating')

    try {
      const paymentReference = clientReference || createPaymentReference()
      setClientReference(paymentReference)

      const result = await chargeSessionMobileMoney({
        sessionId,
        registrationId,
        phone: phoneNumber,
        operator,
        currency,
        reference: paymentReference,
      })

      setClientReference(result.reference)
      setTransaction(result)

      if (result.status === 'completed') {
        setClientReference('')
        setStatus('success')
        setStatusMessage(result.message || 'Payment completed successfully.')
        window.setTimeout(() => {
          void Promise.resolve(onSuccess()).finally(handleClose)
        }, 1200)
        return
      }

      if (result.status === 'failed') {
        setClientReference('')
        setStatus('idle')
        setError(result.failureReason || result.message || 'Payment failed.')
        return
      }

      setStatus('pending')
      setStatusMessage(result.message || 'Approve the payment request on your phone.')
    } catch (paymentError) {
      const recoverable = isRecoverablePaymentError(paymentError)
      const message = paymentError instanceof Error ? paymentError.message : 'Unable to start payment.'
      if (!recoverable) setClientReference('')
      setStatus('idle')
      setError(
        recoverable
          ? `${message} You can try again; the same payment request will be reused.`
          : message
      )
    }
  }

  return (
    <Flex position="fixed" inset={0} zIndex={100} bg="blackAlpha.800" align="center" justify="center" p={4}>
      <Box
        bg="gray.900"
        border="1px solid"
        borderColor="whiteAlpha.150"
        borderRadius="2xl"
        maxW="460px"
        w="full"
        overflow="hidden"
      >
        <Flex justify="space-between" align="center" p={5} borderBottom="1px solid" borderColor="whiteAlpha.100">
          <Box minW={0}>
            <Heading as="h2" size="sm" color="white">Mobile Money Payment</Heading>
            <Text color="whiteAlpha.500" fontSize="sm" mt={1} lineClamp={1}>{sessionTitle}</Text>
          </Box>
          <Button onClick={handleClose} size="sm" bg="whiteAlpha.100" color="white" borderRadius="full" _hover={{ bg: 'whiteAlpha.200' }}>
            <X size={16} />
          </Button>
        </Flex>

        <Box p={5}>
          {status === 'success' ? (
            <VStack gap={4} py={8} textAlign="center">
              <Flex boxSize="64px" borderRadius="full" bg="green.500/15" color="green.300" align="center" justify="center">
                <CheckCircle2 size={32} />
              </Flex>
              <Box>
                <Text color="white" fontWeight="semibold" fontSize="lg">Payment received</Text>
                <Text color="whiteAlpha.600" mt={1}>{statusMessage}</Text>
              </Box>
            </VStack>
          ) : (
            <form onSubmit={handleSubmit}>
              <VStack align="stretch" gap={5}>
                <Box p={4} bg="whiteAlpha.50" border="1px solid" borderColor="whiteAlpha.100" borderRadius="xl">
                  <Text color="whiteAlpha.500" fontSize="xs" textTransform="uppercase" letterSpacing="0.12em">
                    Amount
                  </Text>
                  <Text color="white" fontSize="2xl" fontWeight="bold" mt={1}>{formattedAmount}</Text>
                  <Text color="whiteAlpha.500" fontSize="sm" mt={2}>
                    Your payment will be reviewed by Club BZR before your spot is confirmed.
                  </Text>
                </Box>

                <Box>
                  <Text color="whiteAlpha.600" fontSize="sm" mb={2}>Mobile Money Network</Text>
                  <HStack gap={3}>
                    {(['airtel', 'mtn'] as MobileMoneyOperator[]).map((network) => (
                      <Button
                        key={network}
                        type="button"
                        flex={1}
                        h="44px"
                        borderRadius="xl"
                        bg={operator === network ? 'brand.500' : 'whiteAlpha.100'}
                        color="white"
                        border="1px solid"
                        borderColor={operator === network ? 'brand.500' : 'whiteAlpha.200'}
                        _hover={{ bg: operator === network ? 'brand.600' : 'whiteAlpha.200' }}
                        onClick={() => setOperator(network)}
                        disabled={paymentInProgress}
                        textTransform="capitalize"
                      >
                        {network === 'airtel' ? 'Airtel Money' : 'MTN MoMo'}
                      </Button>
                    ))}
                  </HStack>
                </Box>

                <Box>
                  <Text color="whiteAlpha.600" fontSize="sm" mb={2}>Mobile Money Number</Text>
                  <Box position="relative">
                    <Flex position="absolute" left={3} top="50%" transform="translateY(-50%)" color="whiteAlpha.500" pointerEvents="none">
                      <Smartphone size={18} />
                    </Flex>
                    <Input
                      type="tel"
                      value={phoneNumber}
                      onChange={(event) => {
                        setPhoneNumber(normalizePhoneNumber(event.target.value))
                        if (error) setError('')
                      }}
                      pl={10}
                      h="46px"
                      bg="gray.800"
                      color="white"
                      borderColor="whiteAlpha.200"
                      placeholder="0971234567"
                      disabled={paymentInProgress}
                    />
                  </Box>
                  {(statusMessage || resumableTransaction) && (
                    <Text color="blue.200" fontSize="sm" mt={2}>
                      {statusMessage || 'Checking existing mobile money payment.'}
                    </Text>
                  )}
                  {error && <Text color="red.300" fontSize="sm" mt={2}>{error}</Text>}
                </Box>

                <Button
                  type="submit"
                  h="48px"
                  bg="brand.500"
                  color="white"
                  borderRadius="xl"
                  _hover={{ bg: 'brand.600' }}
                  disabled={paymentInProgress || !phoneNumber}
                >
                  {status === 'initiating' ? (
                    <>
                      <Loader2 size={18} />
                      Starting payment...
                    </>
                  ) : status === 'pending' || resumableTransaction ? (
                    <>
                      <Spinner size="sm" />
                      Waiting for confirmation...
                    </>
                  ) : (
                    `Pay ${formattedAmount}`
                  )}
                </Button>
              </VStack>
            </form>
          )}
        </Box>
      </Box>
    </Flex>
  )
}
