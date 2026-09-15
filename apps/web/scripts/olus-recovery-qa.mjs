import { chromium } from 'playwright';
import { mkdirSync,writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const dir='../../docs/verification/recovery';mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});
const results=[],errors=[];
const check=(name,value)=>{results.push({name,pass:!!value});console.log(`${value?'PASS':'FAIL'} ${name}`)};
const page=await browser.newPage({viewport:{width:1440,height:900}});
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error' && /THREE|Shader|GLSL|hydration/i.test(m.text()))errors.push(m.text())});
async function scrollTo(id,fraction=0){await page.evaluate(({id,fraction})=>{const e=document.querySelector(id);const y=e.getBoundingClientRect().top+window.scrollY+e.clientHeight*fraction;window.__olusLenis?.scrollTo(y,{immediate:true,force:true});window.scrollTo(0,y)},{id,fraction});await page.waitForTimeout(1500)}
try {
 const response=await page.goto('http://localhost:3001',{waitUntil:'domcontentloaded',timeout:120000});check('home responds',response.status()===200);await page.waitForTimeout(3000);
 for(const label of ['Only necessary','Reject optional','Essential only','Reject all']){const button=page.getByRole('button',{name:label,exact:true});if(await button.count())await button.click()}
 check('new lower story replaces old sections',await page.locator('#highlights').count()===1&&await page.locator('#network').count()===1);
 await page.screenshot({path:`${dir}/opening.png`});
 for(const id of ['#highlights','#journey','#technology','#benchmarks','#constraints','#decisions','#network','#build-log','#footer']){await scrollTo(id,id==='#network'?.05:0);await page.screenshot({path:`${dir}/${id.slice(1)}.png`});console.log(`Captured ${id}`)}
 await scrollTo('#network',.35);await page.waitForTimeout(2500);
 const scene=page.locator('.olus-network-scene');check('Three globe loaded geographic dots',await scene.getAttribute('data-ready')==='true'&&Number(await scene.getAttribute('data-points'))>3000);
 await page.locator('#network').getByRole('button',{name:'ATL',exact:true}).click();check('hub selection opens simulation details',await page.getByRole('complementary',{name:'ATL simulated disruption summary'}).isVisible());await page.screenshot({path:`${dir}/hub.png`});await page.getByRole('button',{name:'Close hub summary'}).click();
 await page.locator('#network').getByRole('button',{name:'Pause flight paths',exact:true}).click();check('globe can pause',await page.getByRole('button',{name:'Resume flight paths',exact:true}).isVisible());
 const rotation=await scene.getAttribute('data-rotation');const box=await scene.boundingBox();await page.mouse.move(box.x+box.width*.45,Math.max(180,Math.min(650,box.y+box.height*.45)));await page.mouse.down();await page.mouse.move(box.x+box.width*.45+100,Math.max(180,Math.min(650,box.y+box.height*.45)),{steps:8});await page.mouse.up();await page.waitForTimeout(500);check('drag changes globe rotation',await scene.getAttribute('data-rotation')!==rotation);
 await page.goto('http://localhost:3001/faq#determinism',{waitUntil:'domcontentloaded'});await page.waitForTimeout(700);await page.locator('#determinism-header[aria-expanded=true]').waitFor();check('FAQ hash opens answer',await page.locator('#determinism-header').getAttribute('aria-expanded')==='true');await page.locator('#determinism-header').focus();await page.keyboard.press('ArrowDown');check('FAQ keyboard next heading',await page.locator('#tests-header').evaluate(e=>e===document.activeElement));await page.getByRole('searchbox').fill('CP-SAT');check('FAQ search filters results',await page.locator('article').count()<14);await page.getByRole('searchbox').fill('');await page.getByRole('button',{name:'Expand all',exact:true}).click();check('FAQ expand all',await page.locator('button[aria-expanded=true]').count()===14);await page.screenshot({path:`${dir}/faq.png`});
 const notFound=await page.goto('http://localhost:3001/not-a-real-flight',{waitUntil:'domcontentloaded'});check('404 returns missing route',notFound.status()===404);check('404 route links',await page.getByRole('link',{name:/FAQ.*SCHEDULED/}).count()===1);await page.screenshot({path:`${dir}/404.png`});
 const mobile=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});mobile.on('pageerror',e=>errors.push(e.message));await mobile.goto('http://localhost:3001',{waitUntil:'domcontentloaded'});await mobile.waitForTimeout(700);check('mobile no horizontal overflow',await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));check('reduced motion avoids WebGL',await mobile.locator('.olus-network-scene').count()===0);await mobile.locator('#network').scrollIntoViewIfNeeded();await mobile.screenshot({path:`${dir}/mobile-globe.png`});await mobile.goto('http://localhost:3001/faq',{waitUntil:'domcontentloaded'});check('mobile FAQ fits',await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await mobile.screenshot({path:`${dir}/mobile-faq.png`});await mobile.close();
 check('no browser runtime errors',errors.length===0);
} catch(e){check(e.message,false);console.error(e)} finally {writeFileSync(`${dir}/results.json`,JSON.stringify({results,errors},null,2));await browser.close()}
assert(results.every(r=>r.pass),JSON.stringify({failed:results.filter(r=>!r.pass),errors},null,2));



