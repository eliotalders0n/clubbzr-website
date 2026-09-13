import { useEffect, useRef, type FormEvent } from 'react'
import { Box, Button, Flex, Text } from '@chakra-ui/react'
import { Banknote, Coins, Phone, Signal, Smartphone, Wallet as WalletIcon, Zap } from 'lucide-react'

import { Modal } from '@/components/ui/Modal'

const ACCENT = '#f47742'
const OPERATOR_COLORS: Record<string, string> = {
  mtn: '#FFCC00',
  airtel: '#E40000',
  zamtel: '#009A44',
}
const FIELD_BG = '#0d0d0d'
const FIELD_BORDER = '#333'

export interface BuyPointsSettings {
  enabled: boolean
  minNgwee: number | null
  maxNgwee: number | null
  pointsPerZmw: number | null
}

export interface BuyPointsModalProps {
  isOpen: boolean
  onClose: () => void
  amount: string
  onAmountChange: (value: string) => void
  phone: string
  onPhoneChange: (value: string) => void
  operator: 'mtn' | 'airtel' | 'zamtel'
  onOperatorChange: (value: 'mtn' | 'airtel' | 'zamtel') => void
  settings: BuyPointsSettings | null
  previewPoints: number | null
  purchasing: boolean
  feedback: { type: 'error' | 'success'; message: string } | null
  onSubmit: (event: FormEvent) => void
}

function formatZmw(ngwee: number) {
  return `ZMW ${(ngwee / 100).toFixed(2)}`
}

/** Label paired with the icon that identifies the field at a glance. */
function FieldLabel({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Flex align="center" gap={2} mb={2}>
      <Box color="whiteAlpha.700" display="flex">{icon}</Box>
      <Text fontSize="sm" fontWeight="medium" color="white">{children}</Text>
    </Flex>
  )
}

export function BuyPointsModal({
  isOpen,
  onClose,
  amount,
  onAmountChange,
  phone,
  onPhoneChange,
  operator,
  onOperatorChange,
  settings,
  previewPoints,
  purchasing,
  feedback,
  onSubmit,
}: BuyPointsModalProps) {
  const amountRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (!isOpen) return
    // The shared modal focuses its close button first; move to the first field.
    const timer = window.setTimeout(() => amountRef.current?.focus(), 60)
    return () => window.clearTimeout(timer)
  }, [isOpen])

  const rate = settings?.pointsPerZmw
  const hasLimits = Boolean(settings?.minNgwee && settings?.maxNgwee)

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Buy points"
      icon={<Coins size={26} color={ACCENT} strokeWidth={2} />}
      description="Points arrive once Lenco confirms payment."
      size="md"
      className="max-h-[calc(100dvh-2rem)] overflow-y-auto"
    >
      <Box as="form" onSubmit={onSubmit} pt={{ base: 1, md: 3 }}>
        {rate && (
          <Flex
            align="center"
            gap={{ base: 3, md: 4 }}
            mb={{ base: 5, md: 7 }}
            px={{ base: 3.5, md: 4 }}
            py={{ base: 3, md: 4 }}
            rounded="2xl"
            border="1px solid"
            borderColor={ACCENT}
            bg="rgba(244, 119, 66, 0.08)"
          >
            <Flex
              align="center"
              justify="center"
              flexShrink={0}
              w={{ base: '38px', md: '46px' }}
              h={{ base: '38px', md: '46px' }}
              rounded="full"
              bg="rgba(244, 119, 66, 0.18)"
            >
              <Zap size={22} color={ACCENT} fill={ACCENT} strokeWidth={1.5} />
            </Flex>
            <Box minW={0}>
              <Text fontSize="xs" fontWeight="semibold" letterSpacing="0.14em" textTransform="uppercase" color="whiteAlpha.600">
                Exchange rate
              </Text>
              <Text fontSize={{ base: 'md', md: 'lg' }} fontWeight="bold" color="white" lineHeight="1.3" mt={0.5}>
                {rate} points per ZMW
              </Text>
              {hasLimits && (
                <Text fontSize="xs" color="whiteAlpha.500" mt={0.5}>
                  {formatZmw(settings!.minNgwee!)} – {formatZmw(settings!.maxNgwee!)}
                </Text>
              )}
            </Box>
          </Flex>
        )}

        <Box mb={{ base: 4, md: 6 }}>
          <FieldLabel icon={<Banknote size={16} />}>Amount (ZMW)</FieldLabel>
          <Flex
            align="center"
            h={{ base: "50px", md: "56px" }}
            rounded="xl"
            bg={FIELD_BG}
            border="1px solid"
            borderColor={FIELD_BORDER}
            overflow="hidden"
            _focusWithin={{ borderColor: ACCENT }}
          >
            <Flex align="center" justify="center" h="full" px={4} borderRight="1px solid" borderColor={FIELD_BORDER} flexShrink={0}>
              <Text fontSize="sm" fontWeight="semibold" color="whiteAlpha.600">ZMW</Text>
            </Flex>
            <input
              ref={amountRef}
              className="buy-points-field"
              type="number"
              inputMode="decimal"
              min={settings?.minNgwee ? settings.minNgwee / 100 : 1}
              max={settings?.maxNgwee ? settings.maxNgwee / 100 : undefined}
              step="0.01"
              placeholder="Enter amount"
              value={amount}
              onChange={(event) => onAmountChange(event.currentTarget.value)}
            />
          </Flex>
        </Box>

        <Box mb={{ base: 4, md: 6 }}>
          <FieldLabel icon={<Smartphone size={16} />}>Mobile number</FieldLabel>
          <Flex
            align="center"
            h={{ base: "50px", md: "56px" }}
            rounded="xl"
            bg={FIELD_BG}
            border="1px solid"
            borderColor={FIELD_BORDER}
            overflow="hidden"
            _focusWithin={{ borderColor: ACCENT }}
          >
            <Flex align="center" justify="center" h="full" pl={4} pr={3} flexShrink={0} color="whiteAlpha.500">
              <Phone size={18} />
            </Flex>
            <input
              className="buy-points-field"
              type="tel"
              inputMode="tel"
              placeholder="096…"
              value={phone}
              onChange={(event) => onPhoneChange(event.currentTarget.value)}
            />
          </Flex>
        </Box>

        <Box mb={{ base: 5, md: 7 }}>
          <FieldLabel icon={<Signal size={16} />}>Network</FieldLabel>
          <Box position="relative">
            <Box
              position="absolute"
              left="14px"
              top="50%"
              transform="translateY(-50%)"
              w="30px"
              h="22px"
              rounded="6px"
              bg={OPERATOR_COLORS[operator]}
              pointerEvents="none"
              aria-hidden="true"
            />
            <select
              className="buy-points-select buy-points-select--chip"
              value={operator}
              onChange={(event) => onOperatorChange(event.currentTarget.value as BuyPointsModalProps['operator'])}
            >
              <option value="mtn">MTN</option>
              <option value="airtel">Airtel</option>
              <option value="zamtel">Zamtel</option>
            </select>
          </Box>
        </Box>

        {previewPoints !== null && (
          <Flex justify="space-between" align="center" mb={{ base: 5, md: 7 }} px={4} py={3} rounded="xl" bg={FIELD_BG} border="1px solid" borderColor={FIELD_BORDER}>
            <Text fontSize="sm" color="whiteAlpha.600">You receive</Text>
            <Text fontWeight="bold" color={ACCENT}>{previewPoints} points</Text>
          </Flex>
        )}

        <Button
          type="submit"
          w="full"
          h={{ base: '52px', md: '56px' }}
          rounded="full"
          bg={ACCENT}
          bgImage="linear-gradient(180deg, #fa8b58 0%, #f06a33 100%)"
          color="white"
          fontWeight="semibold"
          _hover={{ bgImage: 'linear-gradient(180deg, #fb9668 0%, #e4602c 100%)' }}
          _disabled={{ opacity: 0.5, cursor: 'not-allowed' }}
          disabled={purchasing || settings?.enabled !== true || !amount || !phone}
        >
          <Flex align="center" gap={2.5}>
            <WalletIcon size={19} />
            <Text as="span">{purchasing ? 'Starting…' : 'Buy points'}</Text>
          </Flex>
        </Button>

        {feedback && (
          <Box
            mt={5}
            p={3.5}
            rounded="xl"
            bg={feedback.type === 'error' ? 'red.950' : 'green.950'}
            border="1px solid"
            borderColor={feedback.type === 'error' ? 'red.700' : 'green.700'}
          >
            <Text fontSize="sm" color={feedback.type === 'error' ? 'red.200' : 'green.200'}>{feedback.message}</Text>
          </Box>
        )}

        {settings?.enabled === false && (
          <Text mt={4} fontSize="sm" color="orange.200">Point purchases are closed right now.</Text>
        )}
      </Box>

      <style>{`
        .buy-points-field{flex:1;min-width:0;height:100%;padding:0 16px;border:0;background:transparent;color:white;outline:none;font-size:15px}
        .buy-points-field::placeholder{color:rgba(255,255,255,0.35)}
        .buy-points-field::-webkit-outer-spin-button,.buy-points-field::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}
        .buy-points-field[type=number]{-moz-appearance:textfield}
        .buy-points-select{width:100%;height:50px;padding:0 44px 0 16px;border:1px solid ${FIELD_BORDER};border-radius:12px;background:${FIELD_BG};color:white;outline:none;font-size:15px;-webkit-appearance:none;appearance:none;background-image:url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23ffffff' stroke-opacity='0.5' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");background-repeat:no-repeat;background-position:right 14px center;background-size:20px}
        .buy-points-select--chip{padding-left:58px}
        @media (min-width:48em){.buy-points-select{height:56px}}
        .buy-points-select:focus{border-color:${ACCENT}}
        .buy-points-select option{background:#171717;color:white}
      `}</style>
    </Modal>
  )
}
