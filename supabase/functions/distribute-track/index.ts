import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
})

const isUuid = (value: unknown): value is string =>
  typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Method not allowed. Use POST.' }, 405)

  const authorization = request.headers.get('Authorization')
  if (!authorization?.startsWith('Bearer ')) return json({ error: 'Authentication required.' }, 401)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return json({ error: 'Server configuration is incomplete.' }, 500)

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  })
  const { data: { user }, error: userError } = await userClient.auth.getUser()
  if (userError || !user) return json({ error: 'The access token is invalid or expired.' }, 401)

  let input: { track_id?: unknown; dsp_ids?: unknown }
  try {
    input = await request.json()
  } catch {
    return json({ error: 'Request body must be valid JSON.' }, 400)
  }

  if (!isUuid(input.track_id)) return json({ error: 'track_id must be a valid UUID.' }, 422)
  if (!Array.isArray(input.dsp_ids) || input.dsp_ids.length < 1 || input.dsp_ids.length > 20) {
    return json({ error: 'dsp_ids must contain between 1 and 20 DSP UUIDs.' }, 422)
  }
  if (!input.dsp_ids.every(isUuid)) return json({ error: 'Every dsp_ids item must be a valid UUID.' }, 422)
  const dspIds = [...new Set(input.dsp_ids as string[])]

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
  const { data: track, error: trackError } = await admin
    .from('tracks')
    .select('id, status, created_by')
    .eq('id', input.track_id)
    .maybeSingle()

  if (trackError) return json({ error: 'Could not validate the track.' }, 500)
  if (!track) return json({ error: 'Track not found.' }, 404)
  if (track.created_by && track.created_by !== user.id) return json({ error: 'You do not manage this track.' }, 403)
  if (track.status === 'distributed') return json({ error: 'A fully distributed track cannot be submitted again.' }, 409)

  const { data: activeDsps, error: dspError } = await admin.from('dsps').select('id').in('id', dspIds).eq('is_active', true)
  if (dspError) return json({ error: 'Could not validate DSPs.' }, 500)
  if (activeDsps.length !== dspIds.length) return json({ error: 'One or more DSPs do not exist or are inactive.' }, 422)

  const rows = dspIds.map((dspId) => ({ track_id: track.id, dsp_id: dspId, status: 'pending' }))
  const { data: distributions, error: distributionError } = await admin
    .from('track_distributions')
    .upsert(rows, { onConflict: 'track_id,dsp_id', ignoreDuplicates: true })
    .select('id, dsp_id, status, submitted_at')

  if (distributionError) return json({ error: 'Distribution records could not be created.' }, 500)

  const { error: updateError } = await admin.from('tracks').update({ status: 'submitted' }).eq('id', track.id)
  if (updateError) return json({ error: 'DSP submissions were saved, but the track status could not be updated.' }, 500)

  return json({ track_id: track.id, status: 'submitted', distributions }, 201)
})
