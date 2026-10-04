import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, gutter } from '../theme';
import { validateMealInput } from '../lib/meals';
import type { MealInput, SavedMeal } from '../types';
import { PrimaryButton } from './ui';

function nutritionValue(text: string): number | null {
  const value = text.trim();
  if (!value) return null;
  return /^(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(value) ? Number(value.replace(',', '.')) : NaN;
}

export function MealEditor({ meal, onSave, onClose }: {
  meal: SavedMeal | null;
  onSave: (input: MealInput) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(meal?.name ?? '');
  const [portion, setPortion] = useState(meal?.portion ?? '');
  const [kcal, setKcal] = useState(meal?.kcal?.toString() ?? '');
  const [protein, setProtein] = useState(meal?.protein?.toString() ?? '');
  const [fibre, setFibre] = useState(meal?.fibre?.toString() ?? '');
  const [showNutrition, setShowNutrition] = useState(meal?.nutritionStatus === 'manual');
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    let input: MealInput;
    try {
      input = validateMealInput({ name, portion, kcal: nutritionValue(kcal), protein: nutritionValue(protein), fibre: nutritionValue(fibre) });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Check your meal details.');
      return;
    }
    try { onSave(input); }
    catch { setError('Meal not saved. Check device storage and try again.'); return; }
    onClose();
  };

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[s.header, { paddingTop: insets.top + 16 }]}>
          <Text style={s.title}>{meal ? 'Edit meal' : 'Log food'}</Text>
          <Pressable onPress={onClose} accessibilityRole="button" hitSlop={12}>
            <Text style={s.cancel}>Cancel</Text>
          </Pressable>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.body}>
          <Field label="What did you eat?" value={name} onChangeText={setName} placeholder="2 roti, 1 katori dal, rice" autoFocus multiline />
          <Field label="Portion (optional)" value={portion} onChangeText={setPortion} placeholder="1 katori, 2 medium roti" />
          <Text style={s.help}>Saved on this phone, even offline. Automatic estimates are not available yet.</Text>
          <Pressable onPress={() => setShowNutrition(!showNutrition)} accessibilityRole="button" accessibilityState={{ expanded: showNutrition }} style={s.toggle}>
            <Text style={s.cancel}>{showNutrition ? 'Hide nutrition fields' : 'Add nutrition manually (optional)'}</Text>
          </Pressable>
          {showNutrition && (
            <>
              <Text style={s.help}>Enter all three values, or leave all blank. Blank means not estimated, not zero.</Text>
              <Field label="Calories (kcal)" value={kcal} onChangeText={setKcal} numeric />
              <Field label="Protein (g)" value={protein} onChangeText={setProtein} numeric />
              <Field label="Fibre (g)" value={fibre} onChangeText={setFibre} numeric />
            </>
          )}
          {error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
        </ScrollView>
        <View style={[s.footer, { paddingBottom: insets.bottom + 16 }]}>
          <PrimaryButton label={meal ? 'Save changes' : 'Save meal'} onPress={save} disabled={!name.trim()} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Field({ label, numeric, ...props }: {
  label: string;
  numeric?: boolean;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  multiline?: boolean;
}) {
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <TextInput {...props} accessibilityLabel={label} keyboardType={numeric ? 'decimal-pad' : 'default'}
        placeholderTextColor={colors.inkLow} selectionColor={colors.ink} style={s.input} />
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  header: { paddingHorizontal: gutter, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 20 },
  title: { fontFamily: fonts.uiSemi, fontSize: 24, color: colors.ink },
  cancel: { fontFamily: fonts.uiMedium, fontSize: 14, color: colors.protein },
  body: { paddingHorizontal: gutter, paddingBottom: 24, gap: 16 },
  field: { gap: 8 },
  label: { fontFamily: fonts.uiMedium, fontSize: 13, color: colors.inkMid },
  input: { fontFamily: fonts.ui, fontSize: 16, color: colors.ink, backgroundColor: colors.card, borderColor: colors.rule, borderWidth: 1, borderRadius: 12, padding: 14 },
  help: { fontFamily: fonts.ui, fontSize: 13, lineHeight: 20, color: colors.inkMid },
  toggle: { paddingVertical: 12 },
  error: { fontFamily: fonts.uiMedium, fontSize: 13, color: colors.protein },
  footer: { paddingHorizontal: gutter, paddingTop: 12 },
});
