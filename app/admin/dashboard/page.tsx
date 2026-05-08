'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { signOut } from 'firebase/auth'
import { collection, getDocs } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import AdminGuard from '@/components/admin/AdminGuard'
import Link from 'next/link'

interface Club {
  id: string
  name: string
  slug: string
  city: string
  loginEmail: string
  logoUrl?: string
}

export default function AdminDashboard() {
  const router = useRouter()
  const [clubs, setClubs] = useState<Club[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const snapshot = await getDocs(collection(db, 'clubs'))
      const clubList = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Club[]
      setClubs(clubList)
      setLoading(false)
    }
    load()
  }, [])

  const handleLogout = async () => {
    await signOut(auth)
    router.push('/admin/login')
  }

  return (
    <AdminGuard>
      <main className="min-h-screen bg-dark">
        <header className="bg-primary border-b border-secondary px-6 py-3 relative">
          <Link href="/" target="_blank" className="absolute left-4 top-1/2 -translate-y-1/2 text-xs text-green-400 hover:text-secondary transition">
            View Site
          </Link>
          <div className="text-center">
            <img src="/pigeon.png" alt="Pigeon" className="w-10 h-10 object-contain drop-shadow mx-auto" />
            <h1 className="text-sm font-bold text-secondary leading-tight mt-0.5">Admin Dashboard</h1>
            <p className="text-green-400 text-xs">Pakistan Pigeon Racing</p>
          </div>
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <button
              onClick={handleLogout}
              className="text-xs bg-red-900 hover:bg-red-700 text-white px-3 py-1.5 rounded transition"
            >
              Logout
            </button>
          </div>
        </header>

        <div className="px-6 py-8 max-w-6xl mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <div className="bg-surface border border-green-800 rounded-xl p-5">
              <p className="text-green-400 text-sm">Total Clubs</p>
              <p className="text-4xl font-bold text-secondary mt-1">{clubs.length}</p>
            </div>
            <div className="bg-surface border border-green-800 rounded-xl p-5">
              <p className="text-green-400 text-sm">Platform</p>
              <p className="text-xl font-bold text-white mt-1">Pakistan Pigeon Racing</p>
            </div>
            <div className="bg-surface border border-green-800 rounded-xl p-5">
              <p className="text-green-400 text-sm">Status</p>
              <p className="text-xl font-bold text-green-400 mt-1">🟢 Live</p>
            </div>
          </div>

          <div className="flex items-center justify-between mb-4">
            <h2 className="text-secondary font-bold text-lg uppercase tracking-widest">🏟️ Clubs</h2>
            <Link href="/admin/clubs/new" className="bg-secondary hover:bg-accent text-dark text-sm font-bold px-4 py-2 rounded-lg transition">
              + Add New Club
            </Link>
          </div>

          {loading ? (
            <p className="text-green-400">Loading clubs...</p>
          ) : clubs.length === 0 ? (
            <div className="bg-surface border border-green-800 rounded-xl p-10 text-center">
              <p className="text-4xl mb-3">🏟️</p>
              <p className="text-white font-bold text-lg">No clubs yet</p>
              <Link href="/admin/clubs/new" className="bg-secondary hover:bg-accent text-dark text-sm font-bold px-6 py-2 rounded-lg transition inline-block mt-3">
                + Create First Club
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {clubs.map((club) => (
                <div key={club.id} className="bg-surface border border-green-800 hover:border-secondary rounded-xl p-5 transition">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-full bg-primary border border-secondary overflow-hidden">
                      <img src={club.logoUrl || '/pigeon.png'} alt={club.name} className="w-full h-full object-cover" />
                    </div>
                    <div>
                      <h3 className="text-white font-bold">{club.name}</h3>
                      <p className="text-green-400 text-xs">{club.city}</p>
                    </div>
                  </div>
                  <p className="text-green-600 text-xs mb-4">📧 {club.loginEmail}</p>
                  <div className="flex gap-2">
                    <Link href={`/admin/clubs/${club.id}`} className="flex-1 text-center bg-primary hover:bg-green-800 text-white text-xs py-2 rounded-lg transition">
                      Manage
                    </Link>
                    <Link href={`/${club.slug}`} target="_blank" className="flex-1 text-center bg-secondary hover:bg-accent text-dark text-xs font-bold py-2 rounded-lg transition">
                      View
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </AdminGuard>
  )
}
