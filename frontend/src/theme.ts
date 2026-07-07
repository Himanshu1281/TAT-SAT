export const colors = {
  surface: '#F7F6F2',
  onSurface: '#1A1A1A',
  surfaceSecondary: '#FFFFFF',
  surfaceTertiary: '#ECE8E1',
  surfaceInverse: '#101828',
  onSurfaceInverse: '#FFFFFF',
  brand: '#FFBA3D',
  onBrand: '#1A1A1A',
  brandSecondary: '#7861FF',
  brandTertiary: '#00BB84',
  success: '#00BB84',
  warning: '#FFBA3D',
  error: '#D92D20',
  border: '#ECE8E1',
  divider: '#ECE8E1',
  muted: '#6B6558',
  mutedStrong: '#3F3B33',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
  xxxl: 48,
};

export const radius = {
  sm: 8,
  md: 16,
  lg: 24,
  pill: 999,
};

export const fonts = {
  display: 'Cormorant Garamond',
  text: 'Inter',
};

export const type = {
  display: { fontSize: 32, fontWeight: '700' as const, lineHeight: 40 },
  h1: { fontSize: 24, fontWeight: '600' as const, lineHeight: 32 },
  h2: { fontSize: 20, fontWeight: '600' as const, lineHeight: 28 },
  h3: { fontSize: 16, fontWeight: '600' as const, lineHeight: 22 },
  body: { fontSize: 14, fontWeight: '400' as const, lineHeight: 22 },
  bodyStrong: { fontSize: 14, fontWeight: '600' as const, lineHeight: 22 },
  caption: { fontSize: 12, fontWeight: '400' as const, lineHeight: 16 },
};

export const shadow = {
  soft: {
    shadowColor: '#1A1A1A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
};
