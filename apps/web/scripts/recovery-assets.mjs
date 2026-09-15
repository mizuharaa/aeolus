import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'node:fs';
const css=readFileSync('components/landing/olus-tokens.css','utf8');
const color=name=>css.match(new RegExp(`--${name}:([^;]+)`))[1];
const {data,info}=await sharp('public/textures/earth-mask.png').raw().toBuffer({resolveWithObject:true});
let dots='';const a=.95;
for(let lat=-78;lat<83;lat+=1.5){for(let lon=-180;lon<180;lon+=1.5/Math.max(.22,Math.cos(lat*Math.PI/180))){const ix=Math.floor((lon+180)/360*info.width),iy=Math.floor((90-lat)/180*info.height);if(data[(iy*info.width+ix)*info.channels]>128)continue;const p=lat*Math.PI/180,l=lon*Math.PI/180+a,z=Math.cos(p)*Math.cos(l);if(z<0)continue;const x=500+Math.cos(p)*Math.sin(l)*390,y=500-Math.sin(p)*390;dots+=`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1.25" opacity="${(.25+z*.65).toFixed(2)}"/>`}}
const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000"><defs><linearGradient id="rim" x2=".2" y2="1"><stop stop-color="${color('disrupt')}"/><stop offset=".5" stop-color="${color('ink-900')}"/><stop offset="1" stop-color="${color('neutral-arc')}"/></linearGradient><filter id="glow"><feGaussianBlur stdDeviation="10"/></filter></defs><circle cx="500" cy="500" r="393" fill="${color('ink-900')}" stroke="url(#rim)" stroke-width="12" filter="url(#glow)"/><circle cx="500" cy="500" r="390" fill="${color('ink-900')}" stroke="url(#rim)" stroke-width="3"/><g fill="${color('text-hi')}">${dots}</g><g fill="none" stroke="${color('neutral-arc')}" opacity=".65"><path d="M270 390Q410 40 710 300"/><path d="M290 395Q90 520 460 770"/><path d="M710 300Q970 450 770 700"/></g></svg>`;
writeFileSync('public/images/olus/globe-static.svg',svg);console.log(`Static geographic globe: ${dots.split('<circle').length-1} visible land points`);
