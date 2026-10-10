import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';
import { captureDiagnostic } from '../src/lib/captureDiagnostics.ts';

function voiceHarness(failingStage) {
  const values = [];
  const warnings = [];
  const prepared = [];
  const constants = { exports: {} };
  const presetCode = ts.transpileModule(readFileSync(new URL('../node_modules/expo-audio/src/RecordingConstants.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('exports', presetCode)(constants.exports);
  const presets = constants.exports.RecordingPresets;
  const nativeError = new Error('Native recorder rejected format');
  const recorder = {
    uri: failingStage === 'recording-uri' ? null : 'file:///documents/ExpoAudio/recording-fixture.m4a',
    prepareToRecordAsync: async (options) => { prepared.push(options); if (failingStage === 'prepare') throw nativeError; },
    record: () => { if (failingStage === 'record-start') throw nativeError; },
    stop: async () => {},
  };
  const hooks = {
    useState: (initial) => { const index = values.length; values.push(initial); return [initial, (value) => { values[index] = value; }]; },
    useRef: (current) => ({ current }), useCallback: (fn) => fn, useEffect: (fn) => { fn(); },
  };
  const node = (type, props) => ({ type, props });
  const ui = Object.fromEntries(['ActivityIndicator','Modal','Pressable','ScrollView','Text','TextInput','View'].map((name) => [name, name]));
  const context = {
    getVoiceJob: () => null,
    startVoiceRecording: () => { if (failingStage === 'local-session') throw nativeError; return { id: 'test' }; },
    interruptVoiceRecording: () => {}, failVoiceFinalization: () => {}, reviewVoiceTranscript: () => {}, retryVoiceJob: () => {}, discardVoiceJob: () => {},
    queueVoiceRecording: () => {}, voicesEnabled: true,
  };
  const deps = {
    react: hooks, 'react/jsx-runtime': { jsx: node, jsxs: node, Fragment: 'Fragment' },
    'react-native': { ...ui, Alert: {}, AppState: { currentState: 'active', addEventListener: () => ({ remove: () => {} }) }, Linking: {}, Platform: { OS: 'ios' }, StyleSheet: { create: (styles) => styles } },
    'expo-audio': { AudioModule: { requestRecordingPermissionsAsync: async () => ({ granted: true }) }, RecordingPresets: presets,
      setAudioModeAsync: async (mode) => { if (failingStage === 'audio-session' && mode.allowsRecording) throw nativeError; },
      useAudioRecorder: () => recorder, useAudioRecorderState: () => ({ durationMillis: 0 }) },
    'expo-secure-store': { getItemAsync: async () => 'yes' }, 'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
    '../context/AppContext': { useApp: () => context }, '../components/ui': { PrimaryButton: 'PrimaryButton' }, './MealResultScreen': { MealResultScreen: 'MealResult' },
    '../lib/voiceFiles': { persistVoiceAudio: () => {}, removeVoiceAudio: () => {} }, '../lib/voice': { MAX_VOICE_SECONDS: 30 },
    '../lib/captureDiagnostics': { captureDiagnostic }, '../theme': { colors: {}, fonts: {}, gutter: 24 },
  };
  const source = readFileSync(new URL('../src/screens/VoiceScreen.tsx', import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, esModuleInterop: true } });
  const module = { exports: {} };
  new Function('require','module','exports','__DEV__','console',outputText)((name) => { assert.ok(name in deps, name); return deps[name]; }, module, module.exports, true, { warn: (...args) => warnings.push(args) });
  const tree = module.exports.VoiceScreen({ id: null, onClose: () => {}, onType: () => {} });
  let record;
  const visit = (value) => {
    if (Array.isArray(value)) return value.forEach(visit);
    if (!value || typeof value !== 'object') return;
    if (value.type === 'PrimaryButton' && value.props.label === 'Record') record = value.props.onPress;
    visit(value.props?.children);
  };
  visit(tree);
  return { record, values, warnings, prepared, presets };
}

test('voice startup passes the supported standard AAC preset to native preparation without custom codec overrides', async () => {
  const harness = voiceHarness(null);
  harness.record();
  await new Promise(setImmediate);
  assert.deepEqual(harness.prepared[0], { ...harness.presets.HIGH_QUALITY, directory: 'document' });
  assert.equal(harness.warnings.length, 0);
});

test('capture diagnostics identify the native stage without exposing recording paths', () => {
  const error = Object.assign(new Error('Failed at file:///private/var/mobile/private-recording.m4a and /Users/private/audio.m4a'), { code: 'ERR_AUDIO' });
  const info = captureDiagnostic('prepare', error);
  assert.equal(info.stage, 'prepare');
  assert.equal(info.code, 'ERR_AUDIO');
  assert.equal(info.detail.includes('private-recording'), false);
  assert.equal(info.detail.includes('/Users/private'), false);
});

test('actual voice Record action reports the failing startup boundary after granted permission', async () => {
  for (const stage of ['audio-session','prepare','recording-uri','local-session','record-start']) {
    const harness = voiceHarness(stage);
    harness.record();
    await new Promise(setImmediate);
    assert.ok(harness.values[2].includes(`(${stage})`));
    assert.equal(harness.warnings.length, 0);
  }
});
