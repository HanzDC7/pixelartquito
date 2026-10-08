'use strict';

/* Tres juegos autónomos. Cada sesión devuelve dispose(): sin temporizadores
 * pendientes ni escuchas de teclado al cerrar, volver a jugar o cambiar de vista. */
(() => {
    const { R, disc, line, clamp, hash } = Q;
    const CATALOG = [
        { id: 'memory', title: 'Las piedras de Cantuña', kind: 'MEMORIA', icon: '◇', place: 'sanfrancisco', description: 'Seis parejas. Un atrio. Sesenta segundos.', instructions: 'Descubre dos piedras por turno y encuentra las seis parejas antes de que termine el minuto. Las parejas correctas se quedan visibles. Se juega con clic, toque o Tab y Enter.', objective: 'Encuentra las 6 parejas', reward: 'Sello: Guardián de la memoria', duration: '60 s' },
        { id: 'bird', title: 'El vuelo del colibrí', kind: 'DESTREZA', icon: '✦', place: 'moderna', description: 'Ocho flores antes de que llegue el aguacero.', instructions: 'Guía al colibrí con las flechas o arrastrando el dedo sobre el jardín. Recoge ocho flores y evita las gotas azules. Tienes tres vidas y 45 segundos. Tras un golpe dispones de un instante de protección.', objective: 'Recoge 8 flores', reward: 'Sello: Alas de Quito', duration: '45 s' },
        { id: 'metro', title: 'Próxima estación', kind: 'PRECISIÓN', icon: '▰', place: 'metro', description: 'Domina la frenada y completa cinco paradas.', instructions: 'Pulsa Espacio o el botón Frenar cuando el frente del tren entre en la zona verde. Cada parada aumenta la velocidad. Un fallo cuesta una de tus tres oportunidades. La ruta es un circuito de juego inspirado en el Metro.', objective: 'Completa 5 paradas', reward: 'Sello: Pulso de la ciudad', duration: '1–2 min' },
    ];
    const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const gardenCloud = Q.cloudSprite(71,'#EAE7CE','#B2C7BD');
    const landscape = (g, t, night = false) => {
        R(g, 0, 0, 384, 216, night ? '#152D34' : '#93BBC0');
        for (let y = 0; y < 140; y += 4) R(g, 0, y, 384, 4, Q.mix(night ? '#152D34' : '#87B1B9', night ? '#405253' : '#D6D6AE', y / 140));
        for (let x = 0; x < 384; x++) {
            const y = 93 - Math.sin(x * .017) * 24 - Math.sin(x * .035 + 1) * 14;
            R(g, x, y, 1, 120 - y, night ? '#2A4444' : '#75937C');
            const y2 = 124 - Math.sin(x * .027 + 2) * 20;
            R(g, x, y2, 1, 160 - y2, night ? '#213F36' : '#4C7959');
        }
        if(!night){g.globalAlpha=.65;g.drawImage(gardenCloud,Math.round(210+t*.7),20);g.globalAlpha=1;disc(g,66,28,9,'#EADFAD');}
        else for(let i=0;i<30;i++)R(g,hash(i)*384,hash(i+9)*42,1,1,'#9BB9B7');
        const base=night?63:151;
        for(let i=0;i<27;i++){
            const x=i*15-5,h=8+Math.floor(hash(i+17)*17),y=base-h;
            R(g,x,y,13,h,night?'#304B4D':Q.pick(['#BDBB99','#D2C5A0','#AFB39A'],i));
            R(g,x-1,y-2,15,2,night?'#3D5453':'#A67B59');
            R(g,x+11,y,2,h,night?'#203A41':'#8D9B81');
            for(let yy=y+3;yy<base-3;yy+=5)for(let xx=x+2;xx<x+10;xx+=4)R(g,xx,yy,2,2,night?(hash(xx+yy)>.6?'#D7C48D':'#506B65'):'#627D75');
        }
        if(!night){
            R(g,282,112,44,37,'#9DA992');R(g,287,107,36,5,'#6F887D');
            [283,299].forEach((x)=>{R(g,x,95,9,53,'#ABB59A');R(g,x+7,95,2,53,'#7C9483');for(let k=0;k<4;k++)R(g,x+k,91-k*4,9-k*2,4,'#607A71');R(g,x+4,73,1,4,'#C6C8A6');R(g,x+3,100,3,8,'#5F7C73');R(g,x+3,121,3,12,'#5F7C73');});
        }
        R(g, 0, 154, 384, 62, '#2B533B');
        for (let i = 0; i < 130; i++) R(g, hash(i) * 384, 156 + hash(i + 1) * 60, 2, 1, '#496C43');
        for(let x=0;x<384;x++)R(g,x,191+Math.sin(x*.018)*7,1,6,'#7B8761');
        for (let i = 0; i < 12; i++) {
            const x = i * 35 + 3, y = 125 + hash(i) * 20;
            R(g, x + 3, y, 2, 30, '#5D5C3C'); disc(g, x + 4, y, 9, '#315D42'); disc(g, x + 1, y - 3, 7, '#668750');
            for(let k=0;k<7;k++)R(g,x-4+hash(i+k)*12,y-7+hash(k+i+31)*12,2,1,k%2?'#86A366':'#426F47');
        }
    };
    Q.games = {
        catalog: CATALOG,
        mount(id, root, finish) {
            const config = CATALOG.find((c) => c.id === id);
            let disposed = false, ended = false, paused = false, raf = 0, last = performance.now();
            const abort = new AbortController(), opts = { signal: abort.signal };
            root.innerHTML = '<div class="game-stats"><span id="game-objective"></span><span id="game-score"></span><button id="game-pause" type="button">Pausar</button></div><p class="game-paused" hidden>En pausa. Pulsa Continuar para volver.</p><div id="game-board"></div><p class="game-instruction"></p>';
            const $ = (s) => root.querySelector(s), board = $('#game-board'), score = $('#game-score');
            $('#game-objective').textContent = config.objective;
            const pauseButton = $('#game-pause');
            const state = { elapsed: 0, score: 0, lives: 3 };
            const complete = (won, points, message) => {
                if (ended || disposed) return;
                ended = true; cancelAnimationFrame(raf); abort.abort();
                finish({ id, won, score: Math.max(0, Math.round(points)), message });
            };
            pauseButton.addEventListener('click', () => {
                paused = !paused; pauseButton.textContent = paused ? 'Continuar' : 'Pausar';
                $('.game-paused').hidden = !paused;
            }, opts);
            let update, draw = () => {};
            if (id === 'memory') {
                const symbols = [['✦', 'Estrella'], ['☀', 'Sol'], ['◇', 'Piedra'], ['♜', 'Torre'], ['≋', 'Agua'], ['❀', 'Flor']];
                const deck = shuffle([...symbols.keys(), ...symbols.keys()]);
                let open = [], found = 0, moves = 0, lock = 0;
                board.className = 'memory-grid';
                const tiles = deck.map((value, i) => {
                    const b = document.createElement('button'); b.className = 'memory-tile'; b.type = 'button';
                    b.textContent = '·'; b.setAttribute('aria-label', `Piedra ${i + 1}, oculta`);
                    b.addEventListener('click', () => {
                        if (paused || document.hidden || ended || lock > 0 || b.classList.contains('matched') || open.includes(i)) return;
                        b.textContent = symbols[value][0]; b.classList.add('revealed'); b.setAttribute('aria-label', `Piedra ${i + 1}: ${symbols[value][1]}`);
                        open.push(i);
                        if (open.length === 2) {
                            moves++;
                            if (deck[open[0]] === deck[open[1]]) {
                                open.forEach((j) => { tiles[j].classList.add('matched'); tiles[j].disabled = true; });
                                open = []; found++;
                                if (found === 6) complete(true, 600 + (60 - state.elapsed) * 10 - moves * 5, 'Cada pareja encontró su lugar. La memoria del atrio queda en buenas manos.');
                            } else lock = .8;
                        }
                    }, opts);
                    board.append(b); return b;
                });
                $('.game-instruction').textContent = 'Elige dos piedras. Observa sus símbolos y encuentra su pareja.';
                update = (dt) => {
                    state.elapsed += dt;
                    if (lock > 0) { lock -= dt; if (lock <= 0) { open.forEach((i) => { tiles[i].textContent = '·'; tiles[i].classList.remove('revealed'); tiles[i].setAttribute('aria-label', `Piedra ${i + 1}, oculta`); }); open = []; } }
                    score.textContent = `${found}/6 parejas · ${Math.ceil(Math.max(0,60 - state.elapsed))} s · ${moves} turnos`;
                    if (state.elapsed >= 60) complete(false, found * 100, 'Se acabó el tiempo. Ya conoces algunas piedras: vuelve a intentarlo con una nueva disposición.');
                };
            } else {
                const cv = document.createElement('canvas'); cv.width = 384; cv.height = 216; cv.className = 'arcade-canvas'; cv.tabIndex = 0;
                cv.setAttribute('aria-label', id === 'bird' ? 'Jardín del colibrí. Usa las flechas o arrastra para moverte.' : 'Tren en movimiento. Pulsa Espacio cuando alcance el andén verde.');
                board.append(cv); const g = cv.getContext('2d'); g.imageSmoothingEnabled = false;
                if (id === 'bird') {
                    const keys = new Set(), bird = { x: 48, y: 104, safe: 0 }, flowers = [
                        [105, 62], [202, 138], [302, 70], [275, 170], [145, 175], [60, 58], [204, 55], [337, 132],
                    ].map(([x,y]) => ({x,y,found:false}));
                    const drops = Array.from({length: 7}, (_,i) => ({x:40+i*49,y:-i*31,v:32+i*5}));
                    let target = null, pointer = null, collected = 0;
                    const point = (e) => { const r=cv.getBoundingClientRect(); return [clamp((e.clientX-r.left)/r.width*384,8,376),clamp((e.clientY-r.top)/r.height*216,12,203)]; };
                    cv.addEventListener('pointerdown', (e) => { if(paused)return;pointer=e.pointerId;cv.setPointerCapture(e.pointerId);target=point(e); },opts);
                    cv.addEventListener('pointermove', (e) => {if(pointer===e.pointerId)target=point(e);},opts);
                    cv.addEventListener('pointerup', () => {pointer=null;},opts);
                    cv.addEventListener('pointercancel', () => {pointer=null;target=null;},opts);
                    addEventListener('keydown',(e)=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();keys.add(e.key);target=null;}},opts);
                    addEventListener('keyup',(e)=>keys.delete(e.key),opts);
                    addEventListener('blur',()=>{keys.clear();target=null;},opts);
                    $('.game-instruction').textContent = 'Flechas para volar · toca o arrastra hacia una flor · evita las gotas azules.';
                    update = (dt) => {
                        state.elapsed += dt; bird.safe=Math.max(0,bird.safe-dt);
                        let dx=(keys.has('ArrowRight')?1:0)-(keys.has('ArrowLeft')?1:0),dy=(keys.has('ArrowDown')?1:0)-(keys.has('ArrowUp')?1:0);
                        if(target){dx=target[0]-bird.x;dy=target[1]-bird.y;}
                        const len=Math.hypot(dx,dy),speed=target?Math.min(100,len*8):100;
                        if(len){bird.x=clamp(bird.x+dx/len*speed*dt,8,376);bird.y=clamp(bird.y+dy/len*speed*dt,12,203);}
                        flowers.forEach((f)=>{if(!f.found&&Math.hypot(f.x-bird.x,f.y-bird.y)<11){f.found=true;collected++;}});
                        drops.forEach((d)=>{
                            d.y+=d.v*dt; if(d.y>224){d.y=-12;d.x=15+Math.random()*354;}
                            if(bird.safe<=0&&Math.hypot(d.x-bird.x,d.y-bird.y)<8){state.lives--;bird.safe=1.6;}
                        });
                        score.textContent=`${collected}/8 flores · ${Math.ceil(Math.max(0,45-state.elapsed))} s · ${'♥'.repeat(Math.max(0,state.lives))}`;
                        if(collected===8)complete(true,800+(45-state.elapsed)*12+state.lives*50,'El jardín florece de nuevo. Ocho pequeñas paradas, un gran vuelo.');
                        else if(state.lives<=0||state.elapsed>=45)complete(false,collected*100,'La lluvia ganó esta ronda. Busca una ruta corta entre las flores y vuelve a volar.');
                    };
                    draw=()=>{
                        landscape(g,state.elapsed);const t=state.elapsed;
                        flowers.forEach((f,i)=>{if(f.found){R(g,f.x,f.y,1,2,'#799153');return;}line(g,f.x,f.y,f.x,f.y+9,'#8FAD68');disc(g,f.x,f.y,4,i%2?'#E2A586':'#DCBD73');R(g,f.x-1,f.y-1,3,3,'#FFF0B5');if(Math.floor(t*2+i)%2)R(g,f.x+6,f.y-6,1,1,'#F8E9BD');});
                        drops.forEach((d)=>{R(g,d.x,d.y-5,1,6,'#9AC6E4');R(g,d.x-1,d.y-1,3,3,'#66A1CD');});
                        if(bird.safe<=0||Math.floor(t*12)%2){const x=bird.x,y=bird.y;R(g,x-4,y,7,3,'#52BE9A');R(g,x+2,y-2,3,3,'#A8D49B');R(g,x+5,y-2,5,1,'#E8D99D');R(g,x+3,y-2,1,1,'#153D3A');R(g,x-6,y+2,3,1,'#305F86');R(g,x-1,y+(Math.floor(t*20)%2?-6:3),3,5,'#BDD6B2');}
                    };
                } else {
                    const names=['SAN FRANCISCO','LA ALAMEDA','EL EJIDO','LA CAROLINA','INAQUITO'];
                    let x=20,zone=220,stops=0,cooldown=0,feedback='Acerca el frente del tren a la zona verde.';
                    const action=document.createElement('button');action.type='button';action.className='primary arcade-action';action.textContent='Frenar · Espacio';board.append(action);
                    const reset=()=>{x=20;zone=155+Math.random()*160;};
                    const brake=()=>{
                        if(paused||document.hidden||ended||cooldown>0)return;
                        const width=29-stops*2, error=Math.abs(x-zone);
                        if(error<=width/2){state.score+=Math.round(200-error*5);stops++;feedback='¡En el andén! Buena frenada.';}
                        else{state.lives--;feedback=x<zone?'Demasiado pronto. Espera la zona verde.':'Te pasaste del andén. Anticipa la frenada.';}
                        if(stops===5){complete(true,state.score+state.lives*100,'Cinco paradas precisas. La ciudad sigue su camino gracias a tu pulso.');return;}
                        if(state.lives<=0){complete(false,state.score,'El turno ha terminado. Inténtalo otra vez y encuentra el ritmo de cada estación.');return;}
                        cooldown=1.2;action.disabled=true;
                    };
                    action.addEventListener('click',brake,opts);
                    addEventListener('keydown',(e)=>{if(e.code==='Space'||e.key===' '){if(e.target instanceof HTMLButtonElement&&e.target!==action)return;e.preventDefault();if(!e.repeat)brake();}},opts);
                    $('.game-instruction').textContent='Frena cuando el frente del tren esté dentro del andén verde. Cada acierto aumenta la velocidad.';
                    update=(dt)=>{
                        state.elapsed+=dt;
                        if(cooldown>0){cooldown-=dt;if(cooldown<=0){reset();action.disabled=false;}}
                        else{x+=(65+stops*17)*dt;if(x>380)brake();}
                        score.textContent=`${stops}/5 paradas · ${state.score} pts · ${'♥'.repeat(Math.max(0,state.lives))}`;
                    };
                    draw=()=>{
                        landscape(g,state.elapsed,true);R(g,0,63,384,153,'#15282D');
                        for(let i=0;i<12;i++){R(g,i*35,66,2,121,'#314344');R(g,i*35+7,72,20,2,'#B3C0A2');}
                        for(let row=0;row<7;row++)for(let col=0;col<32;col++)R(g,col*13+(row%2?6:0),80+row*10,11,1,'#243B3D');
                        [35,310].forEach((px)=>{R(g,px,96,27,34,'#536D67');R(g,px+2,98,23,30,'#283F3E');Q.text(g,px===35?'QUITO':'VIAJA',px+3,102,'#D7C793');R(g,px+5,114,17,1,'#719287');R(g,px+5,118,12,1,'#719287');R(g,px+4,144,25,2,'#869789');R(g,px+6,146,2,10,'#536D67');R(g,px+24,146,2,10,'#536D67');});
                        R(g,0,158,384,13,'#728273');R(g,0,158,384,2,'#E4C878');
                        for(let px=0;px<384;px+=6)R(g,px,162,2,1,'#C2C39B');
                        R(g,0,154,384,1,'#4D6364');R(g,0,156,384,1,'#A1AD99');
                        const w=29-stops*2;R(g,zone-w/2,99,w,57,'#315C47');R(g,zone-w/2,99,w,1,'#ABDA97');
                        for(let i=0;i<3;i++){const bx=x-25-i*27;R(g,bx,123,25,25,'#D7DECF');R(g,bx+2,126,20,9,'#87B5BA');R(g,bx,140,25,3,'#D78763');R(g,bx,144,25,3,'#557591');R(g,bx+3,149,4,3,'#101F28');R(g,bx+18,149,4,3,'#101F28');}
                        R(g,x,122,1,29,'#F5E3A3');
                        Q.label(g,names[Math.min(stops,4)],192,87,'#E6D29D','#203C36');
                        Q.label(g,cooldown>0?'SIGUIENTE PARADA':'FRENA EN LA ZONA VERDE',192,182,'#D2DEB8','#203C36');
                        line(g,148,202,236,202,'#4E6A5C');for(let i=0;i<5;i++)disc(g,148+i*22,202,3,i<stops?'#D8CD88':'#536F60');
                        $('.game-instruction').textContent=feedback;
                    };
                }
            }
            update(0); draw();
            const frame = (now) => {
                if(disposed||ended)return;
                const dt=Math.min(.05,Math.max(0,(now-last)/1000));last=now;
                if(!paused&&!document.hidden){update(dt);if(!ended)draw();}
                if(!ended)raf=requestAnimationFrame(frame);
            };
            raf=requestAnimationFrame(frame);
            return () => {disposed=true;abort.abort();cancelAnimationFrame(raf);};
        },
    };
})();
