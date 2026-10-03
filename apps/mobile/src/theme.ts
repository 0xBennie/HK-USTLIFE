import { StyleSheet } from 'react-native';

// Values mirror the Pen variables in design/campus-apple.pen (campus-* and ios-*). Change Pen first, then here.
// V3 Glass (Pen boards "V3 / …", variables g-*). Plasma-like: monochrome ink actions on soft neutral grey, colour only for meaning (deadline red, live green, category tiles).
export const palette = {
  light: { background: '#F2F4F7', surface: '#FFFFFF', solid: '#FFFFFF', glassBorder: '#FFFFFF00', text: '#0B0B0C', muted: '#7A7A80', accent: '#0B0B0C', onAccent: '#FFFFFF', link: '#0B0B0C', border: '#E7E7EB', danger: '#E5484D', tint: '#0B0B0C0D', tertiary: '#C2C2C8', fill: '#76768017', glass: '#FFFFFFD9', red: '#E5484D', green: '#2E9E5B', orange: '#D98A1C', purple: '#6B6F8E', teal: '#4F6F8C', indigo: '#56647D', blue: '#24467F', pink: '#A9824C', gray: '#8E8E93' },
  dark: { background: '#07090D', surface: '#1C1C1E', solid: '#1C1C1E', glassBorder: '#FFFFFF0F', text: '#F5F5F7', muted: '#8E8E93', accent: '#F5F5F7', onAccent: '#000000', link: '#F5F5F7', border: '#2C2C2E', danger: '#EC5D61', tint: '#FFFFFF14', tertiary: '#5A5A5E', fill: '#7676803D', glass: '#1C1C1ED9', red: '#EC5D61', green: '#3FB36E', orange: '#E0A040', purple: '#8E92B0', teal: '#4F6F8C', indigo: '#7F8DA8', blue: '#8FB0E8', pink: '#C8A875', gray: '#8E8E93' },
};
export type Colors = typeof palette.light;
export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };
// Pen "Component / Tab bar" is a 64pt floating capsule.
export const TAB_BAR_HEIGHT = 64;
export const styles = StyleSheet.create({
  // Pen "Scrollable content": 16pt side padding, 18pt section gap.
  flex: { flex: 1 }, page: { paddingHorizontal: 16, gap: 18 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, flexWrap: 'wrap' },
  stack: { gap: spacing.md }, smallStack: { gap: spacing.sm },
  title: { fontSize: 34, fontWeight: '700', lineHeight: 41, letterSpacing: 0.2 },
  heading: { fontSize: 20, fontWeight: '600', lineHeight: 27 },
  body: { fontSize: 17, lineHeight: 24 }, caption: { fontSize: 13, lineHeight: 19 },
  card: { padding: 20, gap: 12, borderRadius: 20, borderCurve: 'continuous', boxShadow: 'none' },
  input: { minHeight: 48, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: spacing.md, paddingVertical: 12, fontSize: 17 },
});
