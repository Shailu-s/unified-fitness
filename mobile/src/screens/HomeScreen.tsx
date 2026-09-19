import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SearchIcon } from '../components/Icons';
import { Ring } from '../components/Ring';
import { useApp } from '../context/AppContext';
import { formatDay, num } from '../lib/format';
import { colors, fonts, gutter, radius } from '../theme';

const frac = (p: { value: number; goal: number }) => (p.goal > 0 ? p.value / p.goal : 0);

export function HomeScreen({ onOpenLog }: { onOpenLog: () => void }) {
  const { activity: a, profile } = useApp();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const ringSize = Math.min(290, width - gutter * 2);

  return (
    <View style={s.root}>
      <View style={s.screen}>
        <View style={s.top}>
          <Text style={s.date}>{formatDay(new Date())}</Text>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{profile?.name.charAt(0).toUpperCase()}</Text>
          </View>
        </View>

        <View style={s.gap1} />

        <View style={s.stepsLine}>
          <Text style={s.stepsN}>{num(a.steps.value)}</Text>
          <Text style={s.stepsGoal}>/ {num(a.steps.goal)}</Text>
          <Text style={s.stepsLabel}>Steps</Text>
        </View>

        <View style={s.gap2} />

        <View style={s.ringWrap}>
          <Ring size={ringSize} move={frac(a.move)} exercise={frac(a.exercise)} stand={frac(a.stand)} />
        </View>

        <View style={s.gap2} />

        <View style={s.row}>
          <Box label="Calories" value={a.move.value} sub={`of ${a.move.goal} kcal`} color={colors.move} />
          <Box label="Exercise" value={a.exercise.value} sub={`of ${a.exercise.goal} min`} color={colors.exer} />
          <Box label="Stand" value={a.stand.value} sub={`of ${a.stand.goal} hrs`} color={colors.stand} />
        </View>

        <View style={s.gap1} />
      </View>

      {/* Logging lives in the thumb zone. Tapping opens the Log page. */}
      <View style={[s.bottom, { paddingBottom: 12 + insets.bottom }]}>
        <Pressable
          onPress={onOpenLog}
          accessibilityRole="button"
          accessibilityLabel="Log food, workout, or search"
          style={({ pressed }) => [s.search, pressed && s.searchPressed]}
        >
          <SearchIcon color={colors.inkLow} />
          <Text style={s.searchText}>Log food, workout, or search</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Box({ label, value, sub, color }: { label: string; value: number; sub: string; color: string }) {
  return (
    <View style={s.box}>
      <Text style={s.boxLabel}>{label}</Text>
      <Text style={[s.boxNum, { color }]}>{value}</Text>
      <Text style={s.boxSub}>{sub}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  screen: { flex: 1, paddingHorizontal: gutter },

  // Elastic gaps absorb spare height instead of pooling in one dead zone.
  gap1: { flex: 1, minHeight: 14 },
  gap2: { flex: 1.4, minHeight: 18 },

  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  date: {
    fontFamily: fonts.monoMedium,
    fontSize: 11,
    letterSpacing: 1.3,
    color: colors.inkLow,
    textTransform: 'uppercase',
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.paper2,
    borderWidth: 1,
    borderColor: colors.rule,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: fonts.uiSemi, fontSize: 12, color: colors.inkMid },

  stepsLine: { flexDirection: 'row', alignItems: 'baseline', gap: 9 },
  stepsN: { fontFamily: fonts.monoBold, fontSize: 30, letterSpacing: -1.2, color: colors.ink },
  stepsGoal: { fontFamily: fonts.monoMedium, fontSize: 15, color: colors.inkLow },
  stepsLabel: {
    marginLeft: 'auto',
    fontFamily: fonts.uiSemi,
    fontSize: 10,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.inkMid,
  },

  ringWrap: { alignItems: 'center' },

  row: { flexDirection: 'row', gap: 10 },
  box: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.rule,
    borderRadius: radius.sm,
    paddingVertical: 13,
    paddingHorizontal: 14,
  },
  boxLabel: {
    fontFamily: fonts.uiSemi,
    fontSize: 9.5,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.inkLow,
  },
  boxNum: { fontFamily: fonts.monoBold, fontSize: 21, letterSpacing: -0.7, marginTop: 6 },
  boxSub: { fontFamily: fonts.mono, fontSize: 10, color: colors.inkLow, marginTop: 5 },

  bottom: {
    paddingHorizontal: gutter,
    paddingTop: 12,
    backgroundColor: colors.paper,
    borderTopWidth: 1,
    borderTopColor: colors.rule,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.rule,
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: 15,
  },
  searchPressed: { borderColor: colors.ruleStrong },
  searchText: { fontFamily: fonts.ui, fontSize: 15, color: colors.inkLow },
});
