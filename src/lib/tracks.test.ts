import { describe, expect, it, vi } from 'vitest'

vi.mock('./supabase', () => ({ supabase: null }))

import { getTrack, listTracks } from './tracks'

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
})
