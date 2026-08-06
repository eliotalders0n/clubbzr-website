/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { collection, doc, limit, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where } from 'firebase/firestore'

import { db } from '../../lib/config'
import { useAuth } from './AuthContext'

export interface AppNotification {
  id: string
  type: string
  title: string
  body: string
  read: boolean
  referenceType?: string
  referenceId?: string
  createdAt?: unknown
}

interface NotificationContextValue {
  notifications: AppNotification[]
  unreadCount: number
  loading: boolean
  markRead: (id: string) => Promise<void>
}

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined)

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { firebaseUser } = useAuth()
  const [notifications, setNotifications] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!firebaseUser) return
    return onSnapshot(query(
      collection(db, 'notifications'),
      where('userId', '==', firebaseUser.uid),
      orderBy('createdAt', 'desc'),
      limit(50),
    ), (snapshot) => {
      setNotifications(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as AppNotification)))
      setLoading(false)
    }, () => setLoading(false))
  }, [firebaseUser])

  const value = useMemo<NotificationContextValue>(() => ({
    notifications: firebaseUser ? notifications : [],
    unreadCount: firebaseUser ? notifications.filter((item) => !item.read).length : 0,
    loading: firebaseUser ? loading : false,
    markRead: async (id) => updateDoc(doc(db, 'notifications', id), {
      read: true,
      readAt: serverTimestamp(),
    }),
  }), [firebaseUser, loading, notifications])
  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
}

export function useNotifications() {
  const context = useContext(NotificationContext)
  if (!context) throw new Error('useNotifications must be used within NotificationProvider')
  return context
}
