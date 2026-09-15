import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'msedge',headless:true});
try {
 for(const width of [1440,390]) {
  const page=await browser.newPage({viewport:{width,height:900}});
  await page.addInitScript(()=>{
   window.logoSamples=[];
   const sample=()=>{
    const word=document.querySelector('[data-nav-wordmark]');
    if(word){const r=word.getBoundingClientRect();window.logoSamples.push({x:r.x,width:r.width});}
    if(!document.querySelector('[data-ready=true]'))requestAnimationFrame(sample);
   };requestAnimationFrame(sample);
  });
  await page.goto(process.env.TEST_URL || 'http://localhost:3002',{waitUntil:'domcontentloaded'});
  await page.waitForSelector('[data-ready=true]');
  const result=await page.evaluate(()=>{
   const mark=document.querySelector('[data-logo-mark]').getBoundingClientRect();
   const word=document.querySelector('[data-nav-wordmark]').getBoundingClientRect();
   return {samples:window.logoSamples,center:(mark.x+word.right)/2,gap:word.x-mark.right};
  });
  assert.ok(result.samples.length>15,'captured morph frames');
  const positions=result.samples.map(s=>s.x);
  console.log(JSON.stringify({width,min:Math.min(...positions),max:Math.max(...positions),center:result.center,gap:result.gap,samples:result.samples.filter((s,i,a)=>!i||s.x!==a[i-1].x)}));
  assert.ok(Math.max(...positions)-Math.min(...positions)<2,'wordmark stays fixed during morph');
  assert.ok(Math.abs(result.center-width/2)<2,'logo lockup centered');
  assert.ok(Math.abs(result.gap-8)<2,'mark and text retain gap');
  console.log(`PASS ${width}px: wordmark fixed, logo centered, spacing intact`);
  await page.close();
 }
} finally {await browser.close();}

