import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const code=ts.transpileModule(fs.readFileSync('lib/brand.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const exports={};vm.runInNewContext(code,{exports});
const storage=(data={})=>({data,get length(){return Object.keys(this.data).length},key(i){return Object.keys(this.data)[i]},getItem(k){return this.data[k]??null},setItem(k,v){this.data[k]=String(v)}});
const localStorage=storage({'aeolus-console-theme':'dark','aeolus-watchlist':'["2291"]','olus-watchlist':'["118"]'}),sessionStorage=storage({'aeolus-intro-seen':'1'});
const document={documentElement:{setAttribute(k,v){this[k]=v}}};const context={window:{localStorage,sessionStorage},localStorage,sessionStorage,document};
vm.runInNewContext(exports.brandStorageScript+exports.themeInitScript,context);
assert.equal(localStorage.getItem('olus-console-theme'),'dark');assert.equal(document.documentElement['data-console-theme'],'dark');assert.equal(localStorage.getItem('olus-watchlist'),'["118"]');assert.equal(localStorage.getItem('aeolus-watchlist'),'["2291"]');assert.equal(sessionStorage.getItem('olus-intro-seen'),'1');
assert.equal(document.documentElement['data-olus-intro'],'pending','Old intro flags must not suppress a reload');
const before=JSON.stringify(localStorage.data);vm.runInNewContext(exports.brandStorageScript,context);assert.equal(JSON.stringify(localStorage.data),before);
const blocked={get localStorage(){throw new Error('blocked')},get sessionStorage(){throw new Error('blocked')}};vm.runInNewContext(exports.brandStorageScript,{window:blocked});
console.log('PASS: browser state migration, canonical priority, idempotence, theme initialization, blocked storage');

