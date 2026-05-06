'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { collection, query, where, getDocs, doc, setDoc, getDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { calculateHoursFlown, calculateGrandTotal, formatTimeDisplay } from '@/lib/timeUtils'
import Link from 'next/link'

interface Club { id: string; name: string; slug: string; city: string }
interface Tournament { id: string; name: string; status: string; totalDays: number; defaultStartTime: string; pigeonCount: number; raceDays: { dayNumber: number; date: string }[]; participantIds?: string[] }
interface Participant { id: string; name: string; area: string }

interface PigeonEntry {
  landingTime: string
  hoursFlown: string
}

interface EntryRow {
  participantId: string
  name: string
  area: string
  startTime: string
  pigeons: PigeonEntry[]
  totalHours: string
}

export default function ClubDashboard() {
  const router = useRouter()
  const [club, setClub] = useState<Club | null>(null)
  const [activeTournaments, setActiveTournaments] = useState<Tournament[]>([])
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [allClubParticipants, setAllClubParticipants] = useState<Participant[]>([])
  const [participants, setParticipants] = useState<Participant[]>([])
  const [todayDay, setTodayDay] = useState<number | null>(null)
  const [todayDate, setTodayDate] = useState('')
  const [entries, setEntries] = useState<EntryRow[]>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

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

        const tq = query(collection(db, 'clubs', clubData.id, 'tournaments'), where('status', '==', 'active'))
        const tSnap = await getDocs(tq)
        if (!active) return
        const allActive = tSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Tournament[]
        setActiveTournaments(allActive)
        if (allActive.length === 0) { setLoading(false); return }

        const tData = allActive[0]
        setTournament(tData)

        const today = new Date().toISOString().split('T')[0]
        setTodayDate(today)
        const todayRaceDay = tData.raceDays?.find(rd => rd.date === today)
        if (todayRaceDay) setTodayDay(todayRaceDay.dayNumber)

        const pSnap = await getDocs(collection(db, 'clubs', clubData.id, 'participants'))
        const allParticipants = pSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Participant[]
        setAllClubParticipants(allParticipants)
        const participantList = tData.participantIds?.length
          ? allParticipants.filter(p => tData.participantIds!.includes(p.id))
          : allParticipants
        setParticipants(participantList)

        const dayNum = todayRaceDay?.dayNumber
        const entryRows: EntryRow[] = await Promise.all(
          participantList.map(async (p) => {
            let startTime = tData.defaultStartTime
            let pigeons: PigeonEntry[] = Array.from({ length: tData.pigeonCount }, () => ({
              landingTime: '',
              hoursFlown: '',
            }))

            if (dayNum) {
              const entryRef = doc(db, 'clubs', clubData.id, 'tournaments', tData.id, 'entries', `${p.id}_day${dayNum}`)
              const entrySnap = await getDoc(entryRef)
              if (entrySnap.exists()) {
                const d = entrySnap.data()
                startTime = d.startTime
                pigeons = d.pigeons || pigeons
              }
            }

            const filledPigeons = pigeons.filter(pg => pg.hoursFlown)
            const totalHours = filledPigeons.length > 0
              ? calculateGrandTotal(filledPigeons.map(pg => pg.hoursFlown))
              : ''

            return { participantId: p.id, name: p.name, area: p.area, startTime, pigeons, totalHours }
          })
        )

        if (!active) return
        setEntries(entryRows)
        setLoading(false)
      })
    })

    return () => {
      active = false
      unsubscribe()
    }
  }, [router])

  const updateStartTime = (participantIndex: number, value: string) => {
    setEntries(prev => {
      const updated = [...prev]
      updated[participantIndex] = { ...updated[participantIndex], startTime: value }
      // Recalculate all pigeons hours with new start time
      updated[participantIndex].pigeons = updated[participantIndex].pigeons.map(pg => {
        if (pg.landingTime) {
          return { ...pg, hoursFlown: calculateHoursFlown(value, pg.landingTime) }
        }
        return pg
      })
      const filled = updated[participantIndex].pigeons.filter(pg => pg.hoursFlown)
      updated[participantIndex].totalHours = filled.length > 0
        ? calculateGrandTotal(filled.map(pg => pg.hoursFlown))
        : ''
      return updated
    })
    setSaved(false)
  }

  const updateLanding = (participantIndex: number, pigeonIndex: number, value: string) => {
    setEntries(prev => {
      const updated = [...prev]
      const row = { ...updated[participantIndex] }
      const pigeons = [...row.pigeons]
      pigeons[pigeonIndex] = {
        landingTime: value,
        hoursFlown: value ? calculateHoursFlown(row.startTime, value) : '',
      }
      row.pigeons = pigeons
      const filled = pigeons.filter(pg => pg.hoursFlown)
      row.totalHours = filled.length > 0
        ? calculateGrandTotal(filled.map(pg => pg.hoursFlown))
        : ''
      updated[participantIndex] = row
      return updated
    })
    setSaved(false)
  }

  const saveEntries = async () => {
    if (!club || !tournament || !todayDay) return
    setSaving(true)
    try {
      // Other active tournaments that also have today as a race day
      const otherTournaments = activeTournaments.filter(t =>
        t.id !== tournament.id && t.raceDays?.some(rd => rd.date === todayDate)
      )

      for (const entry of entries) {
        const hasAnyLanding = entry.pigeons.some(pg => pg.landingTime)
        if (!hasAnyLanding) continue

        // Save to current tournament
        const entryRef = doc(db, 'clubs', club.id, 'tournaments', tournament.id, 'entries', `${entry.participantId}_day${todayDay}`)
        await setDoc(entryRef, {
          participantId: entry.participantId,
          dayNumber: todayDay,
          startTime: entry.startTime,
          pigeons: entry.pigeons,
          totalHours: entry.totalHours,
          pigeonCount: tournament.pigeonCount,
          savedAt: new Date().toISOString(),
        })

        // Sync to other tournaments that share today as a race day
        for (const otherT of otherTournaments) {
          // Skip if participant is not enrolled in the other tournament
          const isEnrolled = !otherT.participantIds?.length || otherT.participantIds.includes(entry.participantId)
          if (!isEnrolled) continue

          const otherRaceDay = otherT.raceDays.find(rd => rd.date === todayDate)
          if (!otherRaceDay) continue

          // Read existing entry in the other tournament to preserve any extra pigeons
          const otherRef = doc(db, 'clubs', club.id, 'tournaments', otherT.id, 'entries', `${entry.participantId}_day${otherRaceDay.dayNumber}`)
          const otherSnap = await getDoc(otherRef)
          const existingPigeons: { landingTime: string; hoursFlown: string }[] =
            otherSnap.exists() ? (otherSnap.data().pigeons || []) : []

          // Build synced pigeons array sized to the other tournament's pigeon count
          const syncedPigeons = Array.from({ length: otherT.pigeonCount }, (_, i) => {
            if (i < entry.pigeons.length) {
              // Slot exists in source tournament — copy landing time, recalculate hours
              const src = entry.pigeons[i]
              if (src.landingTime) {
                return {
                  landingTime: src.landingTime,
                  hoursFlown: calculateHoursFlown(entry.startTime, src.landingTime),
                }
              }
              return { landingTime: '', hoursFlown: '' }
            }
            // Extra slot only in the other tournament — keep whatever was saved there
            return existingPigeons[i] || { landingTime: '', hoursFlown: '' }
          })

          const filledSynced = syncedPigeons.filter(pg => pg.hoursFlown)
          const syncedTotal = filledSynced.length > 0
            ? calculateGrandTotal(filledSynced.map(pg => pg.hoursFlown))
            : ''

          await setDoc(otherRef, {
            participantId: entry.participantId,
            dayNumber: otherRaceDay.dayNumber,
            startTime: entry.startTime,
            pigeons: syncedPigeons,
            totalHours: syncedTotal,
            pigeonCount: otherT.pigeonCount,
            savedAt: new Date().toISOString(),
          })
        }
      }
      setSaved(true)
    } finally {
      setSaving(false)
    }
  }

  const handleTournamentChange = async (tournamentId: string) => {
    const selected = activeTournaments.find(t => t.id === tournamentId)
    if (!selected || !club) return
    setTournament(selected)
    setSaved(false)
    setLoading(true)

    // Re-filter participants for the newly selected tournament from the full club list
    const filtered = selected.participantIds?.length
      ? allClubParticipants.filter(p => selected.participantIds!.includes(p.id))
      : allClubParticipants
    setParticipants(filtered)

    const today = new Date().toISOString().split('T')[0]
    setTodayDate(today)
    const todayRaceDay = selected.raceDays?.find(rd => rd.date === today)
    setTodayDay(todayRaceDay?.dayNumber ?? null)

    const dayNum = todayRaceDay?.dayNumber
    const entryRows: EntryRow[] = await Promise.all(
      participants.map(async (p) => {
        let startTime = selected.defaultStartTime
        let pigeons: PigeonEntry[] = Array.from({ length: selected.pigeonCount }, () => ({
          landingTime: '',
          hoursFlown: '',
        }))

        if (dayNum) {
          const entryRef = doc(db, 'clubs', club.id, 'tournaments', selected.id, 'entries', `${p.id}_day${dayNum}`)
          const entrySnap = await getDoc(entryRef)
          if (entrySnap.exists()) {
            const d = entrySnap.data()
            startTime = d.startTime
            pigeons = d.pigeons || pigeons
          }
        }

        const filledPigeons = pigeons.filter(pg => pg.hoursFlown)
        const totalHours = filledPigeons.length > 0
          ? calculateGrandTotal(filledPigeons.map(pg => pg.hoursFlown))
          : ''

        return { participantId: p.id, name: p.name, area: p.area, startTime, pigeons, totalHours }
      })
    )

    setEntries(entryRows)
    setLoading(false)
  }

  if (loading) return (
    <main className="min-h-screen bg-dark flex items-center justify-center">
      <p className="text-green-400">Loading dashboard...</p>
    </main>
  )

  return (
    <main className="min-h-screen bg-dark">
      <header className="bg-primary border-b border-secondary px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-secondary">🐦 {club?.name}</h1>
          <p className="text-green-400 text-xs">{club?.city} · Club Dashboard</p>
        </div>
        <div className="flex gap-3 items-center">
          <Link href="/" target="_blank" className="text-xs text-green-400 hover:text-secondary transition">View Site</Link>
          <Link href="/club/participants" className="text-xs text-green-400 hover:text-secondary transition">Participants</Link>
          <button
            onClick={async () => { await signOut(auth); router.push('/club/login') }}
            className="text-xs bg-red-900 hover:bg-red-700 text-white px-3 py-1 rounded transition"
          >Logout</button>
        </div>
      </header>

      <div className="px-4 py-6 max-w-full mx-auto">
        {!tournament ? (
          <div className="bg-surface border border-green-800 rounded-xl p-10 text-center">
            <p className="text-4xl mb-3">⏳</p>
            <p className="text-white font-bold text-lg">No Active Tournament</p>
            <p className="text-green-400 text-sm mt-2">Ask your admin to activate a tournament.</p>
          </div>
        ) : (
          <>
            {/* Tournament Info */}
            <div className="bg-surface border border-secondary rounded-xl p-4 mb-5">
              <div className="flex items-center justify-between mb-1">
                {activeTournaments.length > 1 ? (
                  <select
                    value={tournament.id}
                    onChange={e => handleTournamentChange(e.target.value)}
                    className="bg-primary border border-secondary text-secondary font-bold text-base rounded-lg px-3 py-1 focus:outline-none focus:border-accent"
                  >
                    {activeTournaments.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                ) : (
                  <h2 className="text-secondary font-bold text-lg">{tournament.name}</h2>
                )}
                <div className="text-right">
                  <p className="text-green-400 text-xs">Pigeons / Participant</p>
                  <p className="text-white font-bold text-xl">{tournament.pigeonCount}</p>
                </div>
              </div>
              <p className="text-green-400 text-sm">
                {todayDay ? `Day ${todayDay} · ${todayDate}` : `Today (${todayDate}) is not a race day`}
              </p>
            </div>

            {!todayDay ? (
              <div className="bg-surface border border-green-800 rounded-xl p-8 text-center">
                <p className="text-3xl mb-3">📅</p>
                <p className="text-white font-bold">No Race Today</p>
              </div>
            ) : entries.length === 0 ? (
              <div className="bg-surface border border-green-800 rounded-xl p-8 text-center">
                <p className="text-3xl mb-3">👥</p>
                <p className="text-white font-bold">No Participants Yet</p>
                <Link href="/club/participants" className="bg-secondary hover:bg-accent text-dark font-bold px-6 py-2 rounded-lg text-sm transition inline-block mt-3">
                  + Add Participants
                </Link>
              </div>
            ) : (
              <>
                <div className="bg-surface border border-green-800 rounded-xl overflow-x-auto mb-4">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-primary border-b border-green-800">
                        <th className="text-left text-green-400 px-3 py-3 font-semibold whitespace-nowrap">#</th>
                        <th className="text-left text-green-400 px-3 py-3 font-semibold whitespace-nowrap">Participant</th>
                        <th className="text-left text-green-400 px-3 py-3 font-semibold whitespace-nowrap">Area</th>
                        <th className="text-left text-green-400 px-3 py-3 font-semibold whitespace-nowrap">Start Time</th>
                        {Array.from({ length: tournament.pigeonCount }, (_, i) => (
                          <th key={i} className="text-left text-green-400 px-3 py-3 font-semibold whitespace-nowrap">
                            🐦 {i + 1}
                          </th>
                        ))}
                        <th className="text-left text-secondary px-3 py-3 font-semibold whitespace-nowrap">Total Hours</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map((entry, i) => (
                        <tr key={entry.participantId} className="border-b border-green-900 hover:bg-primary transition">
                          <td className="px-3 py-3 text-green-400">{i + 1}</td>
                          <td className="px-3 py-3 text-white font-semibold whitespace-nowrap">{entry.name}</td>
                          <td className="px-3 py-3 text-green-300 whitespace-nowrap">{entry.area}</td>
                          <td className="px-3 py-3">
                            <input
                              type="time"
                              value={entry.startTime}
                              onChange={e => updateStartTime(i, e.target.value)}
                              className="bg-primary border border-green-700 text-white rounded px-2 py-1 text-xs focus:outline-none focus:border-secondary"
                            />
                          </td>
                          {entry.pigeons.map((pg, pi) => (
                            <td key={pi} className="px-3 py-3">
                              <div className="flex flex-col gap-1">
                                <input
                                  type="time"
                                  value={pg.landingTime}
                                  onChange={e => updateLanding(i, pi, e.target.value)}
                                  className="bg-primary border border-green-700 text-white rounded px-2 py-1 text-xs focus:outline-none focus:border-secondary"
                                />
                                {pg.hoursFlown && (
                                  <span className="text-secondary font-mono text-xs text-center">
                                    {formatTimeDisplay(pg.hoursFlown)}
                                  </span>
                                )}
                              </div>
                            </td>
                          ))}
                          <td className="px-3 py-3">
                            <span className={`font-mono font-bold text-base ${entry.totalHours ? 'text-secondary' : 'text-green-700'}`}>
                              {entry.totalHours ? formatTimeDisplay(entry.totalHours) : '--:--'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between">
                  {saved && <p className="text-green-400 text-sm">✅ Entries saved!</p>}
                  <div className="ml-auto">
                    <button
                      onClick={saveEntries}
                      disabled={saving}
                      className="bg-secondary hover:bg-accent text-dark font-bold px-8 py-3 rounded-lg transition disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : 'Save Entries'}
                    </button>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </main>
  )
}