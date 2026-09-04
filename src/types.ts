export type TrackStatus = 'draft' | 'submitted' | 'distributed'
export type DistributionStatus = 'pending' | 'live' | 'rejected'

export interface Artist {
  id: string
  name: string
  email: string
  country: string
}

export interface Distribution {
  id: string
  dsp_id: string
  submitted_at: string
  status: DistributionStatus
  dsp: { id: string; name: string }
}

export interface Track {
  id: string
  title: string
  artist_id: string
  isrc: string
  release_date: string
  genre: string
  status: TrackStatus
  artist: Pick<Artist, 'id' | 'name' | 'country'>
  track_distributions?: Distribution[]
}

export interface Dsp {
  id: string
  name: string
}
