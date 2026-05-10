'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'

export default function ClubLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let active = true
    auth.authStateReady().then(() => {
      if (!active) return
      const user = auth.currentUser
      if (!user) return
      const q = query(collection(db, 'clubs'), where('loginEmail', '==', user.email))
      getDocs(q).then(snap => {
        if (active && !snap.empty) router.push('/club/dashboard')
      })
    })
    return () => { active = false }
  }, [router])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      await signInWithEmailAndPassword(auth, email, password)

      // Find club by loginEmail
      const q = query(collection(db, 'clubs'), where('loginEmail', '==', email))
      const snap = await getDocs(q)

      if (snap.empty) {
        setError('No club found for this email.')
        await auth.signOut()
        return
      }

      router.push('/club/dashboard')
    } catch {
      setError('Invalid email or password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-dark flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src="/pigeon.png" alt="Pigeon" className="w-24 h-24 mx-auto mb-2 object-contain drop-shadow-lg" />
          <h2 className="text-2xl font-bold text-secondary">High Fly Pigeons</h2>
          <p className="text-green-400 text-sm mt-1">Club Portal</p>
        </div>

        <div className="bg-surface border border-green-800 rounded-2xl p-8">
          <h3 className="text-white text-xl font-bold mb-6 text-center">Club Login</h3>

          {error && (
            <div className="bg-red-900 border border-red-600 text-red-200 px-4 py-3 rounded-lg mb-4 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-green-300 text-sm mb-2">Club Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="yourclub@pigeonracing.pk"
                className="w-full bg-primary border border-green-700 text-white rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-secondary placeholder-green-700"
              />
            </div>

            <div>
              <label className="block text-green-300 text-sm mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full bg-primary border border-green-700 text-white rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-secondary placeholder-green-700"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-secondary hover:bg-accent text-dark font-bold py-3 rounded-lg transition disabled:opacity-50"
            >
              {loading ? 'Logging in...' : 'Login to Club'}
            </button>
          </form>
        </div>

        <p className="text-center text-green-600 text-sm mt-6">
          <a href="/" className="hover:text-secondary transition">← Back to Home</a>
        </p>
      </div>
    </main>
  )
}