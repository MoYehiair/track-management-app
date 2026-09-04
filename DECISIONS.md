# Implementation Decisions

## 1. What AI generated, and what I wrote or modified

AI was used heavily to generate and revise the project structure, React interface, Supabase migrations, seed data, Edge Function, tests, and documentation. I configured the hosted Supabase project, linked it to the repository, applied the migrations and seed data, deployed the Edge Function, configured the local environment, authorized GitHub access, and reviewed the running result. I also directed a second correctness and security review and chose to address its findings before submission.

The final implementation choices were deliberately constrained to the assignment. I kept the required two-view workflow, added create-artist and create-track forms so protected ownership flows can be tested, and retained a read-only demo fallback for easy review. The optional chatbot is implemented as a separate authenticated Edge Function so the model provider key and all database tools remain server-side.

## 2. Security issues found and how they were handled

The riskiest generated pattern was letting the browser insert directly into `track_distributions`. That would make multi-DSP submissions easy to tamper with and would bypass track-state validation. Distribution writes were moved behind a JWT-protected Edge Function. The function verifies the token with Supabase Auth, validates UUIDs and request size, checks ownership and current track state, validates active DSPs, and uses the service role only on the server.

I also checked for common Supabase failures:

- RLS is enabled on every table.
- Policies are operation-specific. Public catalog reads do not imply public writes.
- Artist and track mutations are scoped to `created_by = auth.uid()`; null-owned seed rows cannot be changed.
- DSP and distribution mutations have no client policies and their privileges are explicitly revoked.
- Public column grants exclude artist emails and owner UUIDs.
- No service-role key is present in front-end code or example environment files.
- PostgreSQL constraints provide a second validation layer for status values, required values, relationships, unique ISRCs, valid ISRC format, and duplicate DSP submissions.

Seeded tracks deliberately have no owner and are read-only. An evaluator signs in and creates an artist and track to test protected operations. In a production label, I would replace individual ownership with organization membership and role tables so authorized team members can manage the same catalog.

## 3. One thing AI got wrong and how it was fixed

The first generated approach modeled “distribute track” as separate database writes after Edge Function validation. That was wrong because the second write could fail after distribution rows had already committed. I replaced both writes with one locked, transactional PostgreSQL function invoked only by the authenticated Edge Function. The React client still calls only `supabase.functions.invoke('distribute-track', ...)` for that workflow.

It assumed that the logic doesn`t require a good styling since it says in PDF No design system required. Functional is enough.

## Additional engineering decisions

- Native PostgreSQL enums plus `CHECK` constraints make invalid states fail close to the data.
- The unique `(track_id, dsp_id)` constraint makes retries idempotent and prevents duplicate submissions.
- Both gateway JWT verification and explicit `auth.getUser()` validation are used for defense in depth.
- Status changes go through a protected RPC that enforces ownership, forward-only transitions, and distribution invariants.
- The UI remains usable without secrets by falling back to clearly marked demo data; protected writes fail with an explicit setup message.
- The interface uses semantic tables, buttons, labels, focusable controls, responsive layouts, and reduced-motion handling without bringing in a design system.

## Bonus chatbot and confirm-before-action flow

The catalog assistant uses the OpenAI Responses API with a small allowlist of Supabase-backed tools. It can search tracks, list artists and DSPs, fetch track details, and request distribution. The model never receives database credentials and cannot issue raw SQL. Unsupported mutations—such as deleting a track or changing artist metadata—have no tool, so the assistant must say it cannot perform them.

Example transcript:

> **User:** Distribute “Midnight Signal” to Spotify and Apple Music.
>
> **Assistant:** Submit “Midnight Signal” to Apple Music, Spotify and set its status to submitted. Should I go ahead?
>
> **User:** Yes, go ahead.
>
> **Assistant:** Done — “Midnight Signal” was submitted to Apple Music, Spotify. Its workflow status is now submitted.

To prevent destructive actions by mistake, the server intercepts every write tool call and performs no mutation until the user presses **Confirm**; the confirmation is a signed, user-bound token that expires after ten minutes, and the server rechecks authentication, ownership, track state, and DSP validity before the transactional RPC runs. There are no delete tools.
