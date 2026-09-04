import { describe, expect, it, vi } from 'vitest'

vi.mock('./supabase', () => ({ supabase: null }))

import { getTrack, listTracks, listTracksPage } from './tracks'

describe('track data access demo fallback', () => {
  it('filters tracks by status', async () => {
    const tracks = await listTracks('draft')
    expect(tracks.length).toBeGreaterThan(0)
    expect(tracks.every((track) => track.status === 'draft')).toBe(true)
  })

  it('returns a track with joined artist and distribution data', async () => {
    const track = await getTrack('track-1')
    expect(track?.artist.name).toBe('Mira Vale')
    expect(track?.track_distributions?.[0].dsp.name).toBe('Spotify')
  })

  it('paginates tracks without changing newest-release-first order', async () => {
    const first = await listTracksPage('all', 1, 3)
    const second = await listTracksPage('all', 2, 3)

    expect(first.tracks).toHaveLength(3)
    expect(first.count).toBeGreaterThan(first.tracks.length)
    expect(first.tracks[0].release_date >= first.tracks[1].release_date).toBe(true)
    expect(second.tracks[0].id).not.toBe(first.tracks[0].id)
  })
})
