'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { onAuthStateChanged } from 'firebase/auth'
import { collection, query, where, getDocs, addDoc, deleteDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import Link from 'next/link'

interface Club { id: string; name: string }
interface Tournament { id: string; name: string; status: string; participantIds?: string[] }
interface Participant { id: string; name: string; area: string }

export default function ParticipantsPage() {
  const router = useRouter()
  const [club, setClub] = useState<Club | null>(null)
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>('')
  const [assignedIds, setAssignedIds] = useState<Set<string>>(new Set())
  const [savingAssignment, setSavingAssignment] = useState(false)
  const [savedAssignment, setSavedAssignment] = useState(false)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [area, setArea] = useState('')
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    let unsubscribe: () => void = () => {}
    let active = true

    auth.authStateReady().then(() => {
      if (!active) return
      unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (!active) return
        if (!user) { router.push('/club/login'); return }

        const q = query(collection(db, 'clubs'), where('loginEmail', '==', user.email))
        const snap = await getDocs(q)
        if (!active) return
        if (snap.empty) { router.push('/club/login'); return }

        const clubData = { id: snap.docs[0].id, ...snap.docs[0].data() } as Club
        setClub(clubData)

        const [pSnap, tSnap] = await Promise.all([
          getDocs(collection(db, 'clubs', clubData.id, 'participants')),
          getDocs(collection(db, 'clubs', clubData.id, 'tournaments')),
        ])
        if (!active) return

        const pList = pSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Participant[]
        setParticipants(pList)

        const tList = tSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Tournament[]
        setTournaments(tList)

        if (tList.length > 0) {
          const first = tList[0]
          setSelectedTournamentId(first.id)
          setAssignedIds(new Set(first.participantIds?.length ? first.participantIds : pList.map(p => p.id)))
        }

        setLoading(false)
      })
    })

    return () => { active = false; unsubscribe() }
  }, [router])

  const handleTournamentSelect = (tournamentId: string) => {
    const t = tournaments.find(t => t.id === tournamentId)
    if (!t) return
    setSelectedTournamentId(tournamentId)
    setAssignedIds(new Set(t.participantIds?.length ? t.participantIds : participants.map(p => p.id)))
    setSavedAssignment(false)
  }

  const toggleAssigned = (participantId: string) => {
    setAssignedIds(prev => {
      const next = new Set(prev)
      if (next.has(participantId)) next.delete(participantId); else next.add(participantId)
      return next
    })
    setSavedAssignment(false)
  }

  const saveAssignment = async () => {
    if (!club || !selectedTournamentId) return
    setSavingAssignment(true)
    const ids = Array.from(assignedIds)
    await updateDoc(doc(db, 'clubs', club.id, 'tournaments', selectedTournamentId), { participantIds: ids })
    setTournaments(prev => prev.map(t => t.id === selectedTournamentId ? { ...t, participantIds: ids } : t))
    setSavingAssignment(false)
    setSavedAssignment(true)
  }

  const addParticipant = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!club) return
    setAdding(true)
    const docRef = await addDoc(collection(db, 'clubs', club.id, 'participants'), {
      name, area, pigeonRingNumbers: [], createdAt: serverTimestamp()
    })
    setParticipants(prev => [...prev, { id: docRef.id, name, area }])
    setName('')
    setArea('')
    setAdding(false)
  }

  const removeParticipant = async (id: string) => {
    if (!club) return
    await deleteDoc(doc(db, 'clubs', club.id, 'participants', id))
    setParticipants(prev => prev.filter(p => p.id !== id))
    setAssignedIds(prev => { const next = new Set(prev); next.delete(id); return next })
  }

  const selectedTournament = tournaments.find(t => t.id === selectedTournamentId)

  if (loading) return (
    <main className="min-h-screen bg-dark flex items-center justify-center">
      <p className="text-green-400">Loading...</p>
    </main>
  )

  return (
    <main className="min-h-screen bg-dark">
      <header className="bg-primary border-b border-secondary px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-secondary">👥 Participants</h1>
          <p className="text-green-400 text-xs">{club?.name}</p>
        </div>
        <Link href="/club/dashboard" className="text-xs text-green-400 hover:text-secondary transition">
          ← Dashboard
        </Link>
      </header>

      <div className="px-6 py-8 max-w-3xl mx-auto space-y-6">

        {/* Tournament Participant Assignment */}
        {tournaments.length > 0 && (
          <div className="bg-surface border border-secondary rounded-xl p-6">
            <h2 className="text-secondary font-bold mb-1">Tournament Participants</h2>
            <p className="text-green-400 text-xs mb-4">Select which participants are enrolled in each tournament.</p>

            {/* Tournament selector */}
            <div className="flex flex-wrap gap-2 mb-5">
              {tournaments.map(t => (
                <button
                  key={t.id}
                  onClick={() => handleTournamentSelect(t.id)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition ${
                    t.id === selectedTournamentId
                      ? 'bg-secondary text-dark'
                      : 'bg-primary border border-green-700 text-green-300 hover:border-secondary'
                  }`}
                >
                  {t.name}
                  <span className="ml-2 text-xs opacity-70">
                    ({t.participantIds?.length ?? participants.length})
                  </span>
                </button>
              ))}
            </div>

            {selectedTournament && participants.length > 0 && (
              <>
                <div className="flex gap-4 mb-3">
                  <button
                    onClick={() => { setAssignedIds(new Set(participants.map(p => p.id))); setSavedAssignment(false) }}
                    className="text-xs text-green-400 hover:text-secondary transition"
                  >
                    Select All
                  </button>
                  <span className="text-green-800">·</span>
                  <button
                    onClick={() => { setAssignedIds(new Set()); setSavedAssignment(false) }}
                    className="text-xs text-green-400 hover:text-secondary transition"
                  >
                    Deselect All
                  </button>
                  <span className="text-green-800 ml-auto text-xs text-green-600">
                    {assignedIds.size} / {participants.length} selected
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-5">
                  {participants.map(p => (
                    <label
                      key={p.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition ${
                        assignedIds.has(p.id)
                          ? 'border-secondary bg-primary'
                          : 'border-green-800 hover:border-green-600'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={assignedIds.has(p.id)}
                        onChange={() => toggleAssigned(p.id)}
                        className="accent-yellow-400 w-4 h-4 shrink-0"
                      />
                      <div>
                        <p className="text-white text-sm font-semibold">{p.name}</p>
                        <p className="text-green-400 text-xs">{p.area}</p>
                      </div>
                    </label>
                  ))}
                </div>

                <div className="flex items-center gap-4">
                  <button
                    onClick={saveAssignment}
                    disabled={savingAssignment}
                    className="bg-secondary hover:bg-accent text-dark font-bold px-6 py-2 rounded-lg text-sm transition disabled:opacity-50"
                  >
                    {savingAssignment ? 'Saving...' : 'Save'}
                  </button>
                  {savedAssignment && <p className="text-green-400 text-sm">✅ Saved!</p>}
                </div>
              </>
            )}

            {participants.length === 0 && (
              <p className="text-green-600 text-sm">Add participants below first.</p>
            )}
          </div>
        )}

        {/* Add Participant */}
        <div className="bg-surface border border-green-800 rounded-xl p-6">
          <h2 className="text-secondary font-bold mb-4">+ Add Participant</h2>
          <form onSubmit={addParticipant} className="flex gap-3">
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              placeholder="Participant name"
              className="flex-1 bg-primary border border-green-700 text-white rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-secondary placeholder-green-700"
            />
            <input
              type="text"
              value={area}
              onChange={e => setArea(e.target.value)}
              required
              placeholder="Area / Location"
              className="flex-1 bg-primary border border-green-700 text-white rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-secondary placeholder-green-700"
            />
            <button
              type="submit"
              disabled={adding}
              className="bg-secondary hover:bg-accent text-dark font-bold px-5 py-2 rounded-lg text-sm transition disabled:opacity-50"
            >
              Add
            </button>
          </form>
        </div>

        {/* All Participants */}
        <div className="bg-surface border border-green-800 rounded-xl overflow-hidden">
          <div className="bg-primary px-4 py-3 border-b border-green-800">
            <p className="text-green-400 text-sm font-semibold">
              {participants.length} Participant{participants.length !== 1 ? 's' : ''} in Club
            </p>
          </div>
          {participants.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-green-600">No participants yet. Add your first one above.</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-green-900">
                  <th className="text-left text-green-400 px-4 py-3">#</th>
                  <th className="text-left text-green-400 px-4 py-3">Name</th>
                  <th className="text-left text-green-400 px-4 py-3">Area</th>
                  <th className="text-left text-green-400 px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {participants.map((p, i) => (
                  <tr key={p.id} className="border-b border-green-900 hover:bg-primary transition">
                    <td className="px-4 py-3 text-green-600">{i + 1}</td>
                    <td className="px-4 py-3 text-white font-semibold">{p.name}</td>
                    <td className="px-4 py-3 text-green-300">{p.area}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => removeParticipant(p.id)}
                        className="text-red-500 hover:text-red-400 text-xs transition"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </div>
    </main>
  )
}
