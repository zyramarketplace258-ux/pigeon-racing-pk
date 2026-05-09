'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, getDoc, collection, onSnapshot, updateDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { formatTimeDisplay } from '@/lib/timeUtils'
import Link from 'next/link'

interface RaceDay { dayNumber: number; date: string; isGap: boolean }
interface Tournament {
  id: string; name: string; nameUrdu?: string; status: string; totalDays: number
  defaultStartTime: string; pigeonCount: number; raceDays: RaceDay[]
  participantIds?: string[]; area?: string; areaUrdu?: string
}
interface Participant { id: string; name: string; nameUrdu?: string; area: string; areaUrdu?: string }
interface PigeonEntry { landingTime: string; hoursFlown: string }
interface Entry {
  participantId: string; name: string; area: string
  startTime: string; pigeons: PigeonEntry[]; totalHours: string
}

type Tab = 'entries' | 'participants'

export default function TournamentManagePage() {
  const router = useRouter()
  const params = useParams()
  const clubId = params.clubId as string
  const tournamentId = params.tournamentId as string

  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [allClubParticipants, setAllClubParticipants] = useState<Participant[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [savingParticipants, setSavingParticipants] = useState(false)
  const [savedParticipants, setSavedParticipants] = useState(false)
  const [editingTournament, setEditingTournament] = useState(false)
  const [editTName, setEditTName] = useState('')
  const [editTNameUrdu, setEditTNameUrdu] = useState('')
  const [editTArea, setEditTArea] = useState('')
  const [editTAreaUrdu, setEditTAreaUrdu] = useState('')
  const [savingTournament, setSavingTournament] = useState(false)
  const [savedTournament, setSavedTournament] = useState(false)

  const [tab, setTab] = useState<Tab>('entries')
  const [selectedDay, setSelectedDay] = useState<number | null>(null)
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingEntries, setLoadingEntries] = useState(false)

  // Tournament participants = filtered by selectedIds (or all if none selected)
  const tournamentParticipants = selectedIds.size > 0
    ? allClubParticipants.filter(p => selectedIds.has(p.id))
    : allClubParticipants

  useEffect(() => {
    let unsubscribeAuth: () => void = () => {}
    let unsubscribeParticipants: (() => void) | null = null
    let active = true
    let initialParticipantIds: string[] | undefined

    auth.authStateReady().then(() => {
      if (!active) return
      unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
        if (!active) return
        if (!user) { router.push('/admin/login'); return }

        const adminDoc = await getDoc(doc(db, 'admins', user.uid))
        if (!active) return
        if (!adminDoc.exists()) { router.push('/admin/login'); return }

        const tDoc = await getDoc(doc(db, 'clubs', clubId, 'tournaments', tournamentId))
        if (!active) return
        if (!tDoc.exists()) { router.push(`/admin/clubs/${clubId}`); return }
        const tData = { id: tDoc.id, ...tDoc.data() } as Tournament
        setTournament(tData)
        initialParticipantIds = tData.participantIds

        if (tData.participantIds?.length) {
          setSelectedIds(new Set(tData.participantIds))
        }

        const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Karachi' })
        const todayDay = tData.raceDays?.find(rd => rd.date === today && !rd.isGap)
        const nonGapDays = tData.raceDays?.filter(rd => !rd.isGap) ?? []
        const defaultDay = todayDay?.dayNumber ?? nonGapDays[0]?.dayNumber ?? null
        setSelectedDay(defaultDay)

        unsubscribeParticipants?.()
        unsubscribeParticipants = onSnapshot(collection(db, 'clubs', clubId, 'participants'), snap => {
          if (!active) return
          const pList = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Participant[]
          setAllClubParticipants(pList)
          if (!initialParticipantIds?.length) {
            setSelectedIds(new Set(pList.map(p => p.id)))
          }
          setLoading(false)
        })
      })
    })

    return () => { active = false; unsubscribeAuth(); unsubscribeParticipants?.() }
  }, [clubId, tournamentId, router])

  // Load entries for selected day
  useEffect(() => {
    if (!selectedDay || !tournament || tournamentParticipants.length === 0) return
    let active = true
    setLoadingEntries(true)

    const load = async () => {
      const rows: Entry[] = await Promise.all(
        tournamentParticipants.map(async (p) => {
          const entryRef = doc(db, 'clubs', clubId, 'tournaments', tournamentId, 'entries', `${p.id}_day${selectedDay}`)
          const snap = await getDoc(entryRef)
          if (snap.exists()) {
            const d = snap.data()
            return { participantId: p.id, name: p.name, area: p.area, startTime: d.startTime, pigeons: d.pigeons, totalHours: d.totalHours }
          }
          return {
            participantId: p.id, name: p.name, area: p.area,
            startTime: tournament.defaultStartTime,
            pigeons: Array.from({ length: tournament.pigeonCount }, () => ({ landingTime: '', hoursFlown: '' })),
            totalHours: '',
          }
        })
      )
      if (!active) return
      setEntries(rows)
      setLoadingEntries(false)
    }

    load()
    return () => { active = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDay, tournament, clubId, tournamentId, selectedIds])

  const toggleParticipant = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
    setSavedParticipants(false)
  }

  const saveTournamentInfo = async () => {
    if (!tournament || (!editTName.trim() && !editTNameUrdu.trim())) return
    setSavingTournament(true)
    const updates: Record<string, string> = { name: editTName.trim() }
    if (editTNameUrdu.trim()) updates.nameUrdu = editTNameUrdu.trim()
    if (editTArea.trim()) updates.area = editTArea.trim()
    if (editTAreaUrdu.trim()) updates.areaUrdu = editTAreaUrdu.trim()
    await updateDoc(doc(db, 'clubs', clubId, 'tournaments', tournamentId), updates)
    setTournament(prev => prev ? { ...prev, ...updates } : prev)
    setSavingTournament(false); setSavedTournament(true); setEditingTournament(false)
    setTimeout(() => setSavedTournament(false), 3000)
  }

  const saveParticipants = async () => {
    if (!tournament) return
    setSavingParticipants(true)
    await updateDoc(doc(db, 'clubs', clubId, 'tournaments', tournamentId), {
      participantIds: Array.from(selectedIds),
    })
    setTournament(prev => prev ? { ...prev, participantIds: Array.from(selectedIds) } : prev)
    setSavingParticipants(false)
    setSavedParticipants(true)
  }

  const statusBadge = (status: string) => {
    if (status === 'active') return 'bg-green-700 text-green-200'
    if (status === 'completed') return 'bg-blue-900 text-blue-200'
    return 'bg-gray-700 text-gray-300'
  }

  const hasEntries = entries.some(e => e.pigeons.some(pg => pg.landingTime))

  if (loading) return (
    <main className="min-h-screen bg-dark flex items-center justify-center">
      <p className="text-green-400">Loading...</p>
    </main>
  )

  return (
    <main className="min-h-screen bg-dark">
      <header className="bg-primary border-b border-secondary px-6 py-4">
        <div className="flex items-center justify-between mb-1">
          <div>
            <h1 className="text-xl font-bold text-secondary">🏆 {tournament?.name}</h1>
            {tournament?.nameUrdu && <p className="text-green-300 text-sm font-urdu" dir="rtl">{tournament.nameUrdu}</p>}
            {tournament?.area && <p className="text-green-400 text-xs">{tournament.area}{tournament.areaUrdu ? ` · ${tournament.areaUrdu}` : ''}</p>}
            {savedTournament && <p className="text-green-400 text-xs mt-0.5">✅ Saved!</p>}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setEditTName(tournament?.name || ''); setEditTNameUrdu(tournament?.nameUrdu || ''); setEditTArea(tournament?.area || ''); setEditTAreaUrdu(tournament?.areaUrdu || ''); setEditingTournament(v => !v) }}
              className="text-xs text-green-400 border border-green-700 px-3 py-1.5 rounded hover:bg-green-800 transition"
            >
              {editingTournament ? 'Cancel' : 'Edit'}
            </button>
            <Link href={`/admin/clubs/${clubId}`} className="text-xs text-green-400 hover:text-secondary transition">
              ← Back to Club
            </Link>
          </div>
        </div>
        {editingTournament && (
          <div className="mt-3 pt-3 border-t border-green-800 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-green-400 text-xs mb-1 block">Tournament Name (English)</label>
              <input value={editTName} onChange={e => setEditTName(e.target.value)} placeholder="Tournament name"
                className="w-full bg-dark border border-green-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-secondary" />
            </div>
            <div>
              <label className="text-green-400 text-xs mb-1 block">نام (اردو)</label>
              <input value={editTNameUrdu} onChange={e => setEditTNameUrdu(e.target.value)} dir="rtl" placeholder="ٹورنامنٹ کا نام"
                className="w-full bg-dark border border-green-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-secondary font-urdu" />
            </div>
            <div>
              <label className="text-green-400 text-xs mb-1 block">Race Area / Location (English, optional)</label>
              <input value={editTArea} onChange={e => setEditTArea(e.target.value)} placeholder="e.g. Lahore Race Track"
                className="w-full bg-dark border border-green-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-secondary" />
            </div>
            <div>
              <label className="text-green-400 text-xs mb-1 block">علاقہ (اردو، اختیاری)</label>
              <input value={editTAreaUrdu} onChange={e => setEditTAreaUrdu(e.target.value)} dir="rtl" placeholder="مثلاً لاہور ریس ٹریک"
                className="w-full bg-dark border border-green-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-secondary font-urdu" />
            </div>
            <div className="sm:col-span-2">
              <button onClick={saveTournamentInfo} disabled={savingTournament || (!editTName.trim() && !editTNameUrdu.trim())}
                className="bg-secondary hover:bg-accent text-dark font-bold px-6 py-2 rounded-lg text-sm transition disabled:opacity-50 flex items-center gap-2">
                {savingTournament && <span className="inline-block w-3 h-3 border-2 border-dark border-t-transparent rounded-full animate-spin" />}
                {savingTournament ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        )}
      </header>

      <div className="px-6 py-8 max-w-6xl mx-auto">

        {/* Tournament Info */}
        <div className="bg-surface border border-green-800 rounded-xl p-5 mb-6 grid grid-cols-2 sm:grid-cols-5 gap-4">
          <div>
            <p className="text-green-400 text-xs mb-1">Status</p>
            <span className={`text-xs px-2 py-1 rounded-full font-semibold ${statusBadge(tournament?.status ?? '')}`}>
              {tournament?.status?.toUpperCase()}
            </span>
          </div>
          <div>
            <p className="text-green-400 text-xs mb-1">Race Days</p>
            <p className="text-white font-bold">{tournament?.raceDays?.filter(rd => !rd.isGap).length ?? tournament?.totalDays}</p>
          </div>
          <div>
            <p className="text-green-400 text-xs mb-1">Pigeons / Participant</p>
            <p className="text-white font-bold">{tournament?.pigeonCount}</p>
          </div>
          <div>
            <p className="text-green-400 text-xs mb-1">Default Start</p>
            <p className="text-white font-bold">{tournament?.defaultStartTime}</p>
          </div>
          <div>
            <p className="text-green-400 text-xs mb-1">Participants</p>
            <p className="text-white font-bold">{selectedIds.size} / {allClubParticipants.length}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setTab('entries')}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition ${tab === 'entries' ? 'bg-secondary text-dark' : 'bg-surface border border-green-700 text-green-300 hover:border-secondary'}`}
          >
            📋 Entries
          </button>
          <button
            onClick={() => setTab('participants')}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition ${tab === 'participants' ? 'bg-secondary text-dark' : 'bg-surface border border-green-700 text-green-300 hover:border-secondary'}`}
          >
            👥 Participants ({selectedIds.size})
          </button>
        </div>

        {/* Participants Tab */}
        {tab === 'participants' && (
          <div className="bg-surface border border-green-800 rounded-xl p-6">
            <p className="text-green-400 text-sm mb-4">
              Select which club members participate in this tournament. Only selected participants will appear on the club&apos;s entry form.
            </p>

            {allClubParticipants.length === 0 ? (
              <p className="text-green-600 text-sm">No participants in this club yet.</p>
            ) : (
              <>
                <div className="flex gap-3 mb-4">
                  <button
                    onClick={() => { setSelectedIds(new Set(allClubParticipants.map(p => p.id))); setSavedParticipants(false) }}
                    className="text-xs text-green-400 hover:text-secondary transition"
                  >
                    Select All
                  </button>
                  <span className="text-green-800">·</span>
                  <button
                    onClick={() => { setSelectedIds(new Set()); setSavedParticipants(false) }}
                    className="text-xs text-green-400 hover:text-secondary transition"
                  >
                    Deselect All
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
                  {allClubParticipants.map(p => (
                    <label
                      key={p.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition ${selectedIds.has(p.id) ? 'border-secondary bg-primary' : 'border-green-800 hover:border-green-600'}`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.has(p.id)}
                        onChange={() => toggleParticipant(p.id)}
                        className="accent-yellow-400 w-4 h-4"
                      />
                      <div>
                        <p className="text-white text-sm font-semibold">{p.name}</p>
                        {p.nameUrdu && <p className="text-green-300 text-xs font-urdu" dir="rtl">{p.nameUrdu}</p>}
                        <p className="text-green-400 text-xs">{p.area}{p.areaUrdu ? ` · ${p.areaUrdu}` : ''}</p>
                      </div>
                    </label>
                  ))}
                </div>

                <div className="flex items-center gap-4">
                  <button
                    onClick={saveParticipants}
                    disabled={savingParticipants}
                    className="bg-secondary hover:bg-accent text-dark font-bold px-6 py-2 rounded-lg text-sm transition disabled:opacity-50 flex items-center gap-2"
                  >
                    {savingParticipants && <span className="inline-block w-3 h-3 border-2 border-dark border-t-transparent rounded-full animate-spin" />}
                    {savingParticipants ? 'Saving...' : 'Save Participants'}
                  </button>
                  {savedParticipants && <p className="text-green-400 text-sm">✅ Saved!</p>}
                </div>
              </>
            )}
          </div>
        )}

        {/* Entries Tab */}
        {tab === 'entries' && (
          <>
            <div className="flex items-center gap-4 mb-6">
              <label className="text-green-400 text-sm font-semibold whitespace-nowrap">Race Day:</label>
              <select
                value={selectedDay ?? ''}
                onChange={e => setSelectedDay(Number(e.target.value))}
                className="bg-primary border border-green-700 text-white rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-secondary"
              >
                {tournament?.raceDays?.filter(rd => !rd.isGap).map(rd => (
                  <option key={rd.dayNumber} value={rd.dayNumber}>
                    Day {tournament.raceDays.filter(r => !r.isGap && r.dayNumber <= rd.dayNumber).length} — {rd.date}
                  </option>
                ))}
              </select>
            </div>

            {loadingEntries ? (
              <p className="text-green-400 text-sm">Loading entries...</p>
            ) : !hasEntries ? (
              <div className="bg-surface border border-green-800 rounded-xl p-10 text-center">
                <p className="text-3xl mb-3">📋</p>
                <p className="text-white font-bold">No entries for Day {tournament?.raceDays?.filter(r => !r.isGap && r.dayNumber <= (selectedDay ?? 0)).length}</p>
                <p className="text-green-400 text-sm mt-1">The club hasn&apos;t submitted data for this race day yet.</p>
              </div>
            ) : (
              <div className="bg-surface border border-green-800 rounded-xl overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-primary border-b border-green-800">
                      <th className="text-left text-green-400 px-3 py-3 font-semibold whitespace-nowrap">#</th>
                      <th className="text-left text-green-400 px-3 py-3 font-semibold whitespace-nowrap">Participant</th>
                      <th className="text-left text-green-400 px-3 py-3 font-semibold whitespace-nowrap">Area</th>
                      <th className="text-left text-green-400 px-3 py-3 font-semibold whitespace-nowrap">Start</th>
                      {Array.from({ length: tournament?.pigeonCount ?? 0 }, (_, i) => (
                        <th key={i} className="text-left text-green-400 px-3 py-3 font-semibold whitespace-nowrap">
                          🐦 {i + 1}
                        </th>
                      ))}
                      <th className="text-left text-secondary px-3 py-3 font-semibold whitespace-nowrap">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry, i) => {
                      const hasData = entry.pigeons.some(pg => pg.landingTime)
                      if (!hasData) return null
                      return (
                        <tr key={entry.participantId} className="border-b border-green-900 hover:bg-primary transition">
                          <td className="px-3 py-3 text-green-400">{i + 1}</td>
                          <td className="px-3 py-3 text-white font-semibold whitespace-nowrap">{entry.name}</td>
                          <td className="px-3 py-3 text-green-300 whitespace-nowrap">{entry.area}</td>
                          <td className="px-3 py-3 text-green-300 font-mono whitespace-nowrap">{entry.startTime}</td>
                          {entry.pigeons.map((pg, pi) => (
                            <td key={pi} className="px-3 py-3 whitespace-nowrap">
                              {pg.landingTime ? (
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-white font-mono text-xs">{pg.landingTime}</span>
                                  <span className="text-secondary font-mono text-xs">{formatTimeDisplay(pg.hoursFlown)}</span>
                                </div>
                              ) : (
                                <span className="text-green-800">—</span>
                              )}
                            </td>
                          ))}
                          <td className="px-3 py-3">
                            <span className={`font-mono font-bold ${entry.totalHours ? 'text-secondary' : 'text-green-700'}`}>
                              {entry.totalHours ? formatTimeDisplay(entry.totalHours) : '—'}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  )
}
