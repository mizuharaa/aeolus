import { createServer } from 'node:http';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, extname } from 'node:path';
import { chromium } from 'playwright';
const root = process.cwd();
const html = `<html><body style="margin:0"><script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js","three/addons/":"/node_modules/three/examples/jsm/"}}</script><script type="module">
import * as T from 'three'; import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'; import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
const renderer=new T.WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});renderer.setSize(1800,1300);renderer.setClearColor(0,0);renderer.outputColorSpace=T.SRGBColorSpace;document.body.appendChild(renderer.domElement);
const scene=new T.Scene(); scene.add(new T.HemisphereLight(0xffffff,0x647181,2));const light=new T.DirectionalLight(0xffffff,2);light.position.set(-3,8,4);scene.add(light);
const model=(await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync('/public/models/olus-airliner.glb')).scene;const box=new T.Box3().setFromObject(model);const size=box.getSize(new T.Vector3());model.position.sub(box.getCenter(new T.Vector3()));const group=new T.Group();group.add(model);scene.add(group);group.rotation.y=Math.PI;
const span=Math.max(size.x,size.z*1800/1300)*1.14;const camera=new T.OrthographicCamera(-span/2,span/2,span*1300/1800/2,-span*1300/1800/2,.01,100);camera.position.set(0,10,0);camera.up.set(0,0,-1);camera.lookAt(0,0,0);renderer.render(scene,camera);window.result=renderer.domElement.toDataURL('image/png'); window.bounds=size.toArray();
</script></body></html>`;
const server=createServer((req,res)=>{if(req.url==='/'){res.setHeader('Content-Type','text/html');return res.end(html)}try{const p=resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));if(!p.startsWith(root+'\\'))throw Error('path');res.setHeader('Content-Type',extname(p)==='.js'?'application/javascript':'application/octet-stream');res.end(readFileSync(p))}catch{res.writeHead(404).end()}}).listen(3017,'127.0.0.1');
const browser=await chromium.launch({channel:'msedge',headless:true});try{const page=await browser.newPage();page.on('pageerror',e=>console.error(e));await page.goto('http://127.0.0.1:3017');await page.waitForFunction(()=>window.result,{timeout:30000});const data=await page.evaluate(()=>({image:window.result,bounds:window.bounds}));writeFileSync('public/images/olus/aircraft-top.png',Buffer.from(data.image.split(',')[1],'base64'));console.log({bounds:data.bounds,output:'public/images/olus/aircraft-top.png'});}finally{await browser.close();server.close()}

