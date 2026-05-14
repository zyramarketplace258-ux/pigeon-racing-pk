import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'

export const runtime = 'edge'

const W = 1170  // 390 × 3 — high-res render
const S = 3     // scale factor

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

    const type       = s('type', 'daily')
    const tournament = safe(s('tournament', 'Tournament'), 'Tournament')
    const club       = safe(s('club', 'Club'), 'Club')
    const player     = safe(s('player', ''), safe(s('playerUrdu', ''), 'Player'))
    const area       = safe(s('area', ''), safe(s('areaUrdu', ''), ''))
    const rank       = parseInt(s('rank', '0')) || 0
    const score      = s('score', '')
    const photoUrl   = s('photoUrl')
    const photoData  = photoUrl ? await fetchPhoto(photoUrl) : null
    const medal      = getMedal(rank)
    const ringColor  = getRankRing(rank)

    // ── Header ───────────────────────────────────────────────────
    const headerEl = (rightContent: React.ReactNode) => (
      <div style={{ display: 'flex', flexDirection: 'column', background: 'linear-gradient(135deg,#1a4a1f,#2e7d32)', padding: `${36}px ${48}px ${30}px` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <span style={{ fontSize: 78 }}>🕊️</span>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ color: 'white', fontSize: 45, fontWeight: 900 }}>{club}</span>
              <span style={{ color: '#a5d6a7', fontSize: 21, letterSpacing: 6 }}>RACING FEDERATION</span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            {rightContent}
          </div>
        </div>
        <div style={{ display: 'flex', marginTop: 24 }}>
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.18)', borderRadius: 60, padding: `${6}px ${30}px`, border: '3px solid rgba(255,255,255,0.3)' }}>
            <span style={{ color: 'white', fontSize: 27, fontWeight: 600 }}>{tournament}</span>
          </div>
        </div>
      </div>
    )

    // ── Rank banner (top 3 only) ──────────────────────────────────
    const rankBannerEl = medal ? (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24, background: getRankGradient(rank), padding: `${24}px 0` }}>
        <span style={{ fontSize: 60 }}>{medal}</span>
        <span style={{ color: 'white', fontSize: 39, fontWeight: 900, letterSpacing: 6 }}>{getRankLabel(rank)}</span>
      </div>
    ) : null

    // ── Profile ──────────────────────────────────────────────────
    const profileEl = (scoreLabel: string) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 36, margin: `${30}px ${36}px`, background: 'white', borderRadius: 42, padding: `${36}px ${42}px`, border: '3px solid #e0e0e0' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', border: '6px solid #c8e6c9', borderRadius: 30, padding: `${18}px ${36}px`, background: '#f1fbf1', flexShrink: 0 }}>
          <span style={{ color: '#888', fontSize: 21, letterSpacing: 6, fontWeight: 700 }}>{scoreLabel}</span>
          <span style={{ color: '#1b5e20', fontSize: score ? 72 : 45, fontWeight: 900, lineHeight: 1, marginTop: 9 }}>{score || '--:--'}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, alignItems: 'center' }}>
          <span style={{ color: '#111', fontSize: 48, fontWeight: 800, textAlign: 'center' }}>{player}</span>
          {area ? <span style={{ color: '#4caf50', fontSize: 33, marginTop: 9 }}>{area}</span> : null}
          {!medal && rank > 0 ? (
            <div style={{ display: 'flex', background: '#388e3c', borderRadius: 60, padding: `${6}px ${30}px`, marginTop: 15 }}>
              <span style={{ color: 'white', fontSize: 30, fontWeight: 800 }}>#{rank}</span>
            </div>
          ) : null}
        </div>
        <div style={{ display: 'flex', flexShrink: 0 }}>
          <div style={{ display: 'flex', width: 234, height: 234, borderRadius: 117, border: `${9}px solid ${ringColor}`, background: '#e8f5e9', alignItems: 'center', justifyContent: 'center' }}>
            {photoData
              ? <img src={photoData} width={234} height={234} style={{ borderRadius: 117 }} alt="" />
              : <span style={{ fontSize: 84, fontWeight: 900, color: '#1b5e20' }}>{player.charAt(0).toUpperCase()}</span>
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
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, margin: `${12}px ${36}px 0`, gap: 18 }}>
          {rows.map((row, ri) => (
            <div key={ri} style={{ display: 'flex', gap: 18, flex: 1 }}>
              {row.map((cell, ci) => cell.i === -1
                ? <div key={ci} style={{ flex: 1, display: 'flex' }} />
                : (
                  <div key={cell.i} style={{
                    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    background: cell.active ? '#2e7d32' : '#f0f0f0',
                    borderRadius: 24, padding: `${18}px ${6}px`,
                  }}>
                    <span style={{ color: cell.active ? 'rgba(255,255,255,0.65)' : '#c0c0c0', fontSize: 24, fontWeight: 700 }}>{cell.label}</span>
                    <span style={{ color: cell.active ? 'white' : '#d0d0d0', fontSize: 39, fontWeight: 900, marginTop: 6 }}>{cell.time}</span>
                  </div>
                )
              )}
            </div>
          ))}
        </div>
      )
    }

    // ── Footer ───────────────────────────────────────────────────
    const footerEl = (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: `${24}px ${48}px ${30}px` }}>
        <span style={{ color: 'rgba(27,94,32,0.3)', fontSize: 27, fontWeight: 700, letterSpacing: 9 }}>PAKISTAN PIGEON RACING</span>
      </div>
    )

    // ── DAILY CARD ───────────────────────────────────────────────
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
      const height = Math.min(Math.max(480 * S, (250 + (medal ? 36 : 0) + nRows * 72) * S), 720 * S)

      return new ImageResponse(
        (
          <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', fontFamily: 'sans-serif', background: 'linear-gradient(160deg,#e8f5e9,#f9fdf9,#e8f5e9)' }}>
            {headerEl(
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 9 }}>
                <span style={{ color: 'white', fontSize: 39, fontWeight: 800 }}>{`DAY ${day} / ${totalDays}`}</span>
                {date ? <span style={{ color: '#c8e6c9', fontSize: 30 }}>{date}</span> : null}
              </div>
            )}
            {rankBannerEl}
            {profileEl('DAY TOTAL')}
            {gridEl(cells, cols)}
            {footerEl}
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
    const height   = Math.min(Math.max(450 * S, (230 + (medal ? 36 : 0) + dayRows * 72) * S), 690 * S)

    return new ImageResponse(
      (
        <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', fontFamily: 'sans-serif', background: 'linear-gradient(160deg,#e8f5e9,#f9fdf9,#e8f5e9)' }}>
          {headerEl(
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 9 }}>
              <span style={{ color: 'white', fontSize: 36, fontWeight: 700 }}>OVERALL RESULT</span>
              <span style={{ color: '#a5d6a7', fontSize: 27, marginTop: 6 }}>{`${totalDays} DAY${totalDays > 1 ? 'S' : ''}`}</span>
            </div>
          )}
          {rankBannerEl}
          {profileEl('TOTAL TIME')}
          {gridEl(dayCells, dayCols)}
          {footerEl}
        </div>
      ),
      { width: W, height }
    )

  } catch (err) {
    return new Response(`Card error: ${err}`, { status: 500, headers: { 'content-type': 'text/plain' } })
  }
}
