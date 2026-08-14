import type { TextStyle, ViewStyle } from 'react-native';

export const palette = {
  canvas: '#F4F1EA', surface: '#FFFFFF', surfaceRaised: '#FAF9F6',
  ink: '#111111', inkSubtle: '#5E5D58', inkFaint: '#86837B',
  line: '#D7D3CA', lineStrong: '#B8B3A8', dark: '#141414',
  onDark: '#FFFFFF', onDarkSubtle: '#C9C7C1', primary: '#2459D3',
  destructive: '#A22B25', highlight: '#FFF1A8'
} as const;

export const spacing = { xxs: 4, xs: 8, sm: 12, md: 16, lg: 24, xl: 32, xxl: 48 } as const;
export const radius = { sm: 8, md: 14, lg: 22, round: 999 } as const;

export const type = {
  eyebrow: { fontSize: 12, lineHeight: 16, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' } satisfies TextStyle,
  title: { fontSize: 34, lineHeight: 39, fontWeight: '700', letterSpacing: -1.1 } satisfies TextStyle,
  heading: { fontSize: 24, lineHeight: 29, fontWeight: '700', letterSpacing: -0.5 } satisfies TextStyle,
  subheading: { fontSize: 18, lineHeight: 23, fontWeight: '600' } satisfies TextStyle,
  body: { fontSize: 16, lineHeight: 23, fontWeight: '400' } satisfies TextStyle,
  bodyStrong: { fontSize: 16, lineHeight: 23, fontWeight: '600' } satisfies TextStyle,
  meta: { fontSize: 13, lineHeight: 18, fontWeight: '500' } satisfies TextStyle,
  mono: { fontSize: 13, lineHeight: 18, fontVariant: ['tabular-nums'] } satisfies TextStyle
} as const;

export const shadow: ViewStyle = {
  shadowColor: '#000000', shadowOpacity: 0.08, shadowRadius: 18,
  shadowOffset: { width: 0, height: 6 }, elevation: 3
};
