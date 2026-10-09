import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MealEditor } from '../components/MealEditor';
import { MealRow } from '../components/MealRow';
import { useApp } from '../context/AppContext';
import { formatDay, num } from '../lib/format';
import { localDateKey, shiftLocalDay, sumNutrition } from '../lib/meals';
import { colors, fonts, gutter } from '../theme';
import type { SavedMeal } from '../types';

export function HistoryScreen({ onClose }: { onClose: () => void }) {
  const { getMealsForDay, getMealDays, updateMeal } = useApp();
  const insets = useSafeAreaInsets();
  const today = localDateKey(new Date());
  const selectedDay = useRef(today);
  const [view, setView] = useState<{ day: string; meals: SavedMeal[]; days: string[] }>({ day: today, meals: [], days: [] });
  const [ready, setReady] = useState(false);
  const [readError, setReadError] = useState(false);
  const [editingMeal, setEditingMeal] = useState<SavedMeal | null>(null);

  const loadDay = useCallback((day: string) => {
    try {
      const meals = getMealsForDay(day);
      const days = getMealDays();
      selectedDay.current = day;
      setView({ day, meals, days });
      setReadError(false);
      setReady(true);
    } catch { setReadError(true); }
  }, [getMealsForDay, getMealDays]);

  useEffect(() => {
    loadDay(selectedDay.current);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') loadDay(selectedDay.current);
    });
    return () => subscription.remove();
  }, [loadDay]);

  const totals = useMemo(() => sumNutrition(view.meals), [view.meals]);
  const date = new Date(`${view.day}T12:00:00`);
  const label = view.day === today ? 'Today' : `${formatDay(date)} ${date.getFullYear()}`;

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" allowSwipeDismissal onRequestClose={onClose}>
      <View style={[s.root, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 12 }]}>
        <View style={s.header}>
          <Text style={s.title}>History</Text>
          <Pressable onPress={onClose} accessibilityRole="button" hitSlop={12}>
            <Text style={s.action}>Done</Text>
          </Pressable>
        </View>
        <View style={s.navigation}>
          <Pressable onPress={() => loadDay(shiftLocalDay(view.day, -1))} accessibilityRole="button" accessibilityLabel="Previous day" style={s.navButton}>
            <Text style={s.action}>Prev</Text>
          </Pressable>
          <Text style={s.day}>{label}</Text>
          <Pressable onPress={() => loadDay(shiftLocalDay(view.day, 1))} disabled={view.day >= today}
            accessibilityRole="button" accessibilityLabel="Next day" accessibilityState={{ disabled: view.day >= today }} style={s.navButton}>
            <Text style={[s.action, view.day >= today && s.disabled]}>Next</Text>
          </Pressable>
        </View>
        <Pressable onPress={() => loadDay(localDateKey(new Date()))} accessibilityRole="button" style={s.todayButton}>
          <Text style={s.action}>Today</Text>
        </Pressable>
        {view.days.length > 0 && (
          <View style={s.loggedDays}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.dayChips}>
              {view.days.filter((day) => day <= today).map((day) => (
                <Pressable key={day} onPress={() => loadDay(day)} accessibilityRole="button" accessibilityLabel={`Show meals for ${day}`}
                  accessibilityState={{ selected: day === view.day }} style={[s.chip, day === view.day && s.selectedChip]}>
                  <Text style={s.chipText}>{day}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}
        {readError ? (
          <View style={s.empty}>
            <Text accessibilityRole="alert" style={s.help}>Could not load meals.</Text>
            <Pressable onPress={() => loadDay(selectedDay.current)} accessibilityRole="button" style={s.todayButton}>
              <Text style={s.action}>Retry</Text>
            </Pressable>
          </View>
        ) : !ready ? <ActivityIndicator color={colors.ink} accessibilityLabel="Loading meal history" /> : (
          <>
            <View style={s.summary}>
              <Text style={s.totals}>{num(totals.kcal)} kcal · {num(totals.protein)} g protein · {num(totals.fibre)} g fibre</Text>
              <Text style={s.help}>Carbs {totals.carbs === null ? '—' : num(totals.carbs)} g · Fat {totals.fat === null ? '—' : num(totals.fat)} g</Text>
              {totals.pending > 0 && <Text style={s.help}>{totals.pending} pending · partial totals</Text>}
            </View>
            <FlatList data={view.meals} keyExtractor={(meal) => meal.id} style={s.list} contentContainerStyle={s.listContent}
              renderItem={({ item, index }) => <MealRow meal={item} last={index === view.meals.length - 1} onPress={() => setEditingMeal(item)} />}
              ListEmptyComponent={<Text style={s.help}>No meals.</Text>} />
          </>
        )}
      </View>
      {editingMeal && (
        <MealEditor meal={editingMeal} onClose={() => setEditingMeal(null)} onSave={(input) => {
          const saved = updateMeal(editingMeal.id, input);
          setView((previous) => ({ ...previous, meals: previous.meals.map((meal) => meal.id === saved.id ? saved : meal) }));
        }} />
      )}
    </Modal>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  header: { paddingHorizontal: gutter, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 20 },
  title: { fontFamily: fonts.uiSemi, fontSize: 23, color: colors.ink },
  action: { fontFamily: fonts.uiMedium, fontSize: 13, color: colors.protein },
  navigation: { paddingHorizontal: gutter, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  navButton: { paddingVertical: 12 },
  day: { flex: 1, textAlign: 'center', fontFamily: fonts.uiSemi, fontSize: 15, color: colors.ink },
  disabled: { color: colors.inkLow },
  todayButton: { paddingVertical: 12, alignItems: 'center' },
  loggedDays: { marginTop: 12 },
  dayChips: { paddingHorizontal: gutter, paddingVertical: 10, gap: 8 },
  chip: { borderWidth: 1, borderColor: colors.rule, borderRadius: 18, paddingVertical: 8, paddingHorizontal: 12 },
  selectedChip: { borderColor: colors.protein, backgroundColor: colors.card },
  chipText: { fontFamily: fonts.mono, fontSize: 12, color: colors.ink },
  summary: { paddingHorizontal: gutter, paddingVertical: 20, gap: 8 },
  totals: { fontFamily: fonts.uiSemi, fontSize: 14, color: colors.ink },
  help: { fontFamily: fonts.ui, fontSize: 13, lineHeight: 20, color: colors.inkMid },
  list: { flex: 1 },
  listContent: { paddingHorizontal: gutter, paddingBottom: 24 },
  empty: { padding: gutter, gap: 12 },
});
