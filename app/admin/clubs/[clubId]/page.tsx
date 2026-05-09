'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { doc, getDoc, collection, getDocs, onSnapshot, updateDoc, deleteDoc } from 'firebase/firestore'
import { db, auth } from '@/lib/firebase'
import { onAuthStateChanged } from 'firebase/auth'
import Link from 'next/link'

interface Club {
  id: string
  name: string
  nameUrdu?: string
  city: string
  cityUrdu?: string
  slug: string
  loginEmail: string
  logoUrl?: string
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
  const [tTab, setTTab] = useState<'active' | 'inactive' | 'completed'>('active')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [editingClub, setEditingClub] = useState(false)
  const [editName, setEditName] = useState('')
  const [editNameUrdu, setEditNameUrdu] = useState('')
  const [editCity, setEditCity] = useState('')
  const [editCityUrdu, setEditCityUrdu] = useState('')
  const [savingClub, setSavingClub] = useState(false)
  const [savedClub, setSavedClub] = useState(false)

  useEffect(() => {
    let unsubscribeAuth: () => void = () => {}
    let unsubscribeTournaments: (() => void) | null = null
    let active = true

    auth.authStateReady().then(() => {
      if (!active) return
      unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
        if (!active) return
        if (!user) { router.push('/admin/login'); return }

        const adminDoc = await getDoc(doc(db, 'admins', user.uid))
        if (!active) return
        if (!adminDoc.exists()) { router.push('/admin/login'); return }

        const clubDoc = await getDoc(doc(db, 'clubs', clubId))
        if (!active) return
        if (!clubDoc.exists()) { router.push('/admin/dashboard'); return }
        setClub({ id: clubDoc.id, ...clubDoc.data() } as Club)

        unsubscribeTournaments?.()
        unsubscribeTournaments = onSnapshot(collection(db, 'clubs', clubId, 'tournaments'), snap => {
          if (!active) return
          setTournaments(snap.docs.map(d => ({ id: d.id, ...d.data() })) as Tournament[])
          setLoading(false)
        })
      })
    })

    return () => {
      active = false
      unsubscribeAuth()
      unsubscribeTournaments?.()
    }
  }, [clubId, router])

  const setActiveTournament = async (tournamentId: string) => {
    setActionLoading(`active-${tournamentId}`)
    await updateDoc(doc(db, 'clubs', clubId, 'tournaments', tournamentId), { status: 'active' })
    setTournaments(prev => prev.map(t => t.id === tournamentId ? { ...t, status: 'active' } : t))
    setActionLoading(null)
  }

  const setInactiveTournament = async (tournamentId: string) => {
    setActionLoading(`inactive-${tournamentId}`)
    await updateDoc(doc(db, 'clubs', clubId, 'tournaments', tournamentId), { status: 'inactive' })
    setTournaments(prev => prev.map(t => t.id === tournamentId ? { ...t, status: 'inactive' } : t))
    setActionLoading(null)
  }

  const completeTournament = async (tournamentId: string) => {
    setActionLoading(`complete-${tournamentId}`)
    await updateDoc(doc(db, 'clubs', clubId, 'tournaments', tournamentId), { status: 'completed' })
    setTournaments(prev => prev.map(t => t.id === tournamentId ? { ...t, status: 'completed' } : t))
    setActionLoading(null)
  }

  const saveClubInfo = async () => {
    if (!club || !editName.trim() || !editCity.trim()) return
    setSavingClub(true)
    const updates: Record<string, string> = { name: editName.trim(), city: editCity.trim() }
    if (editNameUrdu.trim()) updates.nameUrdu = editNameUrdu.trim()
    if (editCityUrdu.trim()) updates.cityUrdu = editCityUrdu.trim()
    await updateDoc(doc(db, 'clubs', clubId), updates)
    setClub(prev => prev ? { ...prev, ...updates } : prev)
    setSavingClub(false); setSavedClub(true); setEditingClub(false)
    setTimeout(() => setSavedClub(false), 3000)
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
      <header className="bg-primary border-b border-secondary px-6 py-3 relative">
        <Link href="/admin/dashboard" className="absolute left-4 top-1/2 -translate-y-1/2 text-xs text-green-400 hover:text-secondary transition">
          ← Dashboard
        </Link>
        <div className="text-center">
          <img src={club?.logoUrl || '/pigeon.png'} alt="Logo" className="w-10 h-10 object-cover rounded-full drop-shadow mx-auto border border-green-700" />
          <h1 className="text-sm font-bold text-secondary leading-tight mt-0.5">{club?.name}</h1>
          <p className="text-green-400 text-xs">{club?.city}</p>
        </div>
      </header>

      <div className="px-6 py-8 max-w-5xl mx-auto">

        {/* Club Info Card */}
        <div className="bg-surface border border-green-800 rounded-xl p-5 mb-8">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-primary border border-secondary overflow-hidden">
                <img src={club?.logoUrl || '/pigeon.png'} alt={club?.name} className="w-full h-full object-cover" />
              </div>
              <div>
                <h2 className="text-white font-bold text-lg">{club?.name}</h2>
                {club?.nameUrdu && <p className="text-green-300 text-sm font-urdu" dir="rtl">{club.nameUrdu}</p>}
                <p className="text-green-400 text-sm">{club?.city}{club?.cityUrdu ? ` · ${club.cityUrdu}` : ''}</p>
                <p className="text-green-600 text-xs font-mono">{club?.loginEmail}</p>
                {savedClub && <p className="text-green-400 text-xs mt-1">✅ Saved!</p>}
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => { setEditName(club?.name || ''); setEditNameUrdu(club?.nameUrdu || ''); setEditCity(club?.city || ''); setEditCityUrdu(club?.cityUrdu || ''); setEditingClub(v => !v) }}
                className="bg-green-800 hover:bg-green-700 text-white text-xs font-bold px-4 py-2 rounded-lg transition"
              >
                {editingClub ? 'Cancel' : 'Edit Info'}
              </button>
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

          {editingClub && (
            <div className="mt-4 pt-4 border-t border-green-800 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-green-400 text-xs mb-1 block">Club Name (English)</label>
                <input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Club name"
                  className="w-full bg-primary border border-green-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-secondary" />
              </div>
              <div>
                <label className="text-green-400 text-xs mb-1 block">نام (اردو، اختیاری)</label>
                <input value={editNameUrdu} onChange={e => setEditNameUrdu(e.target.value)} dir="rtl" placeholder="کلب کا نام"
                  className="w-full bg-primary border border-green-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-secondary font-urdu" />
              </div>
              <div>
                <label className="text-green-400 text-xs mb-1 block">City / Area (English)</label>
                <input value={editCity} onChange={e => setEditCity(e.target.value)} placeholder="City"
                  className="w-full bg-primary border border-green-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-secondary" />
              </div>
              <div>
                <label className="text-green-400 text-xs mb-1 block">شہر (اردو، اختیاری)</label>
                <input value={editCityUrdu} onChange={e => setEditCityUrdu(e.target.value)} dir="rtl" placeholder="شہر"
                  className="w-full bg-primary border border-green-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-secondary font-urdu" />
              </div>
              <div className="sm:col-span-2">
                <button onClick={saveClubInfo} disabled={savingClub || !editName.trim() || !editCity.trim()}
                  className="bg-secondary hover:bg-accent text-dark font-bold px-6 py-2 rounded-lg text-sm transition disabled:opacity-50 flex items-center gap-2">
                  {savingClub && <span className="inline-block w-3 h-3 border-2 border-dark border-t-transparent rounded-full animate-spin" />}
                  {savingClub ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Tournaments */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-secondary font-bold text-lg uppercase tracking-widest">🏆 Tournaments</h2>
          <Link
            href={`/admin/clubs/${clubId}/tournaments/new`}
            className="bg-secondary hover:bg-accent text-dark text-sm font-bold px-4 py-2 rounded-lg transition"
          >
            + New Tournament
          </Link>
        </div>

        {/* Tournament tabs */}
        <div className="flex gap-1 bg-primary rounded-xl p-1 mb-5 border border-green-900">
          {(['active', 'inactive', 'completed'] as const).map(s => {
            const count = tournaments.filter(t => t.status === s).length
            return (
              <button
                key={s}
                onClick={() => setTTab(s)}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition ${
                  tTab === s
                    ? s === 'active' ? 'bg-green-700 text-white' : s === 'completed' ? 'bg-blue-800 text-white' : 'bg-gray-600 text-white'
                    : 'text-green-500 hover:text-white'
                }`}
              >
                {s === 'active' ? '🟢' : s === 'completed' ? '🏁' : '⏸️'}
                <span className="capitalize">{s}</span>
                {count > 0 && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${tTab === s ? 'bg-white bg-opacity-20 text-white' : 'bg-green-900 text-green-400'}`}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {(() => {
          const filtered = tournaments.filter(t => t.status === tTab)
          if (filtered.length === 0) return (
            <div className="bg-surface border border-green-800 rounded-xl p-10 text-center">
              <p className="text-4xl mb-3">{tTab === 'active' ? '🟢' : tTab === 'completed' ? '🏁' : '⏸️'}</p>
              <p className="text-white font-bold">No {tTab} tournaments</p>
              {tTab === 'inactive' && (
                <Link href={`/admin/clubs/${clubId}/tournaments/new`} className="bg-secondary hover:bg-accent text-dark text-sm font-bold px-6 py-2 rounded-lg transition inline-block mt-4">
                  + Create Tournament
                </Link>
              )}
            </div>
          )
          return (
            <div className="space-y-4">
              {filtered.map((t) => (
                <div key={t.id} className="bg-surface border border-green-800 hover:border-secondary rounded-xl p-5 transition">
                  <div className="flex items-center gap-3 mb-3">
                    <h3 className="text-white font-bold text-base">{t.name}</h3>
                    <span className={`text-xs px-2 py-1 rounded-full font-semibold ${statusBadge(t.status)}`}>
                      {t.status.toUpperCase()}
                    </span>
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

                  <div className="flex gap-2 flex-wrap">
                    {t.status === 'inactive' && (
                      <button
                        onClick={() => setActiveTournament(t.id)}
                        disabled={actionLoading === `active-${t.id}`}
                        className="bg-green-700 hover:bg-green-600 text-white text-xs px-4 py-2 rounded-lg transition disabled:opacity-60 flex items-center gap-1.5"
                      >
                        {actionLoading === `active-${t.id}` && <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                        Set Active
                      </button>
                    )}
                    {t.status === 'active' && (
                      <>
                        <button
                          onClick={() => setInactiveTournament(t.id)}
                          disabled={actionLoading === `inactive-${t.id}`}
                          className="bg-gray-600 hover:bg-gray-500 text-white text-xs px-4 py-2 rounded-lg transition disabled:opacity-60 flex items-center gap-1.5"
                        >
                          {actionLoading === `inactive-${t.id}` && <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                          Set Inactive
                        </button>
                        <button
                          onClick={() => completeTournament(t.id)}
                          disabled={actionLoading === `complete-${t.id}`}
                          className="bg-blue-800 hover:bg-blue-700 text-white text-xs px-4 py-2 rounded-lg transition disabled:opacity-60 flex items-center gap-1.5"
                        >
                          {actionLoading === `complete-${t.id}` && <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                          Mark Completed
                        </button>
                      </>
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
          )
        })()}
      </div>
    </main>
  )
}