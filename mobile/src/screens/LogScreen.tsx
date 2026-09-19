import { useEffect, useRef } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraIcon, MicIcon, TypeIcon } from '../components/Icons';
import { MacroBar } from '../components/MacroBar';
import { MealRow } from '../components/MealRow';
import { useApp } from '../context/AppContext';
import { mockPhotoLogs, mockUsuals } from '../data/mock';
import { colors, eyebrow, fonts, gutter } from '../theme';

export function LogScreen() {
  const { targets, meals, eaten, activity, profile, addMeal } = useApp();
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const listRef = useRef<ScrollView>(null);
  const photoIdx = useRef(0);
  const prevCount = useRef(meals.length);

  // Keep a newly logged meal in view.
  useEffect(() => {
    if (meals.length > prevCount.current) listRef.current?.scrollToEnd({ animated: true });
    prevCount.current = meals.length;
  }, [meals.length]);

  const empty = meals.length === 0;
  const left = Math.max(0, targets.protein - eaten.protein);
  const heroLabel = empty ? 'Protein to eat today' : left === 0 ? 'Protein goal reached' : 'Protein left today';

  // Stand-in for a photo scan. A real one would open an editable draft first.
  const snap = () => {
    addMeal(mockPhotoLogs[photoIdx.current % mockPhotoLogs.length]);
    photoIdx.current += 1;
  };
  const soon = (what: string) => Alert.alert('Coming soon', `${what} logging is not part of this mock.`);

  return (
    <View style={s.root}>
      <View style={s.screen}>
        <View style={s.top}>
          <Text style={s.title}>Today</Text>
          <View style={s.dots}>
            <View style={s.dot} />
            <View style={[s.dot, s.dotOn]} />
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
          <View>
            <MacroBar name="Calories" value={eaten.kcal} goal={targets.kcal} unit="kcal" color={colors.move} />
            <View style={s.burn}>
              <View style={s.burnDot} />
              <Text style={s.burnText}>{activity.burned} burned today</Text>
            </View>
          </View>
        </View>

        {/* Silence, not a divider, separates the day's targets from the day's record. */}
        <View style={[s.meals, { marginTop: height < 720 ? 32 : 66 }]}>
          <Text style={s.mealsHead}>Eaten so far</Text>

          {empty ? (
            <View>
              <Text style={s.emptyLine}>Nothing yet today.</Text>
              <Text style={s.emptySub}>Snap your plate, or start with a usual:</Text>
              <View style={s.usuals}>
                {mockUsuals[profile?.diet ?? 'veg'].map((u) => (
                  <Pressable
                    key={u.name}
                    onPress={() => addMeal(u)}
                    accessibilityRole="button"
                    accessibilityLabel={`Log ${u.name}, ${u.kcal} calories`}
                    style={({ pressed }) => [s.usual, pressed && s.usualPressed]}
                  >
                    <Text style={s.uEmoji}>{u.emoji}</Text>
                    <Text style={s.uName}>{u.name}</Text>
                    <Text style={s.uKcal}>{u.kcal}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : (
            <ScrollView ref={listRef} showsVerticalScrollIndicator={false} style={s.list}>
              {meals.map((m, i) => (
                <MealRow key={m.id} meal={m} last={i === meals.length - 1} />
              ))}
            </ScrollView>
          )}
        </View>
      </View>

      <View style={[s.bottom, { paddingBottom: 10 + insets.bottom }]}>
        <View style={s.satRow}>
          <Pressable
            onPress={() => soon('Typed')}
            accessibilityRole="button"
            accessibilityLabel="Log by typing"
            style={({ pressed }) => [s.sat, pressed && s.satPressed]}
          >
            <TypeIcon color={colors.inkMid} />
          </Pressable>

          <Pressable
            onPress={snap}
            accessibilityRole="button"
            accessibilityLabel="Log by photo"
            style={({ pressed }) => [s.shutter, pressed && s.shutterPressed]}
          >
            <CameraIcon color={colors.paper} />
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
        <Text style={s.cap}>Snap your plate</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  screen: { flex: 1, paddingHorizontal: gutter },

  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 },
  title: { fontFamily: fonts.uiSemi, fontSize: 17, letterSpacing: -0.2, color: colors.ink },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.rule },
  dotOn: { width: 14, backgroundColor: colors.inkLow },

  hero: { marginBottom: 20 },
  heroNum: { fontFamily: fonts.monoBold, fontSize: 62, letterSpacing: -3.1, lineHeight: 66, color: colors.protein },
  heroUnit: { fontFamily: fonts.monoSemi, fontSize: 26, letterSpacing: -0.5, color: colors.inkLow },
  heroLabel: { ...eyebrow, letterSpacing: 1.3, color: colors.inkMid, marginTop: 6 },

  macros: { gap: 11 },
  burn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 7 },
  burnDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.move },
  burnText: { fontFamily: fonts.mono, fontSize: 11, color: colors.inkLow },

  meals: { flex: 1, minHeight: 0 },
  mealsHead: { ...eyebrow, letterSpacing: 1.2, marginBottom: 13 },
  list: { flex: 1 },

  emptyLine: { fontFamily: fonts.uiSemi, fontSize: 15, letterSpacing: -0.15, color: colors.ink },
  emptySub: { fontFamily: fonts.ui, fontSize: 13, color: colors.inkLow, marginTop: 5 },
  usuals: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 15 },
  usual: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 9,
    paddingLeft: 11,
    paddingRight: 13,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.rule,
    borderRadius: 99,
  },
  usualPressed: { borderColor: colors.ruleStrong },
  uEmoji: { fontSize: 15 },
  uName: { fontFamily: fonts.uiMedium, fontSize: 13, color: colors.ink },
  uKcal: { fontFamily: fonts.monoMedium, fontSize: 11, color: colors.inkLow },

  bottom: { paddingTop: 16, paddingHorizontal: 20, backgroundColor: colors.paper, alignItems: 'center' },
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
