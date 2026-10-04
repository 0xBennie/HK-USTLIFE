// Client for /campus/weather (Hong Kong Observatory open data, proxied and cached by our API).
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import {api} from '../runtime';
export type CampusWeather={station:string;place?:{zh:string;en:string};temperature:number|null;humidity:number|null;condition:{zh:string;en:string}|null;updated_at:string;warnings:{code:string;zh:string;en:string;level:'info'|'warning'|'severe';issued_at:string|null}[];classes_may_be_suspended:boolean;source:{name:string;url:string}};
export const getWeather=()=>api.request<CampusWeather>('/campus/weather');
const key=(owner:string)=>'campus.weather-alerts.v1.'+owner,seenKey=(owner:string)=>'campus.weather-seen.v1.'+owner;
export async function weatherAlertsEnabled(owner:string){return (await SecureStore.getItemAsync(key(owner)))!=='off';}
export async function setWeatherAlerts(owner:string,on:boolean){await SecureStore.setItemAsync(key(owner),on?'on':'off',{keychainAccessible:SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY});}
/** On app open: notify once for each newly issued warning (typhoon / rainstorm / etc.). */
export async function checkWeatherAlerts(owner:string,zh:boolean){
 if(!(await weatherAlertsEnabled(owner)))return;
 const w=await getWeather();
 const seen=new Set(((await SecureStore.getItemAsync(seenKey(owner)))??'').split(',').filter(Boolean));
 const fresh=w.warnings.filter(x=>!seen.has(x.code+'@'+x.issued_at));
 await SecureStore.setItemAsync(seenKey(owner),w.warnings.map(x=>x.code+'@'+x.issued_at).join(','),{keychainAccessible:SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY});
 const important=fresh.filter(x=>x.level!=='info');
 if(!important.length)return;
 const perm=await Notifications.getPermissionsAsync();if(!perm.granted)return;
 await Notifications.scheduleNotificationAsync({identifier:'campus.local.weather.'+important[0].code,content:{title:`USTLIFE · ${zh?important[0].zh:important[0].en}`,body:w.classes_may_be_suspended?(zh?'八号风球或黑雨时学校通常停课，请以校方公告为准。':'Classes are usually suspended under T8 or black rain — check the official notice.'):(zh?'出门前留意天气，带好雨具。':'Check the weather before heading out.')},trigger:null});
}
