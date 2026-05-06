'use client'
export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import { auth, db } from '@/lib/firebase'
import Link from 'next/link'

export default function NewClubPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState<{email: string, password: string, name: string} | null>(null)

  const [form, setForm] = useState({
    name: '',
    city: '',
    slug: '',
    password: '',
  })

  const handleNameChange = (value: string) => {
    const slug = value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    setForm(f => ({ ...f, name: value, slug }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const email = `${form.slug}@pigeonracing.pk`

    try {
      // Create Firebase Auth account for club
      const userCredential = await createUserWithEmailAndPassword(auth, email, form.password)
      const uid = userCredential.user.uid

      // Save club to Firestore
      await addDoc(collection(db, 'clubs'), {
        uid,
        name: form.name,
        city: form.city,
        slug: form.slug,
        loginEmail: email,
        logoUrl: '',
        bannerImageUrl: '',
        createdAt: serverTimestamp(),
        createdBy: 'admin',
      })

      setSuccess({ email, password: form.password, name: form.name })

    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message)
      } else {
        setError('Something went wrong.')
      }
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
            <p className="text-green-300 mb-6">{success.name} has been added successfully.</p>

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
                onClick={() => { setSuccess(null); setForm({ name: '', city: '', slug: '', password: '' }) }}
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

      {/* Header */}
      <header className="bg-primary border-b border-secondary px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-secondary">🏟️ Create New Club</h1>
          <p className="text-green-400 text-xs">Admin Panel</p>
        </div>
        <Link
          href="/admin/dashboard"
          className="text-xs text-green-400 hover:text-secondary transition"
        >
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

            {/* Club Name */}
            <div>
              <label className="block text-green-300 text-sm mb-2">Club Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => handleNameChange(e.target.value)}
                required
                placeholder="e.g. Lahore Pigeon Club"
                className="w-full bg-primary border border-green-700 text-white rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-secondary placeholder-green-700"
              />
            </div>

            {/* City */}
            <div>
              <label className="block text-green-300 text-sm mb-2">City</label>
              <input
                type="text"
                value={form.city}
                onChange={(e) => setForm(f => ({ ...f, city: e.target.value }))}
                required
                placeholder="e.g. Lahore"
                className="w-full bg-primary border border-green-700 text-white rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-secondary placeholder-green-700"
              />
            </div>

            {/* Slug (auto generated) */}
            <div>
              <label className="block text-green-300 text-sm mb-2">
                Club URL Slug
                <span className="text-green-600 ml-2 text-xs">(auto-generated)</span>
              </label>
              <input
                type="text"
                value={form.slug}
                onChange={(e) => setForm(f => ({ ...f, slug: e.target.value }))}
                required
                placeholder="lahore-pigeon-club"
                className="w-full bg-primary border border-green-700 text-white rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-secondary placeholder-green-700 font-mono"
              />
              <p className="text-green-600 text-xs mt-1">
                Public URL: yoursite.com/{form.slug || 'club-slug'}
              </p>
            </div>

            {/* Login Email (auto) */}
            <div>
              <label className="block text-green-300 text-sm mb-2">Login Email (auto-generated)</label>
              <div className="w-full bg-dark border border-green-900 text-green-500 rounded-lg px-4 py-3 text-sm font-mono">
                {form.slug ? `${form.slug}@pigeonracing.pk` : 'slug@pigeonracing.pk'}
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-green-300 text-sm mb-2">Login Password</label>
              <input
                type="text"
                value={form.password}
                onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))}
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