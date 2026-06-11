import { lazy, Suspense } from 'react'
import { Navigate, Routes, Route } from 'react-router-dom'
import { Spinner, Center } from '@chakra-ui/react'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'

// Lazy load pages for code splitting
const Landing = lazy(() => import('@/pages/Landing'))
const Quests = lazy(() => import('@/pages/Quests'))
const QuestDetail = lazy(() => import('@/pages/QuestDetail'))
const Sessions = lazy(() => import('@/pages/Sessions'))
const SessionDetail = lazy(() => import('@/pages/SessionDetail'))
const Artists = lazy(() => import('@/pages/Artists'))
const ArtistCreate = lazy(() => import('@/pages/ArtistCreate'))
const ArtistProfile = lazy(() => import('@/pages/ArtistProfile'))
const CommunityWall = lazy(() => import('@/pages/CommunityWall'))
const Matchmaking = lazy(() => import('@/pages/Matchmaking'))
const ArtMap = lazy(() => import('@/pages/ArtMap'))
const Exhibitions = lazy(() => import('@/pages/Exhibitions'))
const ExhibitionView = lazy(() => import('@/pages/ExhibitionView'))
const Radio = lazy(() => import('@/pages/Radio'))
const Passport = lazy(() => import('@/pages/Passport'))
const Auth = lazy(() => import('@/pages/Auth'))
const Terms = lazy(() => import('@/pages/Terms'))
const Privacy = lazy(() => import('@/pages/Privacy'))

// Admin pages
const AdminDashboard = lazy(() => import('@/pages/admin/Dashboard'))
const ManageUsers = lazy(() => import('@/pages/admin/ManageUsers'))
const ManageSessions = lazy(() => import('@/pages/admin/ManageSessions'))
const ManageQuests = lazy(() => import('@/pages/admin/ManageQuests'))
const ManageExhibitions = lazy(() => import('@/pages/admin/ManageExhibitions'))
const ManageRadio = lazy(() => import('@/pages/admin/ManageRadio'))
const ManageCommunity = lazy(() => import('@/pages/admin/ManageCommunity'))
const ManageMap = lazy(() => import('@/pages/admin/ManageMap'))

function PageLoader() {
  return (
    <Center position="fixed" inset={0} bg="gray.950" zIndex={50}>
      <Spinner size="lg" color="brand.500" borderWidth="2px" />
    </Center>
  )
}

function RootRoute() {
  const { firebaseUser, initialized } = useAuth()

  if (!initialized) {
    return <PageLoader />
  }

  if (firebaseUser) {
    return <Navigate to="/community/wall" replace />
  }

  return <Landing />
}

function App() {
  return (
    <AuthProvider>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<RootRoute />} />

          {/* Quests */}
          <Route path="/quests" element={<Quests />} />
          <Route path="/quests/:id" element={<QuestDetail />} />

          {/* Sessions */}
          <Route path="/sessions" element={<Sessions />} />
          <Route path="/sessions/:id" element={<SessionDetail />} />

          {/* Artists */}
          <Route path="/artists" element={<Artists />} />
          <Route path="/artists/create" element={<ArtistCreate />} />
          <Route path="/artists/:id" element={<ArtistProfile />} />

          {/* Community */}
          <Route path="/community/wall" element={<CommunityWall />} />
          <Route path="/community/matchmaking" element={<Matchmaking />} />
          <Route path="/community/map" element={<ArtMap />} />

          {/* Exhibitions */}
          <Route path="/exhibitions" element={<Exhibitions />} />
          <Route path="/exhibitions/:id" element={<ExhibitionView />} />

          {/* Radio */}
          <Route path="/radio" element={<Radio />} />

          {/* User Routes */}
          <Route path="/passport" element={<Passport />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/auth/login" element={<Auth />} />
          <Route path="/auth/signup" element={<Auth />} />

          {/* Legal */}
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />

          {/* Admin Routes */}
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/users" element={<ManageUsers />} />
          <Route path="/admin/sessions" element={<ManageSessions />} />
          <Route path="/admin/quests" element={<ManageQuests />} />
          <Route path="/admin/exhibitions" element={<ManageExhibitions />} />
          <Route path="/admin/radio" element={<ManageRadio />} />
          <Route path="/admin/community" element={<ManageCommunity />} />
          <Route path="/admin/map" element={<ManageMap />} />
        </Routes>
      </Suspense>
    </AuthProvider>
  )
}

export default App
