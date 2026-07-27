import { Timestamp } from 'firebase/firestore'

import type { CreateDocument, CreativePassport } from '../../lib/schema'

export const createDefaultCreativePassport = (userId: string): CreateDocument<CreativePassport> => {
  const now = Timestamp.now()

  return {
    userId,
    level: 1,
    points: 0,
    badges: [],
    questsCompleted: [],
    questsInProgress: [],
    eventsAttended: [],
    mediums: [],
    interests: [],
    collaborations: [],
    timeline: [],
    streaks: {
      current: 0,
      longest: 0,
      lastActivityDate: now,
      weeklyGoal: 3,
      weeklyProgress: 0,
    },
    stats: {
      totalQuestsCompleted: 0,
      totalEventsAttended: 0,
      totalCollaborations: 0,
      totalPostsCreated: 0,
      totalReactionsReceived: 0,
      joinedAt: now,
    },
  }
}
