import { useEffect, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Box, Container, Flex, Heading, Spinner, Text } from '@chakra-ui/react'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import './store.css'

export function StoreShell({ title, description, children }: { title?: string; description?: string; children: ReactNode }) {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }) }, [pathname])
  return <Box minH="100vh" bg="gray.950" color="white"><Header /><Container maxW="1280px" w="full" mx="auto" px={{ base: 5, md: 8 }} pt={{ base: 20, md: 26 }} pb={20} className="store-ui">
    <Flex as="nav" aria-label="Store" gap={5} wrap="wrap" mb={6} color="whiteAlpha.700" fontSize="sm"><Link to="/store">Store</Link><Link to="/store/purchases">My purchases</Link><Link to="/store/library">Download library</Link></Flex>
    {title && <Heading as="h1" fontSize={{ base: '3xl', md: '5xl' }} letterSpacing="tight" mb={3}>{title}</Heading>}
    {description && <Text color="whiteAlpha.600" maxW="3xl" mb={9}>{description}</Text>}{children}
  </Container><Footer /></Box>
}
export function StoreNotice({ children, error = false }: { children: ReactNode; error?: boolean }) {
  return <Box role={error ? 'alert' : 'status'} p={5} my={5} border="1px solid" borderColor={error ? 'red.800' : 'whiteAlpha.200'} rounded="xl" color={error ? 'red.200' : 'whiteAlpha.700'}>{children}</Box>
}
export function StoreLoading() { return <Flex py={12} gap={3} align="center"><Spinner color="brand.500" /><Text>Loading Store…</Text></Flex> }
