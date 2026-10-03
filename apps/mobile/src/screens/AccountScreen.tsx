import { useEffect,useRef,useState } from 'react';
import {useNavigationProtection} from '../navigation/InputProtection';
import {protectionFor} from '../navigation/protection';
import type {AccountExitKind} from '../navigation/account-exit';
import { Share, Text, View } from 'react-native';
import { Button } from '../ui/Primitives';
import { Card } from '../ui/Primitives';
import { Input } from '../ui/Primitives';
import { ApiFailure } from '../api';
import { api, session } from '../runtime';
import type { Profile } from '../session';
import { strings, type Language } from '../strings';
import { palette, styles } from '../theme';

type Props = { language: Language; dark: boolean };
function useAction(language: Language) {
  const [busy, setBusy] = useState(false);
  const locked=useRef(false),alive=useRef(true);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  async function run(action: () => Promise<void>) {
    if (locked.current||!alive.current) return;
    locked.current=true;setBusy(true); setMessage(''); setFailed(false);
    try { await action(); }
    catch (error) { if(alive.current){setFailed(true); setMessage(strings[language].errors[error instanceof ApiFailure ? error.code : 'REQUEST_FAILED'] ?? strings[language].errors.REQUEST_FAILED);} }
    finally { locked.current=false;if(alive.current)setBusy(false); }
  }
  return { busy, message, failed, run, isCurrent:()=>alive.current, setMessage:(value:string)=>{if(alive.current)setMessage(value);} };
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
    if(action.isCurrent()){setChallenge(result.challenge_id); setCode('');}
  });
  return <View style={styles.stack}>
    <Text style={[styles.title, { color: colors.text }]}>{t.loginTitle}</Text>
    <Text style={[styles.body, { color: colors.muted }]}>{t.loginBody}</Text>
    <Card style={[styles.card, { backgroundColor: colors.surface }]}>
      <Text style={[styles.body, { color: colors.text }]}>{t.email}</Text>
      <Input accessibilityLabel={t.email} value={email} onChangeText={setEmail} editable={!challenge && !action.busy} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" textContentType="emailAddress" style={input} />
      {challenge ? <>
        <Text style={[styles.body, { color: colors.text }]}>{t.code}</Text>
        <Input accessibilityLabel={t.code} value={code} editable={!action.busy} onChangeText={value => setCode(value.replace(/\D/g, ''))} keyboardType="number-pad" textContentType="oneTimeCode" maxLength={6} style={input} />
        <Button isDisabled={action.busy || code.length !== 6} onPress={() => action.run(async () => {
          const result = await api.request<{ access_token: string }>('/auth/email/verify', { method: 'POST', body: { challenge_id: challenge, code } });
          if(action.isCurrent())await session.signIn(result.access_token);
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

export function ProfileScreen({ profile, language, dark,exitBusy,exitError,onExit }: Props & { profile: Profile;exitBusy:boolean;exitError:unknown;onExit:(kind:AccountExitKind)=>void }) {
  const t = strings[language], colors = palette[dark ? 'dark' : 'light'];
  const [name, setName] = useState(profile.display_name);
  const action = useAction(language);
  const busy=action.busy||exitBusy;
  useNavigationProtection(protectionFor(name!==profile.display_name||language!==profile.language,busy,false),language==='zh');
  return <View style={styles.stack}>
    <Text style={[styles.title, { color: colors.text }]}>{t.account}</Text>
    <Text selectable style={[styles.body, { color: colors.muted }]}>{profile.email}</Text>
    <Card style={[styles.card, { backgroundColor: colors.surface }]}>
      <Text style={[styles.body, { color: colors.text }]}>{t.name}</Text>
      <Input accessibilityLabel={t.name} value={name} editable={!busy} onChangeText={setName} maxLength={80} style={[styles.input, { color: colors.text, borderColor: colors.border }]} />
      <Button isDisabled={busy} onPress={() => action.run(async () => { await session.updateProfile({ display_name: name, language }); action.setMessage(t.saved); })}>{t.save}</Button>
    </Card>
    <Card style={[styles.card, { backgroundColor: colors.surface }]}>
      <Text style={[styles.heading, { color: colors.text }]}>{t.school}</Text>
      <Text style={[styles.body, { color: colors.muted }]}>{t.schoolBody}</Text>
    </Card>
    <Text style={[styles.body, { color: colors.muted }]}>{t.privacy}</Text>
    {action.message ? <Text accessibilityRole="alert" style={[styles.body, { color: action.failed ? colors.danger : colors.accent }]}>{action.message}</Text> : null}
    {exitError?<Text accessibilityRole="alert" style={[styles.body,{color:colors.danger}]}>{exitError instanceof ApiFailure&&exitError.code==='EXIT_REVIEW_REQUIRED'?(language==='zh'?'账户或未保存状态已变化，请重新检查后操作。':'The account or unsaved state changed. Review it before trying again.'):t.errors[exitError instanceof ApiFailure?exitError.code:'REQUEST_FAILED']??t.errors.REQUEST_FAILED}</Text>:null}
    <Button variant="secondary" isDisabled={busy} onPress={() => action.run(async () => { const data = await session.request('/me/export'); if(action.isCurrent())await Share.share({ message: JSON.stringify(data, null, 2), title: t.export }); })}>{t.export}</Button>
    <Button variant="secondary" isDisabled={busy} onPress={() => onExit('sign-out')}>{t.signOut}</Button>
    <Button variant="danger-soft" isDisabled={busy} onPress={() => onExit('delete')}>{t.delete}</Button>
  </View>;
}
