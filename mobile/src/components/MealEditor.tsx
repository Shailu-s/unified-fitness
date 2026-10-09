import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, gutter } from '../theme';
import { mealDraftInput } from '../lib/mealDraft';
import type { MealInput, SavedMeal } from '../types';
import { PrimaryButton } from './ui';

export function MealEditor({ meal, onSave, onClose }: {
  meal: SavedMeal | null;
  onSave: (input: MealInput) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(meal?.name ?? '');
  const portion = meal?.portion ?? '';
  const [kcal, setKcal] = useState(meal?.kcal?.toString() ?? '');
  const [protein, setProtein] = useState(meal?.protein?.toString() ?? '');
  const [fibre, setFibre] = useState(meal?.fibre?.toString() ?? '');
  const [carbs, setCarbs] = useState(meal?.carbs?.toString() ?? '');
  const [fat, setFat] = useState(meal?.fat?.toString() ?? '');
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    let input: MealInput;
    try {
      input = mealDraftInput(meal, { name, portion, kcal, protein, carbs, fat, fibre });
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
          <Text style={s.title}>{meal ? 'Edit' : 'Log meal'}</Text>
          <Pressable onPress={onClose} accessibilityRole="button" hitSlop={12}>
            <Text style={s.cancel}>Cancel</Text>
          </Pressable>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.body}>
          <Field label="Meal" value={name} onChangeText={setName} placeholder="Roti, dal, rice" autoFocus={!meal} multiline />
          {meal && (
            <>
              <Field label="Calories (kcal)" value={kcal} onChangeText={setKcal} numeric />
              <Field label="Protein (g)" value={protein} onChangeText={setProtein} numeric />
              <Field label="Carbs (g)" value={carbs} onChangeText={setCarbs} numeric />
              <Field label="Fat (g)" value={fat} onChangeText={setFat} numeric />
              <Field label="Fibre (g)" value={fibre} onChangeText={setFibre} numeric />
            </>
          )}
          {error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
        </ScrollView>
        <View style={[s.footer, { paddingBottom: insets.bottom + 16 }]}>
          <PrimaryButton label="Save" onPress={save} disabled={!name.trim()} />
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
  error: { fontFamily: fonts.uiMedium, fontSize: 13, color: colors.protein },
  footer: { paddingHorizontal: gutter, paddingTop: 12 },
});
