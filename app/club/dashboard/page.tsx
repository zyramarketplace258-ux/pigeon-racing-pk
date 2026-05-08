'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import {
  collection, query, where, getDocs, doc, setDoc, getDoc,
  addDoc, deleteDoc, updateDoc, serverTimestamp, onSnapshot
} from 'firebase/firestore'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { auth, db, storage } from '@/lib/firebase'
import { calculateHoursFlown, calculateGrandTotal, formatTimeDisplay } from '@/lib/timeUtils'
import ProfileCropModal from '@/components/ProfileCropModal'

interface Club { id: string; name: string; slug: string; city: string; logoUrl?: string }
interface RaceDay { dayNumber: number; date: string; isGap?: boolean }
interface Tournament {
  id: string; name: string; status: string; totalDays: number
  defaultStartTime: string; defaultEndTime?: string; pigeonCount: number
  raceDays: RaceDay[]; participantIds?: string[]
}
interface Participant { id: string; name: string; area: string; photoUrl?: string; disabled?: boolean }
interface PigeonEntry { landingTime: string; hoursFlown: string }
interface EntryRow {
  participantId: string; name: string; area: string
  startTime: string; pigeons: PigeonEntry[]; totalHours: string
  hadData: boolean
}

async function fetchEntries(
  clubId: string, tData: Tournament, allParticipants: Participant[], today: string
): Promise<{ entryRows: EntryRow[]; dayNum: number | null }> {
  const todayRaceDay = tData.raceDays?.find(rd => rd.date === today && !rd.isGap)
  const dayNum = todayRaceDay?.dayNumber ?? null
  const pList = (tData.participantIds != null
    ? allParticipants.filter(p => tData.participantIds!.includes(p.id))
    : allParticipants).filter(p => !p.disabled)
  const entryRows = await Promise.all(pList.map(async (p) => {
    let startTime = tData.defaultStartTime
    let pigeons: PigeonEntry[] = Array.from({ length: tData.pigeonCount }, () => ({ landingTime: '', hoursFlown: '' }))
    let hadData = false
    if (dayNum) {
      const snap = await getDoc(doc(db, 'clubs', clubId, 'tournaments', tData.id, 'entries', `${p.id}_day${dayNum}`))
      if (snap.exists()) { startTime = snap.data().startTime; pigeons = snap.data().pigeons || pigeons; hadData = true }
    }
    const filled = pigeons.filter(pg => pg.hoursFlown)
    return {
      participantId: p.id, name: p.name, area: p.area, startTime, pigeons,
      totalHours: filled.length > 0 ? calculateGrandTotal(filled.map(pg => pg.hoursFlown)) : '',
      hadData
    }
  }))
  return { entryRows, dayNum }
}

export default function ClubDashboard() {
  const router = useRouter()
  const [tab, setTab] = useState<'add-time' | 'members' | 'tournaments' | 'history'>(() => {
    if (typeof window !== 'undefined') {
      const s = sessionStorage.getItem('club-tab')
      if (s === 'add-time' || s === 'members' || s === 'tournaments' || s === 'history') return s
    }
    return 'add-time'
  })
  const [club, setClub] = useState<Club | null>(null)
  const [loading, setLoading] = useState(true)
  const [entriesLoading, setEntriesLoading] = useState(false)
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [activeTournaments, setActiveTournaments] = useState<Tournament[]>([])
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [todayDay, setTodayDay] = useState<number | null>(null)
  const [todayDate, setTodayDate] = useState('')
  const [entries, setEntries] = useState<EntryRow[]>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [timeError, setTimeError] = useState('')
  const [memberName, setMemberName] = useState('')
  const [memberArea, setMemberArea] = useState('')
  const [nameError, setNameError] = useState('')
  const [areaError, setAreaError] = useState('')
  const [addingMember, setAddingMember] = useState(false)
  const [assignTournamentId, setAssignTournamentId] = useState('')
  const [assignedIds, setAssignedIds] = useState<Set<string>>(new Set())
  const [savingAssignment, setSavingAssignment] = useState(false)
  const [savedAssignment, setSavedAssignment] = useState(false)

  // Photo upload / crop
  const [cropFile, setCropFile] = useState<File | null>(null)
  const [cropTarget, setCropTarget] = useState<'logo' | string | null>(null)
  const [photoUploading, setPhotoUploading] = useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const memberInputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const participantsRef = useRef<Participant[]>([])

  useEffect(() => {
    let unsubscribe: () => void = () => {}
    let tUnsub: (() => void) | null = null
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
        const today = new Date().toISOString().split('T')[0]
        setTodayDate(today)
        const pSnap = await getDocs(collection(db, 'clubs', clubData.id, 'participants'))
        if (!active) return
        const allParticipants = pSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Participant[]
        participantsRef.current = allParticipants
        setParticipants(allParticipants)

        let firstFire = true
        tUnsub?.()
        tUnsub = onSnapshot(collection(db, 'clubs', clubData.id, 'tournaments'), async (tSnap) => {
          if (!active) return
          const allTournaments = tSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Tournament[]
          setTournaments(allTournaments)
          const activeList = allTournaments.filter(t => t.status === 'active')
          setActiveTournaments(activeList)

          if (firstFire) {
            const assignable = allTournaments.filter(t => t.status !== 'completed')
            if (assignable.length > 0) {
              const firstT = assignable[0]
              setAssignTournamentId(firstT.id)
              setAssignedIds(new Set(firstT.participantIds != null ? firstT.participantIds : participantsRef.current.map(p => p.id)))
            }
            firstFire = false
          }

          if (activeList.length > 0) {
            const tData = activeList[0]
            setTournament(tData)
            setEntriesLoading(true)
            const { entryRows, dayNum } = await fetchEntries(clubData.id, tData, participantsRef.current, today)
            if (!active) return
            setTodayDay(dayNum)
            setEntries(entryRows)
            setEntriesLoading(false)
          } else {
            setTournament(null)
            setTodayDay(null)
            setEntries([])
          }

          setLoading(false)
        })
      })
    })
    return () => { active = false; unsubscribe(); tUnsub?.() }
  }, [router])

  const handleTabChange = (t: typeof tab) => { setTab(t); sessionStorage.setItem('club-tab', t) }

  const toMins = (t: string) => { const [h, m] = (t || '0:0').split(':').map(Number); return h * 60 + m }

  const updateStartTime = (i: number, value: string) => {
    setEntries(prev => {
      const updated = [...prev]
      const row = { ...updated[i], startTime: value }
      row.pigeons = row.pigeons.map(pg =>
        pg.landingTime ? { ...pg, hoursFlown: calculateHoursFlown(value, pg.landingTime) } : pg
      )
      const filled = row.pigeons.filter(pg => pg.hoursFlown)
      row.totalHours = filled.length > 0 ? calculateGrandTotal(filled.map(pg => pg.hoursFlown)) : ''
      updated[i] = row
      return updated
    })
    setSaved(false)
  }

  const updateLanding = (i: number, pi: number, value: string) => {
    if (value && tournament) {
      const st = entries[i]?.startTime, et = tournament.defaultEndTime
      const mins = toMins(value)
      if (st && mins < toMins(st)) { setTimeError(`Before start (${st})`); setTimeout(() => setTimeError(''), 3000); return }
      if (et && mins > toMins(et)) { setTimeError(`After cutoff (${et})`); setTimeout(() => setTimeError(''), 3000); return }
    }
    setTimeError('')
    setEntries(prev => {
      const updated = [...prev]
      const row = { ...updated[i], pigeons: [...updated[i].pigeons] }
      row.pigeons[pi] = { landingTime: value, hoursFlown: value ? calculateHoursFlown(row.startTime, value) : '' }
      const filled = row.pigeons.filter(pg => pg.hoursFlown)
      row.totalHours = filled.length > 0 ? calculateGrandTotal(filled.map(pg => pg.hoursFlown)) : ''
      updated[i] = row
      return updated
    })
    setSaved(false)
  }

  const handleTournamentChange = async (tournamentId: string) => {
    if (!club) return
    const selected = activeTournaments.find(t => t.id === tournamentId)
    if (!selected) return
    setTournament(selected); setSaved(false); setEntriesLoading(true)
    const today = new Date().toISOString().split('T')[0]
    const { entryRows, dayNum } = await fetchEntries(club.id, selected, participants, today)
    setTodayDay(dayNum); setEntries(entryRows); setEntriesLoading(false)
  }

  const saveEntries = async () => {
    if (!club || !tournament || !todayDay) return
    setSaving(true)
    try {
      const otherActive = activeTournaments.filter(t =>
        t.id !== tournament.id && t.raceDays?.some(rd => rd.date === todayDate)
      )
      for (const entry of entries) {
        if (!entry.pigeons.some(pg => pg.landingTime)) {
          if (entry.hadData) {
            await deleteDoc(doc(db, 'clubs', club.id, 'tournaments', tournament.id, 'entries', `${entry.participantId}_day${todayDay}`))
          }
          continue
        }
        await setDoc(doc(db, 'clubs', club.id, 'tournaments', tournament.id, 'entries', `${entry.participantId}_day${todayDay}`), {
          participantId: entry.participantId, dayNumber: todayDay,
          startTime: entry.startTime, pigeons: entry.pigeons,
          totalHours: entry.totalHours, pigeonCount: tournament.pigeonCount,
          savedAt: new Date().toISOString(),
        })
        for (const otherT of otherActive) {
          if (otherT.participantIds?.length && !otherT.participantIds.includes(entry.participantId)) continue
          const otherRD = otherT.raceDays.find(rd => rd.date === todayDate)
          if (!otherRD) continue
          const otherRef = doc(db, 'clubs', club.id, 'tournaments', otherT.id, 'entries', `${entry.participantId}_day${otherRD.dayNumber}`)
          const otherSnap = await getDoc(otherRef)
          const existingP: PigeonEntry[] = otherSnap.exists() ? (otherSnap.data().pigeons || []) : []
          const syncedP = Array.from({ length: otherT.pigeonCount }, (_, idx) => {
            if (idx < entry.pigeons.length) {
              const src = entry.pigeons[idx]
              return src.landingTime
                ? { landingTime: src.landingTime, hoursFlown: calculateHoursFlown(entry.startTime, src.landingTime) }
                : { landingTime: '', hoursFlown: '' }
            }
            return existingP[idx] || { landingTime: '', hoursFlown: '' }
          })
          const filledP = syncedP.filter(pg => pg.hoursFlown)
          await setDoc(otherRef, {
            participantId: entry.participantId, dayNumber: otherRD.dayNumber,
            startTime: entry.startTime, pigeons: syncedP,
            totalHours: filledP.length > 0 ? calculateGrandTotal(filledP.map(pg => pg.hoursFlown)) : '',
            pigeonCount: otherT.pigeonCount, savedAt: new Date().toISOString(),
          })
        }
      }
      setSaved(true)
    } finally { setSaving(false) }
  }

  const addMember = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!club) return
    const trimName = memberName.trim()
    const trimArea = memberArea.trim()
    let valid = true
    if (trimName.length < 3) { setNameError('Minimum 3 letters required'); valid = false }
    if (trimArea.length < 2) { setAreaError('Minimum 2 characters required'); valid = false }
    if (!valid) return
    const duplicate = participants.find(
      p => p.name.toLowerCase() === trimName.toLowerCase() && p.area.toLowerCase() === trimArea.toLowerCase()
    )
    if (duplicate && !window.confirm(`A member named "${trimName}" from "${trimArea}" already exists. Add again?`)) return
    setAddingMember(true)
    const docRef = await addDoc(collection(db, 'clubs', club.id, 'participants'), {
      name: trimName, area: trimArea, createdAt: serverTimestamp()
    })
    setParticipants(prev => {
      const updated = [...prev, { id: docRef.id, name: trimName, area: trimArea }]
      participantsRef.current = updated
      return updated
    })
    setMemberName(''); setMemberArea(''); setNameError(''); setAreaError(''); setAddingMember(false)
  }

  const removeMember = async (id: string) => {
    if (!club || !confirm('Permanently delete this member?')) return
    await deleteDoc(doc(db, 'clubs', club.id, 'participants', id))
    setParticipants(prev => {
      const updated = prev.filter(p => p.id !== id)
      participantsRef.current = updated
      return updated
    })
    setAssignedIds(prev => { const next = new Set(prev); next.delete(id); return next })
  }

  const toggleDisabled = async (p: Participant) => {
    if (!club) return
    const newVal = !p.disabled
    await updateDoc(doc(db, 'clubs', club.id, 'participants', p.id), { disabled: newVal })
    setParticipants(prev => {
      const updated = prev.map(m => m.id === p.id ? { ...m, disabled: newVal } : m)
      participantsRef.current = updated
      return updated
    })
  }

  const handleAssignTournamentSelect = (tournamentId: string) => {
    const t = tournaments.find(t => t.id === tournamentId)
    if (!t) return
    setAssignTournamentId(tournamentId)
    setAssignedIds(new Set(t.participantIds != null ? t.participantIds : participants.map(p => p.id)))
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
    if (!club || !assignTournamentId) return
    setSavingAssignment(true)
    const ids = Array.from(assignedIds)
    await updateDoc(doc(db, 'clubs', club.id, 'tournaments', assignTournamentId), { participantIds: ids })
    setTournaments(prev => prev.map(t => t.id === assignTournamentId ? { ...t, participantIds: ids } : t))
    setSavingAssignment(false); setSavedAssignment(true)
  }

  const handleCropSave = async (blob: Blob) => {
    if (!club || !cropTarget) return
    setPhotoUploading(true)
    try {
      if (cropTarget === 'logo') {
        const sRef = storageRef(storage, `clubs/${club.id}/logo.jpg`)
        await uploadBytes(sRef, blob)
        const url = await getDownloadURL(sRef)
        await updateDoc(doc(db, 'clubs', club.id), { logoUrl: url })
        setClub(prev => prev ? { ...prev, logoUrl: url } : prev)
      } else {
        const sRef = storageRef(storage, `clubs/${club.id}/participants/${cropTarget}.jpg`)
        await uploadBytes(sRef, blob)
        const url = await getDownloadURL(sRef)
        await updateDoc(doc(db, 'clubs', club.id, 'participants', cropTarget), { photoUrl: url })
        setParticipants(prev => prev.map(p => p.id === cropTarget ? { ...p, photoUrl: url } : p))
      }
    } finally {
      setCropFile(null)
      setCropTarget(null)
      setPhotoUploading(false)
    }
  }

  if (loading) return (
    <main className="min-h-screen bg-dark flex items-center justify-center">
      <p className="text-green-400">Loading...</p>
    </main>
  )

  return (
    <main className="min-h-screen bg-dark">

      {/* Header */}
      <header className="bg-primary border-b border-secondary px-4 py-3 relative">
        <a href="/" className="absolute left-4 top-1/2 -translate-y-1/2 text-green-400 hover:text-secondary text-xs font-medium transition">← Home</a>
        <div className="text-center">
          <div className="relative inline-block cursor-pointer" onClick={() => logoInputRef.current?.click()}>
            <img src={club?.logoUrl || '/pigeon.png'} alt="Logo" className="w-10 h-10 object-cover rounded-full drop-shadow border border-green-700" />
            <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-green-700 rounded-full flex items-center justify-center border-2 border-primary shadow">
              <span className="text-white text-[9px] leading-none">📷</span>
            </div>
          </div>
          <h1 className="text-sm font-bold text-secondary leading-tight mt-0.5">{club?.name}</h1>
        </div>
        <input ref={logoInputRef} type="file" accept="image/*" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) { setCropTarget('logo'); setCropFile(f) }; e.target.value = '' }} />
        <button
          onClick={async () => { await signOut(auth); router.push('/club/login') }}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-xs bg-red-900 hover:bg-red-700 text-white px-3 py-1.5 rounded transition"
        >
          Logout
        </button>
      </header>

      {/* Nav */}
      <nav className="bg-[#292929] px-4 border-b border-green-900">
        <div className="flex items-center h-10">
          {(['tournaments', 'members', 'add-time', 'history'] as const).map(t => (
            <button key={t} onClick={() => handleTabChange(t)}
              className={`px-4 h-full text-sm font-semibold transition border-b-2 ${
                tab === t ? 'text-white border-[#66bb6a]' : 'text-gray-400 border-transparent hover:text-white'
              }`}
            >
              {t === 'tournaments' ? 'Tournaments' : t === 'members' ? 'Members' : t === 'add-time' ? 'Add Time' : 'History'}
            </button>
          ))}
        </div>
      </nav>

      <div className="px-4 py-6">

        {/* ── TOURNAMENTS TAB — participant assignment ── */}
        {tab === 'tournaments' && (() => {
          const assignableTournaments = tournaments.filter(t => t.status !== 'completed')
          return (
          <div className="max-w-2xl mx-auto">
            {assignableTournaments.length === 0 ? (
              <div className="bg-surface border border-green-800 rounded-xl p-10 text-center">
                <p className="text-4xl mb-3">🏆</p>
                <p className="text-white font-bold">No active tournaments</p>
                <p className="text-green-400 text-sm mt-2">Ask your admin to create or activate a tournament.</p>
              </div>
            ) : (
              <div className="bg-surface border border-green-800 rounded-xl p-6">
                <h2 className="text-secondary font-bold mb-1">Tournament Participants</h2>
                <p className="text-green-400 text-xs mb-4">Select which members are enrolled in each tournament.</p>

                <div className="flex flex-wrap gap-2 mb-5">
                  {assignableTournaments.map(t => (
                    <button key={t.id} onClick={() => handleAssignTournamentSelect(t.id)}
                      className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition ${
                        t.id === assignTournamentId
                          ? 'bg-secondary text-dark'
                          : 'bg-primary border border-green-700 text-green-300 hover:border-secondary'
                      }`}
                    >
                      {t.name}
                      <span className="ml-1.5 text-xs opacity-60">
                        ({t.participantIds?.length ?? participants.length})
                      </span>
                    </button>
                  ))}
                </div>

                {participants.length === 0 ? (
                  <p className="text-green-600 text-sm">
                    Add members first in the{' '}
                    <button onClick={() => handleTabChange('members')} className="text-secondary underline">Members</button> tab.
                  </p>
                ) : (
                  <>
                    <div className="flex gap-4 mb-3">
                      <button onClick={() => { setAssignedIds(new Set(participants.map(p => p.id))); setSavedAssignment(false) }}
                        className="text-xs text-green-400 hover:text-secondary transition">Select All</button>
                      <span className="text-green-800">·</span>
                      <button onClick={() => { setAssignedIds(new Set()); setSavedAssignment(false) }}
                        className="text-xs text-green-400 hover:text-secondary transition">None</button>
                      <span className="text-green-600 ml-auto text-xs">{assignedIds.size} / {participants.length}</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-5">
                      {participants.filter(p => !p.disabled).map(p => (
                        <label key={p.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition ${
                          assignedIds.has(p.id) ? 'border-secondary bg-primary' : 'border-green-800 hover:border-green-600'
                        }`}>
                          <input type="checkbox" checked={assignedIds.has(p.id)} onChange={() => toggleAssigned(p.id)}
                            className="accent-yellow-400 w-4 h-4 shrink-0" />
                          <div>
                            <p className="text-white text-sm font-semibold">{p.name}</p>
                            <p className="text-green-400 text-xs">{p.area}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                    <div className="flex items-center gap-4">
                      <button onClick={saveAssignment} disabled={savingAssignment}
                        className="bg-secondary hover:bg-accent text-dark font-bold px-6 py-2 rounded-lg text-sm transition disabled:opacity-50">
                        {savingAssignment ? 'Saving...' : 'Save'}
                      </button>
                      {savedAssignment && <p className="text-green-400 text-sm">✅ Saved!</p>}
                    </div>
                  </>
                )}
              </div>
            )}

          </div>
        )})()}

        {/* ── MEMBERS TAB ── */}
        {tab === 'members' && (
          <div className="max-w-2xl mx-auto space-y-5">
            <div className="bg-surface border border-green-800 rounded-xl p-6">
              <h2 className="text-secondary font-bold mb-4">+ Add Member</h2>
              <form onSubmit={addMember} className="space-y-2">
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="flex-1">
                    <input type="text" value={memberName}
                      onChange={e => {
                        const val = e.target.value.replace(/[^a-zA-Z؀-ۿݐ-ݿ\s]/g, '')
                        setMemberName(val)
                        setNameError(val.trim().length > 0 && val.trim().length < 3 ? 'Minimum 3 letters' : '')
                      }}
                      placeholder="Name (letters only)"
                      className={`w-full bg-primary border text-white rounded-lg px-4 py-2 text-sm focus:outline-none placeholder-green-700 ${nameError ? 'border-red-500 focus:border-red-400' : 'border-green-700 focus:border-secondary'}`} />
                    {nameError && <p className="text-red-400 text-xs mt-0.5 px-1">{nameError}</p>}
                  </div>
                  <div className="flex-1">
                    <input type="text" value={memberArea}
                      onChange={e => {
                        const val = e.target.value.replace(/[^a-zA-Z0-9؀-ۿݐ-ݿ\s]/g, '')
                        setMemberArea(val)
                        setAreaError(val.trim().length > 0 && val.trim().length < 2 ? 'Minimum 2 characters' : '')
                      }}
                      placeholder="Village/Area"
                      className={`w-full bg-primary border text-white rounded-lg px-4 py-2 text-sm focus:outline-none placeholder-green-700 ${areaError ? 'border-red-500 focus:border-red-400' : 'border-green-700 focus:border-secondary'}`} />
                    {areaError && <p className="text-red-400 text-xs mt-0.5 px-1">{areaError}</p>}
                  </div>
                  <button type="submit" disabled={addingMember}
                    className="bg-secondary hover:bg-accent text-dark font-bold px-5 py-2 rounded-lg text-sm transition disabled:opacity-50 sm:w-auto w-full self-start">
                    Add
                  </button>
                </div>
                <p className="text-green-700 text-xs">Name: letters only, min 3 · Village: letters &amp; numbers, min 2</p>
              </form>
            </div>

            <div className="bg-surface border border-green-800 rounded-xl overflow-hidden">
              <div className="bg-primary px-4 py-3 border-b border-green-800 flex items-center justify-between">
                <p className="text-green-400 text-sm font-semibold">
                  {participants.filter(p => !p.disabled).length} Active · {participants.filter(p => p.disabled).length} Disabled
                </p>
              </div>
              {participants.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-green-600">No members yet. Add your first one above.</p>
                </div>
              ) : (
                <div className="divide-y divide-green-900">
                  {participants.map((p, i) => (
                    <div key={p.id} className={`flex items-center gap-3 px-4 py-3 transition ${p.disabled ? 'opacity-50' : 'hover:bg-primary'}`}>
                      <span className="text-green-600 text-xs w-5 shrink-0">{i + 1}</span>
                      <div
                        className="relative w-10 h-10 shrink-0 cursor-pointer"
                        onClick={() => { setCropTarget(p.id); memberInputRefs.current[p.id]?.click() }}
                      >
                        <div className="w-10 h-10 rounded-full border overflow-hidden" style={{ borderColor: p.disabled ? '#1a3a1a' : '#4ade80' }}>
                          {p.photoUrl
                            ? <img src={p.photoUrl} alt={p.name} className="w-full h-full object-cover" />
                            : <div className={`w-full h-full flex items-center justify-center font-bold text-sm ${p.disabled ? 'bg-primary text-green-700' : 'bg-primary text-secondary'}`}>{p.name.charAt(0)}</div>
                          }
                        </div>
                        <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-green-700 rounded-full flex items-center justify-center border-2 border-surface shadow z-10">
                          <span className="text-white text-[9px] leading-none">📷</span>
                        </div>
                      </div>
                      <input type="file" accept="image/*" className="hidden"
                        ref={el => { memberInputRefs.current[p.id] = el }}
                        onChange={e => { const f = e.target.files?.[0]; if (f) setCropFile(f); e.target.value = '' }} />
                      <div className="flex-1 min-w-0">
                        <p className={`font-semibold text-sm truncate ${p.disabled ? 'text-green-700 line-through' : 'text-white'}`}>{p.name}</p>
                        <p className="text-green-600 text-xs">{p.area}{p.disabled ? ' · Disabled' : ''}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button onClick={() => toggleDisabled(p)}
                          className={`text-xs px-2 py-1 rounded transition ${p.disabled ? 'bg-green-900 text-green-400 hover:bg-green-700' : 'bg-yellow-900 text-yellow-400 hover:bg-yellow-700'}`}>
                          {p.disabled ? 'Enable' : 'Disable'}
                        </button>
                        <button onClick={() => removeMember(p.id)} className="text-red-500 hover:text-red-400 text-xs transition">
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── HISTORY TAB ── */}
        {tab === 'history' && (
          <div className="max-w-2xl mx-auto">
            {tournaments.filter(t => t.status === 'completed').length === 0 ? (
              <div className="bg-surface border border-green-800 rounded-xl p-10 text-center">
                <p className="text-4xl mb-3">🏁</p>
                <p className="text-white font-bold">No completed tournaments yet</p>
              </div>
            ) : (
              <div className="bg-surface border border-green-800 rounded-xl overflow-hidden">
                <div className="bg-primary px-4 py-3 border-b border-green-800">
                  <p className="text-green-400 text-sm font-semibold uppercase tracking-widest">🏁 Completed Tournaments</p>
                </div>
                <div className="divide-y divide-green-900">
                  {tournaments.filter(t => t.status === 'completed').map(t => {
                    const nonGap = t.raceDays?.filter(rd => !rd.isGap) ?? []
                    const firstDate = nonGap[0]?.date
                    const lastDate = nonGap[nonGap.length - 1]?.date
                    return (
                      <a key={t.id} href={`/${club?.slug}/${t.id}`} target="_blank" rel="noreferrer"
                        className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-primary transition group">
                        <div className="min-w-0">
                          <p className="text-white font-semibold text-sm truncate group-hover:text-secondary transition">{t.name}</p>
                          <p className="text-green-600 text-xs mt-0.5">
                            {nonGap.length} days{firstDate && lastDate ? ` · ${firstDate} → ${lastDate}` : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="bg-blue-900 text-blue-300 text-xs px-2 py-0.5 rounded-full font-semibold">DONE</span>
                          <span className="text-green-600 group-hover:text-secondary transition">→</span>
                        </div>
                      </a>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── ADD TIME TAB ── */}
        {tab === 'add-time' && (
          activeTournaments.length === 0 ? (
            <div className="bg-surface border border-green-800 rounded-xl p-10 text-center max-w-lg mx-auto">
              <p className="text-4xl mb-3">⏳</p>
              <p className="text-white font-bold text-lg">No Active Tournament</p>
              <p className="text-green-400 text-sm mt-2">Ask your admin to activate a tournament.</p>
            </div>
          ) : (
            <>
              {/* Tournament selector */}
              <div className="bg-surface border border-secondary rounded-xl p-4 mb-5">
                <div className="mb-1">
                  {activeTournaments.length > 1 ? (
                    <select value={tournament?.id} onChange={e => handleTournamentChange(e.target.value)}
                      className="bg-primary border border-secondary text-secondary font-bold text-base rounded-lg px-3 py-1 focus:outline-none focus:border-accent">
                      {activeTournaments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  ) : (
                    <h2 className="text-secondary font-bold text-lg">{tournament?.name}</h2>
                  )}
                </div>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-green-400 text-sm">
                    {todayDay ? `Day ${tournament?.raceDays?.filter(r => !r.isGap && r.dayNumber <= todayDay).length ?? todayDay} · ${todayDate}` : `Today (${todayDate}) is not a race day`}
                  </p>
                  {tournament?.defaultEndTime && (
                    <p className="text-green-600 text-xs">Cutoff: {tournament.defaultEndTime}</p>
                  )}
                </div>
              </div>

              {timeError && (
                <div className="bg-red-900 border border-red-600 text-red-200 px-4 py-2 rounded-lg mb-4 text-sm">
                  ⚠️ {timeError}
                </div>
              )}

              {!todayDay ? (
                <div className="bg-surface border border-green-800 rounded-xl p-8 text-center">
                  <p className="text-3xl mb-3">📅</p>
                  <p className="text-white font-bold">No Race Today</p>
                </div>
              ) : entriesLoading ? (
                <div className="bg-surface border border-green-800 rounded-xl p-8 text-center">
                  <p className="text-green-400">Loading entries...</p>
                </div>
              ) : entries.length === 0 ? (
                <div className="bg-surface border border-green-800 rounded-xl p-8 text-center">
                  <p className="text-3xl mb-3">👥</p>
                  <p className="text-white font-bold">No Participants</p>
                  <button onClick={() => handleTabChange('members')}
                    className="bg-secondary hover:bg-accent text-dark font-bold px-6 py-2 rounded-lg text-sm transition mt-3 inline-block">
                    + Add Members
                  </button>
                </div>
              ) : (
                <>
                  <div className="bg-surface border border-green-800 rounded-xl overflow-x-auto mb-4">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-primary border-b border-green-800">
                          <th className="text-left text-green-400 px-3 py-3 font-semibold whitespace-nowrap">#</th>
                          <th className="text-left text-green-400 px-3 py-3 font-semibold whitespace-nowrap">Participant</th>
                          <th className="text-left text-green-400 px-3 py-3 font-semibold whitespace-nowrap">Start</th>
                          {Array.from({ length: tournament?.pigeonCount ?? 0 }, (_, i) => (
                            <th key={i} className="text-left text-green-400 px-3 py-3 font-semibold whitespace-nowrap">🐦 {i + 1}</th>
                          ))}
                          <th className="text-left text-secondary px-3 py-3 font-semibold whitespace-nowrap">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {entries.map((entry, i) => (
                          <tr key={entry.participantId} className="border-b border-green-900 hover:bg-primary transition">
                            <td className="px-3 py-3 text-green-400">{i + 1}</td>
                            <td className="px-3 py-3">
                              <p className="text-white font-semibold whitespace-nowrap">{entry.name}</p>
                              <p className="text-green-400 text-xs">{entry.area}</p>
                            </td>
                            <td className="px-3 py-3">
                              <input type="time" value={entry.startTime} onChange={e => updateStartTime(i, e.target.value)}
                                className="bg-primary border border-green-700 text-white rounded px-2 py-1 text-xs focus:outline-none focus:border-secondary" />
                            </td>
                            {entry.pigeons.map((pg, pi) => (
                              <td key={pi} className="px-3 py-3">
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center gap-1">
                                    <input type="time" value={pg.landingTime} onChange={e => updateLanding(i, pi, e.target.value)}
                                      className="bg-primary border border-green-700 text-white rounded px-2 py-1 text-xs focus:outline-none focus:border-secondary" />
                                    {pg.landingTime && (
                                      <button type="button" onClick={() => updateLanding(i, pi, '')}
                                        title="Clear time"
                                        className="text-red-500 hover:text-red-400 text-xs leading-none px-0.5 transition">
                                        ✕
                                      </button>
                                    )}
                                  </div>
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
                      <button onClick={saveEntries} disabled={saving}
                        className="bg-secondary hover:bg-accent text-dark font-bold px-8 py-3 rounded-lg transition disabled:opacity-50">
                        {saving ? 'Saving...' : 'Save Entries'}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </>
          )
        )}

      </div>

      {/* Profile crop modal */}
      {cropFile && cropTarget && (
        <ProfileCropModal
          file={cropFile}
          onSave={handleCropSave}
          onCancel={() => { setCropFile(null); setCropTarget(null) }}
        />
      )}

      {/* Upload in-progress overlay */}
      {photoUploading && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
          <div className="bg-surface border border-green-700 rounded-xl px-8 py-5 text-center">
            <p className="text-green-400 text-sm">Uploading photo...</p>
          </div>
        </div>
      )}

    </main>
  )
}
