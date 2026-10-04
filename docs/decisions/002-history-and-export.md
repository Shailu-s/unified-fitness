# 002: Calendar history and local data export

Date: 2026-10-05
Status: Accepted for slice 1.2

## Context

Durable logging exists, but users cannot browse older meals or take their records out of the app. History must not replace Today's data or retroactively apply today's calculated targets to previous days. Founder does not want a separate manual-nutrition feature; this slice does not expand it.

## Decision

Keep Today state in the existing provider. A separate modal queries saved meals by their authoritative local logging day, with previous/next calendar-day navigation, a Today shortcut, and shortcuts to populated days. Historical corrections preserve the original day and identity; their returned persisted record updates history UI without a post-save read that could misreport a successful write as failed.

Export a versioned, readable JSON document containing the persisted profile and every persisted meal, including original IDs, day keys, timestamps, nullable nutrition, and corrections. Snapshot queries run together in a local read transaction. No server, model, seeded meals, demo activity, or current computed targets enter the export. This is export, not import/restore.

Use the SDK-compatible expo-file-system 57.0.7 (published 2026-09-11) and expo-sharing 57.0.22 (2026-09-24), pinned directly. The founder explicitly starts export, sees its data scope, then chooses Save to Files or another destination in the OS share sheet. Cancellation does not alter source records. Test serialization and share orchestration through injected platform ports; use real SQLite for snapshot/history tests.

## Tradeoffs and verification

JSON preserves full record structure and nulls without CSV quoting/formula ambiguities. It is less spreadsheet-friendly; CSV is not needed for the first export slice. Export includes sensitive profile and meal information, so no payloads are logged and nothing is automatically uploaded. A unique file is created in the app's private cache; the OS can reclaim it. Do not delete it immediately when the share promise resolves, because recipients may still be reading it. A user-saved copy is outside app control.

Current small snapshots and cache writes are synchronous; very large histories will need bounded/asynchronous export work. Calendar shifts use local noon and calendar-day arithmetic, not UTC parsing or 24-hour offsets. Full native share-sheet, local Files save, cancel/retry, and offline behavior still require founder/device feedback on both platforms. No schema migration or existing-log reset is needed.
