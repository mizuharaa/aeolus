"use client"

import { useEffect, useRef, type MutableRefObject } from "react"
import * as T from "three"
import { hubs } from "./network-globe"

type Props = { progress: MutableRefObject<{value:number;velocity:number}>; paused:boolean; selected:number|null; hovered:number|null; onSelect:(index:number)=>void; onHover:(index:number|null)=>void; onFailure:()=>void }
const point = (lat:number,lon:number) => { const p=lat*Math.PI/180, a=lon*Math.PI/180;return new T.Vector3(Math.cos(p)*Math.sin(a),Math.sin(p),Math.cos(p)*Math.cos(a)) }
const pairs = [[0,3],[1,4],[2,3],[3,4],[4,5],[0,6],[1,6],[5,6],[2,4],[3,6],[0,1],[1,2]]

export default function NetworkScene(props:Props) {
  const host = useRef<HTMLDivElement>(null)
  const latest = useRef(props); latest.current=props
  useEffect(() => {
    const el=host.current!; let disposed=false,frame=0,visible=false,ready=false,drag=false,moved=false,lastX=0,lastY=0,lastTime=0,release=0,elapsed=0,yaw=.95,pitch=.08,vx=0,vy=0,focusStart=0,lastSelection:number|null=null
    let renderer:T.WebGLRenderer
    try { renderer=new T.WebGLRenderer({alpha:true,antialias:true,powerPreference:"high-performance"}) } catch { latest.current.onFailure();return }
    renderer.setPixelRatio(Math.min(devicePixelRatio,2)); renderer.setClearColor(0,0); el.appendChild(renderer.domElement)
    const scene=new T.Scene(),camera=new T.PerspectiveCamera(36,1,.1,100); camera.position.z=3.65
    const world=new T.Group();scene.add(world)
    const css=getComputedStyle(el), color=(name:string)=>new T.Color(css.getPropertyValue(name).trim())
    const white=color("--text-hi"),blue=color("--neutral-arc"),amber=color("--disrupt"),jade=color("--recover"),ink=color("--ink-900")
    const uniforms={morph:{value:0},white:{value:white},blue:{value:blue},amber:{value:amber},dpr:{value:Math.min(devicePixelRatio,2)}}
    const dotsMaterial=new T.ShaderMaterial({transparent:true,depthWrite:false,uniforms,
      vertexShader:`attribute vec3 flatPosition; uniform float morph; uniform float dpr; varying vec3 normalV; varying float facing; void main(){vec3 p=mix(flatPosition,position,morph); vec4 mv=modelViewMatrix*vec4(p,1.); normalV=normalize(normalMatrix*normalize(position)); facing=mix(1.,smoothstep(-.08,.22,normalV.z),morph); gl_Position=projectionMatrix*mv; gl_PointSize=(1.8+1.4*morph)*dpr;}`,
      fragmentShader:`uniform vec3 white;uniform vec3 blue;uniform vec3 amber;varying vec3 normalV;varying float facing;void main(){float d=length(gl_PointCoord-.5);if(d>.5)discard;vec3 c=mix(white,normalV.y>0.?amber:blue,pow(1.-abs(normalV.z),2.)*.75);gl_FragColor=vec4(c,(1.-smoothstep(.25,.5,d))*.78*facing);}`})
    const globeGeo=new T.SphereGeometry(.995,64,48)
    const globeMat=new T.MeshBasicMaterial({color:ink,transparent:true,opacity:0})
    const globe=new T.Mesh(globeGeo,globeMat);world.add(globe)
    const rimMat=new T.ShaderMaterial({transparent:true,depthWrite:false,blending:T.AdditiveBlending,side:T.BackSide,uniforms:{blue:{value:blue},amber:{value:amber},strength:{value:0}},vertexShader:`varying vec3 n;varying vec3 v;void main(){vec4 p=modelViewMatrix*vec4(position,1.);n=normalize(normalMatrix*normal);v=normalize(-p.xyz);gl_Position=projectionMatrix*p;}`,fragmentShader:`uniform vec3 blue;uniform vec3 amber;uniform float strength;varying vec3 n;varying vec3 v;void main(){float rim=pow(max(0.,1.-abs(dot(n,v))),3.);vec3 c=mix(blue,amber,smoothstep(-.3,.6,n.y));gl_FragColor=vec4(c,rim*strength*.72);}`})
    const atmosphere=new T.Mesh(new T.SphereGeometry(1.055,64,48),rimMat);scene.add(atmosphere)
    const locations=hubs.map(h=>point(h.lat,h.lon))
    const hubMesh=new T.InstancedMesh(new T.SphereGeometry(.011,8,6),new T.MeshBasicMaterial({color:amber}),hubs.length)
    const object=new T.Object3D();locations.forEach((p,i)=>{object.position.copy(p).multiplyScalar(1.015);object.updateMatrix();hubMesh.setMatrixAt(i,object.matrix)});world.add(hubMesh)
    const rings=locations.map(p=>{const ring=new T.Mesh(new T.RingGeometry(.02,.023,24),new T.MeshBasicMaterial({color:amber,transparent:true,side:T.DoubleSide,depthWrite:false}));ring.position.copy(p).multiplyScalar(1.008);ring.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),p);world.add(ring);return ring})
    const labels=locations.map((_,i)=>{const b=document.createElement('button');b.textContent=hubs[i].id;b.className='olus-globe-label';b.setAttribute('aria-label',`Explore ${hubs[i].name}`);b.onclick=()=>latest.current.onSelect(i);b.onpointerenter=()=>latest.current.onHover(i);b.onpointerleave=()=>latest.current.onHover(null);el.appendChild(b);return b})
    const routes=pairs.map(([a,b],i)=>{
      const start=locations[a],end=locations[b],angle=start.angleTo(end),sin=Math.sin(angle)
      const at=(t:number)=>start.clone().multiplyScalar(Math.sin((1-t)*angle)/sin).addScaledVector(end,Math.sin(t*angle)/sin).multiplyScalar(1.012+Math.sin(Math.PI*t)*.2)
      const vertices=Array.from({length:97},(_,j)=>at(j/96))
      const geometry=new T.BufferGeometry().setFromPoints(vertices), colors:number[]=[]
      for(let j=0;j<97;j++){const c=i%3===0?blue:jade.clone().lerp(amber,j/96);colors.push(c.r,c.g,c.b)}geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3))
      const material=new T.LineBasicMaterial({vertexColors:true,transparent:true,opacity:.65,depthWrite:false})
      const line=new T.Line(geometry,material);world.add(line)
      const trail=new T.Line(new T.BufferGeometry().setFromPoints(Array.from({length:12},()=>at(0))),new T.LineBasicMaterial({color:i%3===0?blue:jade,transparent:true,opacity:.5,depthWrite:false}));world.add(trail)
      return {a,b,at,line,trail}
    })
    // One instanced low-poly airframe layer: fuselage, swept wings and stabilisers, 20 triangles per aircraft.
    const planeShape=new T.Shape();planeShape.moveTo(0,.065);for(const [x,y] of [[.008,.045],[.009,.012],[.057,-.019],[.056,-.028],[.009,-.012],[.007,-.046],[.025,-.061],[.024,-.068],[0,-.058],[-.024,-.068],[-.025,-.061],[-.007,-.046],[-.009,-.012],[-.056,-.028],[-.057,-.019],[-.009,.012],[-.008,.045],[0,.065]])planeShape.lineTo(x,y)
    const planeGeo=new T.ExtrudeGeometry(planeShape,{depth:.003,bevelEnabled:false,steps:1});planeGeo.scale(.36,.36,.36)
    const planes=new T.InstancedMesh(planeGeo,new T.MeshBasicMaterial({color:white,side:T.DoubleSide}),pairs.length);world.add(planes)
    const starPositions:number[]=[];for(let i=0;i<320;i++){const a=i*2.399963;starPositions.push(Math.sin(a)*6,Math.cos(a*.73)*4,-3-(i%11)/3)}
    const stars=new T.Points(new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(starPositions,3)),new T.PointsMaterial({color:white,size:.008,transparent:true,opacity:.25}));scene.add(stars)
    const mask=new Image();mask.src='/textures/earth-mask.png';mask.onload=()=>{
      if(disposed)return
      const canvas=document.createElement('canvas');canvas.width=mask.width;canvas.height=mask.height;const ctx=canvas.getContext('2d')!;ctx.drawImage(mask,0,0);const pixels=ctx.getImageData(0,0,mask.width,mask.height).data
      let bright=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i]>128)bright++;const landBright=bright<pixels.length/8
      const positions:number[]=[],flat:number[]=[]
      for(let lat=-78;lat<83;lat+=1.3)for(let lon=-180;lon<180;lon+=1.3/Math.max(.22,Math.cos(lat*Math.PI/180))){const x=Math.floor((lon+180)/360*mask.width),y=Math.floor((90-lat)/180*mask.height);if((pixels[(y*mask.width+x)*4]>128)!==landBright)continue;const p=point(lat,lon);positions.push(p.x,p.y,p.z);flat.push(lon/180*1.65,lat/90*.85,0)}
      const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setAttribute('flatPosition',new T.Float32BufferAttribute(flat,3));world.add(new T.Points(geo,dotsMaterial));ready=true;el.dataset.ready='true';el.dataset.points=String(positions.length/3);start()
    };mask.onerror=()=>latest.current.onFailure()
    const raycaster=new T.Raycaster(),pointer=new T.Vector2();const pick=(e:PointerEvent)=>{const r=el.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);raycaster.setFromCamera(pointer,camera);return raycaster.intersectObject(hubMesh)[0]?.instanceId??null}
    const down=(e:PointerEvent)=>{if((e.target as HTMLElement).tagName==='BUTTON')return;drag=true;moved=false;lastX=e.clientX;lastY=e.clientY;vx=vy=0;el.setPointerCapture(e.pointerId)}
    const move=(e:PointerEvent)=>{if(drag){const dx=e.clientX-lastX,dy=e.clientY-lastY;moved ||= Math.abs(dx)+Math.abs(dy)>3;vx=dx*.004;vy=dy*.004;yaw+=vx;pitch=T.MathUtils.clamp(pitch+vy,-Math.PI/3,Math.PI/3);lastX=e.clientX;lastY=e.clientY;lastSelection=null}else{latest.current.onHover(pick(e));stars.position.x=pointer.x*.02;stars.position.y=pointer.y*.02}}
    const up=(e:PointerEvent)=>{if(!drag)return;drag=false;release=performance.now();if(!moved){const i=pick(e);if(i!==null)latest.current.onSelect(i)}if(el.hasPointerCapture(e.pointerId))el.releasePointerCapture(e.pointerId)}
    const leave=()=>{if(!drag)latest.current.onHover(null)}
    el.addEventListener('pointerdown',down);el.addEventListener('pointermove',move);el.addEventListener('pointerup',up);el.addEventListener('pointercancel',up);el.addEventListener('pointerleave',leave)
    const fromQ=new T.Quaternion(),toQ=new T.Quaternion(),rotationQ=new T.Quaternion(),upAxis=new T.Vector3(0,1,0)
    const resize=()=>{const r=el.getBoundingClientRect();renderer.setSize(r.width,r.height);camera.aspect=r.width/r.height;camera.updateProjectionMatrix()};const ro=new ResizeObserver(resize);ro.observe(el);resize()
    function render(now:number){frame=0;if(disposed||!visible||document.hidden||!ready)return;const dt=Math.min(.05,(now-(lastTime||now))/1000);lastTime=now;const p=latest.current;const morph=T.MathUtils.smoothstep(p.progress.current.value,0,.65);uniforms.morph.value=morph;globeMat.opacity=morph;rimMat.uniforms.strength.value=morph;world.scale.setScalar(.82+.18*morph);atmosphere.scale.copy(world.scale)
      if(!p.paused){elapsed+=dt*(1+p.progress.current.velocity*.8);p.progress.current.velocity*=.96;if(!drag){yaw+=vx;pitch=T.MathUtils.clamp(pitch+vy,-Math.PI/3,Math.PI/3);vx*=Math.pow(.94,dt*60);vy*=Math.pow(.94,dt*60);if(now-release>1500 && p.selected===null)yaw+=.06*dt*Math.min(1,(now-release-1500)/700)}}
      if(p.selected!==null && p.selected!==lastSelection){lastSelection=p.selected;focusStart=now;fromQ.copy(world.quaternion);toQ.setFromUnitVectors(locations[p.selected],new T.Vector3(0,0,1));vx=vy=0}
      if(p.selected!==null&&!drag){const t=Math.min(1,(now-focusStart)/1200);world.quaternion.slerpQuaternions(fromQ,toQ,t*t*(3-2*t));const e=new T.Euler().setFromQuaternion(world.quaternion,'YXZ');yaw=e.y;pitch=e.x}else{rotationQ.setFromEuler(new T.Euler(pitch*morph,yaw*morph,0,'YXZ'));world.quaternion.copy(rotationQ)}
      const active=p.hovered??p.selected;routes.forEach((route,i)=>{const t=(elapsed*.045+i/pairs.length)%1,position=route.at(t),next=route.at(Math.min(.9999,t+.002));const forward=next.sub(position).normalize(),normal=position.clone().normalize(),right=forward.clone().cross(normal).normalize();const basis=new T.Matrix4().makeBasis(right,forward,normal);object.position.copy(position);object.quaternion.setFromRotationMatrix(basis);object.scale.setScalar(morph);object.updateMatrix();planes.setMatrixAt(i,object.matrix);route.line.material.opacity=morph*(active===null?.52:route.a===active||route.b===active?1:.08);route.line.geometry.setDrawRange(0,Math.floor(97*Math.min(1,((elapsed*.06+i*.13)%1)*3)));const attr=route.trail.geometry.getAttribute('position');for(let j=0;j<12;j++){const q=route.at(Math.max(0,t-j*.003));attr.setXYZ(j,q.x,q.y,q.z)}attr.needsUpdate=true;route.trail.material.opacity=morph*.5});planes.instanceMatrix.needsUpdate=true;hubMesh.visible=morph>.7
      world.updateMatrixWorld(true);locations.forEach((p,i)=>{const v=p.clone().multiplyScalar(1.025).applyMatrix4(world.matrixWorld),facing=v.clone().normalize().dot(camera.position.clone().sub(v).normalize());v.project(camera);const label=labels[i];label.style.transform=`translate(${(v.x*.5+.5)*el.clientWidth}px,${(-v.y*.5+.5)*el.clientHeight}px)`;label.style.opacity=facing>.16&&morph>.9?'1':'0';label.style.visibility=facing>.16&&morph>.9?'visible':'hidden';rings[i].scale.setScalar(1+((elapsed*.6+i*.15)%1));(rings[i].material as T.MeshBasicMaterial).opacity=morph*(.6-((elapsed*.6+i*.15)%1)*.5)})
      el.dataset.rotation=yaw.toFixed(3);renderer.render(scene,camera);frame=requestAnimationFrame(render)
    }
    function start(){if(!frame&&visible&&ready&&!document.hidden){lastTime=0;frame=requestAnimationFrame(render)}}
    const io=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;if(visible)start();else{cancelAnimationFrame(frame);frame=0}},{rootMargin:'100px'});io.observe(el)
    const visibility=()=>{if(document.hidden){cancelAnimationFrame(frame);frame=0}else start()};document.addEventListener('visibilitychange',visibility)
    const lost=(e:Event)=>{e.preventDefault();latest.current.onFailure()};renderer.domElement.addEventListener('webglcontextlost',lost)
    return ()=>{disposed=true;cancelAnimationFrame(frame);io.disconnect();ro.disconnect();document.removeEventListener('visibilitychange',visibility);el.removeEventListener('pointerdown',down);el.removeEventListener('pointermove',move);el.removeEventListener('pointerup',up);el.removeEventListener('pointercancel',up);el.removeEventListener('pointerleave',leave);labels.forEach(b=>b.remove());scene.traverse(o=>{if(o instanceof T.Mesh||o instanceof T.Points||o instanceof T.Line){o.geometry.dispose();const materials=Array.isArray(o.material)?o.material:[o.material];materials.forEach(m=>m.dispose())}});dotsMaterial.dispose();renderer.dispose();renderer.domElement.remove()}
  },[])
  return <div ref={host} className="olus-network-scene" aria-label="Interactive globe; drag to rotate, or use the hub buttons" />
}

