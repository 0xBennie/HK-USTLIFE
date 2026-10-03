'use client';
import {AppMock} from './app-mock';
export {Glyph} from './glyph';
export function CampusPreview({language='zh'}:{language?:'zh'|'en'}){return <AppMock language={language}/>;}
