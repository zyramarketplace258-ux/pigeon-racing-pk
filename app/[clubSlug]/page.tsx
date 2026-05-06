'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import Link from 'next/link'

interface Club { id: string; name: string; slug: string; city: string }
interface Tournament { id: string; name: string; status: string; totalDays: number; defaultStartTime: string }

export default function ClubPublicPage() {
  const params = useParams()
  const clubSlug = params.clubSlug as string

  const [club, setClub] = useState<Club | null>(null)
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    const load = async () => {
      const q = query(collection(db, 'clubs'), where('slug', '==', clubSlug))
      const snap = await getDocs(q)
      if (snap.empty) { setNotFound(true); setLoading(false); return }

      const clubData = { id: snap.docs[0].id, ...snap.docs[0].data() } as Club
      setClub(clubData)

      const tSnap = await getDocs(collection(db, 'clubs', clubData.id, 'tournaments'))
      const tList = tSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Tournament[]
      setTournaments(tList)
      setLoading(false)
    }
    load()
  }, [clubSlug])

  if (loading) return (
    <main className="min-h-screen bg-dark flex items-center justify-center">
      <p className="text-green-400">Loading...</p>
    </main>
  )

  if (notFound) return (
    <main className="min-h-screen bg-dark flex items-center justify-center">
      <div className="text-center">
        <p className="text-6xl mb-4">🏟️</p>
        <h1 className="text-white text-2xl font-bold">Club Not Found</h1>
        <Link href="/" className="text-secondary hover:text-accent mt-4 inline-block">← Back to Home</Link>
      </div>
    </main>
  )

  const active = tournaments.filter(t => t.status === 'active')
  const completed = tournaments.filter(t => t.status === 'completed')
  const inactive = tournaments.filter(t => t.status === 'inactive')

  return (
    <main className="min-h-screen bg-dark">
      <header className="bg-primary border-b border-secondary px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center text-dark text-xl font-bold">
            {club?.name.charAt(0)}
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">{club?.name}</h1>
            <p className="text-green-400 text-xs">{club?.city}</p>
          </div>
        </div>
        <Link href="/" className="text-xs text-green-400 hover:text-secondary transition">
          ← All Clubs
        </Link>
      </header>

      <div className="px-6 py-8 max-w-4xl mx-auto">

        {/* Active */}
        {active.length > 0 && (
          <div className="mb-8">
            <h2 className="text-secondary font-bold text-lg uppercase tracking-widest mb-4">
              🟢 Active Tournaments
            </h2>
            <div className="space-y-3">
              {active.map(t => (
                <Link key={t.id} href={`/${clubSlug}/${t.id}`}
                  className="block bg-surface border border-secondary hover:border-accent rounded-xl p-5 transition group">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-white font-bold text-base group-hover:text-secondary transition">{t.name}</h3>
                      <p className="text-green-400 text-sm mt-1">{t.totalDays} days · Start: {t.defaultStartTime}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="bg-green-700 text-green-200 text-xs px-3 py-1 rounded-full font-semibold">LIVE</span>
                      <span className="text-secondary text-lg">→</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Completed */}
        {completed.length > 0 && (
          <div className="mb-8">
            <h2 className="text-secondary font-bold text-lg uppercase tracking-widest mb-4">
              🏁 Completed Tournaments
            </h2>
            <div className="space-y-3">
              {completed.map(t => (
                <Link key={t.id} href={`/${clubSlug}/${t.id}`}
                  className="block bg-surface border border-green-800 hover:border-secondary rounded-xl p-5 transition group">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-white font-bold group-hover:text-secondary transition">{t.name}</h3>
                      <p className="text-green-400 text-sm mt-1">{t.totalDays} days · Start: {t.defaultStartTime}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="bg-blue-900 text-blue-200 text-xs px-3 py-1 rounded-full font-semibold">COMPLETED</span>
                      <span className="text-secondary text-lg">→</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Upcoming */}
        {inactive.length > 0 && (
          <div className="mb-8">
            <h2 className="text-green-600 font-bold text-sm uppercase tracking-widest mb-4">Upcoming</h2>
            <div className="space-y-3">
              {inactive.map(t => (
                <div key={t.id} className="bg-surface border border-green-900 rounded-xl p-5 opacity-60">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-white font-bold">{t.name}</h3>
                      <p className="text-green-600 text-sm mt-1">{t.totalDays} days</p>
                    </div>
                    <span className="bg-gray-800 text-gray-400 text-xs px-3 py-1 rounded-full">UPCOMING</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tournaments.length === 0 && (
          <div className="bg-surface border border-green-800 rounded-xl p-10 text-center">
            <p className="text-4xl mb-3">🏆</p>
            <p className="text-white font-bold">No Tournaments Yet</p>
            <p className="text-green-400 text-sm mt-2">Check back soon!</p>
          </div>
        )}
      </div>
    </main>
  )
}