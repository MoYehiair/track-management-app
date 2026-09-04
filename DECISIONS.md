# Implementation Decisions

## 1. What AI generated, and what I wrote or modified

AI was used heavily to generate the initial project structure, React interface, Supabase migration, seed data, Edge Function, tests, and documentation. I reviewed the generated result as one system rather than accepting isolated snippets: the data model and foreign-key names were aligned with the Supabase joins, the client behavior was checked against the RLS policies, and the authentication flow was connected to protected writes.

The final implementation choices were deliberately constrained to the assignment. I kept the required two-view workflow, added a read-only demo fallback for easy review, and did not include the optional chatbot because a trustworthy tool-calling implementation would require an additional model provider, server-side secret management, and more evaluation than the core task permits.

## 2. Security issues found and how they were handled

The riskiest generated pattern was letting the browser insert directly into `track_distributions`. That would make multi-DSP submissions easy to tamper with and would bypass track-state validation. Distribution writes were moved behind a JWT-protected Edge Function. The function verifies the token with Supabase Auth, validates UUIDs and request size, checks ownership and current track state, validates active DSPs, and uses the service role only on the server.

I also checked for common Supabase failures:

- RLS is enabled on every table.
- Policies are operation-specific. Public catalog reads do not imply public writes.
- Artist and track mutations are scoped to `created_by = auth.uid()`.
- DSP and distribution mutations have no client policies and their privileges are explicitly revoked.
- No service-role key is present in front-end code or example environment files.
- PostgreSQL constraints provide a second validation layer for status values, required values, relationships, unique ISRCs, valid ISRC format, and duplicate DSP submissions.

One intentional evaluation tradeoff is that seeded tracks have no owner, allowing any authenticated evaluator to test the protected distribution operation. User-created tracks are owner-scoped. In a production label, I would replace that exception with organization membership and role tables, and require membership for every write.

## 3. One thing AI got wrong and how it was fixed

The first generated approach modeled “distribute track” as a series of client-side inserts followed by a track update. That was wrong because the assignment explicitly requires a Supabase Edge Function and because a client could partially submit, skip validation, or forge statuses. I replaced it with one authenticated server-side entry point and removed client write access to `track_distributions`. The React client now calls only `supabase.functions.invoke('distribute-track', ...)` for that workflow.

## Additional engineering decisions

- Native PostgreSQL enums plus `CHECK` constraints make invalid states fail close to the data.
- The unique `(track_id, dsp_id)` constraint makes retries idempotent and prevents duplicate submissions.
- Both gateway JWT verification and explicit `auth.getUser()` validation are used for defense in depth.
- The UI remains usable without secrets by falling back to clearly marked demo data; protected writes fail with an explicit setup message.
- The interface uses semantic tables, buttons, labels, focusable controls, responsive layouts, and reduced-motion handling without bringing in a design system.
