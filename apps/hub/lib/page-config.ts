import {headers} from 'next/headers';
import {environmentWebConfig,validateWebConfig,WebFailure} from './product-web';
export async function localPageConfig(){const config=environmentWebConfig(),checked=validateWebConfig(config),requestHeaders=await headers();if(!config.enabled||requestHeaders.get('host')!==checked.host)throw new WebFailure(503,'WEB_DISABLED','Local product web unavailable.');return config;}
export type PageQuery=Promise<Record<string,string|string[]|undefined>>;
export const pageLanguage=(query:Record<string,string|string[]|undefined>)=>query.lang==='en'?'en':'zh';
export const eventTime=(instant:string,language:string)=>new Intl.DateTimeFormat(language==='zh'?'zh-HK':'en-HK',{timeZone:'Asia/Hong_Kong',dateStyle:'medium',timeStyle:'short',hour12:false}).format(new Date(instant));
