import { useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../context/AppContext';
import { MealEditor } from '../components/MealEditor';
import { colors, fonts, gutter } from '../theme';
import { num } from '../lib/format';
import { removeLocalPhoto } from '../lib/photoFiles';

const errors: Record<string, string> = {
  not_food: 'Food was not clearly visible. Add a food description or take a clearer photo; no calories were invented.',
  budget_exceeded: 'The testing budget is reached. Your meal and photo are saved safely.',
  invalid_result: 'The estimate could not be validated. Edit the food or retry.',
  photo_upload: 'The local photo could not be prepared. Your meal remains saved; try another photo.',
  backend_not_configured: 'Estimation setup is unavailable. Your meal is saved safely.',
  network: 'Could not finish after retries. Your meal is saved; retry when connected.',
};

export function MealResultScreen({ id, onClose }: { id: string; onClose: () => void }) {
  const { getMeal, retryEstimate, removePhoto, updateMeal, photosEnabled } = useApp();
  const meal = getMeal(id);
  const insets = useSafeAreaInsets();
  const [editing, setEditing] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const pending = meal.nutritionStatus === 'pending';
  const waitingSetup = meal.inputType === 'photo' && !photosEnabled;
  const remove = () => Alert.alert('Remove this photo?', 'Nutrition and meal details stay. The saved photo on this device will be removed.', [
    { text: 'Cancel', style: 'cancel' }, { text: 'Remove photo', style: 'destructive', onPress: () => {
      try { const uri = meal.photoUri; removePhoto(id); if (uri) removeLocalPhoto(uri); }
      catch { setLocalError('Could not fully remove the photo. Check device storage and retry.'); }
    } },
  ]);
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={[s.root, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
        <View style={s.header}>
          <Text style={s.title}>Your meal</Text>
          <Pressable onPress={onClose} accessibilityRole="button"><Text style={s.action}>Done</Text></Pressable>
        </View>
        <ScrollView contentContainerStyle={s.body}>
          {meal.photoUri && <Image source={{ uri: meal.photoUri }} style={s.image} accessibilityLabel="Saved meal photo" />}
          <Text style={s.name}>{meal.name}</Text>
          <Text style={s.help}>{meal.portion}</Text>
          {pending ? (
            <View style={s.status}>
              {meal.estimateState !== 'failed' && !waitingSetup && <ActivityIndicator size="large" color={colors.protein} />}
              <Text accessibilityRole={meal.estimateState === 'failed' ? 'alert' : undefined} style={s.statusText}>
                {waitingSetup ? 'Photo saved. Photo backend activation is pending.' : meal.estimateState === 'failed' ? errors[meal.estimateError ?? 'network'] ?? errors.network :
                  meal.estimateError === 'network' ? 'Still working — retrying when connected.' : meal.estimateState === 'running' ? 'Estimating your meal…' : 'Saved on your phone. Waiting to estimate…'}
              </Text>
              <Text style={s.help}>You can leave this screen. Logging never waits for the network.</Text>
            </View>
          ) : (
            <>
              <Text style={s.badge}>{meal.nutritionStatus === 'manual' ? 'Your corrected nutrition' : 'AI estimate · approximate'}</Text>
              <View style={s.macros}>
                <Metric label="Calories" value={meal.kcal} unit="kcal" />
                <Metric label="Protein" value={meal.protein} unit="g" />
                <Metric label="Carbs" value={meal.carbs} unit="g" />
              </View>
              <Text style={s.help}>Fat {meal.fat === null ? '—' : num(meal.fat)} g · Fibre {meal.fibre === null ? '—' : num(meal.fibre)} g</Text>
              {meal.foods.length > 0 && <View style={s.section}>
                <Text style={s.heading}>Identified foods · guessed portions</Text>
                {meal.foods.map((food, index) => <Text key={index} style={s.help}>{food.name} — {food.portion}</Text>)}
              </View>}
              <View style={s.section}>
                <Text style={s.heading}>Portion and preparation assumptions</Text>
                {meal.assumptions.length ? meal.assumptions.map((assumption, index) => <Text key={index} style={s.help}>{assumption}</Text>) : <Text style={s.help}>No model assumptions on manually entered values.</Text>}
                {meal.inputType === 'photo' && <Text style={s.help}>A photo cannot measure hidden oil/ghee or recipe ingredients. Add actual quantities when known.</Text>}
              </View>
            </>
          )}
          <Pressable onPress={() => setEditing(true)} accessibilityRole="button" style={s.button}><Text style={s.action}>Edit foods, portions or nutrition</Text></Pressable>
          {meal.estimateState === 'failed' && !waitingSetup && <Pressable onPress={() => retryEstimate(id)} accessibilityRole="button" style={s.button}><Text style={s.action}>Retry estimate</Text></Pressable>}
          {meal.photoUri && <Pressable onPress={remove} accessibilityRole="button" style={s.button}><Text style={s.action}>Remove local photo</Text></Pressable>}
          {localError && <Text accessibilityRole="alert" style={s.help}>{localError}</Text>}
        </ScrollView>
      </View>
      {editing && <MealEditor meal={meal} onClose={() => setEditing(false)} onSave={(input) => updateMeal(id, input)} />}
    </Modal>
  );
}

function Metric({ label, value, unit }: { label: string; value: number | null; unit: string }) {
  return <View style={s.metric}><Text style={s.number}>{value === null ? '—' : num(value)}</Text><Text style={s.help}>{unit}</Text><Text style={s.label}>{label}</Text></View>;
}
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: gutter, paddingBottom: 16 },
  body: { paddingHorizontal: gutter, gap: 14, paddingBottom: 24 },
  title: { fontFamily: fonts.uiSemi, fontSize: 24, color: colors.ink },
  action: { fontFamily: fonts.uiMedium, fontSize: 14, color: colors.protein },
  name: { fontFamily: fonts.uiSemi, fontSize: 22, color: colors.ink },
  image: { width: '100%', height: 240, borderRadius: 18, resizeMode: 'cover' },
  help: { fontFamily: fonts.ui, fontSize: 14, color: colors.inkMid, lineHeight: 21 },
  badge: { fontFamily: fonts.uiMedium, fontSize: 13, color: colors.protein },
  macros: { flexDirection: 'row', gap: 10 },
  metric: { flex: 1, paddingVertical: 18, alignItems: 'center', backgroundColor: colors.card, borderRadius: 14 },
  number: { fontFamily: fonts.monoBold, fontSize: 27, color: colors.ink },
  label: { fontFamily: fonts.uiMedium, fontSize: 12, color: colors.ink, marginTop: 8 },
  heading: { fontFamily: fonts.uiSemi, fontSize: 15, color: colors.ink },
  section: { gap: 10, paddingTop: 14 },
  status: { gap: 14, paddingVertical: 30, alignItems: 'center' },
  statusText: { fontFamily: fonts.uiMedium, fontSize: 16, color: colors.ink, textAlign: 'center' },
  button: { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: colors.rule },
});
