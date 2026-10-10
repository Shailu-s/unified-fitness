import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as SecureStore from 'expo-secure-store';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { pickMealPhoto, prepareMealPhoto, removeLocalPhoto } from '../lib/photoFiles';
import { MealResultScreen } from './MealResultScreen';
import { fonts, gutter } from '../theme';

export function CameraScreen({ onClose }: { onClose: () => void }) {
  const { addPhotoDraft } = useApp();
  const [permission, requestPermission, getPermission] = useCameraPermissions();
  const camera = useRef<CameraView | null>(null);
  const alive = useRef(true);
  const locked = useRef(false);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [resultId, setResultId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const insets = useSafeAreaInsets();
  const cameraActive = permission?.granted && foreground && !picking && !resultId;

  useEffect(() => {
    alive.current = true;
    void requestPermission().catch(() => { if (alive.current) setError('Camera unavailable. Use Gallery.'); });
    const subscription = AppState.addEventListener('change', (value) => {
      setForeground(value === 'active');
      if (value === 'active') void getPermission().catch(() => {});
    });
    return () => { alive.current = false; subscription.remove(); };
  }, [requestPermission, getPermission]);
  useEffect(() => { if (!cameraActive) setReady(false); }, [cameraActive]);

  const consent = async () => {
    if (await SecureStore.getItemAsync('photo-processing-consent-v1') === 'yes') return true;
    const accepted = await new Promise<boolean>((resolve) => Alert.alert('Approximate photo estimates',
      'Food photos are saved privately on this phone, then sent via private storage to OpenAI for an estimate. Avoid faces or personal information. Uploads are removed after processing; interrupted uploads are removed on next sync. OpenAI API training is opt-in, but abuse-monitoring retention may apply. Photos cannot reveal hidden oil or exact portions.',
      [{ text: 'Cancel', style: 'cancel', onPress: () => resolve(false) }, { text: 'Continue', onPress: () => resolve(true) }], { cancelable: true, onDismiss: () => resolve(false) }));
    if (accepted) await SecureStore.setItemAsync('photo-processing-consent-v1', 'yes');
    return accepted;
  };
  const photo = async (source: 'camera' | 'gallery') => {
    if (locked.current || (source === 'camera' && !ready)) return;
    locked.current = true;
    setBusy(true); setError(null);
    let owned: string | null = null;
    try {
      if (!alive.current) return;
      if (source === 'gallery') {
        setPicking(true);
        owned = await pickMealPhoto('gallery');
      } else {
        const shot = await camera.current?.takePictureAsync({ quality: 1, exif: false, skipProcessing: false });
        if (!shot) throw new Error('Camera unavailable.');
        owned = await prepareMealPhoto(shot);
      }
      if (!owned) return;
      if (!alive.current || !await consent() || !alive.current) { removeLocalPhoto(owned); owned = null; return; }
      const meal = addPhotoDraft({ name: '', portion: '', kcal: null, protein: null, fibre: null, inputType: 'photo', photoUri: owned });
      owned = null;
      setResultId(meal.id);
    } catch {
      if (owned) { try { removeLocalPhoto(owned); } catch {} }
      if (alive.current) setError('Photo not saved. Try again.');
    } finally {
      locked.current = false;
      if (alive.current) { setBusy(false); setPicking(false); }
    }
  };
  const close = () => { if (!locked.current) onClose(); };

  return <Modal visible animationType="slide" onRequestClose={close}>
    {resultId ? <MealResultScreen id={resultId} onClose={onClose} embedded /> : <View style={s.root}>
      {cameraActive && <CameraView ref={camera} style={s.preview} facing="back" mode="picture"
        onCameraReady={() => setReady(true)} onMountError={() => { setReady(false); setError('Camera unavailable. Use Gallery.'); }} />}
      <Pressable onPress={close} disabled={busy} accessibilityRole="button" style={[s.close, { top: insets.top + 16 }]}><Text style={s.text}>Close</Text></Pressable>
      {(!permission?.granted || error) && <View style={s.message}>
        <Text style={s.text}>{error ?? 'Allow camera access, or use Gallery.'}</Text>
        {!permission?.granted && <Pressable onPress={() => { void (permission?.canAskAgain ? requestPermission() : Linking.openSettings()); }} accessibilityRole="button" style={s.permission}>
          <Text style={s.text}>{permission?.canAskAgain ? 'Allow camera' : 'Settings'}</Text>
        </Pressable>}
      </View>}
      <View style={[s.controls, { paddingBottom: insets.bottom + 24 }]}>
        <View style={s.side} />
        <Pressable onPress={() => { void photo('camera'); }} disabled={!ready || busy} accessibilityRole="button"
          accessibilityLabel="Take meal photo" accessibilityState={{ disabled: !ready || busy }} style={[s.shutter, (!ready || busy) && s.disabled]}>
          {busy ? <ActivityIndicator color="#ffffff" /> : <View style={s.shutterInner} />}
        </Pressable>
        <Pressable onPress={() => { void photo('gallery'); }} disabled={busy} accessibilityRole="button" accessibilityLabel="Choose meal photo from gallery" style={s.gallery}>
          <Text style={s.text}>Gallery</Text>
        </Pressable>
      </View>
    </View>}
  </Modal>;
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000000' },
  preview: { flex: 1 },
  text: { fontFamily: fonts.uiMedium, fontSize: 14, color: '#ffffff' },
  close: { position: 'absolute', left: gutter, padding: 12, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.5)' },
  message: { position: 'absolute', top: '40%', left: gutter, right: gutter, alignItems: 'center', gap: 16 },
  permission: { padding: 14 },
  controls: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingTop: 20, paddingHorizontal: gutter, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(0,0,0,0.4)' },
  side: { width: 64 },
  gallery: { width: 64, alignItems: 'center', paddingVertical: 20 },
  shutter: { width: 72, height: 72, borderRadius: 36, borderWidth: 3, borderColor: '#ffffff', alignItems: 'center', justifyContent: 'center' },
  shutterInner: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#ffffff' },
  disabled: { opacity: 0.45 },
});
