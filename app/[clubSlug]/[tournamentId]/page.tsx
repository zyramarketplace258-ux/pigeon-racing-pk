import { getAdminDb } from '@/lib/firebase-admin'
import TournamentClient from '@/components/TournamentClient'
import type { TournamentInitialData } from '@/components/TournamentClient'

export const dynamic = 'force-dynamic'

export default async function TournamentPage({ params }: { params: { clubSlug: string; tournamentId: string } }) {
  const { clubSlug, tournamentId } = params

  const empty = (notFound: boolean): TournamentInitialData => ({
    club: null, tournament: null, participants: [], allEntryDocs: [], defaultDay: 1, notFound,
  })

  try {
    const db = getAdminDb()

    // 1. Club by slug
    const clubsSnap = await db.collection('clubs').where('slug', '==', clubSlug).get()
    if (clubsSnap.empty) {
      return <TournamentClient initialData={empty(true)} clubSlug={clubSlug} />
    }
    const clubDoc = clubsSnap.docs[0]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const clubRaw = clubDoc.data() as any
    const club = {
      id: clubDoc.id,
      name: String(clubRaw.name || ''),
      slug: String(clubRaw.slug || ''),
      city: String(clubRaw.city || ''),
    }

    // 2. Tournament
    const tDoc = await db.collection('clubs').doc(club.id).collection('tournaments').doc(tournamentId).get()
    if (!tDoc.exists) {
      return <TournamentClient initialData={{ ...empty(true), club }} clubSlug={clubSlug} />
    }
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const tRaw = tDoc.data() as any
    const raceDays = (tRaw.raceDays || []).map((rd: any) => ({
      dayNumber: Number(rd.dayNumber),
      date: String(rd.date),
      ...(rd.isGap ? { isGap: true } : {}),
    }))
    const tournament = {
      id: tDoc.id,
      name: String(tRaw.name || ''),
      status: String(tRaw.status || ''),
      totalDays: Number(tRaw.totalDays || 0),
      defaultStartTime: String(tRaw.defaultStartTime || ''),
      pigeonCount: Number(tRaw.pigeonCount || 5),
      raceDays,
      ...(tRaw.participantIds ? { participantIds: tRaw.participantIds as string[] } : {}),
    }

    // 3. Participants
    const pSnap = await db.collection('clubs').doc(club.id).collection('participants').get()
    const allParticipants = pSnap.docs.map(d => {
      const data = d.data() as any
      return {
        id: d.id,
        name: String(data.name || ''),
        area: String(data.area || ''),
        ...(data.photoUrl ? { photoUrl: String(data.photoUrl) } : {}),
      }
    })
    const participants = tournament.participantIds != null
      ? allParticipants.filter(p => tournament.participantIds!.includes(p.id))
      : allParticipants

    // 4. All entries
    const eSnap = await db
      .collection('clubs').doc(club.id)
      .collection('tournaments').doc(tournamentId)
      .collection('entries').get()
    const allEntryDocs = eSnap.docs.map(d => {
      const data = d.data() as any
      return {
        id: d.id,
        startTime: String(data.startTime || ''),
        totalHours: String(data.totalHours || ''),
        pigeons: (data.pigeons || []).map((pg: any) => ({
          landingTime: String(pg.landingTime || ''),
          hoursFlown: String(pg.hoursFlown || ''),
        })),
      }
    })
    /* eslint-enable @typescript-eslint/no-explicit-any */

    // 5. Default day
    const today = new Date().toISOString().split('T')[0]
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nonGapDays = raceDays.filter((rd: any) => !rd.isGap)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const todayDay = nonGapDays.find((rd: any) => rd.date === today)
    const defaultDay: number = todayDay?.dayNumber ?? nonGapDays[nonGapDays.length - 1]?.dayNumber ?? 1

    return (
      <TournamentClient
        initialData={{ club, tournament, participants, allEntryDocs, defaultDay, notFound: false }}
        clubSlug={clubSlug}
      />
    )
  } catch (err) {
    console.error('Tournament SSR failed:', err)
    return <TournamentClient initialData={empty(true)} clubSlug={clubSlug} />
  }
}
