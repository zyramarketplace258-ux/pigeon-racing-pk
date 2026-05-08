import { getAdminDb } from '@/lib/firebase-admin'
import HomeClient from '@/components/HomeClient'
import { compareHours } from '@/lib/timeUtils'
import type { TInfoClient, InitialHomeData, ActiveTournament, RaceDay } from '@/components/HomeClient'

export const dynamic = 'force-dynamic'

type PigeonRec = { participantKey: string; name: string; area: string; hoursFlown: string; landingTime: string }
type ScoreRec = { participantKey: string; name: string; area: string; photoUrl: string; totalHours: string }
type PigeonChip = { landingTime: string; hoursFlown: string }
type TopEntry = { name: string; area: string; photoUrl?: string; pigeons: PigeonChip[]; totalHours: string }

export default async function HomePage() {
  const empty: InitialHomeData = {
    clubs: [], activeTournaments: [], topScorers: [], winnerPigeons: [],
    totalLandedToday: 0, totalStillFlying: 0, totalLotsCompeting: 0,
  }
  let initialData: InitialHomeData = empty
  let tInfos: TInfoClient[] = []

  try {
    const db = getAdminDb()
    const today = new Date().toISOString().split('T')[0]

    // 1. Fetch all clubs — extract only needed fields to avoid Firestore Timestamps in serialized props
    const clubsSnap = await db.collection('clubs').get()
    const clubs: InitialHomeData['clubs'] = clubsSnap.docs.map(d => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = d.data() as any
      return {
        id: d.id,
        name: String(data.name || ''),
        slug: String(data.slug || ''),
        city: String(data.city || ''),
        ...(data.logoUrl ? { logoUrl: String(data.logoUrl) } : {}),
      }
    })

    // 2. Fetch active tournaments + participants per club (all parallel)
    const perClub = await Promise.all(clubs.map(async (club) => {
      const [tSnap, pSnap] = await Promise.all([
        db.collection('clubs').doc(club.id).collection('tournaments').where('status', '==', 'active').get(),
        db.collection('clubs').doc(club.id).collection('participants').get(),
      ])
      return {
        club,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tournaments: tSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) })),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        participants: pSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) })),
      }
    }))

    // 3. Build TInfo structures
    for (const { club, tournaments, participants } of perClub) {
      const nm: Record<string, string> = {}
      const am: Record<string, string> = {}
      const pm: Record<string, string> = {}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      participants.forEach((p: any) => { nm[p.id] = p.name || ''; am[p.id] = p.area || ''; pm[p.id] = p.photoUrl || '' })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const t of tournaments as any[]) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const raceDays: RaceDay[] = (t.raceDays || []).map((rd: any) => ({ dayNumber: Number(rd.dayNumber), date: String(rd.date), ...(rd.isGap ? { isGap: true } : {}) }))
        const nonGap = raceDays.filter(rd => !rd.isGap)
        const passed = nonGap.filter(rd => rd.date <= today).length
        const participantIds: string[] | null = t.participantIds ?? null
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const enrolledIds: string[] = participantIds ?? participants.map((p: any) => p.id)
        const filteredNm: Record<string, string> = {}
        const filteredAm: Record<string, string> = {}
        const filteredPm: Record<string, string> = {}
        enrolledIds.forEach(id => { filteredNm[id] = nm[id] || ''; filteredAm[id] = am[id] || ''; filteredPm[id] = pm[id] || '' })
        const todayRD = nonGap.find(rd => rd.date === today)
        const currentDayNum = todayRD?.dayNumber ?? nonGap[nonGap.length - 1]?.dayNumber

        tInfos.push({
          base: {
            id: t.id, name: t.name,
            pigeonCount: t.pigeonCount || 5,
            defaultStartTime: t.defaultStartTime || '',
            defaultEndTime: t.defaultEndTime || '',
            clubId: club.id, clubName: club.name, clubSlug: club.slug, clubCity: club.city,
            raceDays, participantIds,
            currentDay: Math.min(passed, nonGap.length) || 1,
            totalRaceDays: nonGap.length,
          },
          nameMap: filteredNm, areaMap: filteredAm, photoMap: filteredPm,
          enrolledCount: enrolledIds.length,
          suffix: currentDayNum ? `_day${currentDayNum}` : '',
        })
      }
    }

    // 4. Fetch today's entries for all tournaments in parallel
    const allEntries = await Promise.all(tInfos.map(async (info) => {
      if (!info.suffix) return { id: info.base.id, docs: [] as Record<string, unknown>[] }
      const eSnap = await db
        .collection('clubs').doc(info.base.clubId)
        .collection('tournaments').doc(info.base.id)
        .collection('entries').get()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return { id: info.base.id, docs: eSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) }
    }))
    const entriesMap = new Map(allEntries.map(e => [e.id, e.docs]))

    // 5. Compute derived state (mirrors client-side rebuildAndPublish)
    const liveStore = new Map<string, Pick<ActiveTournament, 'topEntries' | 'totalLanded' | 'totalPigeons'>>()
    const pigeonStore = new Map<string, PigeonRec[]>()
    const scoreStore = new Map<string, ScoreRec[]>()

    for (const info of tInfos) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const docs = (entriesMap.get(info.base.id) || []) as any[]
      let totalLanded = 0
      const precs: PigeonRec[] = []
      const srecs: ScoreRec[] = []

      /* eslint-disable @typescript-eslint/no-explicit-any */
      const entries: TopEntry[] = docs
        .filter((d: any) => d.id.endsWith(info.suffix))
        .flatMap((d: any) => {
          const pId = d.id.slice(0, -info.suffix.length)
          if (!(pId in info.nameMap)) return []
          if (!d.totalHours) return []
          const pigeons: PigeonChip[] = (d.pigeons || []).map((pg: any) => ({
            landingTime: pg.landingTime || '', hoursFlown: pg.hoursFlown || '',
          }))
          pigeons.forEach(pg => { if (pg.landingTime) totalLanded++ })
          return [{ name: info.nameMap[pId], area: info.areaMap[pId] || '', photoUrl: info.photoMap[pId] || '', pigeons, totalHours: d.totalHours }]
        })
        .sort((a: TopEntry, b: TopEntry) => compareHours(a.totalHours, b.totalHours))

      const top = entries.slice(0, 3)

      docs
        .filter((d: any) => d.id.endsWith(info.suffix))
        .forEach((d: any) => {
          const pId = d.id.slice(0, -info.suffix.length)
          if (!(pId in info.nameMap)) return
          if (d.totalHours) {
            srecs.push({ participantKey: `${info.base.clubId}::${pId}`, name: info.nameMap[pId], area: info.areaMap[pId] || '', photoUrl: info.photoMap[pId] || '', totalHours: d.totalHours })
          }
          ;(d.pigeons || []).forEach((pg: any) => {
            if (pg.hoursFlown && pg.landingTime) {
              precs.push({ participantKey: `${info.base.clubId}::${pId}`, name: info.nameMap[pId], area: info.areaMap[pId] || '', hoursFlown: pg.hoursFlown, landingTime: pg.landingTime })
            }
          })
        })
      /* eslint-enable @typescript-eslint/no-explicit-any */

      liveStore.set(info.base.id, { topEntries: top, totalLanded, totalPigeons: info.enrolledCount * info.base.pigeonCount })
      pigeonStore.set(info.base.id, precs)
      scoreStore.set(info.base.id, srecs)
    }

    // 6. Build activeTournaments array
    const activeTournaments: ActiveTournament[] = tInfos.map(info => ({
      ...info.base,
      ...(liveStore.get(info.base.id) ?? { topEntries: [], totalLanded: 0, totalPigeons: info.enrolledCount * info.base.pigeonCount }),
    }))

    // 7. Global stats
    let gLanded = 0, gLots = 0, gStillFlying = 0
    activeTournaments.forEach(tr => {
      gLanded += tr.totalLanded
      gLots += tr.totalPigeons / tr.pigeonCount
      gStillFlying += Math.max(0, tr.totalPigeons - tr.totalLanded)
    })

    // 8. Top scorers (Today's Highlights)
    const allScorers: (ScoreRec & { tournament: string; clubSlug: string; tournamentId: string })[] = []
    tInfos.forEach(info => {
      ;(scoreStore.get(info.base.id) || []).forEach(s => {
        allScorers.push({ ...s, tournament: info.base.name, clubSlug: info.base.clubSlug, tournamentId: info.base.id })
      })
    })
    allScorers.sort((a, b) => compareHours(a.totalHours, b.totalHours))
    const bestScoreMap = new Map<string, typeof allScorers[0]>()
    allScorers.forEach(s => {
      const ex = bestScoreMap.get(s.participantKey)
      if (!ex || compareHours(s.totalHours, ex.totalHours) < 0) bestScoreMap.set(s.participantKey, s)
    })
    const dedupedScorers = Array.from(bestScoreMap.values()).sort((a, b) => compareHours(a.totalHours, b.totalHours))
    const topScorers: InitialHomeData['topScorers'] = []
    let prevHTS = '', rankTS = 0
    for (const s of dedupedScorers) {
      if (s.totalHours !== prevHTS) { rankTS++; if (rankTS > 3) break; prevHTS = s.totalHours }
      topScorers.push({ ...s, rank: rankTS })
    }

    // 9. Winner pigeons
    const allPR: (PigeonRec & { tournament: string; clubSlug: string; tournamentId: string })[] = []
    tInfos.forEach(info => {
      ;(pigeonStore.get(info.base.id) || []).forEach(p => {
        allPR.push({ ...p, tournament: info.base.name, clubSlug: info.base.clubSlug, tournamentId: info.base.id })
      })
    })
    const bestMap = new Map<string, typeof allPR[0]>()
    allPR.forEach(p => {
      const ex = bestMap.get(p.participantKey)
      if (!ex || compareHours(p.hoursFlown, ex.hoursFlown) < 0) bestMap.set(p.participantKey, p)
    })
    const sortedPR = Array.from(bestMap.values()).sort((a, b) => compareHours(a.hoursFlown, b.hoursFlown))
    const winnerPigeons: InitialHomeData['winnerPigeons'] = []
    let prevHW = '', rankW = 0
    for (const p of sortedPR) {
      if (p.hoursFlown !== prevHW) { rankW++; if (rankW > 1) break; prevHW = p.hoursFlown }
      winnerPigeons.push({ name: p.name, area: p.area, landingTime: p.landingTime, hoursFlown: p.hoursFlown, tournament: p.tournament, clubSlug: p.clubSlug, tournamentId: p.tournamentId, rank: rankW })
    }

    initialData = {
      clubs,
      activeTournaments,
      topScorers,
      winnerPigeons,
      totalLandedToday: gLanded,
      totalStillFlying: gStillFlying,
      totalLotsCompeting: gLots,
    }
  } catch (err) {
    console.error('SSR fetch failed:', err)
    tInfos = []
    initialData = empty
  }

  return <HomeClient initialData={initialData} tInfos={tInfos} />
}
