'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'

export default function AdminLoginPage() {
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
      getDoc(doc(db, 'admins', user.uid)).then(adminDoc => {
        if (active && adminDoc.exists()) router.push('/admin/dashboard')
      })
    })
    return () => { active = false }
  }, [router])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await signInWithEmailAndPassword(auth, email, password)
      router.push('/admin/dashboard')
    } catch {
      setError('Invalid email or password. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-dark flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src="/pigeon.png" alt="Pigeon" className="w-24 h-24 mx-auto mb-2 object-contain drop-shadow-lg" />
          <h2 className="text-2xl font-bold text-secondary">Pakistan Pigeon Racing</h2>
          <p className="text-green-400 text-sm mt-1">Admin Panel</p>
        </div>

        <div className="bg-surface border border-green-800 rounded-2xl p-8">
          <h3 className="text-white text-xl font-bold mb-6 text-center">Admin Login</h3>

          {error && (
            <div className="bg-red-900 border border-red-600 text-red-200 px-4 py-3 rounded-lg mb-4 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-green-300 text-sm mb-2">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="admin@pigeonracing.pk"
                className="w-full bg-primary border border-green-700 text-white rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-secondary placeholder-green-700"
              />
            </div>

            <div>
              <label className="block text-green-300 text-sm mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
              {loading ? 'Logging in...' : 'Login to Dashboard'}
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