# Resonant Track Management

A React + Supabase track operations app for browsing a music catalog, viewing DSP delivery details, updating workflow status, and securely submitting tracks to multiple DSPs.

The UI works immediately with representative demo data when Supabase environment variables are absent. Protected writes are disabled in demo mode.

## What is included

- Track list with artist, genre, release date, status, and status filtering
- Track detail with full metadata and per-DSP distribution state
- Authenticated create-artist and create-track forms
- Passwordless Supabase Auth sign-in
- Authenticated status updates protected by owner-scoped RLS
- Authenticated `distribute-track` Edge Function with input, ownership, state, and DSP validation
- Versioned schema, explicit RLS policies, constraints, indexes, and realistic seed data
- Typed client operations for artists, tracks, filters, detail, status updates, and distribution
- Demo-fallback data and focused data-access tests

## Prerequisites

- Node.js 20 or newer
- Docker Desktop (for local Supabase)
- [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started)

## Run locally against hosted Supabase (no Docker)

Create `.env.local` with the URL and publishable key from the project's **Connect** dialog:

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_your-key
```

In **Authentication → URL Configuration**, set the Site URL to `http://localhost:5173` and add `http://localhost:5173/**` to Redirect URLs. Then run:

```bash
npm install
npm run dev
```

## Run the complete Supabase stack locally

```bash
npm install
cp .env.example .env.local
supabase start
supabase db reset
```

After `supabase start`, copy the printed API URL and anon key into `.env.local`:

```dotenv
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=your-local-anon-key
```

Serve the Edge Function in a second terminal; Supabase provides its standard local secrets automatically:

```bash
supabase functions serve distribute-track
```

Then start the app:

```bash
npm run dev
```

Open the local URL printed by Vite. Without `.env.local`, the app intentionally opens in read-only demo mode.

## Apply migrations and seed data

Local development uses one repeatable command:

```bash
supabase db reset
```

That applies every file in `supabase/migrations/` and then runs `supabase/seed.sql`.

For a linked hosted project:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push --include-seed
supabase secrets set ALLOWED_ORIGINS=http://localhost:5173
supabase functions deploy distribute-track
```

Set the same hosted project URL and publishable key in the front-end environment. The existing `VITE_SUPABASE_ANON_KEY` variable name accepts the new `sb_publishable_...` key. Do not place a secret or service-role key in a `VITE_` variable or any browser-accessible file. Supabase injects server secrets into the deployed Edge Function environment.

## Authentication and protected operations

Use **Sign in** in the header, enter an email, and follow the magic link. Once signed in, the session JWT is automatically attached by `@supabase/supabase-js` to status updates and Edge Function calls.

To obtain a token for manual API testing, create a test user in Supabase Auth, then request a password grant:

```bash
curl -s "$SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"manager@example.com","password":"your-test-password"}'
```

Copy `access_token` from the response, then call the protected function:

```bash
curl -i "$SUPABASE_URL/functions/v1/distribute-track" \
  -H "apikey: $SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"track_id":"30000000-0000-4000-8000-000000000002","dsp_ids":["20000000-0000-4000-8000-000000000001"]}'
```

Seed tracks are read-only examples because they have no owner. Sign in and use **+ Artist** and **+ Track** to create an owned release, then exercise protected status and distribution operations on that track.

## Security model

- RLS is enabled on all four tables.
- Catalog reads are public and operation-specific, with public column grants excluding artist emails and owner UUIDs. Artist/track writes require an authenticated owner.
- There are no client write policies for DSPs or distribution records.
- The Edge Function verifies the JWT with `auth.getUser()` even though gateway JWT verification is also enabled.
- The service-role key exists only inside the Edge Function environment.
- Database constraints enforce required values, valid statuses, foreign keys, a unique ISRC, unique track/DSP pairs, and ISRC format.
- A distributed track cannot be resubmitted; inactive or unknown DSPs and unowned tracks are rejected.
- Distribution records and the track status update commit atomically in a locked PostgreSQL function.
- Status changes use a protected RPC that enforces forward-only transitions and requires a live DSP before marking a track distributed.

## Client operations

`src/lib/tracks.ts` exports:

- `createArtist`, `listArtists`
- `createTrack`, `listTracks` with `artistId`, `genre`, and `status` filters
- `getTrack` with joined artist and DSP distribution data
- `updateTrackStatus`
- `distributeTrack` through the Edge Function

## Quality checks

```bash
npm test
npm run build
```

## Project structure

```text
src/                         React UI and Supabase data layer
supabase/migrations/         Versioned PostgreSQL schema and RLS
supabase/functions/          Authenticated Deno Edge Function
supabase/seed.sql            3 artists, 8 tracks, 3 DSPs, distributions
DECISIONS.md                 AI-use and security review notes
```

## Submission checklist

1. Project: [github.com/MoYehiair/track-management-app](https://github.com/MoYehiair/track-management-app)
2. Create a Google Drive document named `FIRSTNAME_SECONDNAME_FULLSTACKDEVELOPER`.
3. Add `01_Project link`, `02_How to run the project`, and `03_Vibe coding challenge` links.
4. In the Supabase dashboard, invite `Mohamed.raafat@takwene.com` to the project with only the access level needed for review.

Those final steps require the submitter's GitHub, Google, and Supabase accounts and are intentionally not automated by this repository.
