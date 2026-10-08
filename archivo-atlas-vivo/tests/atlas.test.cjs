const test=require('node:test'),assert=require('node:assert/strict');
const {load}=require('./harness.cjs');
for(const page of ['index.html','arriba.html']){
 test(page+': render, exploración, persistencia y cambio de vista',()=>{
  const a=load(page);try{
   a.tick(.1);assert(a.$('#expedition').textContent.includes('La expedición'));
   a.$('[data-id=sanfrancisco]').click();assert.equal(a.$('#card').hidden,false);assert(a.saved().visits.includes('sanfrancisco'));
   a.$('[data-id=sanfrancisco]').click();assert.equal(a.saved().visits.filter(x=>x==='sanfrancisco').length,1);
   for(const p of a.q.EXPEDITION)a.q.experience.visit(p.id);
   a.$('[data-panel=passport]').click();assert.equal(a.$$('.stamp.earned').length,5);assert.match(a.$('.passport-score').textContent,/500/);
   const hash=new URL(a.$('#switch').href).hash,b=load(page==='index.html'?'arriba.html':'index.html',{hash});
   try{b.$('[data-panel=passport]').click();assert.equal(b.$$('.stamp.earned').length,5);}finally{b.close();}
   a.$('[data-weather=rain]').click();assert.equal(a.q.state.weather,'rain');
   a.$('#hour').value='21';a.$('#hour').dispatchEvent(new a.win.Event('input'));assert.equal(a.q.state.hour,21);a.tick(.1);
  }finally{a.close();}
 });
 test(page+': historias sin saltarse viñetas y restauración de la luz',()=>{
  const a=load(page);try{
   a.q.state.hour=13;a.q.state.weather='fog';a.$('[data-panel=stories]').click();assert.equal(a.$$('.story-card').length,3);
   a.$$('.story-card')[1].click();assert.equal(a.q.state.hour,8);assert.equal(a.$('#story-scene').hidden,false);
   a.$$('.frame-step')[3].click();a.$('#story-next').click();assert.equal(a.saved().stories.length,0);assert.match(a.$('.story-count').textContent,/02/);
   a.$('#story-next').click();a.$('#story-next').click();a.$('#story-next').click();
   assert(a.saved().stories.includes('memoria'));assert.equal(a.q.state.hour,13);assert.equal(a.q.state.weather,'fog');assert.equal(a.$('#story-scene').hidden,true);
   a.$('[data-panel=stories]').click();a.$$('.story-card')[0].click();a.$('.story-close').click();assert.equal(a.saved().stories.length,1);
  }finally{a.close();}
 });
 test(page+': diálogos, miniaturas, postal y cierre de partidas',()=>{
  const a=load(page);try{
   a.clearFrames();a.$('[data-panel=games]').click();a.$$('.game-card')[0].click();assert(a.$('#experience-dialog').open);
   a.$('#intro-action button').click();assert.equal(a.$$('.memory-tile').length,12);a.tick(.2);
   assert.equal(a.frameCount(),1);a.$('#dialog-close').click();assert.equal(a.frameCount(),0);assert.equal(a.$('#experience-dialog').open,false);
   a.$('#photo').click();assert(a.$('.dialog-postcard'));assert.equal(a.$('.dialog-postcard').width,1200);
   a.$('.postcard-actions button').click();assert.equal(a.saved().photos,1);a.$('#dialog-close').click();
   if(page==='arriba.html'){a.$('.overview-button').click();assert.equal(a.$('.overview-canvas').width,1400);a.$('.overview-links button').click();assert.equal(a.$('#experience-dialog').open,false);assert(Array.isArray(a.q.state.camTarget));}
  }finally{a.close();}
 });
}
test('Progreso importado: ignora campos desconocidos y cifras inválidas',()=>{
 const a=load('index.html',{hash:'#'+new URLSearchParams({progress:JSON.stringify({visits:['plaza','plaza','<script>','__proto__'],stories:['memoria','inventada'],wins:{memory:-9,metro:Infinity,bird:400000},photos:-3})})});
 try{assert.deepEqual(a.saved().visits,['plaza']);assert.deepEqual(a.saved().stories,['memoria']);assert.equal(a.saved().wins.bird,10000);assert.equal(a.saved().photos,0);}finally{a.close();}
});
