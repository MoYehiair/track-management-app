import type { Dsp, Track } from './types'

export const demoDsps: Dsp[] = [
  { id: 'dsp-spotify', name: 'Spotify' },
  { id: 'dsp-apple', name: 'Apple Music' },
  { id: 'dsp-youtube', name: 'YouTube Music' },
]

export const demoTracks: Track[] = [
  {
    id: 'track-1',
    title: 'Neon Weather',
    artist_id: 'artist-1',
    isrc: 'GBAYE2400001',
    release_date: '2026-09-18',
    genre: 'Electronic',
    status: 'submitted',
    artist: { id: 'artist-1', name: 'Mira Vale', country: 'United Kingdom' },
    track_distributions: [
      { id: 'dist-1', dsp_id: 'dsp-spotify', submitted_at: '2026-08-28T10:30:00Z', status: 'live', dsp: demoDsps[0] },
      { id: 'dist-2', dsp_id: 'dsp-apple', submitted_at: '2026-08-28T10:30:00Z', status: 'pending', dsp: demoDsps[1] },
    ],
  },
  {
    id: 'track-2',
    title: 'Blue Hour Radio',
    artist_id: 'artist-2',
    isrc: 'USRC12600002',
    release_date: '2026-10-02',
    genre: 'Alternative',
    status: 'draft',
    artist: { id: 'artist-2', name: 'Static Gardens', country: 'United States' },
    track_distributions: [],
  },
  {
    id: 'track-3',
    title: 'Soft Landing',
    artist_id: 'artist-3',
    isrc: 'EGAAA2600003',
    release_date: '2026-07-11',
    genre: 'R&B',
    status: 'distributed',
    artist: { id: 'artist-3', name: 'Nour Elsen', country: 'Egypt' },
    track_distributions: demoDsps.map((dsp, index) => ({
      id: `dist-3-${index}`,
      dsp_id: dsp.id,
      submitted_at: '2026-07-01T09:00:00Z',
      status: 'live' as const,
      dsp,
    })),
  },
  {
    id: 'track-4',
    title: 'Paper Satellites',
    artist_id: 'artist-1',
    isrc: 'GBAYE2400004',
    release_date: '2026-11-06',
    genre: 'Pop',
    status: 'draft',
    artist: { id: 'artist-1', name: 'Mira Vale', country: 'United Kingdom' },
    track_distributions: [],
  },
  {
    id: 'track-5',
    title: 'Afterimage',
    artist_id: 'artist-2',
    isrc: 'USRC12600005',
    release_date: '2026-08-14',
    genre: 'Indie Rock',
    status: 'submitted',
    artist: { id: 'artist-2', name: 'Static Gardens', country: 'United States' },
    track_distributions: [
      { id: 'dist-5', dsp_id: 'dsp-youtube', submitted_at: '2026-08-04T15:20:00Z', status: 'rejected', dsp: demoDsps[2] },
    ],
  },
]
