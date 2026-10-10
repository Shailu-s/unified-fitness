# 007: Short, durable voice recordings feeding the existing meal pipeline

Date: 2026-10-10
Status: Implemented and isolated preview enabled; physical-device and speech-quality gates pending

## Decision and reasoning

The founder requests typing left, camera central, voice right, and explicitly approves OpenAI transcription/private audio within the existing US$1 total testing cap. This moves voice into the current nutrition phase rather than after GPS. Use SDK-57 expo-audio 57.0.5 (September 11 release, included in Expo Go), not a native-only speech-recognition package or keyboard-dictation placeholder. Record foreground-only AAC/M4A in app documents for up to 30 seconds, with native automatic stop and background/interruption handling. No background service, streaming, speaker labels, playback or new nutrition estimator.

Persist the recording session/URI in additive SQLite v4 before starting the microphone. Completed clips queue durably; an app killed mid-recording leaves an explicit interrupted record, not a fabricated successful transcript. Recover leases and bound transient retries to three attempts. Transcripts must be reviewed/editable before they become a text meal draft; that draft uses the same normalized local/shared nutrition cache, corrections and explicit Save as other inputs. Typed fallback may supersede an in-flight transcript; late results cannot overwrite it. Preserve capture date and create the linked meal atomically/idempotently. Share one coalesced guest-auth session across voice/nutrition to avoid identity races.

## Provider, privacy and costs

Pin gpt-4o-mini-transcribe-2025-12-15 on the server-only Audio Transcriptions endpoint. Nutrition remains gpt-5-mini-2025-08-07 Responses/store=false. Audio transcription does not accept the same store parameter; do not send an unsupported option or claim a zero-retention guarantee. First-use consent explains private processing, training opt-in and possible upstream abuse-monitoring retention. Secrets never enter mobile or Git.

Private meal-voice storage is owner-folder scoped, capped at 1 MB, audio/mp4 only. The authenticated endpoint derives owner/path, verifies bytes/container/duration/digest and rejects unknown request fields. Transcript tables and claim/finish/fail RPCs are service-only with RLS; clients cannot claim budgets or browse transcripts directly. Cache transcripts by owner, audio digest, pinned model and pipeline version, never across owners. Nutrition estimates may still use the existing shared text cache after review.

Use the existing nutrition_budgets row and daily request quota, not a second positive budget. Reserve $0.04 conservatively per uncached transcription, plus existing $0.01 for uncached text nutrition. Published model limits/rates (16k context, 2k output; $1.25/$5 per 1M audio tokens) motivate the margin; reservations are not invoice measurements. New months remain zero by default. Both MODEL_API_ENABLED and VOICE_PREVIEW_API_ENABLED are required; client EXPO_PUBLIC_VOICE_ENABLED defaults off and is enabled only in the ignored development override. Deploy only voice-transcribe-preview with JWT verification; existing text/photo deployment hashes remain unchanged.

Remove local audio after a durable transcript, reviewed typed fallback or confirmed discard, with retained cleanup references for retry. Remove remote uploads after processing/cache responses; prune old owner uploads on next voice sync. Inactivity/lost anonymous sessions prevent a fixed retention promise; a service-side orphan sweeper/account-deletion policy remains a public-pilot hardening gate. JSON export includes voice status/transcripts/references, not binary recordings.

## Evidence and remaining gates

107 automated tests cover SQLite reopen/interrupted capture, atomic review, leases/retries, stale-result protection, native crypto byte contracts, actual transport/worker source, cache/prompt boundaries and permissions. Fresh isolated Postgres tests cover owner isolation, service-only privileges, coalescing, pipeline-version isolation and a shared voice/text spending cap. Native config introspection confirms microphone permission with no background audio modes; regenerated native projects and bundles are not compiled device builds.

Two approved synthetic 1.216-second clips exercised real guest auth/private upload/transcription, same-ID retry, same-owner digest reuse and upload cleanup. Each run made one new reservation despite three requests. Initial output for synthetic “two roti and dal” was “Tu roti andel.” Food-vocabulary context improved it to “To roti and dal.” Recognition is not validated: neither synthetic result is exact, and Hindi/mixed-language microphone speech has not been tested. This is why transcript review is mandatory. A versioned indian-meal-v1 cache prevents new jobs reusing the earlier basic-prompt results while completed IDs keep their original result.

October ledger went from $0.07 to $0.15 reserved for these two tests; limit remains $1. No cap increase/renewal, new photo inference or accuracy claim. Founder must test microphone grant/denial, real English/Hindi/mixed speech, natural timeout, close/reopen, offline recovery, corrections and both physical platforms before sign-off.

## Device fixes and Done flow, 2026-10-10

Founder screenshot/diagnostic confirms iOS prepareToRecordAsync fails with the custom 16 kHz mono/64 kbps profile; the SDK HIGH_QUALITY AAC preset fixes startup on his iPhone without changing document recording or the native limit. Finalization then fails our ownership check: Expo Go's native recorder uses the host container ExpoAudio folder while modern Paths.document is experience-scoped. Permit only UUID-named native recorder assets beneath the same registered app container, plus existing project-owned recording paths. Known iOS /private/var aliases and URI encoding are normalized; traversal, unrelated containers/directories and URLs remain rejected.

Done replaces Stop. After native stop, validate audio and copy to project voice-recordings/<job-id>.m4a, then atomically persist the new URI/duration/queued state before removing the native source. Failure preserves the original reference and can retry finalization without recording again; do not label a file-validation failure as an interrupted capture. No new schema or backend needed. Remove duplicate typing from Voice; the main typing control remains. Existing transcripts remain editable before Review/Save. Temporary DEBUG logs are removed after founder reports “Words appear” on the retest; only concise stage-aware failures remain. That is a narrow iPhone start/Done/transcript checkpoint, not accuracy, full macro-save, offline, auto-stop or Android sign-off. 114 tests include actual native option pass-through, Go-shaped file handling/copying, failed-finalization recovery and ownership rejection cases.

Sources: https://docs.expo.dev/versions/v57.0.0/sdk/audio/ ; https://developers.openai.com/api/docs/models/gpt-4o-mini-transcribe ; https://developers.openai.com/api/docs/guides/speech-to-text .
