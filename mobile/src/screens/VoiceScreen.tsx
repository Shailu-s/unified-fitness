import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';
import * as SecureStore from 'expo-secure-store';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { PrimaryButton } from '../components/ui';
import { MealResultScreen } from './MealResultScreen';
import { voiceAudioData, removeVoiceAudio } from '../lib/voiceFiles';
import { MAX_VOICE_SECONDS } from '../lib/voice';
import { colors, fonts, gutter } from '../theme';

const options = { ...RecordingPresets.HIGH_QUALITY, directory: 'document' as const, sampleRate: 16000, numberOfChannels: 1, bitRate: 64000 };
const errors: Record<string, string> = {
  interrupted: 'Recording interrupted. Type or record again.',
  network: 'Offline · retrying',
  invalid_result: 'No clear transcript. Retry or type.',
  audio_invalid: 'Recording unavailable. Type instead.',
  budget_exceeded: 'Estimate limit reached. Type instead.',
  backend_not_configured: 'Transcription unavailable. Type instead.',
};

export function VoiceScreen({ id, onClose, onType }: { id: string | null; onClose: () => void; onType: () => void }) {
  const { getVoiceJob, startVoiceRecording, queueVoiceRecording, interruptVoiceRecording, reviewVoiceTranscript, retryVoiceJob, discardVoiceJob, voicesEnabled } = useApp();
  const [jobId, setJobId] = useState(id);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [resultId, setResultId] = useState<string | null>(null);
  const recordingId = useRef<string | null>(null);
  const locked = useRef(false);
  const alive = useRef(true);
  const dirty = useRef(false);
  const finishRef = useRef<() => Promise<void>>(async () => {});
  const recorder = useAudioRecorder(options, (status) => {
    if (status.isFinished && recordingId.current) void finishRef.current();
  });
  const state = useAudioRecorderState(recorder, 250);
  const insets = useSafeAreaInsets();
  const job = jobId ? getVoiceJob(jobId) : null;
  const recording = job?.state === 'recording';
  const pending = job?.state === 'queued' || job?.state === 'running';

  useEffect(() => {
    if (job?.transcript && !dirty.current) setText(job.transcript);
  }, [job?.transcript]);

  const finish = useCallback(async () => {
    if (!recordingId.current || locked.current) return;
    const current = recordingId.current;
    recordingId.current = null;
    locked.current = true;
    if (alive.current) setBusy(true);
    try {
      await recorder.stop();
      const saved = getVoiceJob(current);
      if (!saved.audioUri) throw new Error('Recording unavailable.');
      const audio = await voiceAudioData(saved.audioUri);
      queueVoiceRecording(current, audio.durationMs);
    } catch {
      interruptVoiceRecording(current);
      if (alive.current) setError('Recording unavailable. Type or record again.');
    } finally {
      await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
      locked.current = false;
      if (alive.current) setBusy(false);
    }
  }, [recorder, getVoiceJob, queueVoiceRecording, interruptVoiceRecording]);
  finishRef.current = finish;

  useEffect(() => {
    alive.current = true;
    const subscription = AppState.addEventListener('change', (value) => { if (value !== 'active') void finishRef.current(); });
    return () => {
      alive.current = false;
      subscription.remove();
      if (recordingId.current) interruptVoiceRecording(recordingId.current);
      void setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    };
  }, [interruptVoiceRecording]);

  const record = async () => {
    if (locked.current || Platform.OS === 'web') return;
    locked.current = true;
    setBusy(true); setError(null);
    let preparedUri: string | null = null;
    let createdId: string | null = null;
    try {
      if (await SecureStore.getItemAsync('voice-processing-consent-v1') !== 'yes') {
        const accepted = await new Promise<boolean>((resolve) => Alert.alert('Voice transcription',
          'Recordings are saved on this phone, then sent privately to OpenAI for transcription. Avoid personal information. API training is opt-in; abuse-monitoring retention may apply. Local audio is removed after transcription, review or discard; uploads after processing. Interrupted uploads are cleaned on next sync.',
          [{ text: 'Cancel', style: 'cancel', onPress: () => resolve(false) }, { text: 'Continue', onPress: () => resolve(true) }], { cancelable: true, onDismiss: () => resolve(false) }));
        if (!accepted) return;
        await SecureStore.setItemAsync('voice-processing-consent-v1', 'yes');
      }
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) { setDenied(true); setError('Microphone access denied.'); return; }
      setDenied(false);
      if (!alive.current || AppState.currentState !== 'active') return;
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true, shouldPlayInBackground: false });
      await recorder.prepareToRecordAsync(options);
      if (!recorder.uri) throw new Error('Recording unavailable.');
      preparedUri = recorder.uri;
      if (!alive.current || AppState.currentState !== 'active') throw new Error('Recording cancelled.');
      const saved = startVoiceRecording(recorder.uri);
      createdId = saved.id;
      recordingId.current = saved.id;
      setJobId(saved.id);
      dirty.current = false; setText('');
      recorder.record({ forDuration: MAX_VOICE_SECONDS });
    } catch {
      if (createdId) { interruptVoiceRecording(createdId); recordingId.current = null; }
      await recorder.stop().catch(() => {});
      if (!createdId && preparedUri) { try { removeVoiceAudio(preparedUri); } catch {} }
      await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
      if (alive.current) setError('Recording unavailable. Try again or type.');
    } finally { locked.current = false; if (alive.current) setBusy(false); }
  };
  const close = async () => { if (locked.current) return; await finish(); onClose(); };
  const review = () => {
    if (!jobId) return;
    try { setResultId(reviewVoiceTranscript(jobId, text).id); }
    catch { setError('Check your meal text and retry.'); }
  };
  const discard = () => Alert.alert('Discard recording?', 'Removes this voice draft and audio.', [
    { text: 'Cancel', style: 'cancel' }, { text: 'Discard', style: 'destructive', onPress: () => {
      if (!jobId) return;
      try { discardVoiceJob(jobId); onClose(); } catch { setError('Could not discard. Try again.'); }
    } },
  ]);

  return <Modal visible animationType="slide" onRequestClose={() => { void close(); }}>
    {resultId ? <MealResultScreen id={resultId} onClose={onClose} embedded /> : <View style={[s.root, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
      <View style={s.header}>
        <Text style={s.title}>Voice</Text>
        <Pressable onPress={() => { void close(); }} disabled={busy} accessibilityRole="button"><Text style={s.action}>Later</Text></Pressable>
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.body}>
        {(!job || recording || job.errorCode === 'interrupted') && <View style={s.capture}>
          <Text style={s.timer}>{recording ? `${Math.min(MAX_VOICE_SECONDS, Math.floor(state.durationMillis / 1000))}s` : '30s max'}</Text>
          <PrimaryButton label={recording ? 'Stop' : 'Record'} disabled={busy} onPress={() => { void (recording ? finish() : record()); }} />
        </View>}
        {pending && <View style={s.status}>
          {voicesEnabled && <ActivityIndicator color={colors.protein} />}
          <Text style={s.help}>{!voicesEnabled ? 'Saved · waiting for setup' : job?.errorCode === 'network' ? 'Offline · retrying' : 'Transcribing…'}</Text>
        </View>}
        {job && !recording && <TextInput value={text} onChangeText={(value) => { dirty.current = true; setText(value); }}
          multiline maxLength={500} placeholder="Meal · or type instead" accessibilityLabel="Meal transcript" style={s.input} placeholderTextColor={colors.inkLow} />}
        {job?.state === 'failed' && <Text accessibilityRole="alert" style={s.help}>{errors[job.errorCode ?? 'network'] ?? 'Transcription failed. Type instead.'}</Text>}
        {error && <Text accessibilityRole="alert" style={s.help}>{error}</Text>}
        {denied && <Pressable onPress={() => { void Linking.openSettings(); }} accessibilityRole="button" style={s.button}><Text style={s.action}>Settings</Text></Pressable>}
        {!job && <Pressable onPress={onType} disabled={busy} accessibilityRole="button" style={s.button}><Text style={s.action}>Type instead</Text></Pressable>}
        {job?.state === 'failed' && job.audioUri && job.durationMs && <Pressable onPress={() => retryVoiceJob(job.id)} accessibilityRole="button" style={s.button}><Text style={s.action}>Retry</Text></Pressable>}
      </ScrollView>
      {job && !recording && <View style={s.footer}>
        <PrimaryButton label="Review" onPress={review} disabled={!text.trim() || busy} />
        <Pressable onPress={discard} accessibilityRole="button" style={s.button}><Text style={s.action}>Discard</Text></Pressable>
      </View>}
    </View>}
  </Modal>;
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  header: { paddingHorizontal: gutter, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 20 },
  title: { fontFamily: fonts.uiSemi, fontSize: 20, color: colors.ink },
  action: { fontFamily: fonts.uiMedium, fontSize: 14, color: colors.protein },
  body: { paddingHorizontal: gutter, gap: 16, paddingBottom: 24 },
  capture: { paddingVertical: 32, gap: 24 },
  timer: { textAlign: 'center', fontFamily: fonts.monoBold, fontSize: 32, color: colors.ink },
  status: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  help: { fontFamily: fonts.ui, fontSize: 13, color: colors.inkMid },
  input: { minHeight: 120, borderWidth: 1, borderColor: colors.rule, borderRadius: 12, padding: 14, textAlignVertical: 'top', fontFamily: fonts.ui, fontSize: 16, color: colors.ink, backgroundColor: colors.card },
  button: { paddingVertical: 16, alignItems: 'center' },
  footer: { paddingHorizontal: gutter },
});
