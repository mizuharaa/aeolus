import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.addInitScript(()=>{localStorage.setItem('olus-cookie-consent','essential');sessionStorage.setItem('olus-intro-seen','1')});
for(const phase of ['initial with legacy flag','reload at top','reload after scrolling']){
 if(phase==='initial with legacy flag')await page.goto('http://localhost:3001',{waitUntil:'domcontentloaded'});
 else await page.reload({waitUntil:'domcontentloaded'});
 await page.waitForSelector('[data-intro-running=true]');
 const mark=await page.locator('[data-logo-mark]').elementHandle();
 assert.equal(await page.locator('[data-intro-cover]').evaluate(el=>getComputedStyle(el).display),'block');
 await page.waitForSelector('[data-ready=true]');
 assert.ok(await mark.evaluate(el=>el===document.querySelector('[data-logo-mark]')));
 assert.equal(await page.locator('[data-intro-cover]').evaluate(el=>getComputedStyle(el).display),'none');
 console.log('PASS:',phase);
 if(phase==='reload at top'){await page.evaluate(()=>scrollTo(0,2000));await page.waitForTimeout(500);assert.ok(await page.evaluate(()=>scrollY>80))}
}
await page.emulateMedia({reducedMotion:'reduce'});await page.reload({waitUntil:'domcontentloaded'});await page.waitForSelector('[data-ready=true]');
assert.equal(await page.locator('[data-intro-running=true]').count(),0);
assert.equal(await page.locator('[data-intro-cover]').evaluate(el=>getComputedStyle(el).display),'none');
assert.deepEqual(errors,[]);console.log('PASS: reduced motion skips intro; no runtime errors');
await browser.close();
