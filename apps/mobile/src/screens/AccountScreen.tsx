import { useState } from 'react';
import { Alert, Share, Text, View } from 'react-native';
import { Button } from 'heroui-native/button';
import { Card } from 'heroui-native/card';
import { Input } from 'heroui-native/input';
import { ApiFailure } from '../api';
import { api, session } from '../runtime';
import type { Profile } from '../session';
import { strings, type Language } from '../strings';
import { palette, styles } from '../theme';

type Props = { language: Language; dark: boolean };
function useAction(language: Language) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setMessage(''); setFailed(false);
    try { await action(); }
    catch (error) { setFailed(true); setMessage(strings[language].errors[error instanceof ApiFailure ? error.code : 'REQUEST_FAILED'] ?? strings[language].errors.REQUEST_FAILED); }
    finally { setBusy(false); }
  }
  return { busy, message, failed, run, setMessage };
}
export function LoginScreen({ language, dark }: Props) {
  const t = strings[language], colors = palette[dark ? 'dark' : 'light'];
  const [email, setEmail] = useState('');
  const [challenge, setChallenge] = useState('');
  const [code, setCode] = useState('');
  const action = useAction(language);
  const input = [styles.input, { color: colors.text, borderColor: colors.border }];
  const send = () => action.run(async () => {
    const result = await api.request<{ challenge_id: string }>('/auth/email/challenges', { method: 'POST', body: { email } });
    setChallenge(result.challenge_id); setCode('');
  });
  return <View style={styles.stack}>
    <Text style={[styles.title, { color: colors.text }]}>{t.loginTitle}</Text>
    <Text style={[styles.body, { color: colors.muted }]}>{t.loginBody}</Text>
    <Card style={[styles.card, { backgroundColor: colors.surface }]}>
      <Text style={[styles.body, { color: colors.text }]}>{t.email}</Text>
      <Input accessibilityLabel={t.email} value={email} onChangeText={setEmail} editable={!challenge && !action.busy} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" textContentType="emailAddress" style={input} />
      {challenge ? <>
        <Text style={[styles.body, { color: colors.text }]}>{t.code}</Text>
        <Input accessibilityLabel={t.code} value={code} onChangeText={value => setCode(value.replace(/\D/g, ''))} keyboardType="number-pad" textContentType="oneTimeCode" maxLength={6} style={input} />
        <Button isDisabled={action.busy || code.length !== 6} onPress={() => action.run(async () => {
          const result = await api.request<{ access_token: string }>('/auth/email/verify', { method: 'POST', body: { challenge_id: challenge, code } });
          await session.signIn(result.access_token);
        })}>{action.busy ? t.loading : t.signIn}</Button>
        <Button variant="secondary" isDisabled={action.busy} onPress={send}>{t.resend}</Button>
        <Button variant="ghost" isDisabled={action.busy} onPress={() => { setChallenge(''); setCode(''); }}>{t.changeEmail}</Button>
      </> : <Button isDisabled={action.busy || !email.includes('@')} onPress={send}>{action.busy ? t.loading : t.sendCode}</Button>}
      {action.message ? <Text accessibilityRole="alert" style={[styles.body, { color: colors.danger }]}>{action.message}</Text> : null}
    </Card>
    <Text style={[styles.caption, { color: colors.muted }]}>{t.localMail}</Text>
    {challenge ? <Text selectable style={[styles.caption, { color: colors.muted }]}>Challenge: {challenge}</Text> : null}
  </View>;
}

export function ProfileScreen({ profile, language, dark }: Props & { profile: Profile }) {
  const t = strings[language], colors = palette[dark ? 'dark' : 'light'];
  const [name, setName] = useState(profile.display_name);
  const action = useAction(language);
  return <View style={styles.stack}>
    <Text style={[styles.title, { color: colors.text }]}>{t.account}</Text>
    <Text selectable style={[styles.body, { color: colors.muted }]}>{profile.email}</Text>
    <Card style={[styles.card, { backgroundColor: colors.surface }]}>
      <Text style={[styles.body, { color: colors.text }]}>{t.name}</Text>
      <Input accessibilityLabel={t.name} value={name} onChangeText={setName} maxLength={80} style={[styles.input, { color: colors.text, borderColor: colors.border }]} />
      <Button isDisabled={action.busy} onPress={() => action.run(async () => { await session.updateProfile({ display_name: name, language }); action.setMessage(t.saved); })}>{t.save}</Button>
    </Card>
    <Card style={[styles.card, { backgroundColor: colors.surface }]}>
      <Text style={[styles.heading, { color: colors.text }]}>{t.school}</Text>
      <Text style={[styles.body, { color: colors.muted }]}>{t.schoolBody}</Text>
    </Card>
    <Text style={[styles.body, { color: colors.muted }]}>{t.privacy}</Text>
    {action.message ? <Text accessibilityRole="alert" style={[styles.body, { color: action.failed ? colors.danger : colors.accent }]}>{action.message}</Text> : null}
    <Button variant="secondary" isDisabled={action.busy} onPress={() => action.run(async () => { const data = await session.request('/me/export'); await Share.share({ message: JSON.stringify(data, null, 2), title: t.export }); })}>{t.export}</Button>
    <Button variant="secondary" isDisabled={action.busy} onPress={() => action.run(() => session.signOut())}>{t.signOut}</Button>
    <Button variant="ghost" isDisabled={action.busy} onPress={() => Alert.alert(t.delete, t.deleteBody, [{ text: t.cancel, style: 'cancel' }, { text: t.delete, style: 'destructive', onPress: () => action.run(() => session.deleteAccount()) }])}>{t.delete}</Button>
  </View>;
}
