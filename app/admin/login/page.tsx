'use client'

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
    } catch (err: unknown) {
      setError('Invalid email or password. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-dark flex items-center justify-center px-4">
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🐦</div>
          <h1 className="text-secondary text-2xl font-bold">Pakistan Pigeon Racing</h1>
          <p className="text-green-400 text-sm mt-1">Admin Control Panel</p>
        </div>

        {/* Login Card */}
        <div className="bg-surface border border-green-800 rounded-2xl p-8">
          <h2 className="text-white text-xl font-bold mb-6 text-center">Admin Login</h2>

          {error && (
            <div className="bg-red-900/50 border border-red-500 text-red-300 text-sm px-4 py-3 rounded-lg mb-5">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="text-green-300 text-sm font-medium block mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="admin@pigeonracing.pk"
                className="w-full bg-dark border border-green-700 text-white rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-secondary placeholder-green-900"
              />
            </div>

            <div>
              <label className="text-green-300 text-sm font-medium block mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full bg-dark border border-green-700 text-white rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-secondary placeholder-green-900"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-secondary hover:bg-accent text-dark font-bold py-3 rounded-lg transition text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Logging in...' : 'Login to Dashboard'}
            </button>
          </form>
        </div>

        {/* Back link */}
        <p className="text-center mt-4">
          <a href="/" className="text-green-500 hover:text-secondary text-sm transition">
            ← Back to Home
          </a>
        </p>

      </div>
    </main>
  )
}