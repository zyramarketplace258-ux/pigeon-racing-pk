'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { collection, getDocs, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import Link from 'next/link'

interface Club {
  id: string
  name: string
  slug: string
  city: string
}

interface ActiveTournament {
  id: string
  name: string
  totalDays: number
  clubId: string
  clubName: string
  clubSlug: string
  clubCity: string
}

const personalities = [
  { name: 'Ustad Anwar Sahib', title: 'Legend of Lahore Racing' },
  { name: 'Ch. Zafar Iqbal', title: 'Champion 2022 & 2023' },
  { name: 'Haji Bashir Ahmed', title: 'Founder - Punjab Racing League' },
]

export default function HomePage() {
  const [clubs, setClubs] = useState<Club[]>([])
  const [activeTournaments, setActiveTournaments] = useState<ActiveTournament[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const snap = await getDocs(collection(db, 'clubs'))
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Club[]
      setClubs(list)

      // Load active tournaments across all clubs
      const tournamentList: ActiveTournament[] = []
      await Promise.all(list.map(async (club) => {
        const tSnap = await getDocs(
          query(collection(db, 'clubs', club.id, 'tournaments'), where('status', '==', 'active'))
        )
        tSnap.docs.forEach(d => {
          tournamentList.push({
            id: d.id,
            name: d.data().name,
            totalDays: d.data().totalDays,
            clubId: club.id,
            clubName: club.name,
            clubSlug: club.slug,
            clubCity: club.city,
          })
        })
      }))
      setActiveTournaments(tournamentList)
      setLoading(false)
    }
    load()
  }, [])

  return (
    <main className="min-h-screen bg-dark text-white">

      <header className="bg-primary border-b border-secondary px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary">🐦 Pakistan Pigeon Racing</h1>
          <p className="text-green-300 text-sm">Official Racing Platform</p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/club/login"
            className="text-xs bg-surface border border-green-700 text-green-300 px-3 py-1 rounded font-semibold hover:border-secondary hover:text-secondary transition"
          >
            Club Login
          </Link>
          <Link
            href="/admin/login"
            className="text-xs bg-secondary text-dark px-3 py-1 rounded font-semibold hover:bg-accent transition"
          >
            Admin Login
          </Link>
        </div>
      </header>

      <section className="bg-primary py-10 px-6 text-center border-b border-green-800">
        <h2 className="text-3xl font-bold text-secondary mb-2">Pakistan Pigeon Racing</h2>
        <p className="text-green-300 text-base max-w-xl mx-auto">
          The official platform for pigeon racing clubs across Pakistan.
        </p>
      </section>

      <section className="bg-surface px-6 py-8 border-b border-green-900">
        <h2 className="text-secondary text-lg font-bold mb-4 uppercase tracking-widest">
          🏆 Legends of the Sport
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {personalities.map((p, i) => (
            <div key={i} className="bg-primary border border-secondary rounded-xl p-6 text-center">
              <div className="w-20 h-20 rounded-full bg-secondary mx-auto mb-3 flex items-center justify-center text-dark text-3xl font-bold">
                {p.name.charAt(0)}
              </div>
              <h3 className="text-white font-bold text-lg">{p.name}</h3>
              <p className="text-green-300 text-sm mt-1">{p.title}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Active Tournaments */}
      {!loading && activeTournaments.length > 0 && (
        <section className="px-6 py-8 border-b border-green-900">
          <h2 className="text-secondary text-lg font-bold mb-4 uppercase tracking-widest">
            🟢 Live Tournaments
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeTournaments.map(t => (
              <Link
                key={`${t.clubId}-${t.id}`}
                href={`/${t.clubSlug}/${t.id}`}
                className="bg-surface border border-green-700 hover:border-secondary rounded-xl p-5 transition group"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="bg-green-700 text-green-200 text-xs px-2 py-0.5 rounded-full font-semibold">LIVE</span>
                  <span className="text-green-600 text-xs">{t.totalDays} days</span>
                </div>
                <h3 className="text-white font-bold text-base group-hover:text-secondary transition mb-1">
                  {t.name}
                </h3>
                <p className="text-green-400 text-xs">{t.clubName} · {t.clubCity}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="px-6 py-8">
        <h2 className="text-secondary text-lg font-bold mb-4 uppercase tracking-widest">
          🏟️ Registered Clubs
        </h2>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-surface border border-green-900 rounded-xl p-6 animate-pulse">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-primary"></div>
                  <div className="space-y-2">
                    <div className="h-4 bg-primary rounded w-32"></div>
                    <div className="h-3 bg-primary rounded w-20"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : clubs.length === 0 ? (
          <div className="bg-surface border border-green-800 rounded-xl p-10 text-center">
            <p className="text-4xl mb-3">🏟️</p>
            <p className="text-white font-bold">No clubs registered yet</p>
            <p className="text-green-400 text-sm mt-1">Check back soon!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {clubs.map((club) => (
              <Link
                key={club.id}
                href={`/${club.slug}`}
                className="bg-surface border border-green-800 hover:border-secondary rounded-xl p-6 transition group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-primary border border-secondary flex items-center justify-center text-secondary text-2xl font-bold group-hover:bg-secondary group-hover:text-dark transition">
                    {club.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-base group-hover:text-secondary transition">
                      {club.name}
                    </h3>
                    <p className="text-green-400 text-sm">{club.city}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <footer className="bg-primary border-t border-green-800 text-center py-4 text-green-400 text-sm mt-8">
        © 2026 Pakistan Pigeon Racing Platform. All rights reserved.
      </footer>

    </main>
  )
}
