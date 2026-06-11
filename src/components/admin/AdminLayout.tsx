'use client'

import { type ReactNode } from 'react'
import { Link, useLocation, Navigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import logoWhite from '@/assets/logos/Club BZR logo (WHITE).png'

const navItems = [
  { label: 'Dashboard', href: '/admin', icon: '📊' },
  { label: 'Users', href: '/admin/users', icon: '👥' },
  { label: 'Sessions', href: '/admin/sessions', icon: '📅' },
  { label: 'Quests', href: '/admin/quests', icon: '🗺️' },
  { label: 'Exhibitions', href: '/admin/exhibitions', icon: '🖼️' },
  { label: 'Radio', href: '/admin/radio', icon: '🎧' },
  { label: 'Community', href: '/admin/community', icon: '💬' },
  { label: 'Art Map', href: '/admin/map', icon: '📍' },
]

interface AdminLayoutProps {
  children: ReactNode
  /** Optional: page title for AdminLayout header */
  title?: string
  /** Optional: page subtitle for AdminLayout header */
  subtitle?: string
  /** Optional: action buttons for the header */
  actions?: ReactNode
}

export function AdminLayout({ children, title, subtitle, actions }: AdminLayoutProps) {
  const location = useLocation()
  const { user, loading, initialized, hasRole } = useAuth()

  // Show loading state while checking auth
  if (!initialized || loading) {
    return (
      <div className="min-h-screen bg-bzr-black flex items-center justify-center">
        <div className="animate-pulse text-gray-400">Loading...</div>
      </div>
    )
  }

  // Redirect to login if not authenticated
  if (!user) {
    return <Navigate to="/auth" state={{ from: location }} replace />
  }

  // Redirect to home if not admin
  if (!hasRole(['admin'])) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="min-h-screen bg-bzr-black flex">
      {/* Sidebar */}
      <aside className="w-64 border-r border-gray-800 flex flex-col">
        <div className="p-6 border-b border-gray-800">
          <Link to="/" className="flex items-center gap-3">
            <img src={logoWhite} alt="Club BZR" className="h-8" />
            <span className="text-xs uppercase tracking-wider text-gray-500">Admin</span>
          </Link>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.href
            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
                  isActive
                    ? 'bg-bzr-blue/10 text-bzr-blue'
                    : 'text-gray-400 hover:text-bzr-white hover:bg-gray-800/50'
                )}
              >
                <span>{item.icon}</span>
                <span className="font-medium">{item.label}</span>
                {isActive && (
                  <motion.div
                    layoutId="activeNav"
                    className="absolute left-0 w-1 h-8 bg-bzr-blue rounded-r"
                  />
                )}
              </Link>
            )
          })}
        </nav>

        <div className="p-4 border-t border-gray-800">
          <Link
            to="/"
            className="flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-bzr-white transition-colors"
          >
            <span>🌐</span>
            <span>View Site</span>
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-8 overflow-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {children}
        </motion.div>
      </main>
    </div>
  )
}
