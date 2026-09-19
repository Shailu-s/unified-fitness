import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { num } from '../lib/format';
import { colors, fonts } from '../theme';

interface Props {
  name: string;
  value: number;
  goal: number;
  unit: 'g' | 'kcal';
  color: string;
}

export function MacroBar({ name, value, goal, unit, color }: Props) {
  const fraction = goal > 0 ? value / goal : 0;
  const shown = Math.round(fraction * 100);
  const capped = Math.min(fraction, 1);

  // Where the percentage sits: inside the fill, or outside when the fill is too short or empty.
  const zero = fraction === 0;
  const thin = !zero && fraction < 0.12;

  const grow = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(grow, {
      toValue: capped,
      duration: 900,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
      useNativeDriver: false, // width is not supported by the native driver
    }).start();
  }, [capped, grow]);

  const width = grow.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <View>
      <View style={s.head}>
        <Text style={s.name}>{name}</Text>
        <Text style={s.val}>
          <Text style={s.valStrong}>{num(value)}</Text> / {num(goal)} {unit}
        </Text>
      </View>

      <View style={s.track}>
        <Animated.View style={[s.fill, { backgroundColor: color, width }]}>
          {!zero && !thin && <Text style={s.inside}>{shown}%</Text>}
        </Animated.View>
        {(zero || thin) && <Text style={[s.outside, { marginLeft: zero ? 11 : 8 }]}>{shown}%</Text>}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 },
  name: {
    fontFamily: fonts.uiSemi,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.inkMid,
  },
  val: { fontFamily: fonts.monoMedium, fontSize: 11.5, color: colors.inkLow },
  valStrong: { fontFamily: fonts.monoBold, color: colors.ink },
  track: {
    height: 26,
    borderRadius: 7,
    backgroundColor: colors.paper2,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
  },
  fill: { height: '100%', borderRadius: 7, justifyContent: 'center', alignItems: 'flex-end', paddingRight: 9 },
  inside: { fontFamily: fonts.monoBold, fontSize: 11, color: '#fff' },
  outside: { fontFamily: fonts.monoBold, fontSize: 11, color: colors.inkMid },
});
