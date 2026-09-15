import {chromium} from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const out='../../docs/verification/opening';
const browser=await chromium.launch({channel:'msedge',headless:true});
const results=[];
for(const [name,width,height] of [['desktop',1440,900],['mobile',390,844]]){
 const context=await browser.newContext({viewport:{width,height},hasTouch:name==='mobile',recordVideo:{dir:out,size:{width,height}}});
 await context.addInitScript(()=>localStorage.setItem('olus-cookie-consent','essential'));
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:3001',{waitUntil:'domcontentloaded'});
 await page.waitForSelector('[data-intro-running=true]');await page.waitForTimeout(250);
 const intro=await page.evaluate(()=>{const cover=document.querySelector('[data-intro-cover]'),mark=document.querySelector('[data-logo-mark]');return {coverVisible:getComputedStyle(cover).display==='block',markCenter:Math.abs(mark.getBoundingClientRect().x+mark.getBoundingClientRect().width/2-innerWidth/2)<3}});
 assert.ok(intro.coverVisible&&intro.markCenter,'Intro visibly covers the page with a centered mark');
 await page.screenshot({path:out+'/'+name+'-intro.png'});
 await page.waitForSelector('[data-ready=true]');await page.waitForTimeout(400);await page.screenshot({path:out+'/'+name+'.png'});
 await page.getByRole('button',{name:'Open navigation'}).click();await page.waitForTimeout(1300);await page.screenshot({path:out+'/'+name+'-menu.png'});
 await page.getByRole('button',{name:'Close navigation'}).click();await page.mouse.move(width-30,height-30);await page.waitForTimeout(1400);assert.equal(await page.locator('dialog[open]').count(),0);
 if(name==='desktop'){
  const destination=await page.locator('#demo').evaluate(el=>el.getBoundingClientRect().top+scrollY+parseFloat(getComputedStyle(el.parentElement).paddingBottom)*.55);
  for(let i=1;i<=30;i++){await page.evaluate(y=>scrollTo(0,y),destination*i/30);await page.waitForTimeout(45)}
  await page.waitForTimeout(4000);await page.screenshot({path:out+'/macbook.png'});
  await page.getByRole('button',{name:'Pause demo',exact:true}).click();await page.waitForTimeout(600);await page.getByRole('button',{name:'Replay',exact:true}).click();await page.getByRole('button',{name:'Play demo',exact:true}).click();await page.waitForTimeout(1000);
 }else{
  await page.getByRole('link',{name:'Watch the recovery',exact:true}).click();await page.waitForTimeout(1200);await page.screenshot({path:out+'/mobile-demo.png'});
  const top=await page.locator('.olus-demo-controls').evaluate(el=>el.getBoundingClientRect().top);assert.ok(top>=72,'Mobile demo label clears fixed navbar');
 }
 await page.waitForTimeout(600);assert.deepEqual(errors,[]);const video=page.video();await page.close();await context.close();await video.saveAs(out+'/opening-'+name+'.webm');
 const bytes=fs.statSync(out+'/opening-'+name+'.webm').size;assert.ok(bytes>10000);results.push({name,intro,errors,videoBytes:bytes});
}
await browser.close();fs.writeFileSync(out+'/production-smoke.json',JSON.stringify(results,null,2));console.log(results);
