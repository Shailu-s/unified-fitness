# 001: Local-first logging foundation

Date: 2026-10-05
Status: Accepted for implementation of slice 1.1

## Context

The existing Expo/React Native/TypeScript scaffold stores all writes in React state. App restart loses profile and food logs. Network-based storage violates the agreed offline-first requirement. Food text must be saved even before estimation exists.

## Decision

Continue the existing stack. Add the SDK-compatible expo-sqlite 57.0.3, pinned exactly (published 2026-09-11). Keep database operations behind a small repository so React screens do not contain SQL. Use a versioned schema, WAL, full synchronous durability, bound parameters, stable random 128-bit record IDs, and synchronous small local writes before updating UI state.

Persist meal description, portion, nullable nutrition, nutrition status, creation/update timestamps, and the local calendar day at logging. Unknown nutrition is pending, not zero. Manual nutrition is optional and must be complete, finite, and nonnegative. Corrections retain record identity and original logging day. Do not seed demo food records into the real database.

Test the repository against real SQLite using Node's built-in node:sqlite and node:test, without an additional test framework. Mobile runtime still uses expo-sqlite. Automated SQLite reopen tests prove repository persistence, not device force-stop behavior; verify the latter on physical iOS and Android devices.

## Tradeoffs

Small synchronous writes avoid an acknowledged log waiting on an async effect; large imports/exports should use async/batched operations later to avoid blocking UI. JSON profile storage is adequate for one local profile; meals use queryable columns and a date index. Native health/GPS will require development builds, not reliance on Expo Go alone.

LLM jobs, cache, sync outbox, account boundaries, and encrypted-at-rest requirements need explicit follow-on migrations/decisions. No model calls or curated food estimates are introduced in this slice. Phone OS sandbox protection is not equivalent to application-level database encryption.
