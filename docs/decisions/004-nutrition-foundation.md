# 004: Durable nutrition work before remote model calls

Date: 2026-10-05
Status: Local foundation implemented; Supabase integration/live model use pending

## Context

Founder selects Supabase and requires complete text plus photo nutrition before rings/GPS. The app already has real local records that cannot be reset during the change. Shared server cache and model calls are still absent; fabricating sample estimates in the app would undermine trust.

## Decision

Use additive SQLite schema version 2: retain the original meals table/IDs/timestamps/manual nutrition and add carbs/fat, input type, local photo reference, and revision. Store derived estimates in a separate table joined only when their revision matches. No destructive table rebuild, dropped table, log truncation, or remote reset is needed. Legacy missing carbs/fat remain unknown, never synthesized as zero.

Persist each unknown meal and its queued job in one transaction before acknowledging the write. Backfill unknown legacy meals into jobs once without enforcing new input-length rules retroactively. Jobs have unique meal/revision identity, durable states, retry delay, and expiring worker leases with random tokens. Completion must match the current job token, meal revision, and non-manual source. Editing food/portion invalidates old jobs; corrections cannot be overwritten by late results.

Cache validated generic estimates by a conservative, versioned normalized name/portion/locale key. Preserve quantities and punctuation rather than collapsing different portions together. Check cache both when saving and when claiming already queued duplicate inputs. Manual values never populate generic cache. Photo captions are not valid image cache keys: photo jobs retain a private local reference and do not reuse a text estimate solely because the caption matches. Bump cache version when provider/prompt/schema semantics change.

Validate structured results and strip extra fields. Preserve explicit assumptions and model provenance. Text editing through the real editor must not silently convert unchanged model values to manual overrides; only actual numeric corrections do so. New logs have no separate custom-nutrition entry path; existing entered values and future estimates retain correction access.

## Boundaries

This slice implements local data/queue/cache and macro/status UI only. There is no active worker, no paid model call, no Supabase deployment or authentication, and no photo capture/upload yet. Queued meals display their pending state. Photo file copying, metadata removal, uploads, ownership checks, recognition, and media export/retention belong to subsequent nutrition slices. A stored photo URI test is not proof of physical media persistence.

Supabase is the approved backend: shared Postgres cache/jobs, private Storage, authenticated bounded TypeScript/Deno functions. Owner provided project URL; a publishable client key, deployment access, model/provider secrets and explicit spending approval are still required. The mobile template contains only the public URL and an empty publishable-key field; privileged/model secrets remain server-side. Dotenv files are ignored. No existing dotenv content was read or committed.

## Verification

Real SQLite tests cover version-one migration, transactional rollback/retry, legacy descriptions, atomic save/queue, reopen, normalized cache hits/quantity separation, queued duplicate consumption, stale worker rejection, manual correction precedence, editor-input integration, retry and photo input separation. Additional static native/config tests do not establish device behavior. Founder must reload the existing iPhone project and confirm migrated logs, queued writes, corrections, history and persistence before manual sign-off.
