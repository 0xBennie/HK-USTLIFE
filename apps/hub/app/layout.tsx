import type {Metadata,Viewport} from 'next';
import Link from 'next/link';
import {Suspense} from 'react';
import {SiteHeader} from '../components/site-header';
import './globals.css';
export const metadata:Metadata={title:{default:'HKUST · 学习，也好好生活',template:'%s · HKUST Campus'},description:'Learning plans, campus information and low-pressure activities. Independent local development preview.',robots:{index:false,follow:false}};
export const viewport:Viewport={width:'device-width',initialScale:1,themeColor:'#F5F5F7'};
export default function RootLayout({children}:Readonly<{children:React.ReactNode}>){return <html lang="zh-Hans"><body><a className="campus-skip" href="#main-content">跳到内容 / Skip to content</a><Suspense fallback={<header className="campus-header"><Link href="/">HKUST Campus</Link></header>}><SiteHeader/></Suspense><main id="main-content">{children}</main><footer className="campus-footer"><p>独立学生产品 · 本地开发预览<br/><span lang="en">Independent student project. Local development preview.</span></p><nav aria-label="Footer"><Link href="/privacy">隐私 / Privacy</Link><Link href="/support">帮助 / Help</Link><Link href="/start">校园指南 / Guide</Link><Link href="/admin">管理 / Admin</Link></nav></footer></body></html>;}
