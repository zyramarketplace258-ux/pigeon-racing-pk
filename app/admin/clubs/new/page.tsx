'use client'
export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { initializeApp, deleteApp } from 'firebase/app'
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth'
import { db, firebaseConfig } from '@/lib/firebase'
import Link from 'next/link'

const isUrduScript = (text: string) => /[؀-ۿ]/.test(text)

export default function NewClubPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState<{email: string, password: string, displayName: string} | null>(null)

  const [nameInput, setNameInput] = useState('')
  const [cityInput, setCityInput] = useState('')
  const [slug, setSlug] = useState('')
  const [password, setPassword] = useState('')

  const handleNameInput = (value: string) => {
    setNameInput(value)
    // Auto-generate slug only from English text
    if (!isUrduScript(value)) {
      setSlug(value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const trimName = nameInput.trim()
    const trimCity = cityInput.trim()

    if (!trimName) { setError('Club name is required'); setLoading(false); return }
    if (!trimCity) { setError('City is required'); setLoading(false); return }
    if (!slug) { setError('URL slug is required — type an English name or enter slug manually'); setLoading(false); return }

    const nameIsUrdu = isUrduScript(trimName)
    const cityIsUrdu = isUrduScript(trimCity)

    const email = `${slug}@pigeonracing.pk`

    try {
      const secondaryApp = initializeApp(firebaseConfig, `club-create-${Date.now()}`)
      const secondaryAuth = getAuth(secondaryApp)
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password)
      const uid = userCredential.user.uid
      await deleteApp(secondaryApp)

      await addDoc(collection(db, 'clubs'), {
        uid,
        name: nameIsUrdu ? '' : trimName,
        ...(nameIsUrdu ? { nameUrdu: trimName } : {}),
        city: cityIsUrdu ? '' : trimCity,
        ...(cityIsUrdu ? { cityUrdu: trimCity } : {}),
        slug,
        loginEmail: email,
        logoUrl: '',
        bannerImageUrl: '',
        createdAt: serverTimestamp(),
        createdBy: 'admin',
      })

      setSuccess({ email, password, displayName: trimName })

    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message)
      else setError('Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <main className="min-h-screen bg-dark flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="bg-surface border border-secondary rounded-2xl p-8 text-center">
            <p className="text-5xl mb-4">🎉</p>
            <h2 className="text-secondary text-2xl font-bold mb-2">Club Created!</h2>
            <p className="text-green-300 mb-6">{success.displayName} has been added successfully.</p>

            <div className="bg-primary rounded-xl p-4 text-left mb-6">
              <p className="text-green-400 text-xs mb-3 uppercase tracking-widest">Club Login Credentials</p>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-green-400 text-sm">Email:</span>
                  <span className="text-white text-sm font-mono">{success.email}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-green-400 text-sm">Password:</span>
                  <span className="text-white text-sm font-mono">{success.password}</span>
                </div>
              </div>
              <p className="text-yellow-400 text-xs mt-3">⚠️ Save these credentials and share with the club.</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setSuccess(null); setNameInput(''); setCityInput(''); setSlug(''); setPassword('') }}
                className="flex-1 bg-primary hover:bg-green-800 text-white py-2 rounded-lg text-sm transition"
              >
                + Add Another
              </button>
              <Link
                href="/admin/dashboard"
                className="flex-1 bg-secondary hover:bg-accent text-dark font-bold py-2 rounded-lg text-sm transition text-center"
              >
                Dashboard
              </Link>
            </div>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-dark">

      <header className="bg-primary border-b border-secondary px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-secondary">🏟️ Create New Club</h1>
          <p className="text-green-400 text-xs">Admin Panel</p>
        </div>
        <Link href="/admin/dashboard" className="text-xs text-green-400 hover:text-secondary transition">
          ← Back to Dashboard
        </Link>
      </header>

      <div className="px-6 py-8 max-w-xl mx-auto">
        <div className="bg-surface border border-green-800 rounded-2xl p-8">

          {error && (
            <div className="bg-red-900 border border-red-600 text-red-200 px-4 py-3 rounded-lg mb-5 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Club Name — single smart field */}
            <div>
              <label className="block text-green-300 text-sm mb-1">Club Name</label>
              <p className="text-green-600 text-xs mb-2">Type in English or Urdu — detected automatically</p>
              <input
                type="text"
                value={nameInput}
                onChange={e => handleNameInput(e.target.value)}
                required
                dir={isUrduScript(nameInput) ? 'rtl' : 'ltr'}
                placeholder="e.g. Lahore Pigeon Club / لاہور پیجن کلب"
                className="w-full bg-primary border border-green-700 text-white rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-secondary placeholder-green-700"
              />
              {isUrduScript(nameInput) && (
                <p className="text-green-500 text-xs mt-1">Urdu detected ✓ — enter URL slug manually below</p>
              )}
            </div>

            {/* City — single smart field */}
            <div>
              <label className="block text-green-300 text-sm mb-1">City</label>
              <p className="text-green-600 text-xs mb-2">Type in English or Urdu — detected automatically</p>
              <input
                type="text"
                value={cityInput}
                onChange={e => setCityInput(e.target.value)}
                required
                dir={isUrduScript(cityInput) ? 'rtl' : 'ltr'}
                placeholder="e.g. Lahore / لاہور"
                className="w-full bg-primary border border-green-700 text-white rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-secondary placeholder-green-700"
              />
            </div>

            {/* Slug */}
            <div>
              <label className="block text-green-300 text-sm mb-2">
                Club URL Slug
                <span className="text-green-600 ml-2 text-xs">{isUrduScript(nameInput) ? '(enter manually)' : '(auto-generated)'}</span>
              </label>
              <input
                type="text"
                value={slug}
                onChange={e => setSlug(e.target.value)}
                required
                placeholder="lahore-pigeon-club"
                className="w-full bg-primary border border-green-700 text-white rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-secondary placeholder-green-700 font-mono"
              />
              <p className="text-green-600 text-xs mt-1">
                Public URL: yoursite.com/{slug || 'club-slug'}
              </p>
            </div>

            {/* Login Email (auto) */}
            <div>
              <label className="block text-green-300 text-sm mb-2">Login Email (auto-generated)</label>
              <div className="w-full bg-dark border border-green-900 text-green-500 rounded-lg px-4 py-3 text-sm font-mono">
                {slug ? `${slug}@pigeonracing.pk` : 'slug@pigeonracing.pk'}
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-green-300 text-sm mb-2">Login Password</label>
              <input
                type="text"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="Set a password for this club"
                className="w-full bg-primary border border-green-700 text-white rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-secondary placeholder-green-700"
              />
              <p className="text-green-600 text-xs mt-1">Minimum 6 characters</p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-secondary hover:bg-accent text-dark font-bold py-3 rounded-lg transition disabled:opacity-50 mt-2"
            >
              {loading ? 'Creating Club...' : 'Create Club'}
            </button>

          </form>
        </div>
      </div>
    </main>
  )
}
