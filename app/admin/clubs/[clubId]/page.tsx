'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { doc, getDoc, collection, getDocs, updateDoc, deleteDoc } from 'firebase/firestore'
import { db, auth } from '@/lib/firebase'
import { onAuthStateChanged } from 'firebase/auth'
import Link from 'next/link'

interface Club {
  id: string
  name: string
  city: string
  slug: string
  loginEmail: string
}

interface Tournament {
  id: string
  name: string
  status: 'active' | 'inactive' | 'completed'
  totalDays: number
  defaultStartTime: string
  pigeonCount: number
  createdAt: { seconds: number }
}

export default function ClubDetailPage() {
  const router = useRouter()
  const params = useParams()
  const clubId = params.clubId as string

  const [club, setClub] = useState<Club | null>(null)
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let unsubscribe: () => void = () => {}
    let active = true

    auth.authStateReady().then(() => {
      if (!active) return
      unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (!active) return
        if (!user) { router.push('/admin/login'); return }

        const adminDoc = await getDoc(doc(db, 'admins', user.uid))
        if (!active) return
        if (!adminDoc.exists()) { router.push('/admin/login'); return }

        const clubDoc = await getDoc(doc(db, 'clubs', clubId))
        if (!active) return
        if (!clubDoc.exists()) { router.push('/admin/dashboard'); return }
        setClub({ id: clubDoc.id, ...clubDoc.data() } as Club)

        const tSnap = await getDocs(collection(db, 'clubs', clubId, 'tournaments'))
        if (!active) return
        const tList = tSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Tournament[]
        setTournaments(tList)
        setLoading(false)
      })
    })

    return () => {
      active = false
      unsubscribe()
    }
  }, [clubId, router])

  const setActiveTournament = async (tournamentId: string) => {
    await Promise.all(tournaments.map(t =>
      updateDoc(doc(db, 'clubs', clubId, 'tournaments', t.id), {
        status: t.id === tournamentId ? 'active' : 'inactive'
      })
    ))
    setTournaments(prev => prev.map(t => ({
      ...t,
      status: t.id === tournamentId ? 'active' : 'inactive'
    })))
  }

  const completeTournament = async (tournamentId: string) => {
    await updateDoc(doc(db, 'clubs', clubId, 'tournaments', tournamentId), { status: 'completed' })
    setTournaments(prev => prev.map(t =>
      t.id === tournamentId ? { ...t, status: 'completed' } : t
    ))
  }

  const deleteTournament = async (tournamentId: string, tournamentName: string) => {
    if (!confirm(`Delete tournament "${tournamentName}"? This will also delete all its entries. This cannot be undone.`)) return
    const entriesSnap = await getDocs(collection(db, 'clubs', clubId, 'tournaments', tournamentId, 'entries'))
    await Promise.all(entriesSnap.docs.map(e => deleteDoc(e.ref)))
    await deleteDoc(doc(db, 'clubs', clubId, 'tournaments', tournamentId))
    setTournaments(prev => prev.filter(t => t.id !== tournamentId))
  }

  const deleteClub = async () => {
    if (!club) return
    if (!confirm(`Delete club "${club.name}"? This will permanently delete the club, all tournaments, entries, and participants. This cannot be undone.`)) return
    await Promise.all(tournaments.map(async (t) => {
      const entriesSnap = await getDocs(collection(db, 'clubs', clubId, 'tournaments', t.id, 'entries'))
      await Promise.all(entriesSnap.docs.map(e => deleteDoc(e.ref)))
      await deleteDoc(doc(db, 'clubs', clubId, 'tournaments', t.id))
    }))
    const pSnap = await getDocs(collection(db, 'clubs', clubId, 'participants'))
    await Promise.all(pSnap.docs.map(p => deleteDoc(p.ref)))
    await deleteDoc(doc(db, 'clubs', clubId))
    router.push('/admin/dashboard')
  }

  const statusBadge = (status: string) => {
    if (status === 'active') return 'bg-green-700 text-green-200'
    if (status === 'completed') return 'bg-blue-900 text-blue-200'
    return 'bg-gray-700 text-gray-300'
  }

  if (loading) return (
    <main className="min-h-screen bg-dark flex items-center justify-center">
      <p className="text-green-400">Loading...</p>
    </main>
  )

  return (
    <main className="min-h-screen bg-dark">
      <header className="bg-primary border-b border-secondary px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-secondary">🏟️ {club?.name}</h1>
          <p className="text-green-400 text-xs">{club?.city} · {club?.loginEmail}</p>
        </div>
        <Link href="/admin/dashboard" className="text-xs text-green-400 hover:text-secondary transition">
          ← Dashboard
        </Link>
      </header>

      <div className="px-6 py-8 max-w-5xl mx-auto">

        {/* Club Info Card */}
        <div className="bg-surface border border-green-800 rounded-xl p-5 mb-8 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-primary border border-secondary flex items-center justify-center text-secondary text-2xl font-bold">
              {club?.name.charAt(0)}
            </div>
            <div>
              <h2 className="text-white font-bold text-lg">{club?.name}</h2>
              <p className="text-green-400 text-sm">{club?.city}</p>
              <p className="text-green-600 text-xs font-mono">{club?.loginEmail}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Link
              href={`/${club?.slug}`}
              target="_blank"
              className="bg-secondary hover:bg-accent text-dark text-xs font-bold px-4 py-2 rounded-lg transition"
            >
              View Public Page
            </Link>
            <button
              onClick={deleteClub}
              className="bg-red-900 hover:bg-red-700 text-white text-xs font-bold px-4 py-2 rounded-lg transition"
            >
              Delete Club
            </button>
          </div>
        </div>

        {/* Tournaments */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-secondary font-bold text-lg uppercase tracking-widest">
            🏆 Tournaments
          </h2>
          <Link
            href={`/admin/clubs/${clubId}/tournaments/new`}
            className="bg-secondary hover:bg-accent text-dark text-sm font-bold px-4 py-2 rounded-lg transition"
          >
            + New Tournament
          </Link>
        </div>

        {tournaments.length === 0 ? (
          <div className="bg-surface border border-green-800 rounded-xl p-10 text-center">
            <p className="text-4xl mb-3">🏆</p>
            <p className="text-white font-bold">No tournaments yet</p>
            <p className="text-green-400 text-sm mt-1 mb-4">Create the first tournament for this club</p>
            <Link
              href={`/admin/clubs/${clubId}/tournaments/new`}
              className="bg-secondary hover:bg-accent text-dark text-sm font-bold px-6 py-2 rounded-lg transition inline-block"
            >
              + Create Tournament
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {tournaments.map((t) => (
              <div key={t.id} className="bg-surface border border-green-800 hover:border-secondary rounded-xl p-5 transition">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <h3 className="text-white font-bold text-base">{t.name}</h3>
                    <span className={`text-xs px-2 py-1 rounded-full font-semibold ${statusBadge(t.status)}`}>
                      {t.status.toUpperCase()}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="bg-primary rounded-lg p-3 text-center">
                    <p className="text-green-400 text-xs">Total Days</p>
                    <p className="text-white font-bold text-lg">{t.totalDays}</p>
                  </div>
                  <div className="bg-primary rounded-lg p-3 text-center">
                    <p className="text-green-400 text-xs">Start Time</p>
                    <p className="text-white font-bold text-lg">{t.defaultStartTime}</p>
                  </div>
                  <div className="bg-primary rounded-lg p-3 text-center">
                    <p className="text-green-400 text-xs">Pigeons</p>
                    <p className="text-white font-bold text-lg">{t.pigeonCount}</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  {t.status !== 'active' && t.status !== 'completed' && (
                    <button
                      onClick={() => setActiveTournament(t.id)}
                      className="bg-green-700 hover:bg-green-600 text-white text-xs px-4 py-2 rounded-lg transition"
                    >
                      Set Active
                    </button>
                  )}
                  {t.status === 'active' && (
                    <button
                      onClick={() => completeTournament(t.id)}
                      className="bg-blue-800 hover:bg-blue-700 text-white text-xs px-4 py-2 rounded-lg transition"
                    >
                      Mark Completed
                    </button>
                  )}
                  <Link
                    href={`/admin/clubs/${clubId}/tournaments/${t.id}`}
                    className="bg-primary hover:bg-green-800 text-white text-xs px-4 py-2 rounded-lg transition"
                  >
                    Manage
                  </Link>
                  <button
                    onClick={() => deleteTournament(t.id, t.name)}
                    className="bg-red-900 hover:bg-red-700 text-white text-xs px-4 py-2 rounded-lg transition ml-auto"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  )
}