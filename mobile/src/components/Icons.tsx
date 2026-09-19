import Svg, { Circle, Path, Rect } from 'react-native-svg';

interface IconProps {
  color: string;
  size?: number;
}

const Base = ({ size, color, strokeWidth, children }: IconProps & { strokeWidth: number; children: React.ReactNode }) => (
  <Svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {children}
  </Svg>
);

export const CameraIcon = ({ color, size = 26 }: IconProps) => (
  <Base color={color} size={size} strokeWidth={1.8}>
    <Path d="M3 8.5A1.5 1.5 0 014.5 7h2L8 5h8l1.5 2h2A1.5 1.5 0 0121 8.5v9a1.5 1.5 0 01-1.5 1.5h-15A1.5 1.5 0 013 17.5z" />
    <Circle cx="12" cy="13" r="3.4" />
  </Base>
);

export const MicIcon = ({ color, size = 18 }: IconProps) => (
  <Base color={color} size={size} strokeWidth={1.9}>
    <Rect x="9" y="3" width="6" height="11" rx="3" />
    <Path d="M5 11a7 7 0 0014 0M12 18v3" />
  </Base>
);

export const TypeIcon = ({ color, size = 18 }: IconProps) => (
  <Base color={color} size={size} strokeWidth={1.9}>
    <Path d="M4 7h16M4 12h16M4 17h9" />
  </Base>
);

export const SearchIcon = ({ color, size = 16 }: IconProps) => (
  <Base color={color} size={size} strokeWidth={2.2}>
    <Circle cx="11" cy="11" r="7" />
    <Path d="M20 20l-3.5-3.5" />
  </Base>
);

export const PlusIcon = ({ color, size = 18 }: IconProps) => (
  <Base color={color} size={size} strokeWidth={2}>
    <Path d="M12 5v14M5 12h14" />
  </Base>
);

export const MinusIcon = ({ color, size = 18 }: IconProps) => (
  <Base color={color} size={size} strokeWidth={2}>
    <Path d="M5 12h14" />
  </Base>
);
