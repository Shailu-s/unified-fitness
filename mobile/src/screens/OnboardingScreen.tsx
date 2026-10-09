import { useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FadeIn, OptionRow, Pills, PrimaryButton, ProgressBar, Stepper } from '../components/ui';
import { useApp } from '../context/AppContext';
import { mockProfile } from '../data/mock';
import { num } from '../lib/format';
import { computeTargets } from '../lib/targets';
import { colors, fonts, gutter } from '../theme';
import type { Diet, Goal, Profile } from '../types';

const STEPS = 5;

const GOALS: { value: Goal; title: string; sub: string }[] = [
  { value: 'lose', title: 'Lose fat', sub: 'A small calorie deficit with high protein' },
  { value: 'maintain', title: 'Stay where I am', sub: 'Hold weight and stay consistent' },
  { value: 'build', title: 'Build muscle', sub: 'A small surplus with more protein' },
];

const DIETS: { value: Diet; title: string; sub: string }[] = [
  { value: 'veg', title: 'Vegetarian', sub: 'No eggs, no meat' },
  { value: 'egg', title: 'Eggetarian', sub: 'Vegetarian plus eggs' },
  { value: 'nonveg', title: 'Non-vegetarian', sub: 'Includes meat and fish' },
];

const COPY = [
  { title: 'Your name' },
  { title: 'Your goal' },
  { title: 'About you' },
  { title: 'Your diet' },
  { title: 'Daily targets' },
];

export function OnboardingScreen() {
  const { completeOnboarding } = useApp();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Profile>({ ...mockProfile, name: '' });

  const set = <K extends keyof Profile>(key: K, value: Profile[K]) => setDraft((d) => ({ ...d, [key]: value }));
  const targets = useMemo(() => computeTargets(draft), [draft]);

  const canContinue = step !== 0 || draft.name.trim().length > 0;
  const last = step === STEPS - 1;

  const next = () => {
    if (!canContinue) return;
    if (!last) return setStep(step + 1);
    try { completeOnboarding({ ...draft, name: draft.name.trim() }); }
    catch { Alert.alert('Profile not saved', 'Check device storage and try again.'); }
  };

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[s.screen, { paddingTop: insets.top + 14 }]}>
        <View style={s.header}>
          <Pressable
            onPress={() => setStep(step - 1)}
            disabled={step === 0}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={step === 0 && s.hidden}
          >
            <Text style={s.back}>Back</Text>
          </Pressable>
        </View>
        <ProgressBar step={step} total={STEPS} />

        <FadeIn key={step}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={s.body}
          >
            <Text style={s.title}>{COPY[step].title}</Text>

            <View style={s.content}>
              {step === 0 && (
                <TextInput
                  value={draft.name}
                  onChangeText={(t) => set('name', t)}
                  placeholder="First name"
                  placeholderTextColor={colors.inkLow}
                  selectionColor={colors.ink}
                  autoFocus
                  autoCapitalize="words"
                  autoCorrect={false}
                  maxLength={20}
                  returnKeyType="next"
                  onSubmitEditing={next}
                  style={s.input}
                />
              )}

              {step === 1 &&
                GOALS.map((g) => (
                  <OptionRow
                    key={g.value}
                    title={g.title}
                    sub={g.sub}
                    selected={draft.goal === g.value}
                    onPress={() => set('goal', g.value)}
                  />
                ))}

              {step === 2 && (
                <>
                  <Pills
                    options={[
                      { value: 'male', label: 'Male' },
                      { value: 'female', label: 'Female' },
                    ]}
                    value={draft.sex}
                    onChange={(v) => set('sex', v)}
                  />
                  <Stepper label="Age" value={draft.age} unit="yrs" min={14} max={90} onChange={(v) => set('age', v)} />
                  <Stepper label="Height" value={draft.heightCm} unit="cm" min={120} max={220} onChange={(v) => set('heightCm', v)} />
                  <Stepper label="Weight" value={draft.weightKg} unit="kg" min={30} max={200} onChange={(v) => set('weightKg', v)} />
                </>
              )}

              {step === 3 &&
                DIETS.map((d) => (
                  <OptionRow
                    key={d.value}
                    title={d.title}
                    sub={d.sub}
                    selected={draft.diet === d.value}
                    onPress={() => set('diet', d.value)}
                  />
                ))}

              {step === 4 && (
                <View>
                  <Text style={s.heroNum}>
                    {targets.protein}
                    <Text style={s.heroUnit}>g</Text>
                  </Text>
                  <Text style={s.heroLabel}>Protein per day</Text>

                  <View style={s.rows}>
                    <TargetRow label="Fibre" value={`${targets.fibre} g`} />
                    <TargetRow label="Calories" value={`${num(targets.kcal)} kcal`} last />
                  </View>
                </View>
              )}
            </View>
          </ScrollView>
        </FadeIn>

        <View style={{ paddingBottom: 16 + insets.bottom }}>
          <PrimaryButton label={last ? 'Start tracking' : 'Continue'} onPress={next} disabled={!canContinue} />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function TargetRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[s.targetRow, !last && s.targetDivider]}>
      <Text style={s.targetLabel}>{label}</Text>
      <Text style={s.targetValue}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  screen: { flex: 1, paddingHorizontal: gutter },

  header: { height: 28, justifyContent: 'center', marginBottom: 10 },
  hidden: { opacity: 0 },
  back: { fontFamily: fonts.uiMedium, fontSize: 13, color: colors.inkMid },

  body: { paddingTop: 40, paddingBottom: 24 },
  title: { fontFamily: fonts.uiSemi, fontSize: 28, letterSpacing: -0.7, lineHeight: 34, color: colors.ink },
  content: { marginTop: 28 },

  input: {
    fontFamily: fonts.uiMedium,
    fontSize: 17,
    color: colors.ink,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.rule,
    borderRadius: 12,
    paddingVertical: 15,
    paddingHorizontal: 16,
  },

  heroNum: { fontFamily: fonts.monoBold, fontSize: 62, letterSpacing: -3.1, lineHeight: 66, color: colors.protein },
  heroUnit: { fontFamily: fonts.monoSemi, fontSize: 26, letterSpacing: -0.5, color: colors.inkLow },
  heroLabel: {
    fontFamily: fonts.uiSemi,
    fontSize: 10,
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    color: colors.inkMid,
    marginTop: 6,
  },

  rows: { marginTop: 40 },
  targetRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingVertical: 15 },
  targetDivider: { borderBottomWidth: 1, borderBottomColor: colors.rule },
  targetLabel: { fontFamily: fonts.uiMedium, fontSize: 14, color: colors.inkMid },
  targetValue: { fontFamily: fonts.monoBold, fontSize: 19, letterSpacing: -0.6, color: colors.ink },
});
