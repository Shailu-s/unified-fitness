import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Meal } from '../types';
import { colors, fonts, radius } from '../theme';

export function MealRow({ meal, last, onPress }: { meal: Meal; last: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Edit ${meal.name}`} style={[s.row, !last && s.divider]}>
      <View style={s.thumb}>
        <Text style={s.emoji}>{meal.emoji || '•'}</Text>
      </View>
      <View style={s.body}>
        <Text style={s.name} numberOfLines={1}>
          {meal.name}
        </Text>
        <Text style={s.sub}>
          {meal.time} · {meal.portion}
        </Text>
      </View>
      <Text style={s.kcal}>{meal.kcal === null ? 'Not estimated' : `${meal.kcal} kcal`}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.rule },
  thumb: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    backgroundColor: colors.paper2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 16 },
  body: { flex: 1, minWidth: 0 },
  name: { fontFamily: fonts.uiMedium, fontSize: 14, color: colors.ink },
  sub: { fontFamily: fonts.mono, fontSize: 10.5, color: colors.inkLow, marginTop: 3 },
  kcal: { maxWidth: 110, textAlign: 'right', fontFamily: fonts.monoBold, fontSize: 12, color: colors.ink },
});
