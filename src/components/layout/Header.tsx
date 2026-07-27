'use client'

import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  CalendarDays,
  ChevronDown,
  Compass,
  LogIn,
  LogOut,
  Map,
  MessageCircle,
  Radio as RadioIcon,
  Settings,
  UserRound,
  UsersRound,
  type LucideIcon,
} from 'lucide-react'
import {
  Box,
  Container,
  Flex,
  HStack,
  Text,
  Button,
  Image,
  Avatar,
  Menu,
  Portal,
} from '@chakra-ui/react'

import logoWhite from '@/assets/logos/Club BZR logo (RED).png'
import { useAuth } from '@/contexts/AuthContext'

interface NavLink {
  label: string
  shortLabel: string
  href: string
  match: string[]
  icon: LucideIcon
}

const NAV_LINKS: NavLink[] = [
  { label: 'Community', shortLabel: 'Wall', href: '/community/wall', match: ['/community'], icon: MessageCircle },
  { label: 'Sessions', shortLabel: 'Sessions', href: '/sessions', match: ['/sessions'], icon: CalendarDays },
  { label: 'Side Quests', shortLabel: 'Quests', href: '/quests', match: ['/quests'], icon: Compass },
  { label: 'Artists', shortLabel: 'Artists', href: '/artists', match: ['/artists'], icon: UsersRound },
  { label: 'Radio', shortLabel: 'Radio', href: '/radio', match: ['/radio'], icon: RadioIcon },
]

interface HeaderProps {
  activeLink?: string
}

export function Header({ activeLink }: HeaderProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, firebaseUser, signOut } = useAuth()

  const isActive = (link: Pick<NavLink, 'href' | 'match'>) => {
    if (activeLink) return activeLink === link.href
    return [link.href, ...(link.match || [])].some((path) => location.pathname.startsWith(path))
  }

  const isLoggedIn = !!firebaseUser
  const userPhoto = user?.photoURL || firebaseUser?.photoURL
  const userName = user?.displayName || firebaseUser?.displayName || 'User'
  const userEmail = user?.email || firebaseUser?.email || ''
  const accountLink = isLoggedIn
    ? { label: 'Passport', shortLabel: 'Me', href: '/passport', match: ['/passport', '/profile'], icon: UserRound }
    : { label: 'Sign In', shortLabel: 'Sign In', href: '/auth/login', match: ['/auth'], icon: LogIn }
  const mobileTabLinks = [...NAV_LINKS.slice(0, 4), accountLink]

  return (
    <>
      <Box
        as="header"
        position="fixed"
        top={0}
        left={0}
        right={0}
        zIndex={50}
        py={{ base: 3, md: 4 }}
        bg="blackAlpha.900"
        backdropFilter="blur(14px)"
        borderBottom="1px solid"
        borderColor="whiteAlpha.100"
      >
        <Container maxW="1440px" px={{ base: 4, md: 12, lg: 16, xl: 20 }}>
          <Flex justify="space-between" align="center" gap={4}>
            <Link to="/">
              <Image src={logoWhite} alt="Club BZR" h={{ base: 10, md: 12 }} />
            </Link>

            <HStack gap={{ md: 5, lg: 8 }} display={{ base: 'none', md: 'flex' }}>
              {NAV_LINKS.map((link) => {
                const active = isActive(link)

                return (
                  <Link key={link.href} to={link.href}>
                    <Text
                      color={active ? 'brand.500' : 'whiteAlpha.600'}
                      fontSize="sm"
                      fontWeight={active ? 'semibold' : 'normal'}
                      _hover={{ color: 'white' }}
                      transition="color 0.2s"
                    >
                      {link.label}
                    </Text>
                  </Link>
                )
              })}
            </HStack>

            <HStack gap={3}>
              <Menu.Root>
                <Menu.Trigger
                  display={{ base: 'inline-flex', md: 'none' }}
                  alignItems="center"
                  gap={2}
                  h={9}
                  px={4}
                  borderRadius="full"
                  bg="whiteAlpha.100"
                  color="whiteAlpha.900"
                  fontSize="xs"
                  fontWeight="semibold"
                  _hover={{ bg: 'whiteAlpha.200' }}
                >
                  <Map size={16} strokeWidth={2} />
                  Explore
                  <ChevronDown size={14} strokeWidth={2.4} />
                </Menu.Trigger>
                <Portal>
                  <Menu.Positioner>
                    <Menu.Content
                      minW="248px"
                      maxW="calc(100vw - 32px)"
                      p={2}
                      bg="rgba(18, 18, 18, 0.98)"
                      border="1px solid"
                      borderColor="whiteAlpha.200"
                      borderRadius="18px"
                      boxShadow="0 18px 50px rgba(0, 0, 0, 0.45)"
                    >
                      {NAV_LINKS.map((link) => {
                        const active = isActive(link)
                        const Icon = link.icon

                        return (
                          <Menu.Item
                            key={link.href}
                            value={link.href}
                            onClick={() => navigate(link.href)}
                            display="flex"
                            alignItems="center"
                            gap={3}
                            minH="44px"
                            px={3}
                            py={2}
                            borderRadius="12px"
                            bg={active ? 'whiteAlpha.100' : 'transparent'}
                            color={active ? 'brand.500' : 'whiteAlpha.800'}
                            fontSize="15px"
                            fontWeight={active ? 'semibold' : 'medium'}
                            _hover={{ bg: 'whiteAlpha.100', color: 'white' }}
                          >
                            <Icon size={18} strokeWidth={2} />
                            <Text as="span">{link.label}</Text>
                          </Menu.Item>
                        )
                      })}
                    </Menu.Content>
                  </Menu.Positioner>
                </Portal>
              </Menu.Root>

              {isLoggedIn ? (
                <Menu.Root>
                  <Menu.Trigger
                    borderRadius="full"
                    border="2px solid"
                    borderColor="whiteAlpha.300"
                    cursor="pointer"
                    p={0}
                    _hover={{ borderColor: 'brand.500' }}
                  >
                    <Avatar.Root
                      size="sm"
                      cursor="pointer"
                    >
                      <Avatar.Image src={userPhoto || undefined} alt={userName} />
                      <Avatar.Fallback name={userName} />
                    </Avatar.Root>
                  </Menu.Trigger>
                  <Portal>
                    <Menu.Positioner>
                      <Menu.Content
                        minW="260px"
                        p={2}
                        bg="rgba(18, 18, 18, 0.98)"
                        border="1px solid"
                        borderColor="whiteAlpha.200"
                        borderRadius="18px"
                        boxShadow="0 18px 50px rgba(0, 0, 0, 0.45)"
                      >
                        <HStack gap={3} p={3} mb={1}>
                          <Avatar.Root size="sm" flexShrink={0}>
                            <Avatar.Image src={userPhoto || undefined} alt={userName} />
                            <Avatar.Fallback name={userName} />
                          </Avatar.Root>
                          <Box minW={0}>
                            <Text color="white" fontSize="sm" fontWeight="semibold" lineClamp={1}>
                              {userName}
                            </Text>
                            {userEmail && (
                              <Text color="whiteAlpha.500" fontSize="xs" lineClamp={1}>
                                {userEmail}
                              </Text>
                            )}
                          </Box>
                        </HStack>
                        <Box h="1px" bg="whiteAlpha.100" my={1} />
                        <Menu.Item
                          value="passport"
                          onClick={() => navigate('/passport')}
                          display="flex"
                          alignItems="center"
                          gap={3}
                          minH="44px"
                          px={3}
                          py={2}
                          borderRadius="12px"
                          bg="transparent"
                          color="whiteAlpha.800"
                          fontSize="sm"
                          fontWeight="medium"
                          _hover={{ bg: 'whiteAlpha.100', color: 'white' }}
                        >
                          <UserRound size={18} />
                          <Text as="span">My Passport</Text>
                        </Menu.Item>
                        <Menu.Item
                          value="profile"
                          onClick={() => navigate('/profile')}
                          display="flex"
                          alignItems="center"
                          gap={3}
                          minH="44px"
                          px={3}
                          py={2}
                          borderRadius="12px"
                          bg="transparent"
                          color="whiteAlpha.800"
                          fontSize="sm"
                          fontWeight="medium"
                          _hover={{ bg: 'whiteAlpha.100', color: 'white' }}
                        >
                          <Settings size={18} />
                          <Text as="span">Manage Profile</Text>
                        </Menu.Item>
                        <Menu.Item
                          value="sign-out"
                          onClick={() => signOut()}
                          display="flex"
                          alignItems="center"
                          gap={3}
                          minH="44px"
                          px={3}
                          py={2}
                          borderRadius="12px"
                          bg="transparent"
                          color="red.300"
                          fontSize="sm"
                          fontWeight="medium"
                          _hover={{ bg: 'red.500/10', color: 'red.200' }}
                        >
                          <LogOut size={18} />
                          <Text as="span">Sign Out</Text>
                        </Menu.Item>
                      </Menu.Content>
                    </Menu.Positioner>
                  </Portal>
                </Menu.Root>
              ) : (
                <Link to="/auth/login">
                  <Button
                    bg="transparent"
                    color="white"
                    size="sm"
                    px={5}
                    borderRadius="full"
                    border="1px solid"
                    borderColor="whiteAlpha.300"
                    fontWeight="medium"
                    _hover={{ bg: 'whiteAlpha.100', borderColor: 'whiteAlpha.400' }}
                  >
                    Sign In
                  </Button>
                </Link>
              )}
            </HStack>
          </Flex>
        </Container>
      </Box>

      <Box
        as="nav"
        display={{ base: 'block', md: 'none' }}
        position="fixed"
        left={0}
        right={0}
        bottom={0}
        zIndex={60}
        px={3}
        pt={2}
        pb="calc(0.5rem + env(safe-area-inset-bottom))"
        bg="blackAlpha.900"
        backdropFilter="blur(18px)"
        borderTop="1px solid"
        borderColor="whiteAlpha.100"
      >
        <HStack gap={1.5} justify="space-between">
          {mobileTabLinks.map((link) => {
            const active = isActive(link)
            const Icon = link.icon

            return (
              <Link key={link.href} to={link.href} style={{ flex: 1, minWidth: 0 }}>
                <Box
                  position="relative"
                  px={1.5}
                  py={2}
                  minH="54px"
                  borderRadius="14px"
                  textAlign="center"
                  bg={active ? 'whiteAlpha.100' : 'transparent'}
                  color={active ? 'brand.500' : 'whiteAlpha.600'}
                  _hover={{ bg: 'whiteAlpha.100', color: 'white' }}
                  transition="all 0.2s"
                >
                  {active && (
                    <Box
                      position="absolute"
                      top={1}
                      left="50%"
                      transform="translateX(-50%)"
                      w={1}
                      h={1}
                      borderRadius="full"
                      bg="brand.500"
                    />
                  )}
                  <Box
                    display="flex"
                    justifyContent="center"
                    alignItems="center"
                    h="22px"
                    mb={1}
                  >
                    <Icon size={20} strokeWidth={active ? 2.5 : 2} />
                  </Box>
                  <Text
                    as="span"
                    display="block"
                    fontSize="11px"
                    lineHeight="1.1"
                    fontWeight={active ? 'semibold' : 'medium'}
                    whiteSpace="nowrap"
                  >
                    {link.shortLabel}
                  </Text>
                </Box>
              </Link>
            )
          })}
        </HStack>
      </Box>
    </>
  )
}

export type { HeaderProps }
