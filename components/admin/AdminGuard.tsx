'use client'

import { useEffect, useState, ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'

export default function AdminGuard({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    let unsubscribe: () => void = () => {}
    let active = true

    auth.authStateReady().then(() => {
      if (!active) return
      unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (!active) return
        if (!user) {
          router.push('/admin/login')
          return
        }

        const adminDoc = await getDoc(doc(db, 'admins', user.uid))
        if (!active) return
        if (!adminDoc.exists()) {
          router.push('/admin/login')
          return
        }

        setAuthorized(true)
        setChecking(false)
      })
    })

    return () => {
      active = false
      unsubscribe()
    }
  }, [router])

  if (checking) {
    return (
      <main className="min-h-screen bg-dark flex items-center justify-center">
        <p className="text-green-400">Verifying access...</p>
      </main>
    )
  }

  if (!authorized) return null

  return <>{children}</>
}