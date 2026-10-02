import { StyleSheet } from 'react-native';

export const palette = {
  light: { background: '#F4F7F4', surface: '#FFFFFF', text: '#1B3534', muted: '#526767', accent: '#17685D', border: '#D9E4DF', danger: '#AA2535', tint: '#E3EFE9' },
  dark: { background: '#101C1B', surface: '#1A2A28', text: '#E8F1EC', muted: '#A5BCB5', accent: '#8CDBBF', border: '#36504A', danger: '#FFA8B1', tint: '#29433C' },
};
export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };
export const styles = StyleSheet.create({
  flex: { flex: 1 }, page: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xl },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.md, gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  stack: { gap: spacing.md }, smallStack: { gap: spacing.sm },
  title: { fontSize: 30, fontWeight: '700', lineHeight: 38 }, heading: { fontSize: 22, fontWeight: '600', lineHeight: 30 },
  body: { fontSize: 16, lineHeight: 25 }, caption: { fontSize: 13, lineHeight: 20 },
  card: { padding: spacing.lg, gap: spacing.md, borderRadius: 24 },
  input: { minHeight: 52, borderRadius: 14, borderWidth: 1, paddingHorizontal: spacing.md, fontSize: 17 },
  tabs: { flexDirection: 'row', borderTopWidth: 1, paddingTop: spacing.sm },
  tab: { flex: 1, minHeight: 56, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.xs, paddingVertical: spacing.sm, gap: spacing.xs },
  tabLabel: { fontSize: 12, fontWeight: '600', textAlign: 'center' },
  indicator: { height: 3, width: 24, borderRadius: 2 },
  language: { minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'center' },
});
