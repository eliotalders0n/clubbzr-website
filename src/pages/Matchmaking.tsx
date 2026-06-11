'use client'

import { useState, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { Section } from '@/components/layout/Section'
import { WordReveal } from '@/components/animations/TextReveal'
import { ScrollReveal } from '@/components/animations/ScrollAnimations'
import { MagneticButton } from '@/components/animations/MagneticButton'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import { MEDIUMS } from '@/lib/constants'
import { useAuth } from '@/contexts/AuthContext'
import { useCollection, useMutation } from '@/hooks/useFirestore'
import { updateDocument, createDocument } from '../../lib/firestore'
import type { Match, MatchStatus, User, ArtMedium } from '../../lib/schema'

interface DisplayMatch {
  id: string
  user: {
    id: string
    name: string
    photoURL?: string
    mediums: string[]
    bio: string
  }
  score: number
  matchedOn: string[]
  status: MatchStatus
}

export default function Matchmaking() {
  const { user: authUser } = useAuth()
  const [selectedMediums, setSelectedMediums] = useState<string[]>([])
  const [connectingId, setConnectingId] = useState<string | null>(null)

  // Fetch matches for current user
  const { data: matches, loading, error, refetch } = useCollection('matches', {
    where: authUser ? [{ field: 'userId', operator: '==', value: authUser.uid }] : [],
    orderBy: 'score',
    orderDirection: 'desc',
    skip: !authUser,
  })

  // Fetch all users to display match user data
  const { data: users } = useCollection('users', {
    skip: !authUser,
  })

  // Build user lookup map
  const userMap = useMemo(() => {
    const map = new Map<string, User>()
    users.forEach(u => map.set(u.id, u))
    return map
  }, [users])

  // Transform matches to display format
  const displayMatches: DisplayMatch[] = useMemo(() => {
    return matches.map(match => {
      const matchedUser = userMap.get(match.matchedUserId)
      return {
        id: match.id,
        user: {
          id: match.matchedUserId,
          name: matchedUser?.displayName || 'Unknown User',
          photoURL: matchedUser?.photoURL || undefined,
          mediums: [], // Would need artist profile for mediums
          bio: matchedUser?.bio || '',
        },
        score: match.score,
        matchedOn: match.matchedOn,
        status: match.status,
      }
    })
  }, [matches, userMap])

  // Filter by selected mediums (client-side for now)
  const filteredMatches = useMemo(() => {
    if (selectedMediums.length === 0) return displayMatches
    return displayMatches.filter(match =>
      match.user.mediums.some(m => selectedMediums.includes(m))
    )
  }, [displayMatches, selectedMediums])

  // Handle connect action
  const handleConnect = useCallback(async (matchId: string) => {
    if (!authUser) return
    setConnectingId(matchId)

    try {
      await updateDocument('matches', matchId, {
        status: 'pending',
        initiatedBy: authUser.uid,
      })
      refetch()
    } catch (err) {
      console.error('Failed to connect:', err)
    } finally {
      setConnectingId(null)
    }
  }, [authUser, refetch])

  // If not logged in, show sign-in prompt
  if (!authUser) {
    return (
      <div className="bg-bzr-black min-h-screen">
        <Header />
        <main>
          <Section className="pt-32 pb-16">
            <div className="container text-center">
              <h1 className="font-display text-display-lg text-bzr-white mb-6">
                Creative Matchmaking
              </h1>
              <p className="text-xl text-gray-400 mb-8">
                Sign in to discover artists who complement your creative practice.
              </p>
              <MagneticButton>
                <Button onClick={() => window.location.href = '/auth/login'}>
                  Sign In to Get Started
                </Button>
              </MagneticButton>
            </div>
          </Section>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="bg-bzr-black min-h-screen">
      <Header />

      <main>
        {/* Hero */}
        <Section className="pt-32 pb-16 relative">
          <div className="absolute inset-0 gradient-blue opacity-15" />
          <div className="container relative z-10">
            <ScrollReveal>
              <span className="text-bzr-blue text-sm uppercase tracking-widest mb-4 block">
                Creative Matchmaking
              </span>
              <h1 className="font-display text-display-lg text-bzr-white mb-6">
                <WordReveal>Find Your Collaborators</WordReveal>
              </h1>
              <p className="text-xl text-gray-400 max-w-2xl">
                Connect with artists whose work complements yours.
                Our matching algorithm considers mediums, interests, and collaboration goals.
              </p>
            </ScrollReveal>
          </div>
        </Section>

        {/* How It Works */}
        <Section className="py-16 border-b border-gray-800">
          <div className="container">
            <ScrollReveal>
              <h2 className="font-display text-2xl text-bzr-white mb-8 text-center">
                How It Works
              </h2>
              <div className="grid md:grid-cols-3 gap-8 max-w-3xl mx-auto">
                {[
                  { step: '01', title: 'Complete Your Profile', desc: 'Share your mediums, interests, and what you\'re looking for' },
                  { step: '02', title: 'Get Matched', desc: 'Our algorithm suggests artists based on complementary skills' },
                  { step: '03', title: 'Connect & Create', desc: 'Reach out, start a conversation, and make something together' },
                ].map((item, index) => (
                  <motion.div
                    key={item.step}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.2 }}
                    className="text-center"
                  >
                    <div className="text-4xl font-display text-bzr-blue/30 mb-2">
                      {item.step}
                    </div>
                    <h3 className="font-display text-lg text-bzr-white mb-2">
                      {item.title}
                    </h3>
                    <p className="text-gray-500 text-sm">{item.desc}</p>
                  </motion.div>
                ))}
              </div>
            </ScrollReveal>
          </div>
        </Section>

        {/* Filters */}
        <Section className="py-8">
          <div className="container">
            <ScrollReveal>
              <div className="flex flex-wrap gap-2">
                <span className="text-gray-500 mr-2">Filter by medium:</span>
                {MEDIUMS.slice(0, 8).map(medium => (
                  <Badge
                    key={medium}
                    variant={selectedMediums.includes(medium) ? 'blue' : 'outline'}
                    interactive
                    onClick={() => {
                      setSelectedMediums(prev =>
                        prev.includes(medium)
                          ? prev.filter(m => m !== medium)
                          : [...prev, medium]
                      )
                    }}
                  >
                    {medium}
                  </Badge>
                ))}
              </div>
            </ScrollReveal>
          </div>
        </Section>

        {/* Matches */}
        <Section className="py-16">
          <div className="container">
            <ScrollReveal>
              <h2 className="font-display text-2xl text-bzr-white mb-8">
                Your Suggested Matches
              </h2>
            </ScrollReveal>

            {loading ? (
              <div className="text-center py-16">
                <p className="text-gray-400">Finding your matches...</p>
              </div>
            ) : error ? (
              <div className="text-center py-16">
                <p className="text-red-400">Error loading matches. Please try again later.</p>
              </div>
            ) : filteredMatches.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-gray-400 mb-4">
                  No matches found yet. Complete your profile to get personalized suggestions.
                </p>
                <MagneticButton>
                  <Button onClick={() => window.location.href = '/passport'}>
                    Update Profile
                  </Button>
                </MagneticButton>
              </div>
            ) : (
              <div className="space-y-6">
                {filteredMatches.map((match, index) => (
                  <ScrollReveal key={match.id} delay={index * 0.1}>
                    <motion.div
                      whileHover={{ scale: 1.01 }}
                      className="glass rounded-xl p-6 flex flex-col md:flex-row gap-6 items-start md:items-center"
                    >
                      <Avatar
                        name={match.user.name}
                        src={match.user.photoURL}
                        size="lg"
                      />

                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-display text-xl text-bzr-white">
                            {match.user.name}
                          </h3>
                          {match.status === 'connected' && (
                            <Badge variant="green">Connected</Badge>
                          )}
                          {match.status === 'pending' && (
                            <Badge variant="blue">Pending</Badge>
                          )}
                        </div>
                        <p className="text-gray-400 mb-3">{match.user.bio || 'No bio available'}</p>
                        <div className="flex flex-wrap gap-2">
                          {match.user.mediums.map(medium => (
                            <Badge key={medium} variant="outline" size="sm">
                              {medium}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      <div className="text-center md:text-right">
                        <div className="text-3xl font-display text-bzr-blue mb-1">
                          {match.score}%
                        </div>
                        <div className="text-xs text-gray-500 mb-4">
                          Match Score
                        </div>
                        <div className="text-xs text-gray-500 mb-2">
                          Matched on: {match.matchedOn.join(', ')}
                        </div>
                        <MagneticButton>
                          <Button
                            variant={match.status === 'connected' ? 'secondary' : 'primary'}
                            size="sm"
                            onClick={() => {
                              if (match.status === 'suggested') {
                                handleConnect(match.id)
                              }
                            }}
                            disabled={connectingId === match.id || match.status === 'pending'}
                          >
                            {match.status === 'connected'
                              ? 'Message'
                              : match.status === 'pending'
                              ? 'Pending...'
                              : connectingId === match.id
                              ? 'Connecting...'
                              : 'Connect'}
                          </Button>
                        </MagneticButton>
                      </div>
                    </motion.div>
                  </ScrollReveal>
                ))}
              </div>
            )}
          </div>
        </Section>

        {/* CTA */}
        <Section className="py-16 bg-gray-900/30">
          <div className="container">
            <ScrollReveal>
              <div className="max-w-2xl mx-auto text-center">
                <h2 className="font-display text-2xl text-bzr-white mb-4">
                  Improve Your Matches
                </h2>
                <p className="text-gray-400 mb-8">
                  Complete your profile with more details about your work and
                  collaboration preferences to get better match suggestions.
                </p>
                <MagneticButton>
                  <Button onClick={() => window.location.href = '/passport'}>
                    Update Profile
                  </Button>
                </MagneticButton>
              </div>
            </ScrollReveal>
          </div>
        </Section>
      </main>

      <Footer />
    </div>
  )
}
