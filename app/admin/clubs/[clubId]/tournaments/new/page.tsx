'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import Link from 'next/link'

interface RaceDay {
  dayNumber: number
  date: string
  isGap: boolean
}

export default function NewTournamentPage() {
  const router = useRouter()
  const params = useParams()
  const clubId = params.clubId as string

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [raceDays, setRaceDays] = useState<RaceDay[]>([])

  const [form, setForm] = useState({
    name: '',
    nameUrdu: '',
    totalDays: 0,
    defaultStartTime: '06:00',
    defaultEndTime: '20:00',
    pigeonCount: 0,
    startDate: '',
  })
  const [nameError, setNameError] = useState('')

  // Regenerate race days whenever startDate or totalDays changes
  useEffect(() => {
    if (!form.startDate || !form.totalDays) { setRaceDays([]); return }
    const start = new Date(form.startDate)
    const days: RaceDay[] = []
    for (let i = 0; i < form.totalDays; i++) {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      // Preserve existing gap toggles when regenerating
      const existing = raceDays[i]
      days.push({
        dayNumber: i + 1,
        date: d.toISOString().split('T')[0],
        isGap: existing?.isGap ?? false,
      })
    }
    setRaceDays(days)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.startDate, form.totalDays])

  const toggleGap = (index: number) => {
    setRaceDays(prev => prev.map((d, i) => i === index ? { ...d, isGap: !d.isGap } : d))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setNameError('')

    if (!form.name.trim() && !form.nameUrdu.trim()) {
      setNameError('Enter tournament name in English or Urdu (at least one)')
      setLoading(false)
      return
    }
    if (/[؀-ۿ]/.test(form.name)) {
      setNameError('Urdu text detected in English field — use the Urdu field below')
      setLoading(false)
      return
    }
    if (form.nameUrdu.trim() && /[a-zA-Z]/.test(form.nameUrdu) && !/[؀-ۿ]/.test(form.nameUrdu)) {
      setNameError('English text detected in Urdu field — use the English field above')
      setLoading(false)
      return
    }

    try {
      await addDoc(collection(db, 'clubs', clubId, 'tournaments'), {
        name: form.name,
        ...(form.nameUrdu.trim() ? { nameUrdu: form.nameUrdu.trim() } : {}),
        status: 'inactive',
        totalDays: form.totalDays,
        defaultStartTime: form.defaultStartTime,
        defaultEndTime: form.defaultEndTime,
        pigeonCount: form.pigeonCount,
        raceDays,
        participantIds: [],
        createdAt: serverTimestamp(),
        createdBy: 'admin',
      })

      router.push(`/admin/clubs/${clubId}`)
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message)
      else setError('Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  const gapCount = raceDays.filter(d => d.isGap).length
  const raceDayCount = raceDays.length - gapCount

  return (
    <main className="min-h-screen bg-dark">
      <header className="bg-primary border-b border-secondary px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-secondary">🏆 New Tournament</h1>
          <p className="text-green-400 text-xs">Admin Panel</p>
        </div>
        <Link href={`/admin/clubs/${clubId}`} className="text-xs text-green-400 hover:text-secondary transition">
          ← Back to Club
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

            <div>
              <label className="block text-green-300 text-sm mb-1">Tournament Name</label>
              <p className="text-green-600 text-xs mb-2">At least one of English or Urdu is required</p>
              <div className="space-y-2">
                <input
                  type="text"
                  value={form.name}
                  onChange={e => {
                    const val = e.target.value
                    setForm(f => ({ ...f, name: val }))
                    if (/[؀-ۿ]/.test(val)) setNameError('Urdu text detected — use the Urdu field below')
                    else setNameError('')
                  }}
                  placeholder="English name (e.g. Spring Race 2026)"
                  className={`w-full bg-primary border text-white rounded-lg px-4 py-3 text-sm focus:outline-none placeholder-green-700 ${nameError && /[؀-ۿ]/.test(form.name) ? 'border-red-500 focus:border-red-400' : 'border-green-700 focus:border-secondary'}`}
                />
                <input
                  type="text"
                  value={form.nameUrdu}
                  onChange={e => {
                    const val = e.target.value
                    setForm(f => ({ ...f, nameUrdu: val }))
                    if (val.trim() && !/[؀-ۿ]/.test(val) && /[a-zA-Z]/.test(val)) setNameError('English text detected — use the English field above')
                    else setNameError('')
                  }}
                  dir="rtl"
                  placeholder="اردو نام (مثلاً بہار ریس ۲۰۲۶)"
                  className={`w-full bg-primary border text-white rounded-lg px-4 py-3 text-sm focus:outline-none placeholder-green-700 font-urdu ${nameError && /[a-zA-Z]/.test(form.nameUrdu) ? 'border-red-500 focus:border-red-400' : 'border-green-700 focus:border-secondary'}`}
                />
              </div>
              {nameError && <p className="text-red-400 text-xs mt-1">{nameError}</p>}
            </div>

            <div>
              <label className="block text-green-300 text-sm mb-2">Start Date</label>
              <input
                type="date"
                value={form.startDate}
                onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                required
                className="w-full bg-primary border border-green-700 text-white rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-secondary"
              />
            </div>

            <div>
              <label className="block text-green-300 text-sm mb-2">
                Total Days
                <span className="text-green-600 ml-2 text-xs">(1 – 100)</span>
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="e.g. 10"
                value={form.totalDays || ''}
                onFocus={e => e.target.select()}
                onChange={e => {
                  const v = parseInt(e.target.value.replace(/\D/g, ''))
                  setForm(f => ({ ...f, totalDays: isNaN(v) ? 0 : Math.min(100, v) }))
                }}
                required
                className="w-full bg-primary border border-green-700 text-white rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-secondary placeholder-green-700"
              />
            </div>

            <div>
              <label className="block text-green-300 text-sm mb-2">Default Start Time</label>
              <input
                type="time"
                value={form.defaultStartTime}
                onChange={e => setForm(f => ({ ...f, defaultStartTime: e.target.value }))}
                required
                className="w-full bg-primary border border-green-700 text-white rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-secondary"
              />
              <p className="text-green-600 text-xs mt-1">This can be changed per participant before entry</p>
            </div>

            <div>
              <label className="block text-green-300 text-sm mb-2">Last Landing Time (Cutoff)</label>
              <input
                type="time"
                value={form.defaultEndTime}
                onChange={e => setForm(f => ({ ...f, defaultEndTime: e.target.value }))}
                required
                className="w-full bg-primary border border-green-700 text-white rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-secondary"
              />
              <p className="text-green-600 text-xs mt-1">No pigeon landing can be entered after this time</p>
            </div>

            <div>
              <label className="block text-green-300 text-sm mb-2">Number of Pigeons Flying</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="e.g. 5"
                value={form.pigeonCount || ''}
                onFocus={e => e.target.select()}
                onChange={e => {
                  const v = parseInt(e.target.value.replace(/\D/g, ''))
                  setForm(f => ({ ...f, pigeonCount: isNaN(v) ? 0 : v }))
                }}
                required
                className="w-full bg-primary border border-green-700 text-white rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-secondary placeholder-green-700"
              />
            </div>

            {/* Race Days Preview */}
            {raceDays.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-green-300 text-sm">Schedule — tap a day to mark as gap</label>
                  <span className="text-green-600 text-xs">{raceDayCount} race · {gapCount} gap</span>
                </div>
                <div className="grid grid-cols-5 gap-2 max-h-64 overflow-y-auto pr-1">
                  {raceDays.map((d, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => toggleGap(i)}
                      className={`rounded-lg p-2 text-center text-xs font-semibold transition border ${
                        d.isGap
                          ? 'bg-dark border-green-900 text-green-700 line-through'
                          : 'bg-primary border-green-700 text-white hover:border-secondary'
                      }`}
                    >
                      <span className="block font-bold">{d.isGap ? 'GAP' : `D${raceDays.filter(r => !r.isGap && r.dayNumber <= d.dayNumber).length}`}</span>
                      <span className="block text-xs opacity-70 mt-0.5">{d.date.slice(5)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || raceDays.length === 0 || !form.pigeonCount}
              className="w-full bg-secondary hover:bg-accent text-dark font-bold py-3 rounded-lg transition disabled:opacity-50 mt-2"
            >
              {loading ? 'Creating...' : 'Create Tournament'}
            </button>

          </form>
        </div>
      </div>
    </main>
  )
}
