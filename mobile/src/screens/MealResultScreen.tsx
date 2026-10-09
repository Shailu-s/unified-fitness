import { useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { MealEditor } from '../components/MealEditor';
import { colors, fonts, gutter } from '../theme';
import { num } from '../lib/format';
import { removeLocalPhoto } from '../lib/photoFiles';
import { PrimaryButton } from '../components/ui';
import type { SavedMeal } from '../types';

const errors: Record<string, string> = {
  not_food: 'No food detected. Try another photo.',
  budget_exceeded: 'Estimate limit reached.',
  invalid_result: 'Estimate unavailable. Retry or edit.',
  photo_upload: 'Photo unavailable. Retry or choose another.',
  backend_not_configured: 'Estimates unavailable. Meal kept.',
  network: 'Connection failed. Retry when online.',
};

export function MealResultScreen({ id, onClose, embedded = false }: { id: string; onClose: () => void; embedded?: boolean }) {
  const { getMeal, retryEstimate, removePhoto, updateMeal, savePhotoDraft, discardPhotoDraft, photosEnabled } = useApp();
  const meal = getMeal(id);
  const insets = useSafeAreaInsets();
  const [editing, setEditing] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const pending = meal.nutritionStatus === 'pending';
  const waitingSetup = meal.inputType === 'photo' && !photosEnabled;
  const isDraft = meal.logState === 'draft';
  const loading = pending && meal.estimateState !== 'failed' && !waitingSetup;
  const status = waitingSetup ? 'Estimates unavailable' : meal.estimateState === 'failed' ? errors[meal.estimateError ?? 'network'] ?? errors.network :
    meal.estimateError === 'network' ? 'Offline · retrying' : meal.estimateState === 'running' ? 'Estimating…' : 'Queued';
  const save = () => {
    try { savePhotoDraft(id); onClose(); }
    catch { setLocalError('Not saved. Try again.'); }
  };
  const discard = () => Alert.alert('Discard draft?', 'Removes this draft and its photo.', [
    { text: 'Cancel', style: 'cancel' }, { text: 'Discard', style: 'destructive', onPress: () => {
      try { discardPhotoDraft(id); }
      catch { setLocalError('Not discarded. Try again.'); return; }
      try { if (meal.photoUri) removeLocalPhoto(meal.photoUri); }
      catch { Alert.alert('Draft discarded', 'Photo cleanup failed.'); }
      onClose();
    } },
  ]);
  if (meal.logState === 'discarded') return null;
  const remove = () => Alert.alert('Remove photo?', 'Meal and macros stay.', [
    { text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: () => {
      try { const uri = meal.photoUri; removePhoto(id); if (uri) removeLocalPhoto(uri); }
      catch { setLocalError('Photo not removed. Try again.'); }
    } },
  ]);
  const content = (
    <>
      <View style={[s.root, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
        <View style={s.header}>
          <Text style={s.title}>{isDraft ? 'Draft' : 'Meal'}</Text>
          <Pressable onPress={onClose} accessibilityRole="button" hitSlop={12}><Text style={s.action}>{isDraft ? 'Later' : 'Done'}</Text></Pressable>
        </View>
        <ScrollView contentContainerStyle={s.body}>
          {meal.photoUri ? <View style={s.photo}>
            <Image source={{ uri: meal.photoUri }} style={s.image} accessibilityLabel="Meal photo" />
            <View style={s.overlay}><Macros meal={meal} pending={pending} status={status} loading={loading} light /></View>
          </View> : <View style={s.summary}>
            <Text style={s.name}>{meal.name}</Text>
            <Macros meal={meal} pending={pending} status={status} loading={loading} />
          </View>}
          <View style={s.actions}>
            <Pressable onPress={() => setEditing(true)} accessibilityRole="button" style={s.button}><Text style={s.action}>Edit</Text></Pressable>
            {meal.photoUri && <Pressable onPress={remove} accessibilityRole="button" accessibilityLabel="Remove photo" style={s.button}><Text style={s.action}>Remove</Text></Pressable>}
            {meal.estimateState === 'failed' && !waitingSetup && <Pressable onPress={() => retryEstimate(id)} accessibilityRole="button" style={s.button}><Text style={s.action}>Retry</Text></Pressable>}
          </View>
          {localError && <Text accessibilityRole="alert" style={s.error}>{localError}</Text>}
        </ScrollView>
        {isDraft && <View style={s.footer}>
          <PrimaryButton label={pending ? 'Save now' : 'Save'} onPress={save} />
          <Pressable onPress={discard} accessibilityRole="button" style={s.discard}><Text style={s.action}>Discard</Text></Pressable>
        </View>}
      </View>
      {editing && <MealEditor meal={meal} onClose={() => setEditing(false)} onSave={(input) => updateMeal(id, input)} />}
    </>
  );
  return embedded ? content : <Modal visible animationType="slide" onRequestClose={onClose}>{content}</Modal>;
}

function Macros({ meal, pending, status, loading, light = false }: { meal: SavedMeal; pending: boolean; status: string; loading: boolean; light?: boolean }) {
  return <View style={s.nutrition}>
    <View style={s.status}>
      {loading && <ActivityIndicator size="small" color={light ? '#ffffff' : colors.protein} />}
      <Text accessibilityRole={pending && meal.estimateState === 'failed' ? 'alert' : undefined} style={[s.badge, light && s.light]}>
        {pending ? status : meal.nutritionStatus === 'manual' ? 'Edited' : 'AI estimate'}
      </Text>
    </View>
    <View style={s.macros}>
      <Metric label="kcal" value={meal.kcal} light={light} />
      <Metric label="Protein" value={meal.protein} unit="g" light={light} />
      <Metric label="Carbs" value={meal.carbs} unit="g" light={light} />
    </View>
    <Text style={[s.secondary, light && s.light]}>Fat {meal.fat === null ? '—' : num(meal.fat)} g · Fibre {meal.fibre === null ? '—' : num(meal.fibre)} g</Text>
  </View>;
}

function Metric({ label, value, unit, light }: { label: string; value: number | null; unit?: string; light: boolean }) {
  return <View style={s.metric}>
    <Text style={[s.number, light && s.light]}>{value === null ? '—' : num(value)}{unit ? <Text style={s.unit}> {unit}</Text> : null}</Text>
    <Text style={[s.label, light && s.light]}>{label}</Text>
  </View>;
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: gutter, paddingBottom: 16 },
  body: { paddingHorizontal: gutter, gap: 12, paddingBottom: 24 },
  title: { fontFamily: fonts.uiSemi, fontSize: 20, color: colors.ink },
  action: { fontFamily: fonts.uiMedium, fontSize: 14, color: colors.protein },
  name: { fontFamily: fonts.uiSemi, fontSize: 22, color: colors.ink },
  photo: { borderRadius: 20, overflow: 'hidden', backgroundColor: colors.card },
  image: { width: '100%', aspectRatio: 0.8, resizeMode: 'cover' },
  overlay: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 18, backgroundColor: 'rgba(0, 0, 0, 0.62)' },
  summary: { gap: 20, paddingVertical: 20 },
  nutrition: { gap: 12 },
  badge: { fontFamily: fonts.uiMedium, fontSize: 12, color: colors.inkMid, flexShrink: 1 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  macros: { flexDirection: 'row', gap: 10 },
  metric: { flex: 1, minWidth: 0 },
  number: { fontFamily: fonts.monoBold, fontSize: 24, color: colors.ink },
  unit: { fontFamily: fonts.ui, fontSize: 12 },
  label: { fontFamily: fonts.uiMedium, fontSize: 12, color: colors.inkMid, marginTop: 4 },
  secondary: { fontFamily: fonts.ui, fontSize: 12, color: colors.inkMid },
  light: { color: '#ffffff' },
  actions: { flexDirection: 'row', gap: 24 },
  button: { paddingVertical: 14 },
  error: { fontFamily: fonts.ui, fontSize: 13, color: colors.inkMid },
  footer: { paddingHorizontal: gutter, paddingTop: 12 },
  discard: { paddingVertical: 16, alignItems: 'center' },
});
