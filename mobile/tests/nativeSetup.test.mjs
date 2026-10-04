import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const ignore = readFileSync(new URL('../../.gitignore', import.meta.url), 'utf8');
const config = JSON.parse(readFileSync(new URL('../app.json', import.meta.url), 'utf8')).expo;

test('Expo Go remains an explicit preview option after installing dev client', () => {
  assert.match(pkg.scripts.start, /expo start --go/);
  assert.match(pkg.scripts['start:dev'], /expo start --dev-client/);
  assert.equal(pkg.dependencies['expo-dev-client'], '57.0.19');
});

test('both platforms have device-build commands, separate from the Expo Go preview server', () => {
  assert.match(pkg.scripts['ios:device'], /expo run:ios --device --port 8083/);
  assert.match(pkg.scripts['android:device'], /expo run:android --device --port 8083/);
});

test('native config supports light mode without legacy external-storage access', () => {
  assert.equal(config.userInterfaceStyle, 'light');
  assert.equal(pkg.dependencies['expo-system-ui'], '57.0.4');
  for (const permission of ['android.permission.READ_EXTERNAL_STORAGE', 'android.permission.WRITE_EXTERNAL_STORAGE']) {
    assert.ok(config.android.blockedPermissions.includes(permission));
  }
});

test('native generation does not delete existing projects or silently upgrade React', () => {
  assert.match(pkg.scripts['native:generate'], /expo prebuild --no-install --no-clean/);
  assert.match(pkg.scripts['native:generate'], /--skip-dependency-update react,react-native/);
  assert.equal(pkg.scripts['native:generate'].includes(' --clean'), false);
  assert.ok(ignore.includes('/mobile/ios/'));
  assert.ok(ignore.includes('/mobile/android/'));
});
