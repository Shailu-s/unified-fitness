import type { TextStyle } from 'react-native';

// Tokens lifted 1:1 from the HTML designs. Paper, never pure white.
export const colors = {
  paper: '#FAF7F1',
  paper2: '#F4F0E8',
  card: '#FFFDF9',
  rule: '#E3DDD1',
  ruleStrong: '#CDC5B5',

  ink: '#1F1B16',
  inkMid: '#6B6459',
  inkLow: '#9A9285',

  // Apple Activity ring colours
  move: '#FA114F',
  exer: '#92E82A',
  stand: '#1AD7E5',

  steps: '#2E8B62',
  protein: '#C2410C',
  fibre: '#4D7C3F',
} as const;

// React Native has no fontWeight for custom fonts, so each weight is its own family.
export const fonts = {
  ui: 'Inter_400Regular',
  uiMedium: 'Inter_500Medium',
  uiSemi: 'Inter_600SemiBold',
  uiBold: 'Inter_700Bold',
  mono: 'JetBrainsMono_400Regular',
  monoMedium: 'JetBrainsMono_500Medium',
  monoSemi: 'JetBrainsMono_600SemiBold',
  monoBold: 'JetBrainsMono_700Bold',
} as const;

export const radius = { lg: 18, md: 12, sm: 9 } as const;
export const gutter = 22;

// Small uppercase label used for section heads and metric names.
export const eyebrow: TextStyle = {
  fontFamily: fonts.uiSemi,
  fontSize: 10,
  letterSpacing: 1.2,
  textTransform: 'uppercase',
  color: colors.inkLow,
};
