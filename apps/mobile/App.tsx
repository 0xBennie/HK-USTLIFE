import { CampusScreen } from './src/campus/CampusScreen';
import './global.css';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Pressable, ScrollView, Text, useColorScheme, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { HeroUINativeProvider } from 'heroui-native/provider';
import { Button } from 'heroui-native/button';
import { Card } from 'heroui-native/card';
import { StatusBar } from 'expo-status-bar';
import { session } from './src/runtime';
import { LoginScreen, ProfileScreen } from './src/screens/AccountScreen';
import { strings, type Language } from './src/strings';
import { palette, styles } from './src/theme';
import { StudyScreen } from './src/study/StudyScreen';

function CampusApp() {
  const state = useSyncExternalStore(session.subscribe, session.snapshot);
  const [language, setLanguage] = useState<Language>('zh');
  const [tab, setTab] = useState(4);
  const dark = useColorScheme() === 'dark';
  const colors = palette[dark ? 'dark' : 'light'], t = strings[language];
  useEffect(() => { void session.restore(); }, []);
  useEffect(() => { if (state.profile) setLanguage(state.profile.language); }, [state.profile?.id]);
  return <SafeAreaView style={[styles.flex, { backgroundColor: colors.background }]}>
    <StatusBar style={dark ? 'light' : 'dark'} />
    <View style={styles.header}>
      <View style={styles.row}>
        <Text style={[styles.caption, { color: colors.muted }]}>{t.campus}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={language === 'zh' ? 'Switch to English' : '切换至中文'} style={styles.language} onPress={() => setLanguage(language === 'zh' ? 'en' : 'zh')}><Text style={{ color: colors.accent }}>{language === 'zh' ? 'EN' : '中文'}</Text></Pressable>
      </View>
      <Text style={[styles.caption, { color: colors.accent }]}>{t.dev}</Text>
    </View>
    <KeyboardAvoidingView behavior="padding" style={styles.flex}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.page}>
        {tab === 4 ? state.status === 'loading' ? <View style={styles.stack}><ActivityIndicator color={colors.accent} /><Text style={{ color: colors.text }}>{t.loading}</Text></View>
          : state.status === 'error' ? <View style={styles.stack}><Text accessibilityRole="alert" style={[styles.body, { color: colors.danger }]}>{t.errors[state.error ?? ''] ?? t.network}</Text><Button onPress={() => session.restore()}>{t.retry}</Button></View>
          : state.profile ? <ProfileScreen key={state.profile.id} profile={state.profile} language={language} dark={dark} />
          : <LoginScreen language={language} dark={dark} />
          : tab === 0 ? state.profile ? <StudyScreen key={state.profile.id} language={language} dark={dark} />
          : <View style={styles.stack}><Text style={[styles.heading,{color:colors.text}]}>{t.loginBody}</Text><Button onPress={()=>setTab(4)}>{t.signIn}</Button></View>
          : tab === 1 ? <CampusScreen key={state.profile?.id??'visitor'} language={language} dark={dark} onLogin={()=>setTab(4)}/>
          : <View style={styles.stack}>
            <Text style={[styles.title, { color: colors.text }]}>{[t.todayTitle, t.campusTitle, t.discoverTitle, t.inboxTitle][tab]}</Text>
            <Card style={[styles.card, { backgroundColor: colors.surface }]}><Text style={[styles.heading, { color: colors.text }]}>{t.phase}</Text><Text style={[styles.body, { color: colors.muted }]}>{t.pending}</Text></Card>
          </View>}
      </ScrollView>
    </KeyboardAvoidingView>
    <View accessibilityRole="tablist" style={[styles.tabs, { borderTopColor: colors.border, backgroundColor: colors.surface }]}>
      {t.tabs.map((label, index) => <Pressable key={index} accessibilityRole="tab" accessibilityState={{ selected: tab === index }} accessibilityLabel={label} onPress={() => setTab(index)} style={styles.tab}>
        <View style={[styles.indicator, { backgroundColor: tab === index ? colors.accent : 'transparent' }]} />
        <Text style={[styles.tabLabel, { color: tab === index ? colors.accent : colors.muted }]}>{label}</Text>
      </Pressable>)}
    </View>
  </SafeAreaView>;
}
export default function App() {
  return <GestureHandlerRootView style={styles.flex}><SafeAreaProvider><HeroUINativeProvider><CampusApp /></HeroUINativeProvider></SafeAreaProvider></GestureHandlerRootView>;
}
