import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'

export const runtime = 'edge'

const W = 1170  // 390 × 3 — high-res render

const isArabic = (text: string) => /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/.test(text)
const safeEn = (text: string, fallback = '') => isArabic(text) ? fallback : text

const getMedal      = (r: number) => r === 1 ? '🥇' : r === 2 ? '🥈' : r === 3 ? '🥉' : null
const getRankLabel  = (r: number) => r === 1 ? '1ST PLACE' : r === 2 ? '2ND PLACE' : '3RD PLACE'
const getRankBg     = (r: number) =>
  r === 1 ? 'rgba(249,168,37,0.82)' : r === 2 ? 'rgba(158,158,158,0.82)' : 'rgba(141,110,99,0.82)'
const getRankRing   = (r: number) =>
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
    const tournament = safeEn(s('tournament', 'Tournament'), 'Tournament')
    const club       = safeEn(s('club', 'Club'), 'Club')

    // Player name: prefer English, fall back to Urdu
    const playerEn   = s('player', '').trim()
    const playerUr   = s('playerUrdu', '').trim()
    const showUrdu   = !playerEn && !!playerUr
    const playerName = playerEn || playerUr || 'Player'

    const area       = s('area', '').trim() || s('areaUrdu', '').trim()
    const rank       = parseInt(s('rank', '0')) || 0
    const score      = s('score', '')
    const photoUrl   = s('photoUrl')

    const [photoData, cardBkData] = await Promise.all([
      photoUrl ? fetchPhoto(photoUrl) : Promise.resolve(null),
      fetchPhoto(`${baseUrl}/cardbk.png`),
    ])

    const medal     = getMedal(rank)
    const ringColor = getRankRing(rank)

    const nameStyle = showUrdu ? { direction: 'rtl' as const } : {}

    // ── Header (home-page style, cardbk.png as center logo) ─────
    const headerEl = (rightContent: React.ReactNode) => (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'linear-gradient(135deg,#1b5e20,#2e7d32)', padding: '36px 54px' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ color: 'white', fontSize: 51, fontWeight: 900 }}>Pakistan Pigeon Racing</span>
          <span style={{ color: '#86efac', fontSize: 21, letterSpacing: 6 }}>LOVE FOR THE LOFT</span>
        </div>
        {cardBkData
          ? <img src={cardBkData} width={120} height={120} style={{ objectFit: 'contain' }} alt="" />
          : <div style={{ width: 120, height: 120, display: 'flex' }} />
        }
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 9 }}>
          {rightContent}
        </div>
      </div>
    )

    // ── Rank banner (glassy) ──────────────────────────────────────
    const rankBannerEl = medal ? (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24, background: getRankBg(rank), padding: '21px 0' }}>
        <span style={{ fontSize: 57 }}>{medal}</span>
        <span style={{ color: 'white', fontSize: 39, fontWeight: 900, letterSpacing: 6 }}>{getRankLabel(rank)}</span>
      </div>
    ) : null

    // ── Profile box (glassy cream) ────────────────────────────────
    const profileEl = (scoreLabel: string) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 42, margin: '24px 36px', background: 'rgba(253,248,240,0.55)', borderRadius: 36, padding: '33px 42px', border: '1.5px solid rgba(232,220,200,0.5)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <span style={{ color: '#1b5e20', fontSize: 51, fontWeight: 900, lineHeight: 1.1 }}>{tournament}</span>
          <span style={{ color: '#111', fontSize: 45, fontWeight: 800, marginTop: 12, ...nameStyle }}>{playerName}</span>
          {area ? <span style={{ color: '#2e7d32', fontSize: 30, marginTop: 6 }}>{area}</span> : null}
          {!medal && rank > 0 ? (
            <div style={{ display: 'flex', alignSelf: 'flex-start', background: 'rgba(56,142,60,0.85)', borderRadius: 60, padding: '6px 27px', marginTop: 12 }}>
              <span style={{ color: 'white', fontSize: 27, fontWeight: 800 }}>#{rank}</span>
            </div>
          ) : null}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 15, marginTop: 18 }}>
            <span style={{ color: '#888', fontSize: 21, letterSpacing: 4, fontWeight: 700 }}>{scoreLabel}</span>
            <span style={{ color: '#1b5e20', fontSize: 57, fontWeight: 900, lineHeight: 1 }}>{score || '--:--'}</span>
          </div>
        </div>
        <div style={{ display: 'flex', flexShrink: 0 }}>
          <div style={{ display: 'flex', width: 219, height: 219, borderRadius: 110, border: `9px solid ${ringColor}`, background: 'rgba(232,245,233,0.6)', alignItems: 'center', justifyContent: 'center' }}>
            {photoData
              ? <img src={photoData} width={219} height={219} style={{ borderRadius: 110 }} alt="" />
              : <span style={{ fontSize: 81, fontWeight: 900, color: '#1b5e20' }}>{playerName.charAt(0).toUpperCase()}</span>
            }
          </div>
        </div>
      </div>
    )

    // ── Grid (glassy cells, black text) ───────────────────────────
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
                    background: cell.active ? 'rgba(254,249,238,0.52)' : 'rgba(245,245,240,0.38)',
                    borderRadius: 24, padding: '18px 6px',
                    border: cell.active ? '2px solid rgba(46,125,50,0.45)' : '2px solid rgba(224,224,224,0.35)',
                  }}>
                    <span style={{ color: cell.active ? '#444' : 'rgba(160,160,160,0.7)', fontSize: 24, fontWeight: 700 }}>{cell.label}</span>
                    <span style={{ color: cell.active ? '#111' : 'rgba(200,200,200,0.7)', fontSize: 39, fontWeight: 900, marginTop: 6 }}>{cell.time}</span>
                  </div>
                )
              )}
            </div>
          ))}
        </div>
      )
    }

    // ── Watermark (full card, behind everything) ──────────────────
    const watermarkEl = cardBkData ? (
      <img src={cardBkData} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'contain', opacity: 0.1 }} alt="" />
    ) : null

    // ── DAILY CARD ────────────────────────────────────────────────
    if (type === 'daily') {
      const day         = s('day', '1')
      const totalDays   = s('totalDays', '1')
      const date        = s('date', '')
      const pigeonCount = Math.max(1, parseInt(s('pigeonCount', '1')) || 1)
      const timesRaw    = s('times')
      const rawTimes    = timesRaw ? timesRaw.split(',') : []
      while (rawTimes.length < pigeonCount) rawTimes.push('')

      const cells  = rawTimes.slice(0, pigeonCount).map((t, i) => ({ i, label: `#${i + 1}`, time: t || '--', active: !!(t && t !== '--') }))
      const cols   = pigeonCount <= 6 ? 3 : pigeonCount <= 12 ? 4 : 5
      const nRows  = Math.ceil(pigeonCount / cols)
      const height = Math.min(Math.max(1500, 870 + (medal ? 108 : 0) + nRows * 216), 2250)

      return new ImageResponse(
        (
          <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', fontFamily: 'sans-serif', background: 'linear-gradient(160deg,#e8f5e9,#f9fdf9,#e8f5e9)', position: 'relative' }}>
            {watermarkEl}
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

    // ── OVERALL CARD ──────────────────────────────────────────────
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
          {watermarkEl}
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
