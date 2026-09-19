import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius } from '../theme';
import { MinusIcon, PlusIcon } from './Icons';

export function PrimaryButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [s.btn, disabled && s.btnOff, pressed && s.pressed]}
    >
      <Text style={s.btnText}>{label}</Text>
    </Pressable>
  );
}

export function OptionRow({
  title,
  sub,
  selected,
  onPress,
}: {
  title: string;
  sub?: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={({ pressed }) => [s.opt, selected && s.optOn, pressed && s.pressed]}
    >
      <Text style={[s.optTitle, selected && s.onInk]}>{title}</Text>
      {sub ? <Text style={[s.optSub, selected && s.onInkSoft]}>{sub}</Text> : null}
    </Pressable>
  );
}

export function Pills<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={s.pills}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            style={[s.pill, on && s.pillOn]}
          >
            <Text style={[s.pillText, on && s.onInk]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Stepper({
  label,
  value,
  unit,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  unit: string;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  const step = (d: number) => onChange(Math.min(max, Math.max(min, value + d)));
  return (
    <View style={s.stepper}>
      <View style={s.stepperValue}>
        <Text style={s.stepperLabel}>{label}</Text>
        <Text style={s.stepperNum}>
          {value}
          <Text style={s.stepperUnit}> {unit}</Text>
        </Text>
      </View>
      <Pressable
        onPress={() => step(-1)}
        accessibilityLabel={`Decrease ${label}`}
        style={({ pressed }) => [s.round, pressed && s.pressed]}
      >
        <MinusIcon color={colors.inkMid} />
      </Pressable>
      <Pressable
        onPress={() => step(1)}
        accessibilityLabel={`Increase ${label}`}
        style={({ pressed }) => [s.round, pressed && s.pressed]}
      >
        <PlusIcon color={colors.inkMid} />
      </Pressable>
    </View>
  );
}

export function ProgressBar({ step, total }: { step: number; total: number }) {
  return (
    <View style={s.progress}>
      {Array.from({ length: total }, (_, i) => (
        <View key={i} style={[s.seg, i <= step && s.segOn]} />
      ))}
    </View>
  );
}

// Fades a step in when it mounts. Give it a new key per step.
export function FadeIn({ children }: { children: React.ReactNode }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(a, { toValue: 1, duration: 240, useNativeDriver: true }).start();
  }, [a]);
  return <Animated.View style={{ flex: 1, opacity: a }}>{children}</Animated.View>;
}

const s = StyleSheet.create({
  pressed: { transform: [{ scale: 0.985 }] },
  onInk: { color: colors.paper },
  onInkSoft: { color: colors.paper, opacity: 0.7 },

  btn: {
    height: 54,
    borderRadius: 99,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnOff: { opacity: 0.35 },
  btnText: { fontFamily: fonts.uiSemi, fontSize: 15, color: colors.paper },

  opt: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.rule,
    borderRadius: radius.md,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  optOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  optTitle: { fontFamily: fonts.uiMedium, fontSize: 15, color: colors.ink },
  optSub: { fontFamily: fonts.ui, fontSize: 12.5, color: colors.inkLow, marginTop: 3 },

  pills: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  pill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 99,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.rule,
  },
  pillOn: { backgroundColor: colors.ink, borderColor: colors.ink },
  pillText: { fontFamily: fonts.uiMedium, fontSize: 13, color: colors.inkMid },

  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.rule,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingLeft: 16,
    paddingRight: 12,
    marginBottom: 10,
  },
  stepperValue: { flex: 1 },
  stepperLabel: {
    fontFamily: fonts.uiSemi,
    fontSize: 10,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: colors.inkLow,
  },
  stepperNum: { fontFamily: fonts.monoBold, fontSize: 21, letterSpacing: -0.7, color: colors.ink, marginTop: 5 },
  stepperUnit: { fontFamily: fonts.mono, fontSize: 12, letterSpacing: 0, color: colors.inkLow },
  round: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.rule,
    alignItems: 'center',
    justifyContent: 'center',
  },

  progress: { flexDirection: 'row', gap: 6 },
  seg: { flex: 1, height: 3, borderRadius: 99, backgroundColor: colors.rule },
  segOn: { backgroundColor: colors.ink },
});
