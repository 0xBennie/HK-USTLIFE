import Link from 'next/link';
export default function MissingActivity(){return <section className="campus-shell campus-page"><h1>活动不可查看</h1><p>内容可能已删除，或不对访客开放。</p><p lang="en">This activity is unavailable. It may have been removed or may not be public.</p><Link className="campus-button" href="/events">返回公开活动 / Public activities</Link></section>;}
