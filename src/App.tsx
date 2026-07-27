import { lazy, Suspense, type ReactNode } from 'react'
import { Navigate, Routes, Route, useLocation } from 'react-router-dom'
import { Spinner, Center } from '@chakra-ui/react'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'

// Lazy load pages for code splitting
const Landing = lazy(() => import('@/pages/Landing'))
const About = lazy(() => import('@/pages/About'))
const Quests = lazy(() => import('@/pages/Quests'))
const QuestDetail = lazy(() => import('@/pages/QuestDetail'))
const Sessions = lazy(() => import('@/pages/Sessions'))
const SessionDetail = lazy(() => import('@/pages/SessionDetail'))
const Artists = lazy(() => import('@/pages/Artists'))
const ArtworkDetail = lazy(() => import('@/pages/ArtworkDetail'))
const ArtistCreate = lazy(() => import('@/pages/ArtistCreate'))
const ArtistProfile = lazy(() => import('@/pages/ArtistProfile'))
const CommunityWall = lazy(() => import('@/pages/CommunityWall'))
const Matchmaking = lazy(() => import('@/pages/Matchmaking'))
const ArtMap = lazy(() => import('@/pages/ArtMap'))
const Exhibitions = lazy(() => import('@/pages/Exhibitions'))
const ExhibitionView = lazy(() => import('@/pages/ExhibitionView'))
const Radio = lazy(() => import('@/pages/Radio'))
const Passport = lazy(() => import('@/pages/Passport'))
const Profile = lazy(() => import('@/pages/Profile'))
const MemberProfile = lazy(() => import('@/pages/MemberProfile'))
const Auth = lazy(() => import('@/pages/Auth'))
const Terms = lazy(() => import('@/pages/Terms'))
const Privacy = lazy(() => import('@/pages/Privacy'))

// Admin pages
const AdminDashboard = lazy(() => import('@/pages/admin/Dashboard'))
const ManageUsers = lazy(() => import('@/pages/admin/ManageUsers'))
const ManageSessions = lazy(() => import('@/pages/admin/ManageSessions'))
const ManageQuests = lazy(() => import('@/pages/admin/ManageQuests'))
const ManageExhibitions = lazy(() => import('@/pages/admin/ManageExhibitions'))
const Payments = lazy(() => import('@/pages/admin/Payments'))
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

function AdminRoute({ children }: { children: ReactNode }) {
  const location = useLocation()
  const { firebaseUser, user, initialized, hasRole } = useAuth()

  if (!initialized) {
    return <PageLoader />
  }

  if (!firebaseUser || !user) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />
  }

  if (!hasRole(['admin'])) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

function App() {
  return (
    <AuthProvider>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<RootRoute />} />
          <Route path="/about" element={<About />} />

          {/* Quests */}
          <Route path="/quests" element={<Quests />} />
          <Route path="/quests/:id" element={<QuestDetail />} />

          {/* Sessions */}
          <Route path="/sessions" element={<Sessions />} />
          <Route path="/sessions/:id" element={<SessionDetail />} />

          {/* Artists */}
          <Route path="/artists" element={<Artists />} />
          <Route path="/artworks/:id" element={<ArtworkDetail />} />
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
          <Route path="/profile" element={<Profile />} />
          <Route path="/members/:id" element={<MemberProfile />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/auth/login" element={<Auth />} />
          <Route path="/auth/signup" element={<Auth />} />

          {/* Legal */}
          <Route path="/terms" element={<Terms />} />
          <Route path="/privacy" element={<Privacy />} />

          {/* Admin Routes */}
          <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
          <Route path="/admin/users" element={<AdminRoute><ManageUsers /></AdminRoute>} />
          <Route path="/admin/sessions" element={<AdminRoute><ManageSessions /></AdminRoute>} />
          <Route path="/admin/payments" element={<AdminRoute><Payments /></AdminRoute>} />
          <Route path="/admin/quests" element={<AdminRoute><ManageQuests /></AdminRoute>} />
          <Route path="/admin/exhibitions" element={<AdminRoute><ManageExhibitions /></AdminRoute>} />
          <Route path="/admin/radio" element={<AdminRoute><ManageRadio /></AdminRoute>} />
          <Route path="/admin/community" element={<AdminRoute><ManageCommunity /></AdminRoute>} />
          <Route path="/admin/map" element={<AdminRoute><ManageMap /></AdminRoute>} />
        </Routes>
      </Suspense>
    </AuthProvider>
  )
}

export default App
