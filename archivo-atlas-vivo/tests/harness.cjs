const { JSDOM } = require('jsdom');
const { createCanvas } = require('@napi-rs/canvas');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.resolve(__dirname,'..');
function load(page='index.html', options={}) {
 const html=fs.readFileSync(path.join(ROOT,page),'utf8');
 const dom=new JSDOM(html,{url:'https://quito.test/'+page+(options.hash||''),runScripts:'outside-only',pretendToBeVisual:true});
 const win=dom.window,ctx=dom.getInternalVMContext(),canvases=new WeakMap();
 let now=1000,nextId=0;const frames=new Map(),timers=new Map();
 Object.defineProperty(win.performance,'now',{value:()=>now});
 win.requestAnimationFrame=fn=>{const id=++nextId;frames.set(id,fn);return id;};win.cancelAnimationFrame=id=>frames.delete(id);
 win.setTimeout=(fn,ms)=>{const id=++nextId;timers.set(id,{fn,at:now+ms});return id;};win.clearTimeout=id=>timers.delete(id);
 win.HTMLElement.prototype.scrollIntoView=function(){};
 win.HTMLCanvasElement.prototype.setPointerCapture=function(){};
 win.HTMLCanvasElement.prototype.getBoundingClientRect=function(){return {left:0,top:0,width:this.width,height:this.height};};
 win.HTMLCanvasElement.prototype.getContext=function(){
  if(!canvases.has(this)){
   const canvas=createCanvas(this.width,this.height),g=canvas.getContext('2d'),draw=g.drawImage.bind(g);
   g.drawImage=(source,...args)=>draw(canvases.get(source)?.canvas||source,...args);canvases.set(this,{canvas,g});
  }return canvases.get(this).g;
 };
 win.HTMLCanvasElement.prototype.toBlob=function(callback){callback(new win.Blob([canvases.get(this).canvas.toBuffer('image/png')],{type:'image/png'}));};
 win.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
 win.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new win.Event('close'));};
 win.URL.createObjectURL=()=> 'blob:quito-test';win.URL.revokeObjectURL=()=>{};
 win.document.addEventListener('click',e=>{if(e.target.closest('a'))e.preventDefault();});
 if(options.saved)win.localStorage.setItem('quito-atlas-vivo-v1',JSON.stringify(options.saved));
 // Random estable para comprobar resultados y evitar pruebas intermitentes.
 vm.runInContext('Math.random = (() => { let seed=12345; return () => ((seed=(seed*1664525+1013904223)>>>0)/4294967296); })()',ctx);
 for(const [,src]of html.matchAll(/<script src="([^"]+)"/g))vm.runInContext(fs.readFileSync(path.join(ROOT,src),'utf8'),ctx,{filename:src});
 const q=vm.runInContext('Q',ctx);
 return {
  dom,win,q,ctx,canvases,$:s=>win.document.querySelector(s),$$:s=>[...win.document.querySelectorAll(s)],
  tick(seconds){const count=Math.ceil(seconds/.025);for(let i=0;i<count;i++){now+=seconds/count*1000;const pending=[...frames];frames.clear();pending.forEach(([,fn])=>fn(now));for(const [id,t]of [...timers])if(t.at<=now){timers.delete(id);t.fn();}}},
  clearFrames(){frames.clear();},frameCount:()=>frames.size,
  saved:()=>JSON.parse(win.localStorage.getItem('quito-atlas-vivo-v1')),
  capture(selector,file){fs.writeFileSync(file,canvases.get(win.document.querySelector(selector)).canvas.toBuffer('image/png'));},
  close(){dom.window.close();frames.clear();timers.clear();},
 };
}
module.exports={load};
