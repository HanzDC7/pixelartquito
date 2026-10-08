'use strict';

(() => {
    const $ = (s) => document.querySelector(s), S = Q.state, api = Q.api;
    const panel = $('#expedition'), dialog = $('#experience-dialog'), scene = $('#story-scene');
    const KEY = 'quito-atlas-vivo-v1', params = new URLSearchParams(location.hash.slice(1));
    let progress = { visits: [], stories: [], wins: {}, photos: 0 }, storageAvailable = true;
    const clean = (raw) => {
        const source = raw && typeof raw === 'object' ? raw : {};
        const result = { visits: [], stories: [], wins: {}, photos: 0 };
        if(Array.isArray(source.visits))result.visits=[...new Set(source.visits.filter((id)=>Object.hasOwn(Q.INFO,id)))];
        if(Array.isArray(source.stories))result.stories=[...new Set(source.stories.filter((id)=>Q.CHAPTERS.some((c)=>c.id===id)))];
        Q.games.catalog.forEach(({id})=>{const value=source.wins?.[id];if(Number.isFinite(value)&&value>0)result.wins[id]=Math.min(10000,Math.floor(value));});
        result.photos=Number.isFinite(source.photos)?Math.min(999,Math.max(0,Math.floor(source.photos))):0;
        return result;
    };
    try { progress=clean(JSON.parse(localStorage.getItem(KEY)||'null')); } catch { storageAvailable=false; }
    if(params.has('progress')) {
        try {
            const other=clean(JSON.parse(params.get('progress')));
            progress.visits=[...new Set([...progress.visits,...other.visits])];progress.stories=[...new Set([...progress.stories,...other.stories])];
            Object.entries(other.wins).forEach(([id,score])=>progress.wins[id]=Math.max(progress.wins[id]||0,score));progress.photos=Math.max(progress.photos,other.photos);
        } catch { /* Un enlace incompleto no impide explorar. */ }
        params.delete('progress');
        try{history.replaceState(null,'',location.pathname+(params.size?'#'+params.toString():''));}catch{}
    }
    const save = () => {
        try { localStorage.setItem(KEY,JSON.stringify(progress)); } catch { storageAvailable=false; }
        // file:// no comparte almacenamiento entre documentos en todos los navegadores.
        const href=api.mode==='top'?'index.html':'arriba.html';
        $('#switch').href=href+'#'+new URLSearchParams({progress:JSON.stringify(progress)});
    };
    let currentPanel='explore', target=null, story=null, priorAtmosphere=null, cleanupGame=null, modalFocus=null, capturing=false, toastTimer;
    const visitedCount=()=>Q.EXPEDITION.filter((x)=>progress.visits.includes(x.id)).length;
    const points=()=>visitedCount()*100+progress.stories.length*150+Object.values(progress.wins).reduce((a,b)=>a+b,0);
    const toast=(message)=>{clearTimeout(toastTimer);$('#toast').textContent=message;$('#toast').classList.add('visible');toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),3500);};
    const button=(text,fn,className='')=>{const b=document.createElement('button');b.type='button';b.textContent=text;b.className=className;b.addEventListener('click',fn);return b;};
    const title=(small,big,count='')=>`<div class="panel-heading"><div><p class="eyebrow">${small}</p><h2>${big}</h2></div><span class="counter">${count}</span></div>`;
    const sourceFor=(chapter)=>chapter.source?`<a class="source-link" href="${chapter.source[1]}" target="_blank" rel="noopener noreferrer">${chapter.source[0]} ↗</a>`:'<p class="small-note">Un cuento original ambientado en la ciudad. El mapa representa una interpretación artística de Quito.</p>';
    const snapshot=(id,hour=10)=>{
        const saved={cam:S.cam,camY:S.camY,camTarget:S.camTarget,camV:S.camV,camVY:S.camVY,tour:S.tour,hour:S.hour,hover:S.hover};
        const cardHidden=$('#card').hidden;
        capturing=true;api.focus(id,true);S.hour=hour;S.hover=null;api.render();
        const c=Q.canvas(Q.W,Q.H);c.g.drawImage($('#view'),0,0);
        Object.assign(S,saved);$('#card').hidden=cardHidden;capturing=false;api.sync();api.render();
        c.cv.className='feature-art';c.cv.setAttribute('aria-label',Q.INFO[id]?.[0]||'Paisaje de Quito');return c.cv;
    };
    const focusPlace=(id)=>{
        target=id;api.focus(id);if(params.has('shot')){api.focus(id,true);api.render();}
        toast('Busca el marcador y toca el lugar para descubrirlo.');
    };
    const renderExplore=()=>{
        const count=visitedCount(), next=Q.EXPEDITION.find((x)=>!progress.visits.includes(x.id));
        panel.innerHTML=title('TU CUADERNO DE VIAJE','La expedición',`${String(count).padStart(2,'0')} / 05`)+
            '<p class="panel-subtitle">Una ciudad para mirar despacio. Un nuevo detalle en cada esquina.</p><div class="explore-grid"><div><div class="mission-card"><span class="tiny-label">'+(next?'MISIÓN ACTIVA':'EXPEDICIÓN COMPLETA')+'</span><h3>'+(next?next.title:'Quito ya es parte de ti.')+'</h3><p>'+(next?next.clue:'Cinco lugares, cinco recuerdos. Continúa con las historias o desafía tu mejor marca en el arcade.')+'</p><div id="mission-action"></div></div><div class="progress-line"><span style="width:'+count*20+'%"></span></div><div class="progress-label"><span>Sellos de la ciudad</span><span>'+count+' de 5</span></div></div><div><p class="section-label"><span>PARADAS IMPERDIBLES</span><span>↘</span></p><div class="location-list"></div></div></div><p class="small-note">Toca los monumentos del mapa para descubrirlos y sellar tu pasaporte. Prueba el atardecer a las 18:00.</p>';
        $('#mission-action').append(button(next?'Seguir la pista →':'Abrir mi pasaporte →',()=>next?focusPlace(next.id):renderPanel('passport')));
        const list=panel.querySelector('.location-list');
        Q.EXPEDITION.forEach((p)=>{
            const done=progress.visits.includes(p.id),b=button('',()=>focusPlace(p.id),'location-row'+(done?' done':''));
            b.innerHTML=`<span class="location-number">${done?'✓':p.stamp}</span><span><strong>${p.name}</strong><small>${done?'Sello conseguido':p.title}</small></span><span>↗</span>`;list.append(b);
        });
    };
    const renderStories=()=>{
        if(story){
            const chapter=Q.CHAPTERS[story.chapter];
            panel.innerHTML=title(chapter.tag,chapter.title)+`<p class="panel-subtitle">Cuatro escenas para descubrir otra forma de mirar la ciudad.</p><div id="story-steps"></div><div style="margin-top:18px">${sourceFor(chapter)}</div>`;
            chapter.frames.forEach((f,i)=>{
                const b=button('',()=>setFrame(i),'frame-step'+(i===story.frame?' active':''));
                b.innerHTML=`<span>0${i+1}</span>${f.title}`;b.setAttribute('aria-current',i===story.frame?'step':'false');$('#story-steps').append(b);
            });
            panel.append(button('← Volver a las historias',()=>{stopStory();renderPanel('stories');},'story-back'));return;
        }
        panel.innerHTML=title('EL LADO QUE NO SE VE','Historias de Quito')+'<p class="panel-subtitle">Elige un relato. La ciudad pone el escenario; tú marcas el ritmo.</p><div class="panel-grid"></div>';
        Q.CHAPTERS.forEach((c,i)=>{
            const b=button('',()=>startStory(i),'story-card');b.append(snapshot(c.place,i===0?18.1:10));
            const copy=document.createElement('span');copy.className='card-copy';copy.innerHTML=`<span class="tiny-label">${c.tag}</span><strong>${c.title}</strong><p>${c.description}</p><span class="card-meta"><span>${c.time}</span><span>${progress.stories.includes(c.id)?'Leída ✓':'Leer →'}</span></span>`;b.append(copy);panel.querySelector('.panel-grid').append(b);
        });
    };
    const renderGames=()=>{
        panel.innerHTML=title('UNA PAUSA PARA JUGAR','Arcade quiteño')+'<p class="panel-subtitle">Tres desafíos breves. Memoria, vuelo y precisión. ¿Cuál es tu mejor marca?</p><div class="panel-grid"></div>';
        Q.games.catalog.forEach((game)=>{
            const b=button('',()=>openGame(game.id),'game-card');b.innerHTML=`<span class="game-icon">${game.icon}</span><span class="card-copy"><span class="tiny-label">${game.kind} · ${game.duration}</span><strong>${game.title}</strong><p>${game.description}</p><span class="card-meta"><span>${progress.wins[game.id]?'Récord: '+progress.wins[game.id]+' pts':'Un sello por conquistar'}</span><span>Jugar ↗</span></span>`;panel.querySelector('.panel-grid').append(b);
        });
        const note=document.createElement('p');note.className='small-note';note.textContent='Tus mejores puntuaciones se guardan en este navegador. Puedes pausar cualquier partida.';panel.append(note);
    };
    const renderPassport=()=>{
        panel.innerHTML=title('RECUERDOS DE UNA CIUDAD','Mi pasaporte')+`<div class="passport-score">${points().toLocaleString('es')} <small>PUNTOS DE VIAJE</small></div><p class="panel-subtitle">${visitedCount()} lugares descubiertos · ${progress.stories.length} historias leídas · ${Object.keys(progress.wins).length} juegos superados</p><div class="stamp-grid"></div><p class="section-label">INSIGNIAS DEL ARCADE</p><div id="badges"></div><p class="small-note">${storageAvailable?'Progreso guardado en este navegador.':'El navegador no permite guardar de forma permanente. El progreso se conserva al cambiar de vista con el botón del mapa.'} Cada lugar suma 100 puntos y cada relato completo, 150. En los juegos cuenta tu mejor victoria.</p>`;
        Q.EXPEDITION.forEach((p)=>{const done=progress.visits.includes(p.id),s=document.createElement('div');s.className='stamp'+(done?' earned':'');s.innerHTML=`<strong>${done?'✦':p.stamp}</strong><span>${p.name}</span><small>${done?'DESCUBIERTO':'POR DESCUBRIR'}</small>`;panel.querySelector('.stamp-grid').append(s);});
        Q.games.catalog.forEach((g)=>{const b=document.createElement('div');b.className='badge-row'+(progress.wins[g.id]?'':' locked');b.innerHTML=`<span>${g.icon}</span><div>${g.reward.replace('Sello: ','')}<div class="tiny-label" style="margin-top:5px">${progress.wins[g.id]?progress.wins[g.id]+' puntos':'Completa el desafío'}</div></div>`;$('#badges').append(b);});
    };
    const renderPanel=(name)=>{
        if(story&&name!=='stories')stopStory();
        currentPanel=name;
        document.querySelectorAll('[data-panel]').forEach((b)=>{const on=b.dataset.panel===name;b.classList.toggle('active',on);b.setAttribute('aria-pressed',on);});
        ({explore:renderExplore,stories:renderStories,games:renderGames,passport:renderPassport}[name]||renderExplore)();
    };
    const setFrame=(index)=>{
        if(!story)return;
        const c=Q.CHAPTERS[story.chapter],f=c.frames[index];story.frame=index;story.read.add(index);
        api.focus(f.place);api.atmosphere(f.hour);S.fiestas=false;S.hover=null;
        if(params.has('shot')){api.focus(f.place,true);api.render();}
        scene.hidden=false;$('#viewport').classList.add('cinema');$('#scene-mode').textContent='MODO HISTORIA';
        scene.innerHTML=`<div class="story-body"><div><span class="tiny-label">${c.tag} · VIÑETA ${index+1}</span><h2>${f.title}</h2><p>${f.text}</p><div class="story-voice">${f.voice}</div></div><button class="story-close" aria-label="Cerrar historia">×</button></div><div class="story-actions"><button id="story-prev" ${index===0?'disabled':''}>← Anterior</button><button id="story-next" class="primary">${index===c.frames.length-1?'Completar historia ✓':'Siguiente →'}</button><span class="story-count">0${index+1} / 04</span></div>`;
        scene.querySelector('.story-close').addEventListener('click',()=>{stopStory();renderPanel('stories');});
        $('#story-prev').addEventListener('click',()=>setFrame(Math.max(0,index-1)));
        $('#story-next').addEventListener('click',()=>{
            if(index<c.frames.length-1){setFrame(index+1);return;}
            if(story.read.size<c.frames.length){const unread=c.frames.findIndex((_,i)=>!story.read.has(i));toast('Aún queda una viñeta por descubrir.');setFrame(unread);return;}
            if(!progress.stories.includes(c.id)){progress.stories.push(c.id);save();toast('Historia completada · +150 puntos de viaje');}
            const game=f.game;stopStory();renderPanel(game?'games':'passport');if(game)openGame(game);
        });
        renderStories();
    };
    const startStory=(index)=>{
        if(story)stopStory();
        priorAtmosphere={hour:S.hour,weather:S.weather,playing:S.playing,fiestas:S.fiestas};
        story={chapter:index,frame:0,read:new Set()};currentPanel='stories';
        document.querySelectorAll('[data-panel]').forEach((b)=>{b.classList.toggle('active',b.dataset.panel==='stories');b.setAttribute('aria-pressed',b.dataset.panel==='stories');});
        setFrame(0);$('#viewport').scrollIntoView({behavior:'smooth',block:'nearest'});
    };
    const stopStory=()=>{
        if(!story)return;
        story=null;scene.hidden=true;scene.replaceChildren();$('#viewport').classList.remove('cinema');$('#scene-mode').textContent=api.mode==='top'?'MAPA VIVO':'CIUDAD VIVA';
        if(priorAtmosphere){Object.assign(S,priorAtmosphere);api.sync();priorAtmosphere=null;}
        api.render();
    };
    const closeDialog=()=>{cleanupGame?.();cleanupGame=null;if(dialog.open)dialog.close();};
    const openDialog=(name,tag)=>{
        cleanupGame?.();cleanupGame=null;
        if(!dialog.open)modalFocus=document.activeElement;
        $('#dialog-content').innerHTML=`<header class="dialog-header"><div><span class="tiny-label">${tag}</span><h2 id="dialog-title">${name}</h2></div><button id="dialog-close" aria-label="Cerrar ventana">×</button></header><div class="dialog-main"></div>`;
        $('#dialog-close').addEventListener('click',closeDialog);
        if(!dialog.open)dialog.showModal();
        $('#dialog-close').focus();return dialog.querySelector('.dialog-main');
    };
    const openGame=(id)=>{
        const game=Q.games.catalog.find((g)=>g.id===id);if(!game)return;
        const body=openDialog(game.title,game.kind+' · ARCADE QUITEÑO');
        body.innerHTML='<div class="game-intro"><div id="intro-art"></div><div><h3>'+game.objective+'</h3><p>'+game.instructions+'</p><span class="tiny-label">'+game.reward+'</span><div id="intro-action"></div></div></div>';
        $('#intro-art').append(snapshot(game.place));$('#intro-action').append(button('Comenzar partida →',()=>runGame(id),'primary'));
    };
    const runGame=(id)=>{
        const game=Q.games.catalog.find((g)=>g.id===id),body=openDialog(game.title,game.kind+' · EN PARTIDA');
        cleanupGame=Q.games.mount(id,body,(result)=>{
            cleanupGame?.();cleanupGame=null;
            const best=progress.wins[id]||0;
            if(result.won){progress.wins[id]=Math.max(best,result.score);save();}
            body.innerHTML=`<div class="game-result"><span class="tiny-label">${result.won?'DESAFÍO SUPERADO':'OTRA RONDA, OTRA OPORTUNIDAD'}</span><div class="result-icon">${result.won?'✦':'↻'}</div><h3>${result.won?'Quito te da un nuevo recuerdo.':'Todavía queda ciudad por jugar.'}</h3><div class="result-score">${result.score} <span class="tiny-label">PTS</span></div><p>${result.message}</p><p class="tiny-label">${result.won?(result.score>best?'Nueva mejor marca · ':'')+game.reward:'Los puntos se guardan al completar el desafío.'}</p><div class="result-actions"></div></div>`;
            const actions=body.querySelector('.result-actions');actions.append(button('Volver a jugar',()=>runGame(id),'primary'),button('Ver mi pasaporte',()=>{closeDialog();renderPanel('passport');}));
            body.querySelector('button').focus();if(currentPanel==='games')renderGames();
        });
        dialog.querySelector('.memory-tile,.arcade-canvas')?.focus();
    };
    const openOverview=()=>{
        if(!api.overview)return;
        const body=openDialog('Toda la ciudad, de un vistazo','ATLAS · SUR → NORTE'),map=api.overview;
        const c=Q.canvas(map.width,map.height);c.g.drawImage(map.canvas,0,0);c.cv.className='overview-canvas';
        c.cv.setAttribute('aria-label','Mapa general de Quito. Toca un punto para viajar. También puedes usar los botones de lugares.');
        c.g.strokeStyle='#FFE5A6';c.g.lineWidth=3;c.g.strokeRect(S.cam,S.camY,Q.W,Q.H);
        Q.EXPEDITION.forEach((p,i)=>{const m=api.marks().find((m)=>m.id===p.id);if(!m)return;Q.disc(c.g,m.cx,m.cy,9,'#203C31');Q.text(c.g,String(i+1),m.cx-1,m.cy-2,'#EAC078');});
        c.cv.addEventListener('click',(e)=>{const r=c.cv.getBoundingClientRect();map.jump((e.clientX-r.left)/r.width*map.width,(e.clientY-r.top)/r.height*map.height);closeDialog();});
        body.append(c.cv);const help=document.createElement('p');help.className='game-instruction';help.textContent='Toca cualquier punto para viajar. Norte a la derecha, Pichincha arriba. Representación artística; no está a escala.';body.append(help);
        const links=document.createElement('div');links.className='overview-links';
        Q.EXPEDITION.forEach((p,i)=>links.append(button((i+1)+'. '+p.name,()=>{api.focus(p.id);target=p.id;closeDialog();})));body.append(links);
    };
    const openPhoto=()=>{
        const body=openDialog('Una postal de Quito','GUARDA ESTE MOMENTO');
        capturing=true;api.render();
        const c=Q.canvas(1200,790),g=c.g;g.fillStyle='#E8E0C8';g.fillRect(0,0,1200,790);g.drawImage($('#view'),24,24,1152,648);
        capturing=false;api.render();
        g.fillStyle='#213C32';g.font='34px Georgia';g.fillText('Quito, entre volcanes e historias.',32,725);
        g.font='12px monospace';g.fillText('ATLAS VIVO / ECUADOR',34,757);
        const time=String(Math.floor(S.hour)).padStart(2,'0')+':'+String(Math.floor(S.hour%1*60)).padStart(2,'0');g.textAlign='right';g.fillText('2.850 m  /  '+time+'  /  '+(api.mode==='top'?'DESDE ARRIBA':'PANORAMA'),1166,754);
        c.cv.className='dialog-postcard';c.cv.setAttribute('aria-label','Vista previa de la postal descargable');body.append(c.cv);
        const actions=document.createElement('div');actions.className='postcard-actions';actions.innerHTML='<p>Tu vista actual, en una postal de 1200 × 790 píxeles.</p>';
        actions.append(button('Descargar PNG ↓',()=>{
            c.cv.toBlob((blob)=>{if(!blob){toast('No se pudo crear la postal. Inténtalo otra vez.');return;}const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='quito-atlas-'+api.mode+'-'+time.replace(':','')+'.png';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);progress.photos++;save();toast('Postal lista · un recuerdo de tu expedición.');},'image/png');
        },'primary'));body.append(actions);
    };
    Q.experience={
        busy:()=>dialog.open,
        visit(id){
            if(!Object.hasOwn(Q.INFO,id)||capturing)return;
            if(!progress.visits.includes(id)){
                progress.visits.push(id);save();const place=Q.EXPEDITION.find((p)=>p.id===id);
                if(place){toast(visitedCount()===5?'¡Expedición completa! Ya tienes los cinco sellos.':'Nuevo sello: '+place.name+' · +100 puntos');if(target===id)target=null;}
                if(currentPanel==='explore')renderExplore();else if(currentPanel==='passport')renderPassport();
            }
        },
        draw(g){
            if(capturing||story||!target)return;
            const m=api.marks().find((m)=>m.id===target);if(!m)return;const [x,y]=api.project(m);
            if(x<8||x>Q.W-8||y<13||y>Q.H-16)return;
            const dy=Math.round(Math.sin(S.time*3)*2);Q.disc(g,x,y-10+dy,5,'#243E33');Q.disc(g,x,y-10+dy,3,'#E8CB88');Q.R(g,x,y-4+dy,1,3,'#E8CB88');
        },
    };
    document.querySelectorAll('[data-panel]').forEach((b)=>b.addEventListener('click',()=>renderPanel(b.dataset.panel)));
    $('#photo').addEventListener('click',openPhoto);
    dialog.addEventListener('close',()=>{cleanupGame?.();cleanupGame=null;modalFocus?.focus();});
    dialog.addEventListener('cancel',()=>{cleanupGame?.();cleanupGame=null;});
    addEventListener('keydown',(e)=>{if(e.key==='Escape'&&story&&!dialog.open){stopStory();renderPanel('stories');}});
    // Flechas y teclas de juego no deben desplazar el documento detrás de un diálogo.
    dialog.addEventListener('keydown',(e)=>{if(e.target instanceof HTMLCanvasElement&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' '].includes(e.key))e.preventDefault();});
    $('#scene-mode').textContent=api.mode==='top'?'MAPA VIVO':'CIUDAD VIVA';
    $('#view').tabIndex=0;
    if(api.overview){const overview=button('↗ Mapa general',openOverview,'overview-button');$('#controls').append(overview);}
    save();renderPanel('explore');
    if(params.has('panel')&&['stories','games','passport'].includes(params.get('panel')))renderPanel(params.get('panel'));
})();
