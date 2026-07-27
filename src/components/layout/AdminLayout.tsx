'use client'

import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  Box,
  Flex,
  VStack,
  Text,
  Button,
} from '@chakra-ui/react'

const NAV_ITEMS = [
  {
    label: 'Dashboard',
    href: '/admin',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        <polyline points="9,22 9,12 15,12 15,22" />
      </svg>
    ),
  },
  {
    label: 'Users',
    href: '/admin/users',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87" />
        <path d="M16 3.13a4 4 0 010 7.75" />
      </svg>
    ),
  },
  {
    label: 'Sessions',
    href: '/admin/sessions',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
  {
    label: 'Payments',
    href: '/admin/payments',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <line x1="2" y1="10" x2="22" y2="10" />
        <path d="M7 15h3" />
        <path d="M15 15h2" />
      </svg>
    ),
  },
  {
    label: 'Quests',
    href: '/admin/quests',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
        <polyline points="22,4 12,14.01 9,11.01" />
      </svg>
    ),
  },
  {
    label: 'Exhibitions',
    href: '/admin/exhibitions',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <polyline points="21,15 16,10 5,21" />
      </svg>
    ),
  },
  {
    label: 'Radio',
    href: '/admin/radio',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4.9 19.1a10 10 0 010-14.2" />
        <path d="M7.8 16.2a6 6 0 010-8.4" />
        <circle cx="12" cy="12" r="2" />
        <path d="M16.2 7.8a6 6 0 010 8.4" />
        <path d="M19.1 4.9a10 10 0 010 14.2" />
      </svg>
    ),
  },
  {
    label: 'Community',
    href: '/admin/community',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87" />
        <path d="M16 3.13a4 4 0 010 7.75" />
      </svg>
    ),
  },
]

interface AdminLayoutProps {
  children: React.ReactNode
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const isActive = (href: string) => {
    if (href === '/admin') return location.pathname === '/admin'
    return location.pathname.startsWith(href)
  }

  return (
    <Box bg="gray.950" minH="100vh">
      {/* Mobile Header */}
      <Box
        display={{ base: 'flex', lg: 'none' }}
        position="fixed"
        top={0}
        left={0}
        right={0}
        zIndex={50}
        h={16}
        px={4}
        bg="gray.900"
        borderBottom="1px solid"
        borderColor="whiteAlpha.100"
        alignItems="center"
        justifyContent="space-between"
      >
        <Text color="white" fontSize="lg" fontWeight="bold" fontFamily="heading">
          Club BZR
        </Text>
        <Button
          variant="ghost"
          color="white"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          _hover={{ bg: 'whiteAlpha.100' }}
          p={2}
          minW="auto"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </Button>
      </Box>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <Box
          display={{ base: 'block', lg: 'none' }}
          position="fixed"
          inset={0}
          zIndex={40}
          bg="blackAlpha.700"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <Box
        position="fixed"
        top={0}
        left={0}
        h="100vh"
        w={64}
        bg="gray.900"
        borderRight="1px solid"
        borderColor="whiteAlpha.100"
        zIndex={45}
        transform={{ base: sidebarOpen ? 'translateX(0)' : 'translateX(-100%)', lg: 'translateX(0)' }}
        transition="transform 0.2s"
      >
        <Flex direction="column" h="full" py={6}>
          {/* Logo */}
          <Box px={6} mb={8}>
            <Link to="/">
              <Text color="white" fontSize="xl" fontWeight="bold" fontFamily="heading">
                Club BZR
              </Text>
            </Link>
            <Text color="whiteAlpha.500" fontSize="sm" mt={1}>
              Admin Panel
            </Text>
          </Box>

          {/* Navigation */}
          <VStack as="nav" align="stretch" gap={1} px={4} flex={1}>
            {NAV_ITEMS.map((item) => (
              <Link key={item.href} to={item.href} onClick={() => setSidebarOpen(false)}>
                <Flex
                  align="center"
                  gap={3}
                  px={4}
                  py={3}
                  borderRadius="lg"
                  bg={isActive(item.href) ? 'rgba(255, 107, 53, 0.15)' : 'transparent'}
                  color={isActive(item.href) ? 'brand.500' : 'whiteAlpha.600'}
                  _hover={{ bg: isActive(item.href) ? 'rgba(255, 107, 53, 0.2)' : 'whiteAlpha.50', color: isActive(item.href) ? 'brand.500' : 'white' }}
                  transition="all 0.2s"
                >
                  <Box opacity={isActive(item.href) ? 1 : 0.6}>
                    {item.icon}
                  </Box>
                  <Text fontSize="sm" fontWeight={isActive(item.href) ? 'medium' : 'normal'}>
                    {item.label}
                  </Text>
                </Flex>
              </Link>
            ))}
          </VStack>

          {/* Bottom Links */}
          <VStack align="stretch" gap={1} px={4} pt={4} borderTop="1px solid" borderColor="whiteAlpha.100">
            <Link to="/">
              <Flex
                align="center"
                gap={3}
                px={4}
                py={3}
                borderRadius="lg"
                color="whiteAlpha.500"
                _hover={{ bg: 'whiteAlpha.50', color: 'white' }}
                transition="all 0.2s"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                  <polyline points="16,17 21,12 16,7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                <Text fontSize="sm">Back to Site</Text>
              </Flex>
            </Link>
          </VStack>
        </Flex>
      </Box>

      {/* Main Content */}
      <Box ml={{ base: 0, lg: 64 }} pt={{ base: 16, lg: 0 }} minH="100vh">
        {children}
      </Box>
    </Box>
  )
}
