import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { colors } from '../theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// Drawn in a fixed 290 box and scaled by the Svg width/height.
const BOX = 290;
const C = BOX / 2;
const STROKE = 20;

function Track({ r, color, fraction }: { r: number; color: string; fraction: number }) {
  const circ = 2 * Math.PI * r;
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: Math.min(Math.max(fraction, 0), 1),
      duration: 1200,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
      useNativeDriver: false, // SVG props cannot use the native driver
    }).start();
  }, [fraction, progress]);

  const offset = progress.interpolate({ inputRange: [0, 1], outputRange: [circ, 0] });

  return (
    <>
      <Circle cx={C} cy={C} r={r} stroke={colors.paper2} strokeWidth={STROKE} fill="none" />
      <AnimatedCircle
        cx={C}
        cy={C}
        r={r}
        stroke={color}
        strokeWidth={STROKE}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={`${circ} ${circ}`}
        strokeDashoffset={offset}
      />
    </>
  );
}

interface RingProps {
  size: number;
  move: number; // each 0..1
  exercise: number;
  stand: number;
}

export function Ring({ size, move, exercise, stand }: RingProps) {
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${BOX} ${BOX}`}>
      <G rotation={-90} origin={`${C}, ${C}`}>
        <Track r={125} color={colors.move} fraction={move} />
        <Track r={101} color={colors.exer} fraction={exercise} />
        <Track r={77} color={colors.stand} fraction={stand} />
      </G>
    </Svg>
  );
}
