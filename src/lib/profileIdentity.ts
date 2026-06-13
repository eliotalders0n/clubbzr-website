import type { User as FirebaseUser } from 'firebase/auth'
import type { Artist, User } from '../../lib/schema'

export type ProfileIdentity = {
  displayName: string
  accountName: string
  username: string
  avatar?: string
}

const getEmailUsername = (email?: string | null) => (email ? email.split('@')[0] : 'user')

export function resolveProfileIdentity({
  artist,
  user,
  firebaseUser,
  fallbackName = 'Creative',
}: {
  artist?: Artist | null
  user?: User | null
  firebaseUser?: FirebaseUser | null
  fallbackName?: string
}): ProfileIdentity {
  const accountName = user?.displayName || firebaseUser?.displayName || artist?.name || fallbackName
  const displayName = artist?.artistName || artist?.name || accountName
  const avatar = artist?.photoURL || user?.photoURL || firebaseUser?.photoURL || undefined

  return {
    displayName,
    accountName,
    username: getEmailUsername(user?.email || firebaseUser?.email),
    ...(avatar ? { avatar } : {}),
  }
}
