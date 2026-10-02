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
