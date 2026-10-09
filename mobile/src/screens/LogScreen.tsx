import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraIcon, MicIcon, TypeIcon } from '../components/Icons';
import { MacroBar } from '../components/MacroBar';
import { MealRow } from '../components/MealRow';
import { MealEditor } from '../components/MealEditor';
import { useApp } from '../context/AppContext';
import { shareExport } from '../lib/shareExport';
import { num } from '../lib/format';
import { HistoryScreen } from './HistoryScreen';
import { MealResultScreen } from './MealResultScreen';
import { pickMealPhoto, removeLocalPhoto } from '../lib/photoFiles';
import * as SecureStore from 'expo-secure-store';
import type { SavedMeal } from '../types';
import { colors, eyebrow, fonts, gutter } from '../theme';

export function LogScreen() {
  const { targets, meals, photoDrafts, eaten, addMeal, addPhotoDraft, updateMeal, getExportData } = useApp();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const listRef = useRef<ScrollView>(null);
  const prevCount = useRef(meals.length);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingMeal, setEditingMeal] = useState<SavedMeal | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [resultId, setResultId] = useState<string | null>(null);
  const [preparingPhoto, setPreparingPhoto] = useState(false);
  const photoBusy = useRef(false);
  const exportBusy = useRef(false);
  const performExport = async () => {
    if (exportBusy.current) return;
    exportBusy.current = true;
    setExporting(true);
    try { await shareExport(getExportData); }
    catch { Alert.alert('Export unavailable', 'Could not create or share the file. Your logs are unchanged. Check device storage and try again.'); }
    finally { exportBusy.current = false; setExporting(false); }
  };
  const confirmExport = () => Alert.alert('Export your data',
    'Includes your profile, saved meals and unsaved photo drafts as JSON. Photo files are not included. Choose Save to Files to keep a copy on your device.',
    [{ text: 'Cancel', style: 'cancel' }, { text: 'Continue', onPress: () => { void performExport(); } }],
  );
  const openEditor = (meal: SavedMeal | null = null) => {
    setEditingMeal(meal);
    setEditorOpen(true);
  };

  // Keep a newly logged meal in view.
  useEffect(() => {
    if (meals.length > prevCount.current) listRef.current?.scrollToEnd({ animated: true });
    prevCount.current = meals.length;
  }, [meals.length]);

  const empty = meals.length === 0;
  const left = Math.max(0, targets.protein - eaten.protein);
  const heroLabel = empty ? 'Protein to eat today' : left === 0 ? 'Protein goal reached' : 'Protein left today';

  // Stand-in for a photo scan. A real one would open an editable draft first.
  const snap = async (source: 'camera' | 'gallery' = 'camera') => {
    if (photoBusy.current) return;
    photoBusy.current = true;
    try {
      if (await SecureStore.getItemAsync('photo-processing-consent-v1') !== 'yes') {
        const accepted = await new Promise<boolean>((resolve) => Alert.alert('Approximate photo estimates',
          'Food photos are saved privately on this phone, then sent via private storage to OpenAI for an estimate. Avoid faces or personal information. Uploads are removed after processing; interrupted uploads are removed on next sync. OpenAI API training is opt-in, but abuse-monitoring retention may apply. Photos cannot reveal hidden oil or exact portions.',
          [{ text: 'Cancel', style: 'cancel', onPress: () => resolve(false) }, { text: 'Continue', onPress: () => resolve(true) }],
          { cancelable: true, onDismiss: () => resolve(false) }));
        if (!accepted) return;
        await SecureStore.setItemAsync('photo-processing-consent-v1', 'yes');
      }
      setPreparingPhoto(true);
      const uri = await pickMealPhoto(source);
      if (!uri) return;
      try {
        const meal = addPhotoDraft({ name: '', portion: '', kcal: null, protein: null, fibre: null, inputType: 'photo', photoUri: uri });
        setResultId(meal.id);
      } catch (error) { removeLocalPhoto(uri); throw error; }
    } catch (error) {
      Alert.alert('Photo not saved', error instanceof Error ? error.message : 'Could not prepare the photo. Try again.',
        [{ text: 'OK' }, { text: 'Device settings', onPress: () => { void Linking.openSettings(); } }]);
    } finally { photoBusy.current = false; setPreparingPhoto(false); }
  };
  const soon = (what: string) => Alert.alert('Not available yet', `${what} logging comes later. Type your meal to save it now.`);

  return (
    <View style={s.root}>
      <View style={s.screen}>
        <View style={s.top}>
          <Text style={s.title}>Today</Text>
          <View style={s.actions}>
            <Pressable onPress={() => setHistoryOpen(true)} accessibilityRole="button" hitSlop={8}>
              <Text style={s.actionText}>History</Text>
            </Pressable>
            <Pressable onPress={confirmExport} disabled={exporting} accessibilityRole="button"
              accessibilityLabel="Export profile and all meals" accessibilityState={{ disabled: exporting }} hitSlop={8}>
              <Text style={s.actionText}>{exporting ? 'Exporting…' : 'Export'}</Text>
            </Pressable>
          </View>
        </View>

        <View style={s.hero}>
          <Text style={s.heroNum}>
            {left}
            <Text style={s.heroUnit}>g</Text>
          </Text>
          <Text style={s.heroLabel}>{heroLabel}</Text>
        </View>

        <View style={s.macros}>
          <MacroBar name="Protein" value={eaten.protein} goal={targets.protein} unit="g" color={colors.protein} />
          <MacroBar name="Fibre" value={eaten.fibre} goal={targets.fibre} unit="g" color={colors.fibre} />
          <Text style={s.macroTotals}>Carbs {eaten.carbs === null ? '—' : num(eaten.carbs)} g · Fat {eaten.fat === null ? '—' : num(eaten.fat)} g</Text>
          <View>
            <MacroBar name="Calories" value={eaten.kcal} goal={targets.kcal} unit="kcal" color={colors.move} />
            <View style={s.burn}>
              <View style={s.burnDot} />
              <Text style={s.burnText}>
                {eaten.pending > 0 ? `${eaten.pending} waiting for estimates · known nutrition only` : 'Known nutrition only · tap a meal to correct'}
              </Text>
            </View>
          </View>
        </View>

        {/* Silence, not a divider, separates the day's targets from the day's record. */}
        <View style={[s.meals, { marginTop: height < 720 ? 32 : 66 }]}>
          <ScrollView ref={listRef} showsVerticalScrollIndicator={false} style={s.list}>
            {photoDrafts.length > 0 && <View style={s.drafts}>
              <Text style={s.mealsHead}>Photo drafts · not logged yet</Text>
              {photoDrafts.map((draft, index) => <MealRow key={draft.id} meal={draft} last={index === photoDrafts.length - 1} onPress={() => setResultId(draft.id)} />)}
            </View>}
            <Text style={s.mealsHead}>Eaten so far</Text>
            {empty ? (
              <View>
                <Text style={s.emptyLine}>Nothing yet today.</Text>
                <Text style={s.emptySub}>Take a meal photo or type what you ate.</Text>
              </View>
            ) : meals.map((m, i) => (
              <MealRow key={m.id} meal={m} last={i === meals.length - 1} onPress={() => setResultId(m.id)} />
            ))}
          </ScrollView>
        </View>
      </View>

      <View style={[s.bottom, { paddingBottom: 10 + insets.bottom }]}>
        <View style={s.satRow}>
          <Pressable
            onPress={() => { void snap(); }}
            disabled={preparingPhoto}
            accessibilityRole="button"
            accessibilityLabel="Photograph a meal"
            style={({ pressed }) => [s.sat, pressed && s.satPressed]}
          >
            {preparingPhoto ? <ActivityIndicator color={colors.inkMid} /> : <CameraIcon color={colors.inkMid} />}
          </Pressable>

          <Pressable
            onPress={() => openEditor()}
            accessibilityRole="button"
            accessibilityLabel="Log food by typing"
            style={({ pressed }) => [s.shutter, pressed && s.shutterPressed]}
          >
            <TypeIcon color={colors.paper} />
          </Pressable>

          <Pressable
            onPress={() => soon('Voice')}
            accessibilityRole="button"
            accessibilityLabel="Log by voice"
            style={({ pressed }) => [s.sat, pressed && s.satPressed]}
          >
            <MicIcon color={colors.inkMid} />
          </Pressable>
        </View>
        <Text style={s.cap}>Photo → review → save · or type a meal</Text>
        <Pressable onPress={() => { void snap('gallery'); }} disabled={preparingPhoto} accessibilityRole="button"
          accessibilityLabel="Upload a meal photo from gallery" accessibilityState={{ disabled: preparingPhoto }} style={s.galleryButton}>
          <Text style={s.actionText}>{preparingPhoto ? 'Preparing photo…' : 'Upload from gallery'}</Text>
        </Pressable>
      </View>
      {historyOpen && <HistoryScreen onClose={() => setHistoryOpen(false)} />}
      {resultId && !editorOpen && <MealResultScreen id={resultId} onClose={() => setResultId(null)} />}
      {editorOpen && (
        <MealEditor meal={editingMeal} onClose={() => setEditorOpen(false)}
          onSave={(input) => {
            const meal = editingMeal ? updateMeal(editingMeal.id, input) : addMeal(input);
            setResultId(meal.id);
          }} />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  screen: { flex: 1, paddingHorizontal: gutter },

  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 },
  title: { fontFamily: fonts.uiSemi, fontSize: 17, letterSpacing: -0.2, color: colors.ink },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 22 },
  actionText: { fontFamily: fonts.uiMedium, fontSize: 13, color: colors.protein },

  hero: { marginBottom: 20 },
  heroNum: { fontFamily: fonts.monoBold, fontSize: 62, letterSpacing: -3.1, lineHeight: 66, color: colors.protein },
  heroUnit: { fontFamily: fonts.monoSemi, fontSize: 26, letterSpacing: -0.5, color: colors.inkLow },
  heroLabel: { ...eyebrow, letterSpacing: 1.3, color: colors.inkMid, marginTop: 6 },

  macros: { gap: 11 },
  macroTotals: { fontFamily: fonts.mono, fontSize: 12, color: colors.inkMid },
  burn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 7 },
  burnDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.move },
  burnText: { flex: 1, fontFamily: fonts.mono, fontSize: 11, color: colors.inkMid },

  meals: { flex: 1, minHeight: 0 },
  mealsHead: { ...eyebrow, letterSpacing: 1.2, marginBottom: 13 },
  list: { flex: 1 },
  drafts: { marginBottom: 20 },

  emptyLine: { fontFamily: fonts.uiSemi, fontSize: 15, letterSpacing: -0.15, color: colors.ink },
  emptySub: { fontFamily: fonts.ui, fontSize: 13, color: colors.inkLow, marginTop: 5 },
  bottom: { paddingTop: 16, paddingHorizontal: 20, backgroundColor: colors.paper, alignItems: 'center' },
  galleryButton: { alignSelf: 'stretch', alignItems: 'center', paddingVertical: 12, marginTop: 10, borderWidth: 1, borderColor: colors.rule, borderRadius: 12, backgroundColor: colors.card },
  satRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 26 },
  sat: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.rule,
    alignItems: 'center',
    justifyContent: 'center',
  },
  satPressed: { borderColor: colors.ruleStrong },
  shutter: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.ink,
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  shutterPressed: { transform: [{ scale: 0.97 }] },
  cap: { fontFamily: fonts.ui, fontSize: 10.5, letterSpacing: 0.3, color: colors.inkLow, marginTop: 11 },
});
