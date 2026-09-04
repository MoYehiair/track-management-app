import { useEffect, useMemo, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { createArtist, createTrack, distributeTrack, getTrack, listArtists, listDsps, listTracks, updateTrackStatus } from './lib/tracks'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import type { Artist, Dsp, Track, TrackStatus } from './types'

const filters: Array<{ label: string; value: TrackStatus | 'all' }> = [
  { label: 'All tracks', value: 'all' },
  { label: 'Draft', value: 'draft' },
  { label: 'Submitted', value: 'submitted' },
  { label: 'Distributed', value: 'distributed' },
]

const formatDate = (date: string) =>
  new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${date}T00:00:00`))

function StatusPill({ status }: { status: string }) {
  return <span className={`status status--${status}`}>{status}</span>
}

function App() {
  const [status, setStatus] = useState<TrackStatus | 'all'>('all')
  const [tracks, setTracks] = useState<Track[]>([])
  const [selected, setSelected] = useState<Track | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [session, setSession] = useState<Session | null>(null)
  const [showSignIn, setShowSignIn] = useState(false)
  const [showNewArtist, setShowNewArtist] = useState(false)
  const [showNewTrack, setShowNewTrack] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    supabase?.auth.getSession().then(({ data }) => setSession(data.session))
    const listener = supabase?.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession))
    return () => listener?.data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    let active = true
    setLoading(true)
    setError('')
    listTracks(status)
      .then((data) => active && setTracks(data))
      .catch((reason: Error) => active && setError(reason.message))
      .finally(() => active && setLoading(false))
    return () => { active = false }
  }, [status, reloadKey])

  async function openTrack(id: string) {
    setError('')
    try {
      const track = await getTrack(id)
      setSelected(track)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not load track details.')
    }
  }

  const counts = useMemo(() => ({
    total: tracks.length,
    ready: tracks.filter((track) => track.status === 'distributed').length,
  }), [tracks])

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" type="button" onClick={() => setSelected(null)} aria-label="Go to all tracks">
          <span className="brand__mark" aria-hidden="true"><i /><i /><i /></span>
          <span>RESONANT</span>
        </button>
        <div className="topbar__actions">
          {!isSupabaseConfigured && <span className="demo-badge">Demo data</span>}
          {session ? (
            <button className="text-button" type="button" onClick={() => supabase?.auth.signOut()}>Sign out</button>
          ) : (
            <button className="text-button" type="button" onClick={() => setShowSignIn(true)}>Sign in</button>
          )}
          <div className="avatar" aria-hidden="true">RM</div>
        </div>
      </header>

      <main>
        {selected ? (
          <TrackDetail track={selected} session={session} onBack={() => setSelected(null)} onChanged={() => openTrack(selected.id)} onRequireSignIn={() => setShowSignIn(true)} />
        ) : (
          <section className="track-list" aria-labelledby="page-title">
            <div className="page-heading">
              <div>
                <p className="eyebrow">CATALOG / RELEASES</p>
                <h1 id="page-title">Track library</h1>
                <p className="lede">Review releases and follow every handoff from draft to DSP.</p>
              </div>
              <div className="summary" aria-label="Current results summary">
                <span><strong>{String(counts.total).padStart(2, '0')}</strong> shown</span>
                <span><strong>{String(counts.ready).padStart(2, '0')}</strong> live</span>
              </div>
            </div>

            <div className="filter-row" aria-label="Filter tracks by status">
              {filters.map((filter) => (
                <button
                  className={status === filter.value ? 'filter filter--active' : 'filter'}
                  type="button"
                  key={filter.value}
                  onClick={() => setStatus(filter.value)}
                >
                  {filter.label}
                </button>
              ))}
              <span className="filter-row__spacer" />
              <button className="secondary-button" type="button" onClick={() => session ? setShowNewArtist(true) : setShowSignIn(true)}>+ Artist</button>
              <button className="primary-button primary-button--compact" type="button" onClick={() => session ? setShowNewTrack(true) : setShowSignIn(true)}>+ Track</button>
            </div>

            {error && <div className="notice notice--error" role="alert">{error}</div>}
            {loading ? (
              <div className="loading-grid" aria-label="Loading tracks"><i /><i /><i /></div>
            ) : tracks.length === 0 ? (
              <div className="empty-state"><h2>No tracks here</h2><p>Try a different status filter.</p></div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Track</th><th>Artist</th><th>Genre</th><th>Release</th><th>Status</th><th><span className="sr-only">Open</span></th></tr></thead>
                  <tbody>
                    {tracks.map((track, index) => (
                      <tr key={track.id} onClick={() => openTrack(track.id)}>
                        <td><span className="track-number">{String(index + 1).padStart(2, '0')}</span><strong>{track.title}</strong><small>{track.isrc}</small></td>
                        <td>{track.artist.name}</td>
                        <td>{track.genre}</td>
                        <td>{formatDate(track.release_date)}</td>
                        <td><StatusPill status={track.status} /></td>
                        <td><button className="row-button" type="button" onClick={(event) => { event.stopPropagation(); openTrack(track.id) }} aria-label={`Open ${track.title}`}>↗</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}
      </main>
      <footer><span>RESONANT / TRACK OPERATIONS</span><span>SUPABASE + REACT</span></footer>
      {showSignIn && <SignInDialog onClose={() => setShowSignIn(false)} />}
      {showNewArtist && <NewArtistDialog onClose={() => setShowNewArtist(false)} onComplete={() => { setShowNewArtist(false); setShowNewTrack(true) }} />}
      {showNewTrack && <NewTrackDialog onClose={() => setShowNewTrack(false)} onComplete={(track) => { setShowNewTrack(false); setReloadKey((key) => key + 1); setSelected(track) }} />}
    </div>
  )
}

function TrackDetail({ track, session, onBack, onChanged, onRequireSignIn }: {
  track: Track
  session: Session | null
  onBack: () => void
  onChanged: () => void
  onRequireSignIn: () => void
}) {
  const [showDistribute, setShowDistribute] = useState(false)
  const [statusError, setStatusError] = useState('')
  const [statusSaving, setStatusSaving] = useState(false)
  const distributions = track.track_distributions ?? []

  async function changeStatus(nextStatus: TrackStatus) {
    if (!session) return onRequireSignIn()
    setStatusSaving(true)
    setStatusError('')
    try {
      await updateTrackStatus(track.id, nextStatus)
      onChanged()
    } catch (reason) {
      setStatusError(reason instanceof Error ? reason.message : 'Could not update status.')
    } finally {
      setStatusSaving(false)
    }
  }

  return (
    <section className="detail" aria-labelledby="detail-title">
      <button className="back-button" type="button" onClick={onBack}>← All tracks</button>
      <div className="detail-hero">
        <div>
          <p className="eyebrow">{track.artist.name} / {track.genre}</p>
          <h1 id="detail-title">{track.title}</h1>
        </div>
        <StatusPill status={track.status} />
      </div>

      <div className="detail-grid">
        <article className="metadata-card">
          <h2>Release information</h2>
          <dl>
            <div><dt>Artist</dt><dd>{track.artist.name}</dd></div>
            <div><dt>Country</dt><dd>{track.artist.country}</dd></div>
            <div><dt>ISRC</dt><dd className="mono">{track.isrc}</dd></div>
            <div><dt>Release date</dt><dd>{formatDate(track.release_date)}</dd></div>
            <div><dt>Genre</dt><dd>{track.genre}</dd></div>
            <div><dt>Workflow status</dt><dd><select aria-label="Track workflow status" value={track.status} disabled={statusSaving} onChange={(event) => changeStatus(event.target.value as TrackStatus)}><option value="draft">Draft</option><option value="submitted">Submitted</option><option value="distributed">Distributed</option></select></dd></div>
          </dl>
          {statusError && <div className="notice notice--error" role="alert">{statusError}</div>}
        </article>

        <article className="distribution-card">
          <div className="card-heading">
            <div><p className="eyebrow">DELIVERY STATUS</p><h2>Distribution</h2></div>
            <button className="primary-button" type="button" disabled={track.status === 'distributed'} onClick={() => session ? setShowDistribute(true) : onRequireSignIn()}>
              Distribute track
            </button>
          </div>
          {distributions.length ? (
            <ul className="distribution-list">
              {distributions.map((item) => (
                <li key={item.id}>
                  <span className="dsp-icon" aria-hidden="true">{item.dsp.name.charAt(0)}</span>
                  <span><strong>{item.dsp.name}</strong><small>Submitted {new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(item.submitted_at))}</small></span>
                  <StatusPill status={item.status} />
                </li>
              ))}
            </ul>
          ) : <div className="empty-distribution"><span>◎</span><p>Not sent to any DSP yet.</p></div>}
        </article>
      </div>
      {showDistribute && <DistributeDialog track={track} onClose={() => setShowDistribute(false)} onComplete={() => { setShowDistribute(false); onChanged() }} />}
    </section>
  )
}

function DistributeDialog({ track, onClose, onComplete }: { track: Track; onClose: () => void; onComplete: () => void }) {
  const [dsps, setDsps] = useState<Dsp[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { listDsps().then(setDsps).catch((reason: Error) => setError(reason.message)) }, [])

  async function submit() {
    if (!selectedIds.length) return setError('Choose at least one DSP.')
    setSubmitting(true)
    setError('')
    try {
      await distributeTrack(track.id, selectedIds)
      onComplete()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Distribution failed.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="distribute-title">
        <button className="dialog-close" type="button" onClick={onClose} aria-label="Close">×</button>
        <p className="eyebrow">PROTECTED ACTION</p>
        <h2 id="distribute-title">Distribute “{track.title}”</h2>
        <p>Select the services that should receive this release. Existing submissions will not be duplicated.</p>
        <div className="dsp-options">
          {dsps.map((dsp) => (
            <label key={dsp.id}>
              <input type="checkbox" checked={selectedIds.includes(dsp.id)} onChange={() => setSelectedIds((current) => current.includes(dsp.id) ? current.filter((id) => id !== dsp.id) : [...current, dsp.id])} />
              <span>{dsp.name}</span>
            </label>
          ))}
        </div>
        {error && <div className="notice notice--error" role="alert">{error}</div>}
        <div className="dialog-actions"><button className="text-button" type="button" onClick={onClose}>Cancel</button><button className="primary-button" type="button" disabled={submitting} onClick={submit}>{submitting ? 'Submitting…' : 'Confirm distribution'}</button></div>
      </div>
    </div>
  )
}

function SignInDialog({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function signIn(event: React.FormEvent) {
    event.preventDefault()
    if (!supabase) return setError('Add your Supabase URL and anon key to .env first.')
    const { error: authError } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } })
    if (authError) setError(authError.message)
    else { setError(''); setMessage('Check your inbox for the secure sign-in link.') }
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="dialog dialog--small" role="dialog" aria-modal="true" aria-labelledby="signin-title">
        <button className="dialog-close" type="button" onClick={onClose} aria-label="Close">×</button>
        <p className="eyebrow">TEAM ACCESS</p><h2 id="signin-title">Sign in</h2>
        <p>We’ll email you a password-free sign-in link.</p>
        <form onSubmit={signIn}>
          <label className="field"><span>Work email</span><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@label.com" /></label>
          {error && <div className="notice notice--error" role="alert">{error}</div>}
          {message && <div className="notice notice--success" role="status">{message}</div>}
          <button className="primary-button primary-button--full" type="submit">Send sign-in link</button>
        </form>
      </div>
    </div>
  )
}

function NewArtistDialog({ onClose, onComplete }: { onClose: () => void; onComplete: () => void }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [country, setCountry] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      await createArtist({ name: name.trim(), email: email.trim(), country: country.trim() })
      onComplete()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not create artist.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="dialog dialog--small" role="dialog" aria-modal="true" aria-labelledby="new-artist-title">
        <button className="dialog-close" type="button" onClick={onClose} aria-label="Close">×</button>
        <p className="eyebrow">CATALOG ENTRY</p><h2 id="new-artist-title">Add an artist</h2>
        <form onSubmit={submit}>
          <label className="field"><span>Artist name</span><input required minLength={1} maxLength={120} value={name} onChange={(event) => setName(event.target.value)} /></label>
          <label className="field"><span>Email</span><input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <label className="field"><span>Country</span><input required minLength={2} maxLength={80} value={country} onChange={(event) => setCountry(event.target.value)} /></label>
          {error && <div className="notice notice--error" role="alert">{error}</div>}
          <div className="dialog-actions"><button className="text-button" type="button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save and add track'}</button></div>
        </form>
      </div>
    </div>
  )
}

function NewTrackDialog({ onClose, onComplete }: { onClose: () => void; onComplete: (track: Track) => void }) {
  const [artists, setArtists] = useState<Artist[]>([])
  const [title, setTitle] = useState('')
  const [artistId, setArtistId] = useState('')
  const [isrc, setIsrc] = useState('')
  const [releaseDate, setReleaseDate] = useState('')
  const [genre, setGenre] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    listArtists()
      .then((data) => { setArtists(data); if (data[0]) setArtistId(data[0].id) })
      .catch((reason: Error) => setError(reason.message))
  }, [])

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const track = await createTrack({
        title: title.trim(), artist_id: artistId, isrc: isrc.trim().toUpperCase(),
        release_date: releaseDate, genre: genre.trim(),
      })
      onComplete(track)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not create track.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="new-track-title">
        <button className="dialog-close" type="button" onClick={onClose} aria-label="Close">×</button>
        <p className="eyebrow">NEW RELEASE</p><h2 id="new-track-title">Add a track</h2>
        <form className="form-grid" onSubmit={submit}>
          <label className="field field--wide"><span>Title</span><input required maxLength={200} value={title} onChange={(event) => setTitle(event.target.value)} /></label>
          <label className="field field--wide"><span>Artist</span><select required value={artistId} onChange={(event) => setArtistId(event.target.value)}><option value="" disabled>Select an artist</option>{artists.map((artist) => <option key={artist.id} value={artist.id}>{artist.name}</option>)}</select></label>
          <label className="field"><span>ISRC</span><input required pattern="[A-Za-z]{2}[A-Za-z0-9]{3}[0-9]{7}" maxLength={12} value={isrc} onChange={(event) => setIsrc(event.target.value)} placeholder="USRC12600001" /></label>
          <label className="field"><span>Release date</span><input required type="date" value={releaseDate} onChange={(event) => setReleaseDate(event.target.value)} /></label>
          <label className="field field--wide"><span>Genre</span><input required maxLength={80} value={genre} onChange={(event) => setGenre(event.target.value)} /></label>
          {error && <div className="notice notice--error field--wide" role="alert">{error}</div>}
          <div className="dialog-actions field--wide"><button className="text-button" type="button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit" disabled={saving || !artistId}>{saving ? 'Saving…' : 'Create track'}</button></div>
        </form>
      </div>
    </div>
  )
}

export default App
