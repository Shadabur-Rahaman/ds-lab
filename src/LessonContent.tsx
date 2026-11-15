import {Fragment} from 'react';
// Deliberately restricted prose renderer: no raw HTML, expressions, or arbitrary JSX.
// Authored .mdx documents currently use only headings, bold, paragraphs and quotes.
export function LessonContent({source}:{source:string}) {
 const inline=(s:string)=>s.split(/(\*\*.*?\*\*)/g).map((part,i)=>part.startsWith('**')?<strong key={i}>{part.slice(2,-2)}</strong>:<Fragment key={i}>{part}</Fragment>);
 return <>{source.trim().split(/\r?\n\s*\r?\n/).map((block,i)=>block.startsWith('### ')?<h3 key={i}>{inline(block.slice(4))}</h3>:block.startsWith('## ')?<h2 key={i}>{inline(block.slice(3))}</h2>:block.startsWith('> ')?<blockquote key={i}><p>{inline(block.slice(2))}</p></blockquote>:<p key={i}>{inline(block)}</p>)}</>;
}
