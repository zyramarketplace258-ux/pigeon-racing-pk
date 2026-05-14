import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'

export const runtime = 'edge'

const W = 1170  // 390 × 3 — high-res render

const isArabic = (text: string) => /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/.test(text)
const safe = (text: string, fallback = '') => isArabic(text) ? fallback : text

const getMedal      = (r: number) => r === 1 ? '🥇' : r === 2 ? '🥈' : r === 3 ? '🥉' : null
const getRankLabel  = (r: number) => r === 1 ? '1ST PLACE' : r === 2 ? '2ND PLACE' : '3RD PLACE'
const getRankGradient = (r: number) =>
  r === 1 ? 'linear-gradient(90deg,#f9a825,#ff8f00)'
  : r === 2 ? 'linear-gradient(90deg,#9e9e9e,#bdbdbd)'
  : 'linear-gradient(90deg,#8d6e63,#a1887f)'
const getRankRing = (r: number) =>
  r === 1 ? '#f9a825' : r === 2 ? '#9e9e9e' : r === 3 ? '#8d6e63' : '#43a047'

async function fetchPhoto(url: string): Promise<string | null> {
  try {
    const res = await fetch(url)
    const buf = await res.arrayBuffer()
    const bytes = new Uint8Array(buf)
    let b64 = ''
    for (let i = 0; i < bytes.length; i++) b64 += String.fromCharCode(bytes[i])
    return `data:${res.headers.get('content-type') || 'image/jpeg'};base64,${btoa(b64)}`
  } catch { return null }
}

export async function GET(request: NextRequest) {
  try {
    const s = (k: string, def = '') => new URL(request.url).searchParams.get(k) ?? def
    const baseUrl = new URL(request.url).origin

    const type       = s('type', 'daily')
    const tournament = safe(s('tournament', 'Tournament'), 'Tournament')
    const club       = safe(s('club', 'Club'), 'Club')
    const player     = safe(s('player', ''), safe(s('playerUrdu', ''), 'Player'))
    const area       = safe(s('area', ''), safe(s('areaUrdu', ''), ''))
    const rank       = parseInt(s('rank', '0')) || 0
    const score      = s('score', '')
    const photoUrl   = s('photoUrl')

    const [photoData, pigeonData, cardBkData] = await Promise.all([
      photoUrl ? fetchPhoto(photoUrl) : Promise.resolve(null),
      fetchPhoto(`${baseUrl}/pigeon.png`),
      fetchPhoto(`${baseUrl}/cardbk.png`),
    ])

    const medal    = getMedal(rank)
    const ringColor = getRankRing(rank)

    // ── Header (home-page style) ─────────────────────────────────
    const headerEl = (rightContent: React.ReactNode) => (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'linear-gradient(135deg,#1b5e20,#2e7d32)', padding: '36px 54px' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ color: 'white', fontSize: 51, fontWeight: 900 }}>Pakistan Pigeon Racing</span>
          <span style={{ color: '#86efac', fontSize: 21, letterSpacing: 6 }}>LOVE FOR THE LOFT</span>
        </div>
        {pigeonData
          ? <img src={pigeonData} width={120} height={120} style={{ objectFit: 'contain' }} alt="" />
          : <div style={{ width: 120, height: 120, display: 'flex' }} />
        }
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 9 }}>
          {rightContent}
        </div>
      </div>
    )

    // ── Rank banner (top 3 only) ──────────────────────────────────
    const rankBannerEl = medal ? (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24, background: getRankGradient(rank), padding: '21px 0' }}>
        <span style={{ fontSize: 57 }}>{medal}</span>
        <span style={{ color: 'white', fontSize: 39, fontWeight: 900, letterSpacing: 6 }}>{getRankLabel(rank)}</span>
      </div>
    ) : null

    // ── Profile box ──────────────────────────────────────────────
    const profileEl = (scoreLabel: string) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 42, margin: '24px 36px', background: '#fdf8f0', borderRadius: 36, padding: '33px 42px', border: '2px solid #e8dcc8' }}>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <span style={{ color: '#1b5e20', fontSize: 51, fontWeight: 900, lineHeight: 1.1 }}>{tournament}</span>
          <span style={{ color: '#111', fontSize: 45, fontWeight: 800, marginTop: 12 }}>{player}</span>
          {area ? <span style={{ color: '#2e7d32', fontSize: 30, marginTop: 6 }}>{area}</span> : null}
          {!medal && rank > 0 ? (
            <div style={{ display: 'flex', alignSelf: 'flex-start', background: '#388e3c', borderRadius: 60, padding: '6px 27px', marginTop: 12 }}>
              <span style={{ color: 'white', fontSize: 27, fontWeight: 800 }}>#{rank}</span>
            </div>
          ) : null}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 15, marginTop: 18 }}>
            <span style={{ color: '#888', fontSize: 21, letterSpacing: 4, fontWeight: 700 }}>{scoreLabel}</span>
            <span style={{ color: '#1b5e20', fontSize: 57, fontWeight: 900, lineHeight: 1 }}>{score || '--:--'}</span>
          </div>
        </div>
        <div style={{ display: 'flex', flexShrink: 0 }}>
          <div style={{ display: 'flex', width: 219, height: 219, borderRadius: 110, border: `9px solid ${ringColor}`, background: '#e8f5e9', alignItems: 'center', justifyContent: 'center' }}>
            {photoData
              ? <img src={photoData} width={219} height={219} style={{ borderRadius: 110 }} alt="" />
              : <span style={{ fontSize: 81, fontWeight: 900, color: '#1b5e20' }}>{player.charAt(0).toUpperCase()}</span>
            }
          </div>
        </div>
      </div>
    )

    // ── Grid ─────────────────────────────────────────────────────
    const gridEl = (cells: { i: number; label: string; time: string; active: boolean }[], cols: number) => {
      const rows: typeof cells[] = []
      for (let r = 0; r < Math.ceil(cells.length / cols); r++) {
        const row = [...cells.slice(r * cols, (r + 1) * cols)]
        while (row.length < cols) row.push({ i: -1, label: '', time: '', active: false })
        rows.push(row)
      }
      return (
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, margin: '6px 36px 30px', gap: 18 }}>
          {rows.map((row, ri) => (
            <div key={ri} style={{ display: 'flex', gap: 18, flex: 1 }}>
              {row.map((cell, ci) => cell.i === -1
                ? <div key={ci} style={{ flex: 1, display: 'flex' }} />
                : (
                  <div key={cell.i} style={{
                    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    background: cell.active ? '#fef9ee' : '#f5f5f0',
                    borderRadius: 24, padding: '18px 6px',
                    border: cell.active ? '3px solid #2e7d32' : '3px solid #e0e0e0',
                  }}>
                    <span style={{ color: cell.active ? '#555' : '#c0c0c0', fontSize: 24, fontWeight: 700 }}>{cell.label}</span>
                    <span style={{ color: cell.active ? '#111' : '#d0d0d0', fontSize: 39, fontWeight: 900, marginTop: 6 }}>{cell.time}</span>
                  </div>
                )
              )}
            </div>
          ))}
        </div>
      )
    }

    // ── DAILY CARD ───────────────────────────────────────────────
    if (type === 'daily') {
      const day         = s('day', '1')
      const totalDays   = s('totalDays', '1')
      const date        = s('date', '')
      const pigeonCount = Math.max(1, parseInt(s('pigeonCount', '1')) || 1)
      const timesRaw    = s('times')
      const rawTimes    = timesRaw ? timesRaw.split(',') : []
      while (rawTimes.length < pigeonCount) rawTimes.push('')

      const cells = rawTimes.slice(0, pigeonCount).map((t, i) => ({ i, label: `#${i + 1}`, time: t || '--', active: !!(t && t !== '--') }))
      const cols  = pigeonCount <= 6 ? 3 : pigeonCount <= 12 ? 4 : 5
      const nRows = Math.ceil(pigeonCount / cols)
      const height = Math.min(Math.max(1500, 870 + (medal ? 108 : 0) + nRows * 216), 2250)

      return new ImageResponse(
        (
          <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', fontFamily: 'sans-serif', background: 'linear-gradient(160deg,#e8f5e9,#f9fdf9,#e8f5e9)', position: 'relative' }}>
            {cardBkData && (
              <img src={cardBkData} style={{ position: 'absolute', top: '20%', left: 0, width: '100%', height: '60%', objectFit: 'contain', opacity: 0.08 }} alt="" />
            )}
            {headerEl(
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 9 }}>
                <span style={{ color: 'white', fontSize: 36, fontWeight: 800 }}>{club}</span>
                <span style={{ color: '#c8e6c9', fontSize: 30, fontWeight: 700 }}>{`DAY ${day} / ${totalDays}`}</span>
                {date ? <span style={{ color: '#a5d6a7', fontSize: 27 }}>{date}</span> : null}
              </div>
            )}
            {rankBannerEl}
            {profileEl('DAY TOTAL')}
            {gridEl(cells, cols)}
          </div>
        ),
        { width: W, height }
      )
    }

    // ── OVERALL CARD ─────────────────────────────────────────────
    const totalDays   = Math.max(1, parseInt(s('totalDays', '1')) || 1)
    const dayTimesRaw = s('dayTimes')
    const rawDayTimes = dayTimesRaw ? dayTimesRaw.split(',') : []
    while (rawDayTimes.length < totalDays) rawDayTimes.push('')

    const dayCells = rawDayTimes.slice(0, totalDays).map((t, i) => ({ i, label: `DAY ${i + 1}`, time: t || '--', active: !!(t && t !== '--') }))
    const dayCols  = totalDays <= 3 ? totalDays : totalDays <= 8 ? 4 : 5
    const dayRows  = Math.ceil(totalDays / dayCols)
    const height   = Math.min(Math.max(1440, 840 + (medal ? 108 : 0) + dayRows * 216), 2160)

    return new ImageResponse(
      (
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', fontFamily: 'sans-serif', background: 'linear-gradient(160deg,#e8f5e9,#f9fdf9,#e8f5e9)', position: 'relative' }}>
          {cardBkData && (
            <img src={cardBkData} style={{ position: 'absolute', top: '20%', left: 0, width: '100%', height: '60%', objectFit: 'contain', opacity: 0.08 }} alt="" />
          )}
          {headerEl(
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 9 }}>
              <span style={{ color: 'white', fontSize: 36, fontWeight: 800 }}>{club}</span>
              <span style={{ color: '#c8e6c9', fontSize: 30, fontWeight: 700 }}>OVERALL RESULT</span>
              <span style={{ color: '#a5d6a7', fontSize: 27 }}>{`${totalDays} DAY${totalDays > 1 ? 'S' : ''}`}</span>
            </div>
          )}
          {rankBannerEl}
          {profileEl('TOTAL TIME')}
          {gridEl(dayCells, dayCols)}
        </div>
      ),
      { width: W, height }
    )

  } catch (err) {
    return new Response(`Card error: ${err}`, { status: 500, headers: { 'content-type': 'text/plain' } })
  }
}
