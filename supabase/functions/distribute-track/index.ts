import { createClient } from 'jsr:@supabase/supabase-js@2'

const allowedOrigins = new Set(
  (Deno.env.get('ALLOWED_ORIGINS') ?? 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
)

const corsHeaders = (origin: string | null) => ({
  'Access-Control-Allow-Origin': origin && allowedOrigins.has(origin) ? origin : 'null',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Vary': 'Origin',
})

const json = (body: unknown, status = 200, origin: string | null = null) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
})

const isUuid = (value: unknown): value is string =>
  typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)

Deno.serve(async (request) => {
  const origin = request.headers.get('Origin')
  if (origin && !allowedOrigins.has(origin)) return json({ error: 'Origin is not allowed.' }, 403, origin)
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(origin) })
  if (request.method !== 'POST') return json({ error: 'Method not allowed. Use POST.' }, 405, origin)

  const authorization = request.headers.get('Authorization')
  if (!authorization?.startsWith('Bearer ')) return json({ error: 'Authentication required.' }, 401, origin)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return json({ error: 'Server configuration is incomplete.' }, 500, origin)

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  })
  const { data: { user }, error: userError } = await userClient.auth.getUser()
  if (userError || !user) return json({ error: 'The access token is invalid or expired.' }, 401, origin)

  let input: { track_id?: unknown; dsp_ids?: unknown }
  try {
    input = await request.json()
  } catch {
    return json({ error: 'Request body must be valid JSON.' }, 400, origin)
  }

  if (!isUuid(input.track_id)) return json({ error: 'track_id must be a valid UUID.' }, 422, origin)
  if (!Array.isArray(input.dsp_ids) || input.dsp_ids.length < 1 || input.dsp_ids.length > 20) {
    return json({ error: 'dsp_ids must contain between 1 and 20 DSP UUIDs.' }, 422, origin)
  }
  if (!input.dsp_ids.every(isUuid)) return json({ error: 'Every dsp_ids item must be a valid UUID.' }, 422, origin)
  const dspIds = [...new Set(input.dsp_ids as string[])]

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } })
  const { data: distributions, error: distributionError } = await admin.rpc('submit_track_distributions', {
    p_track_id: input.track_id,
    p_dsp_ids: dspIds,
    p_user_id: user.id,
  })

  if (distributionError) {
    const knownErrors: Record<string, { status: number; message: string }> = {
      TRACK_NOT_FOUND: { status: 404, message: 'Track not found.' },
      TRACK_NOT_OWNED: { status: 403, message: 'You do not manage this track.' },
      TRACK_ALREADY_DISTRIBUTED: { status: 409, message: 'A fully distributed track cannot be submitted again.' },
      DSP_NOT_FOUND_OR_INACTIVE: { status: 422, message: 'One or more DSPs do not exist or are inactive.' },
    }
    const mapped = knownErrors[distributionError.message]
    return json({ error: mapped?.message ?? 'Distribution could not be completed.' }, mapped?.status ?? 500, origin)
  }

  return json({ track_id: input.track_id, status: 'submitted', distributions }, 201, origin)
})
