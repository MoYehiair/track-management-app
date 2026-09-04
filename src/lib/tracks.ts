import { demoDsps, demoTracks } from '../demo-data'
import type { Artist, Dsp, Track, TrackStatus } from '../types'
import { supabase } from './supabase'

const trackSelect = `
  id, title, artist_id, isrc, release_date, genre, status,
  artist:artists!tracks_artist_id_fkey(id, name, country),
  track_distributions(
    id, dsp_id, submitted_at, status,
    dsp:dsps!track_distributions_dsp_id_fkey(id, name)
  )
`

export interface TrackFilters {
  status?: TrackStatus | 'all'
  artistId?: string
  genre?: string
}

export async function listTracks(statusOrFilters: TrackStatus | 'all' | TrackFilters = 'all'): Promise<Track[]> {
  const filters = typeof statusOrFilters === 'string' ? { status: statusOrFilters } : statusOrFilters
  if (!supabase) return demoTracks.filter((track) =>
    (!filters.status || filters.status === 'all' || track.status === filters.status) &&
    (!filters.artistId || track.artist_id === filters.artistId) &&
    (!filters.genre || track.genre === filters.genre),
  )

  let query = supabase.from('tracks').select(trackSelect).order('release_date', { ascending: false })
  if (filters.status && filters.status !== 'all') query = query.eq('status', filters.status)
  if (filters.artistId) query = query.eq('artist_id', filters.artistId)
  if (filters.genre) query = query.eq('genre', filters.genre)

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as unknown as Track[]
}

export async function listArtists(): Promise<Artist[]> {
  if (!supabase) {
    return [...new Map(demoTracks.map((track) => [track.artist.id, {
      ...track.artist,
      email: '',
    }])).values()] as Artist[]
  }
  const { data, error } = await supabase.from('artists').select('id, name, email, country').order('name')
  if (error) throw error
  return data
}

export async function createArtist(input: Pick<Artist, 'name' | 'email' | 'country'>): Promise<Artist> {
  if (!supabase) throw new Error('Connect Supabase to create an artist.')
  const { data, error } = await supabase.from('artists').insert(input).select('id, name, email, country').single()
  if (error) throw error
  return data
}

export async function createTrack(input: Pick<Track, 'title' | 'artist_id' | 'isrc' | 'release_date' | 'genre'>): Promise<Track> {
  if (!supabase) throw new Error('Connect Supabase to create a track.')
  const { data, error } = await supabase.from('tracks').insert(input).select(trackSelect).single()
  if (error) throw error
  return data as unknown as Track
}

export async function getTrack(id: string): Promise<Track | null> {
  if (!supabase) return demoTracks.find((track) => track.id === id) ?? null

  const { data, error } = await supabase.from('tracks').select(trackSelect).eq('id', id).maybeSingle()
  if (error) throw error
  return data as unknown as Track | null
}

export async function listDsps(): Promise<Dsp[]> {
  if (!supabase) return demoDsps
  const { data, error } = await supabase.from('dsps').select('id, name').order('name')
  if (error) throw error
  return data
}

export async function distributeTrack(trackId: string, dspIds: string[]) {
  if (!supabase) throw new Error('Connect Supabase to perform protected write operations.')
  const { data, error } = await supabase.functions.invoke('distribute-track', {
    body: { track_id: trackId, dsp_ids: dspIds },
  })
  if (error) throw error
  return data
}

export async function updateTrackStatus(trackId: string, status: TrackStatus): Promise<void> {
  if (!supabase) throw new Error('Connect Supabase to update a track status.')
  const { error } = await supabase.from('tracks').update({ status }).eq('id', trackId)
  if (error) throw error
}
