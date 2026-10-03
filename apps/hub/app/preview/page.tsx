import Link from 'next/link';
import {AppMock} from '../../components/app-mock';
export const metadata={title:'Campus · Interactive App mock'};
export default async function Preview({searchParams}:{searchParams:Promise<{lang?:string;screen?:string}>}){
 const query=await searchParams,language=query.lang==='en'?'en':'zh',zh=language==='zh';
 const initialScreen=query.screen==='campus'?'campus':query.screen==='discover'?'discover':query.screen==='inbox'?'inbox':query.screen==='me'?'me':'today';
 return <div className="campus-shell mock-lab"><aside><p className="campus-eyebrow">CAMPUS / INTERACTIVE PROTOTYPE</p><h1>{zh?'把一天，\n真正连起来。':'A day that\nconnects.'}</h1><p>{zh?'点进去，试一试。你的操作会在五个页面之间同步。':'Go ahead. Your actions carry across all five tabs.'}</p><ol><li>{zh?'完成一项任务，再打开课程查看。':'Complete a task, then open its course.'}</li><li>{zh?'报名自习活动，再到今天、消息和我的查看。':'Join the study session, then check Today, Inbox and Me.'}</li><li>{zh?'收藏一个地点，回到我的继续找到它。':'Save a place and find it again in Me.'}</li><li>{zh?'切换下方情境，体验候补、断网和重试。':'Change the scenario to try waitlists, offline and retry.'}</li></ol><p className="mock-boundary">{zh?'这是浏览器中的 App 交互 mock，数据只在当前页面内保留。不会真实报名、发送消息或访问学校账号；不是 iOS 真机运行。':'An App interaction mock in your browser. State stays on this page. No real signups, messages or school access; not an iOS runtime.'}</p><Link className="campus-text-link" href={'/?lang='+language}>{zh?'← 回到官网':'← Back to the website'}</Link></aside><AppMock key={initialScreen+language} language={language} initialScreen={initialScreen}/></div>;
}
