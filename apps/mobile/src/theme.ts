import { StyleSheet } from 'react-native';

// System-font metrics and semantic colors, shared by every native screen.
export const palette = {
  light: { background: '#F2F2F7', surface: '#FFFFFF', text: '#1C1C1E', muted: '#636366', accent: '#0066CC', border: '#D1D1D6', danger: '#C9342D', tint: '#E8F1FC' },
  dark: { background: '#000000', surface: '#1C1C1E', text: '#F5F5F7', muted: '#AEAEB2', accent: '#70B5FF', border: '#38383A', danger: '#FF6961', tint: '#152C46' },
};
export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };
export const styles = StyleSheet.create({
  flex: { flex: 1 }, page: { padding: 20, gap: spacing.lg, paddingBottom: spacing.xl },
  header: { paddingHorizontal: 20, paddingTop: spacing.xs, paddingBottom: spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, flexWrap: 'wrap' },
  stack: { gap: spacing.md }, smallStack: { gap: spacing.sm },
  title: { fontSize: 34, fontWeight: '700', lineHeight: 41, letterSpacing: 0.2 },
  heading: { fontSize: 20, fontWeight: '600', lineHeight: 27 },
  body: { fontSize: 17, lineHeight: 24 }, caption: { fontSize: 13, lineHeight: 19 },
  card: { padding: 20, gap: 12, borderRadius: 20, borderCurve: 'continuous', boxShadow: 'none' },
  input: { minHeight: 48, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: spacing.md, paddingVertical: 12, fontSize: 17 },
  tabs: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.xs, paddingHorizontal: spacing.xs, paddingBottom: spacing.xs },
  tab: { flex: 1, minHeight: 56, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 2, paddingVertical: spacing.xs, gap: 3 },
  tabLabel: { fontSize: 11, fontWeight: '500', textAlign: 'center' },
  language: { minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'center' },
});
