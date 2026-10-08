'use strict';

/*
 * Arranque, bucle de dibujo, cámara, entrada y controles.
 *
 * Para ver un cuadro fijo sin esperar (útil al retocar): agregar a la URL, por
 * ejemplo, #shot&x=700&h=20&w=rain&f=1&t=8&card=basilica
 *   x: cámara · h: hora · w: clima · f: fiestas · t: segundos simulados
 */
(() => {
    const { R, clamp, W, H, GROUND: G } = Q;
    const S = Q.state, A = Q.actors;
    const $ = (sel) => document.querySelector(sel);

    const view = $('#view');
    Q.g = view.getContext('2d');
    Q.g.imageSmoothingEnabled = false;
    Q.scene = Q.canvas(W, H);
    Q.glowLayer = Q.canvas(W, H);

    Q.buildWorld();
    Q.initActors();

    // Las ventanas encendidas de cada capa, en un lienzo aparte.
    Object.values(Q.layers).forEach((L) => {
        const c = Q.canvas(L.w, H);
        L.lights.forEach(([x, y, w, h, seed]) => { if (Q.hash(seed) < 0.72) R(c.g, x, y, w, h, Q.hash(seed + 1) > 0.86 ? '#BFE0FF' : '#FFD98A'); });
        L.lightCv = c.cv;
    });
    const ORDER = ['far', 'pich', 'hills', 'city', 'front'].map((n) => Q.layers[n]);
    const byDepth = [...Q.marks].sort((a, b) => b.layer.f - a.layer.f);

    const markX = (m) => Math.round(m.x - S.cam * m.layer.f);
    const worldX = (m) => clamp((m.x + m.w / 2 - W / 2) / m.layer.f, 0, Q.MAXCAM);   // cámara que lo deja centrado

    // ───────────────────────── Dibujo ─────────────────────────
    const MAP = { x: 122, y: 4, w: 140 };

    const render = () => {
        const g = Q.g, s = Q.scene.g, cam = S.cam, n = Q.night(S.hour);
        const put = (ctx, L, cv = L.cv) => ctx.drawImage(cv, -Math.round(cam * L.f), 0);

        A.drawSky(g);

        s.clearRect(0, 0, W, H);
        put(s, Q.layers.far); A.drawPuffs(s); A.drawClouds(s, true);
        put(s, Q.layers.pich); A.drawCable(s); A.drawCondor(s); A.drawClouds(s, false);
        put(s, Q.layers.hills); A.drawKites(s);
        put(s, Q.layers.city);
        put(s, Q.layers.front); A.drawStreet(s);

        // La hora y el clima tiñen todo lo que no es cielo.
        s.globalCompositeOperation = 'source-atop';
        const tint = (color, alpha) => { if (alpha > 0.01) { s.globalAlpha = alpha; s.fillStyle = color; s.fillRect(0, 0, W, H); } };
        tint('#FF7A2E', Q.dusk(S.hour) * 0.2 * (1 - A.rainF));
        tint('#3C4558', A.rainF * 0.3);
        tint('#0A0E2A', n * 0.64);
        s.globalAlpha = 1; s.globalCompositeOperation = 'source-over';
        g.drawImage(Q.scene.cv, 0, 0);

        // El subsuelo no depende del sol: el metro siempre está iluminado.
        g.drawImage(Q.layers.front.cv, Math.round(cam), G + 17, W, H - G - 17, 0, G + 17, W, H - G - 17);
        A.drawMetro(g);

        if (n > 0.02) {
            // Cada capa tapa las luces de las que tiene detrás.
            const l = Q.glowLayer.g;
            l.clearRect(0, 0, W, H);
            ORDER.forEach((L) => {
                l.globalCompositeOperation = 'destination-out'; put(l, L);
                l.globalCompositeOperation = 'source-over'; put(l, L, L.lightCv);
                l.globalAlpha = 0.82;
                Q.marks.forEach((m) => { if (m.layer === L && m.lit) l.drawImage(m.lit, markX(m), m.y); });
                l.globalAlpha = 1;
            });
            l.clearRect(0, G + 17, W, H);
            g.globalAlpha = n * (S.hour > 23 || S.hour < 5 ? 0.7 : 1);
            g.drawImage(Q.glowLayer.cv, 0, 0);
            g.globalAlpha = 1;
            A.drawGlows(g, n);
        }

        A.drawWetRoad(g);
        A.drawWeather(g);
        A.drawFireworks(g);
        A.drawBird(g);

        // Lugar bajo el cursor: esquinas y rótulo.
        const m = S.hover;
        if (m && !m.car) {
            const x = markX(m), c = '#FFE500';
            [[x, m.y, 1, 1], [x + m.w - 1, m.y, -1, 1], [x, m.y + m.h - 1, 1, -1], [x + m.w - 1, m.y + m.h - 1, -1, -1]].forEach(([cx, cy, dx, dy]) => {
                R(g, dx > 0 ? cx : cx - 4, cy, 5, 1, c); R(g, cx, dy > 0 ? cy : cy - 4, 1, 5, c);
            });
        }
        if (m) {
            const name = Q.INFO[m.id][0].toUpperCase().normalize('NFD').replace(/[^A-Z0-9 .·-]/g, '');
            const cx = m.car ? m.box[0] + m.box[2] / 2 : markX(m) + m.w / 2, top = m.car ? m.box[1] : m.y;
            Q.label(g, name, cx, top > 14 ? top - 10 : top + (m.car ? 18 : m.h) + 4, '#FFE500');
        }

        // Minimapa: de sur a norte, con la ventana que se está viendo.
        g.globalAlpha = 0.7; R(g, MAP.x - 9, MAP.y - 2, MAP.w + 18, 9, '#0B1020'); g.globalAlpha = 1;
        Q.text(g, 'S', MAP.x - 7, MAP.y, '#8FA3D9'); Q.text(g, 'N', MAP.x + MAP.w + 2, MAP.y, '#8FA3D9');
        R(g, MAP.x, MAP.y + 2, MAP.w, 1, '#2C3A66');
        byDepth.forEach((mk) => R(g, MAP.x + (worldX(mk) + W / 2) / Q.WORLD * MAP.w, MAP.y + 1, 1, 3, mk === S.hover ? '#FFE500' : '#5E72A8'));
        const vx = MAP.x + cam / Q.WORLD * MAP.w, vw = Math.round(W / Q.WORLD * MAP.w);
        R(g, vx, MAP.y - 1, vw, 1, '#FF8A3D'); R(g, vx, MAP.y + 5, vw, 1, '#FF8A3D'); R(g, vx, MAP.y - 1, 1, 7, '#FF8A3D'); R(g, vx + vw - 1, MAP.y - 1, 1, 7, '#FF8A3D');
        Q.experience?.draw(g);
    };

    // ───────────────────────── Lógica ─────────────────────────
    const keys = {};
    const update = (dt) => {
        S.time += dt;
        if (S.playing) S.hour = (S.hour + dt * 0.08) % 24;   // un día entero en cinco minutos

        if (keys.ArrowLeft || keys.ArrowRight) { S.camV = (keys.ArrowRight ? 1 : -1) * 170; S.camTarget = null; S.tour = false; syncButtons(); }
        if (S.camTarget !== null) {
            S.cam += (S.camTarget - S.cam) * Math.min(1, dt * 4);
            if (Math.abs(S.camTarget - S.cam) < 0.5) S.camTarget = null;
        } else if (S.tour && !drag.on) {
            S.cam += S.tourDir * 20 * dt;
            if (S.cam >= Q.MAXCAM) S.tourDir = -1; if (S.cam <= 0) S.tourDir = 1;
        } else if (!drag.on) {
            S.cam += S.camV * dt; S.camV *= Math.pow(0.02, dt);
        }
        S.cam = clamp(S.cam, 0, Q.MAXCAM);
        A.update(dt);
    };
    S.tourDir = 1;

    // ───────────────────────── Entrada ─────────────────────────
    const toCanvas = (e) => {
        const r = view.getBoundingClientRect();
        return [(e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H];
    };

    const pickAt = (x, y) => {
        const car = A.cars.find((c) => c.kind === 'trole' && c.box && x >= c.box[0] && x <= c.box[0] + c.box[2] && y >= c.box[1] && y <= c.box[1] + c.box[3]);
        if (car) return { id: 'trole', car: true, box: car.box };
        return byDepth.find((m) => { const mx = markX(m); return x >= mx && x <= mx + m.w && y >= m.y && y <= m.y + m.h && (!m.test || m.test(x + S.cam * m.layer.f, y)); }) || null;
    };

    const card = $('#card');
    const showCard = (id) => {
        Q.experience?.visit(id);
        const [title, sub, text] = Q.INFO[id];
        card.querySelector('h2').textContent = title;
        card.querySelector('.sub').textContent = sub;
        card.querySelector('.text').textContent = text;
        card.hidden = false;
        document.querySelectorAll('#places button').forEach((b) => b.classList.toggle('on', b.dataset.id === id));
    };

    const click = (x, y) => {
        if (y < MAP.y + 9 && x > MAP.x - 9 && x < MAP.x + MAP.w + 9) {
            S.camTarget = clamp((x - MAP.x) / MAP.w * Q.WORLD - W / 2, 0, Q.MAXCAM); S.tour = false; syncButtons();
            return;
        }
        const m = pickAt(x, y);
        if (m) {
            showCard(m.id);
            if (['sanfrancisco', 'compania', 'catedral', 'basilica'].includes(m.id)) Q.sfx.bell();
            if (m.id === 'plaza' || m.id === 'sanfrancisco') A.scatter(m.x + m.w / 2);
            if (m.id === 'trole') Q.sfx.horn();
            return;
        }
        if (y > G - 20) return;
        if (Q.night(S.hour) > 0.5 || S.fiestas) A.firework(x + S.cam * 0.7, y); else A.kite(x + S.cam * 0.55, y);
    };

    const drag = { on: false, x: 0, cam: 0, moved: 0, lastX: 0, lastT: 0 };
    view.addEventListener('pointerdown', (e) => {
        view.setPointerCapture(e.pointerId);
        Object.assign(drag, { on: true, x: e.clientX, cam: S.cam, moved: 0, lastX: e.clientX, lastT: performance.now() });
        S.camV = 0; S.camTarget = null;
    });
    view.addEventListener('pointermove', (e) => {
        const [x, y] = toCanvas(e);
        Object.assign(S.mouse, { x, y, inside: true, movedAt: S.time });
        if (drag.on) {
            const scale = view.getBoundingClientRect().width / W, now = performance.now();
            drag.moved = Math.max(drag.moved, Math.abs(e.clientX - drag.x));
            S.cam = clamp(drag.cam - (e.clientX - drag.x) / scale, 0, Q.MAXCAM);
            if (now > drag.lastT) S.camV = -((e.clientX - drag.lastX) / scale) / ((now - drag.lastT) / 1000);
            drag.lastX = e.clientX; drag.lastT = now;
            if (drag.moved > 5 && S.tour) { S.tour = false; syncButtons(); }
        }
        S.hover = drag.on && drag.moved > 5 ? null : pickAt(x, y);
        view.style.cursor = drag.on && drag.moved > 5 ? 'grabbing' : S.hover ? 'pointer' : 'grab';
    });
    const release = (e) => {
        if (!drag.on) return;
        drag.on = false;
        if (drag.moved <= 5) { S.camV = 0; click(...toCanvas(e)); } else if (performance.now() - drag.lastT > 80) S.camV = 0;
    };
    view.addEventListener('pointerup', release);
    view.addEventListener('pointercancel', () => { drag.on = false; });
    view.addEventListener('pointerleave', () => { S.mouse.inside = false; S.hover = null; });
    view.addEventListener('wheel', (e) => { e.preventDefault(); S.cam = clamp(S.cam + (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) * 0.4, 0, Q.MAXCAM); S.camTarget = null; }, { passive: false });

    addEventListener('keydown', (e) => {
        if (e.target instanceof HTMLInputElement || Q.experience?.busy()) return;
        keys[e.key] = true;
        const k = e.key.toLowerCase();
        if (k === 'n') setHour(Q.night(S.hour) > 0.5 ? 11 : 21);
        else if (k === 'r') setWeather({ clear: 'rain', rain: 'fog', fog: 'clear' }[S.weather]);
        else if (k === 'f') toggle('fiestas');
        else if (k === ' ') { e.preventDefault(); toggle('playing'); }
        else if (k === 'escape') card.hidden = true;
    });
    addEventListener('keyup', (e) => { keys[e.key] = false; });

    // ───────────────────────── Controles ─────────────────────────
    const hourInput = $('#hour'), clock = $('#clock');
    const setHour = (h) => { S.hour = ((h % 24) + 24) % 24; hourInput.value = S.hour; };
    const setWeather = (w) => {
        if (S.weather === 'rain' && w === 'clear' && Q.night(S.hour) < 0.3) A.rainbow = 16;
        S.weather = w;
        document.querySelectorAll('[data-weather]').forEach((b) => b.classList.toggle('on', b.dataset.weather === w));
        Q.sfx.rain(w === 'rain');
    };
    const syncButtons = () => {
        [['#play', S.playing], ['#fiestas', S.fiestas], ['#tour', S.tour], ['#sound', S.sound]].forEach(([sel, on]) => { $(sel).classList.toggle('on', on); $(sel).setAttribute('aria-pressed', on); });
        $('#play').textContent = S.playing ? 'Pausar el tiempo' : 'Seguir el tiempo';
    };
    const toggle = (key) => {
        S[key] = !S[key];
        if (key === 'sound') Q.sfx.enable(S.sound);
        if (key === 'tour' && S.tour) S.camTarget = null;
        syncButtons();
    };

    hourInput.addEventListener('input', () => { S.hour = parseFloat(hourInput.value) % 24; });
    $('#play').addEventListener('click', () => toggle('playing'));
    $('#fiestas').addEventListener('click', () => toggle('fiestas'));
    $('#tour').addEventListener('click', () => toggle('tour'));
    $('#sound').addEventListener('click', () => toggle('sound'));
    document.querySelectorAll('[data-weather]').forEach((b) => b.addEventListener('click', () => setWeather(b.dataset.weather)));
    card.querySelector('button').addEventListener('click', () => { card.hidden = true; });

    const places = $('#places');
    ['cotopaxi', 'panecillo', 'sanfrancisco', 'compania', 'plaza', 'carondelet', 'basilica', 'pichincha', 'teleferico', 'metro', 'estadio', 'mitad'].forEach((id) => {
        const b = document.createElement('button');
        b.type = 'button'; b.dataset.id = id;
        b.textContent = { cotopaxi: 'Cotopaxi', panecillo: 'El Panecillo', sanfrancisco: 'San Francisco', compania: 'La Compañía', plaza: 'Plaza Grande', carondelet: 'Carondelet', basilica: 'Basílica', pichincha: 'Pichincha', teleferico: 'TelefériQo', metro: 'Metro', estadio: 'Estadio', mitad: 'Mitad del Mundo' }[id];
        b.addEventListener('click', () => { S.camTarget = worldX(Q.marks.find((m) => m.id === id)); S.tour = false; syncButtons(); showCard(id); });
        places.appendChild(b);
    });

    const PERIODS = [[5, 'madrugada'], [6.5, 'amanecer'], [12, 'mañana'], [17.7, 'tarde'], [19.2, 'atardecer'], [24, 'noche']];
    const syncClock = () => {
        const h = Math.floor(S.hour), m = Math.floor((S.hour % 1) * 60);
        clock.querySelector('strong').textContent = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
        clock.querySelector('span').textContent = PERIODS.find(([until]) => S.hour < until)[1];
        if (document.activeElement !== hourInput) hourInput.value = S.hour;
    };

    // ───────────────────────── Arranque ─────────────────────────
    Q.api = {
        mode: 'side', render,
        marks: () => Q.marks,
        project: (m) => [markX(m) + m.w / 2, m.y - 5],
        focus(id, instant = false) {
            const m = Q.marks.find((m) => m.id === id);
            if (!m) return;
            S.tour = false; S.camV = 0;
            if (instant) { S.cam = worldX(m); S.camTarget = null; } else S.camTarget = worldX(m);
            card.hidden = true; syncButtons();
        },
        atmosphere(hour, weather = 'clear') { setHour(hour); setWeather(weather); S.playing = false; syncButtons(); syncClock(); },
        sync() { syncButtons(); syncClock(); setWeather(S.weather); },
    };
    syncButtons();
    const params = new URLSearchParams(location.hash.slice(1));
    if (params.has('shot')) {
        if (params.has('x')) S.cam = clamp(+params.get('x'), 0, Q.MAXCAM);
        if (params.has('h')) S.hour = +params.get('h');
        if (params.has('w')) S.weather = params.get('w');
        S.fiestas = params.get('f') === '1'; S.playing = false;
        if (params.has('mx')) Object.assign(S.mouse, { x: +params.get('mx'), y: +params.get('my'), inside: true, movedAt: 1e9 });
        for (let i = 0; i < (+params.get('t') || 3) * 30; i++) update(1 / 30);
        if (params.has('mx')) S.hover = pickAt(S.mouse.x, S.mouse.y);
        if (params.has('card')) showCard(params.get('card'));
        document.querySelectorAll('[data-weather]').forEach((b) => b.classList.toggle('on', b.dataset.weather === S.weather));
        syncButtons(); syncClock(); render();
        return;
    }

    let last = performance.now(), clockT = 0;
    const frame = (now) => {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        update(dt); render();
        if ((clockT += dt) > 0.2) { clockT = 0; syncClock(); }
        requestAnimationFrame(frame);
    };
    syncClock();
    requestAnimationFrame(frame);
})();
