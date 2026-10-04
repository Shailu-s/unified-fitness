# 003: Local native builds before GPS and health work

Date: 2026-10-05
Status: Build setup accepted; native compilation/device installation blocked on toolchain access

## Context

Expo Go preview and local meal persistence work on the founder's iPhone. GPS background behavior and health adapters require our own native app, not a sandbox preview. Founder has no paid Apple Developer membership. This Mac has Command Line Tools, not full Xcode; Android device SDK tools are not available either.

## Decision

Prepare SDK-compatible expo-dev-client 57.0.19 (published 2026-09-11) and separate preview/development-build commands. Keep Expo Go explicitly selectable so current manual testing continues. Preview uses port 8082; native development server uses 8083, avoiding the unrelated Docker service on 8081.

Prebuild flagged the missing Android light-mode helper; include SDK-compatible expo-system-ui 57.0.4 (published 2026-09-11). Block legacy external-storage read/write permissions in app config: local SQLite, private-cache exports, and OS sharing do not need broad access to user storage. Retain existing application identifiers pending actual device-signing checks; do not silently claim ownership or rename them.

Use Expo continuous native generation: app config and dependencies remain source of truth; generated mobile/ios and mobile/android trees are ignored. Pin the SDK-57 native template to expo-template-bare-minimum 57.0.26 (published 2026-09-18), rather than a newly published tag. Generation uses --no-install, --no-clean, and preserves React/React Native versions. Do not delete existing native directories or overwrite native edits with a clean rebuild without explicit confirmation.

First iPhone route is local Xcode compilation and Personal Team signing with the founder's Apple Account, not EAS/TestFlight enrollment or an unapproved paid subscription. Apple documents seven-day provisioning expiry and limits on app/device counts for free teams. Paid membership is still needed for TestFlight/store distribution and advanced capabilities; capability support must be checked before HealthKit or other entitlements are promised.

## Verification and limitations

Native project generation and JavaScript bundles can be checked here without signing. They are not compiled native binaries. Actual iOS compilation requires full compatible Xcode, platform components, first-launch/license setup, trusted USB device, Developer Mode where required, and signing in Xcode. The founder handles Apple credentials locally. Android needs Android Studio/SDK/JDK and a device or emulator. Keep both platform build/install gates visible even when first test device is iPhone.

Expo Go and the standalone app have different OS sandboxes. Preview records remain in Expo Go; they do not automatically migrate to the new app. Export remains available; import/restore is not implemented. Debug development-client launch can still require Metro; use a separately installed Release test build for full airplane-mode cold-start verification.

After a native baseline runs on both platforms, implement durable GPS sessions (start/pause/resume/finish) and route recording, then validate locked-screen/background behavior on physical iPhone and Xiaomi/Realme. No live GPS or health support is claimed by this setup slice.
