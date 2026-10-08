const test=require('node:test'),assert=require('node:assert/strict');
const {load}=require('./harness.cjs');
function game(id){const a=load();a.clearFrames();const root=a.win.document.createElement('div');a.win.document.body.append(root);let result;const dispose=a.q.games.mount(id,root,r=>result=r);return Object.assign(a,{root,dispose,result:()=>result});}
function solveMemory(a){
 const tiles=[...a.root.querySelectorAll('.memory-tile')],known=new Map();
 for(let i=0;i<tiles.length;i++){
  if(tiles[i].disabled)continue;
  tiles[i].click();const symbol=tiles[i].textContent;
  const match=known.get(symbol);
  if(match!==undefined&&match!==i&&!tiles[match].disabled){tiles[match].click();a.tick(.025);continue;}
  known.set(symbol,i);
  let other=tiles.findIndex((b,j)=>j!==i&&!b.disabled&&!known.has('index-'+j)&&b.textContent==='·');
  if(other<0)other=tiles.findIndex((b,j)=>j!==i&&!b.disabled);
  if(other<0)break;
  tiles[other].click();known.set(tiles[other].textContent,other);known.set('index-'+other,other);a.tick(.85);
 }
 // Las parejas observadas se resuelven sin consultar el estado interno del juego.
 for(let rounds=0;rounds<15&&!a.result();rounds++){
  const remaining=tiles.map((b,i)=>({b,i})).filter(x=>!x.b.disabled);
  if(!remaining.length)break;
  const first=remaining[0];first.b.click();const symbol=first.b.textContent;
  let second=remaining.find(x=>x.i!==first.i&&known.get(symbol)===x.i)||remaining.find(x=>x.i!==first.i);
  second.b.click();known.set(second.b.textContent,second.i);if(second.b.textContent===symbol)known.delete(symbol);else known.set(symbol,first.i);a.tick(.85);
 }
}
test('Cantuña: parejas, pausa, victoria y limpieza de sesión',()=>{
 const a=game('memory');try{
  const initial=a.root.querySelector('#game-score').textContent;a.root.querySelector('#game-pause').click();a.tick(3);assert.equal(a.root.querySelector('#game-score').textContent,initial);
  a.root.querySelector('#game-pause').click();solveMemory(a);assert.equal(a.result()?.won,true);assert(a.result().score>0);assert.equal(a.frameCount(),0);
 }finally{a.dispose();a.close();}
});
test('Cantuña: se pierde al terminar el minuto',()=>{const a=game('memory');try{a.tick(61);assert.equal(a.result()?.won,false);}finally{a.dispose();a.close();}});
test('Metro: cinco frenadas con la zona de destino visible',()=>{
 const a=game('metro');try{
  const cv=a.root.querySelector('canvas'),g=a.canvases.get(cv).g;
  for(let frames=0;frames<1800&&!a.result();frames++){
   a.tick(.025);const data=g.getImageData(0,99,384,1).data;
   const zone=[];for(let x=0;x<384;x++)if(data[x*4]===171&&data[x*4+1]===218)zone.push(x);
   const train=g.getImageData(0,122,384,1).data;let front=-1;for(let x=0;x<384;x++)if(train[x*4]===245&&train[x*4+1]===227)front=x;
   if(zone.length&&Math.abs(front-(zone[0]+zone.at(-1))/2)<2)a.root.querySelector('.arcade-action').click();
  }
  assert.equal(a.result()?.won,true);assert(a.result().score>=1000);
 }finally{a.dispose();a.close();}
});
test('Metro: tres errores terminan la partida; repetir Espacio no dispara varias frenadas',()=>{
 const a=game('metro');try{
  a.win.dispatchEvent(new a.win.KeyboardEvent('keydown',{key:' ',code:'Space',repeat:true}));a.tick(.1);assert.match(a.root.querySelector('#game-score').textContent,/♥♥♥/);
  for(let i=0;i<3;i++){a.root.querySelector('.arcade-action').click();a.tick(1.25);}assert.equal(a.result()?.won,false);
 }finally{a.dispose();a.close();}
});
test('Colibrí: vuelo con puntero, ocho flores y victoria',()=>{
 const a=game('bird');try{
  const cv=a.root.querySelector('canvas');
  // La prueba usa las posiciones de las flores visibles en el lienzo, por color.
  for(let i=0;i<1100&&!a.result();i++){
   const data=a.canvases.get(cv).g.getImageData(0,0,384,216).data;let target=null;
   for(let y=10;y<205&&!target;y++)for(let x=10;x<375;x++)if(data[(y*384+x)*4]===255&&data[(y*384+x)*4+1]===240&&data[(y*384+x)*4+2]===181){target=[x+1,y+1];break;}
   if(target){const e=new a.win.MouseEvent('pointerdown',{clientX:target[0],clientY:target[1],bubbles:true});Object.defineProperty(e,'pointerId',{value:1});cv.dispatchEvent(e);}
   a.tick(.025);
  }
  assert.equal(a.result()?.won,true);assert(a.result().score>=800);
 }finally{a.dispose();a.close();}
});
test('Colibrí: cerrar elimina las escuchas y el bucle',()=>{const a=game('bird');try{a.dispose();assert.equal(a.frameCount(),0);a.win.dispatchEvent(new a.win.KeyboardEvent('keydown',{key:'ArrowRight'}));a.tick(2);assert.equal(a.result(),undefined);}finally{a.close();}});
test('Una victoria desde Arcade guarda el récord y abre el pasaporte',()=>{
 const a=load();try{
  a.clearFrames();a.$('[data-panel=games]').click();a.$$('.game-card')[0].click();a.$('#intro-action button').click();
  a.root=a.$('.dialog-main');a.result=()=>a.root.querySelector('.game-result')?{won:true}:undefined;
  solveMemory(a);assert(a.saved().wins.memory>0);assert.match(a.$('.game-result').textContent,/DESAFÍO SUPERADO/);
  a.$$('.result-actions button')[1].click();assert.equal(a.$('#experience-dialog').open,false);assert.equal(a.$$('.badge-row:not(.locked)').length,1);
  assert.match(a.$('.passport-score').textContent,/PUNTOS DE VIAJE/);
 }finally{a.close();}
});
