// Visual tokens from design/DESIGN_HANDOFF.md and design/INVENTORY.md.
export const colors = {
  primary: '#296474', // lh-primary
  ink: '#183B45', // lh-ink
  bg: '#F4F8F9', // lh-bg
  muted: '#5D7379', // lh-muted
  surface: '#FFFFFF',
  onPrimary: '#FFFFFF',
  accentSurface: '#E5F1F3',
  divider: '#DFE9EB',
  track: '#D6E5E9',
  danger: '#B5563F',
  dangerSurface: '#F6E7E3',
  warning: '#A8703B',
  warningSurface: '#FBF3EA',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  screen: 20, // horizontal screen padding
  section: 24, // gap between screen sections
  xl: 32,
} as const;

export const radius = {
  md: 12,
  lg: 16, // primary button
} as const;

// PostScript names = file names in assets/fonts, so the same string works on iOS and Android.
// Do not combine with fontWeight: each weight is its own family.
export const fonts = {
  display: 'Inter-SemiBold', // lh-display role, 600 (Funnel Sans dropped: no Vietnamese glyphs)
  body: 'Inter-Regular', // lh-body
  bodyMedium: 'Inter-Medium',
  bodySemiBold: 'Inter-SemiBold',
} as const;

export const text = {
  displayLg: {
    fontFamily: fonts.display,
    fontSize: 32,
    lineHeight: 40,
    color: colors.ink,
  },
  title: {
    fontFamily: fonts.display,
    fontSize: 27, // page heading in muJxs / myIYB / bnCOs
    lineHeight: 34,
    color: colors.ink,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 24,
    color: colors.ink,
  },
  label: {
    fontFamily: fonts.bodyMedium,
    fontSize: 14,
    lineHeight: 20,
    color: colors.muted,
  },
} as const;
