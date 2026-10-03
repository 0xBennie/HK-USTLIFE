import * as SecureStore from 'expo-secure-store';
import { ApiClient } from './api';
import { SessionController } from './session';

export const api = new ApiClient(process.env.EXPO_PUBLIC_API_URL ?? 'http://127.0.0.1:4318/api/v1');
const key = 'campus.local.session.v1';
export const session = new SessionController(api, {
  get: () => SecureStore.getItemAsync(key),
  set: token => SecureStore.setItemAsync(key, token, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }),
  clear: () => SecureStore.deleteItemAsync(key),
});

// No remote token registration: reminders are scheduled only on this device.
import { ReminderController } from './reminders/controller';
import { notificationPort } from './reminders/device';
export const reminders=new ReminderController({
 os:notificationPort,
 context:()=>{const state=session.snapshot();return state.status==='authenticated'&&state.profile?{owner:state.profile.id,language:state.profile.language}:null;},
 fetch:()=>session.request('/me/reminders'),
 read:async owner=>(await SecureStore.getItemAsync('campus.reminders.v1.'+owner))==='enabled',
 write:(owner,enabled)=>SecureStore.setItemAsync('campus.reminders.v1.'+owner,enabled?'enabled':'disabled',{keychainAccessible:SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY}),
});
