import {AdminConsole} from '../../components/admin-console';
import {pageLanguage,type PageQuery} from '../../lib/page-config';
export default async function AdminPage({searchParams}:{searchParams:PageQuery}){const language=pageLanguage(await searchParams);return <section className="campus-shell campus-page" lang={language==='zh'?'zh-Hans':'en'}><h1>{language==='zh'?'社区管理':'Community review'}</h1><AdminConsole language={language}/></section>;}
