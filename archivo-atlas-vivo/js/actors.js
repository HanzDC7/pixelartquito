'use strict';

/*
 * Todo lo que se mueve: nubes, teleférico, cóndor, tráfico, gente, palomas,
 * metro, clima, cometas, fuegos artificiales y el colibrí que sigue al cursor.
 */
(() => {
    const { R, hash, pick, line, disc, clamp, lerp, W, H, GROUND: G } = Q;
    const S = Q.state;
    const A = (Q.actors = {});

    const sx = (x, f = 1) => Math.round(x - S.cam * f);
    const rnd = (a, b) => a + Math.random() * (b - a);
    const FW_COLORS = [['#FFD23F', '#FF8A3D'], ['#FF5470', '#FFB3C1'], ['#7CC4FF', '#FFFFFF'], ['#3DDC84', '#D9FFE9'], ['#C792EA', '#FFFFFF'], ['#F2C200', '#1F4FA3', '#D62828']];

    Q.initActors = () => {
        A.clouds = Array.from({ length: 12 }, (_, i) => ({ x: hash(i) * 660, y: 16 + hash(i + 0.3) * 80, v: 2 + hash(i + 0.6) * 4, seed: i * 9.1, back: i % 3 === 0 }));
        A.clouds.forEach((c) => { c.clear = Q.cloudSprite(c.seed); c.rain = Q.cloudSprite(c.seed, '#AAB8C2', '#637A8A'); });
        A.stars = Array.from({ length: 110 }, (_, i) => [hash(i + 11) * W, hash(i + 12) * 132, hash(i + 13)]);
        A.people = Array.from({ length: 36 }, (_, i) => ({
            x: hash(i + 100) * Q.WORLD, v: (4 + hash(i + 200) * 7) * (hash(i + 300) > 0.5 ? 1 : -1),
            shirt: pick(['#D62828', '#1F4FA3', '#F2C200', '#2FA36B', '#F4F1E8', '#8B5CF6', '#FF8A3D', '#3A3A40', '#C0392B'], i),
            pants: pick(['#2A2F40', '#3A2A1E', '#1F3A8A', '#4A4A52'], i + 1), skin: pick(['#D9A77A', '#B98058', '#E8BF98'], i + 2),
            hat: hash(i + 400) > 0.62, brolly: pick(['#D62828', '#1F4FA3', '#F2C200', '#2A2A2E', '#2FA36B'], i + 3),
        }));

        // Carril lejano hacia el norte, carril cercano hacia el sur.
        const kinds = ['trole', 'taxi', 'car', 'bus', 'taxi', 'car', 'trole', 'car', 'taxi', 'bus'];
        A.cars = kinds.map((kind, i) => ({
            kind, lane: i % 2, x: i * 160 + hash(i) * 40, v: i % 2 ? -32 : 28, seed: i,
            color: pick(['#D62828', '#F4F1E8', '#3A3A40', '#1F4FA3', '#8FA3B8', '#2FA36B'], i + 5),
        }));
        A.chiva = { kind: 'chiva', lane: 1, x: 1400, v: -20, seed: 99 };

        A.metro = { x: 150, dir: 1, wait: 2.5, last: -1 };
        A.pigeons = Array.from({ length: 16 }, (_, i) => {
            const hx = i < 9 ? 428 + hash(i + 31) * 70 : 150 + hash(i + 32) * 90;
            return { hx, x: hx, fly: 0, seed: i };
        });
        A.rockets = []; A.sparks = []; A.kites = []; A.puffs = []; A.splashes = [];
        A.drops = Array.from({ length: 170 }, () => ({ x: Math.random() * (W + 80), y: Math.random() * H, l: rnd(150, 186) }));
        A.fog = Array.from({ length: 6 }, (_, i) => ({ x: hash(i + 60) * W, y: 96 + i * 13, v: 4 + hash(i + 61) * 6, w: 150 + hash(i + 62) * 120 }));
        A.bolt = { t: 0, next: 4, pts: [] };
        A.rainbow = 0; A.rainF = 0; A.fogF = 0;
        A.condor = 0; A.puffT = 0; A.fiestaT = 0;
        A.plane = { x: -60, y: 30, wait: 9 };
        A.bird = { x: 200, y: 120, vx: 0, vy: 0 };
        A.cabins = [];
    };

    A.scatter = (cx) => A.pigeons.forEach((p) => { if (Math.abs(p.hx - cx) < 60 && p.fly <= 0) p.fly = 3 + Math.random(); });

    A.firework = (lx, ty) => A.rockets.push({ x: lx, y: G - 4, ty: clamp(ty, 14, 110), pal: FW_COLORS[Math.floor(Math.random() * FW_COLORS.length)] });
    A.kite = (lx, y) => { if (A.kites.length > 6) A.kites.shift(); A.kites.push({ x: lx, y, t: 0, c: pick(['#D62828', '#F2C200', '#2FA36B', '#8B5CF6', '#FF8A3D'], Math.random() * 99), seed: Math.random() * 99 }); };

    // ───────────────────────── Actualizar ─────────────────────────
    A.update = (dt) => {
        const t = S.time;
        A.rainF += clamp((S.weather === 'rain' ? 1 : 0) - A.rainF, -dt * 0.7, dt * 0.7);
        A.fogF += clamp((S.weather === 'fog' ? 1 : 0) - A.fogF, -dt * 0.5, dt * 0.5);
        if (A.rainbow > 0) A.rainbow -= dt;

        A.clouds.forEach((c) => { c.x += c.v * dt * (1 + A.rainF); if (c.x > 680) c.x = -70; });
        A.people.forEach((p) => { p.x += p.v * dt; if (p.x > Q.WORLD + 10) p.x = -10; if (p.x < -10) p.x = Q.WORLD + 10; });
        [...A.cars, A.chiva].forEach((c) => { c.x += c.v * dt; if (c.x > Q.WORLD + 60) c.x = -60; if (c.x < -60) c.x = Q.WORLD + 60; });

        // Metro: va y vuelve, y se detiene en cada estación.
        const m = A.metro;
        if (m.wait > 0) m.wait -= dt;
        else {
            m.x += m.dir * 46 * dt;
            const centre = m.x + 36, st = Q.stations.findIndex(([x]) => Math.abs(x - centre) < 1.2);
            if (st >= 0 && st !== m.last) { m.last = st; m.wait = 2.6; }
            if (st < 0 && Q.stations.every(([x]) => Math.abs(x - centre) > 8)) m.last = -1;
            if (m.x < 50) { m.dir = 1; } else if (m.x > 1240) { m.dir = -1; }
        }

        A.pigeons.forEach((p) => {
            if (p.fly > 0) { p.fly -= dt; return; }
            if (Math.random() < dt * 0.6) p.x = p.hx + rnd(-4, 4);
            if (A.people.some((q) => Math.abs(q.x - p.x) < 2) && Math.random() < 0.3) p.fly = 2.5 + Math.random();
        });

        // Fuegos artificiales.
        if (S.fiestas) { A.fiestaT -= dt; if (A.fiestaT <= 0) { A.fiestaT = rnd(0.35, 0.9); A.firework(S.cam * 0.7 + rnd(20, W - 20), rnd(20, 90)); } }
        A.rockets = A.rockets.filter((r) => {
            r.y -= 150 * dt;
            if (r.y > r.ty) return true;
            const n = 46 + Math.floor(Math.random() * 26);
            for (let i = 0; i < n; i++) {
                const a = (i / n) * Math.PI * 2, sp = i % 3 ? rnd(40, 62) : rnd(14, 34);
                A.sparks.push({ x: r.x, y: r.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rnd(0.8, 1.5), c: r.pal[i % r.pal.length] });
            }
            Q.sfx && Q.sfx.pop();
            return false;
        });
        A.sparks = A.sparks.filter((p) => { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 30 * dt; p.vx *= 0.975; p.vy *= 0.985; p.life -= dt; return p.life > 0; });

        A.kites = A.kites.filter((k) => { k.t += dt; return k.t < 26; });

        A.puffT -= dt;
        if (A.puffT <= 0) { A.puffT = 0.9; A.puffs.push({ x: Q.fumarole.x + rnd(-1, 1), y: Q.fumarole.y, life: 0 }); }
        A.puffs = A.puffs.filter((p) => { p.life += dt; p.y -= 3.2 * dt; p.x += 2.4 * dt; return p.life < 7; });

        // Lluvia y rayos.
        if (A.rainF > 0.02) {
            A.drops.forEach((d) => {
                d.y += 250 * dt; d.x -= 62 * dt;
                if (d.y > d.l) { if (Math.random() < 0.4) A.splashes.push({ x: d.x, y: d.l, life: 0.18 }); d.y = rnd(-40, 0); d.x = Math.random() * (W + 80); d.l = rnd(150, 186); }
            });
            A.splashes = A.splashes.filter((p) => (p.life -= dt) > 0);
            A.bolt.next -= dt;
            if (A.bolt.next <= 0 && S.weather === 'rain') {
                A.bolt.next = rnd(5, 13); A.bolt.t = 0.4;
                let x = rnd(40, W - 40), y = 0; A.bolt.pts = [[x, y]];
                while (y < 120) { x += rnd(-9, 9); y += rnd(8, 16); A.bolt.pts.push([x, y]); }
                Q.sfx && Q.sfx.thunder();
            }
        }
        if (A.bolt.t > 0) A.bolt.t -= dt;

        A.condor += dt * 0.22;
        const pl = A.plane;
        if (pl.wait > 0) { pl.wait -= dt; if (pl.wait <= 0) { pl.x = W + 30; pl.y = rnd(18, 48); } } else { pl.x -= 30 * dt; pl.y += 1.2 * dt; if (pl.x < -40) pl.wait = rnd(28, 55); }

        // El colibrí persigue al cursor; si nadie lo llama, vuelve a sus flores.
        const b = A.bird, called = S.mouse.inside && t - S.mouse.movedAt < 5;
        const tx = called ? S.mouse.x + 8 : clamp(sx(Q.garden.x), -20, W + 20) + Math.sin(t * 1.3) * 5;
        const ty = called ? S.mouse.y - 6 : Q.garden.y + Math.sin(t * 2.1) * 3;
        b.vx += ((tx - b.x) * 22 - b.vx * 7) * dt; b.vy += ((ty - b.y) * 22 - b.vy * 7) * dt;
        b.x += b.vx * dt; b.y += b.vy * dt;
    };

    // ───────────────────────── Cielo ─────────────────────────
    const SKY = [
        [0, '#050816', '#0C1230'], [4.8, '#070B22', '#1A1A44'], [5.8, '#243678', '#E8836A'], [6.8, '#4B8BD6', '#F7C9A0'],
        [9, '#3F8DE0', '#A9D4F5'], [13, '#2F7FDB', '#9CCBF2'], [16.6, '#3A86DC', '#BCD9F0'], [17.7, '#44509E', '#F7A85C'],
        [18.4, '#2B2A70', '#F0644E'], [19.2, '#111646', '#3C2B60'], [20.4, '#050816', '#0C1230'], [24, '#050816', '#0C1230'],
    ];
    A.skyColors = (h) => {
        let i = 0; while (i < SKY.length - 2 && h >= SKY[i + 1][0]) i++;
        const a = SKY[i], b = SKY[i + 1], t = clamp((h - a[0]) / (b[0] - a[0]));
        let top = Q.mix(a[1], b[1], t), bottom = Q.mix(a[2], b[2], t);
        const grey = Math.max(A.rainF * 0.75, A.fogF * 0.5), n = Q.night(h);
        if (grey > 0) { top = Q.mix(top, Q.mix('#5C6678', '#141824', n), grey); bottom = Q.mix(bottom, Q.mix('#8792A3', '#1D2233', n), grey); }
        return [top, bottom];
    };

    A.drawSky = (g) => {
        const h = S.hour, n = Q.night(h), t = S.time, [top, bottom] = A.skyColors(h);
        for (let y = 0; y < G; y += 2) R(g, 0, y, W, 2, Q.mix(top, bottom, Math.pow(y / G, 1.3)));

        const clear = 1 - Math.max(A.rainF, A.fogF * 0.7);
        if (n > 0.05 && clear > 0.05) {
            g.globalAlpha = n * clear;
            A.stars.forEach(([x, y, k], i) => { if (Math.sin(t * (1 + k * 2) + i) > -0.85) R(g, x, y, k > 0.93 ? 2 : 1, k > 0.93 ? 2 : 1, k > 0.6 ? '#FFFFFF' : '#9FB4E8'); });
            g.globalAlpha = 1;
        }

        // El sol cruza el cielo y se pone detrás del Pichincha.
        const sp = (h - 5.8) / 12.8;
        if (sp > 0 && sp < 1) {
            const x = lerp(36, W - 36, sp), y = 152 - Math.sin(sp * Math.PI) * 132, low = 1 - Math.sin(sp * Math.PI);
            g.globalAlpha = 0.22 * clear; disc(g, x, y, 12, Q.mix('#FFF3B0', '#FF7A3D', low)); g.globalAlpha = clear;
            disc(g, x, y, 7, Q.mix('#FFF6C8', '#FF9A3D', low)); g.globalAlpha = 1;
        }
        const mp = ((h + 24 - 18.6) % 24) / 11.2;
        if (mp > 0 && mp < 1) {
            const x = lerp(44, W - 44, mp), y = 142 - Math.sin(mp * Math.PI) * 112;
            g.globalAlpha = clear * n;
            disc(g, x, y, 6, '#F1F0E4'); R(g, x - 2, y - 2, 2, 2, '#CFCDBD'); R(g, x + 1, y + 1, 2, 1, '#CFCDBD'); R(g, x + 2, y - 3, 1, 1, '#CFCDBD');
            g.globalAlpha = 1;
        }

        if (A.rainbow > 0 && n < 0.5) {
            g.globalAlpha = clamp(A.rainbow / 4) * 0.5;
            ['#E0314F', '#FF8A3D', '#F2C200', '#3DDC84', '#3B82F6', '#8B5CF6'].forEach((c, i) => {
                const r = 150 - i * 2;
                for (let a = Math.PI; a < Math.PI * 2; a += 0.004) R(g, 200 + Math.cos(a) * r, 190 + Math.sin(a) * r, 1, 2, c);
            });
            g.globalAlpha = 1;
        }

        const pl = A.plane;
        if (pl.wait <= 0) {
            R(g, pl.x, pl.y, 9, 2, '#E8ECF2'); R(g, pl.x + 3, pl.y - 2, 3, 2, '#C9CED8'); R(g, pl.x + 8, pl.y - 2, 1, 2, '#D62828'); R(g, pl.x - 1, pl.y + 1, 1, 1, '#E8ECF2');
            if (n > 0.3 && Math.floor(t * 3) % 2) R(g, pl.x + 4, pl.y + 2, 1, 1, '#FF3B3B');
        }
    };

    // ───────────────────────── Detrás de la ciudad ─────────────────────────
    A.drawPuffs = (g) => A.puffs.forEach((p) => {
        const r = 1 + Math.floor(p.life * 0.7);
        g.globalAlpha = clamp(1 - p.life / 7) * 0.8;
        disc(g, sx(p.x, 0.15), p.y, r, '#E8ECF4');
        g.globalAlpha = 1;
    });

    A.drawClouds = (g, back) => A.clouds.forEach((c) => {
        if (c.back !== back) return;
        const x = sx(c.x, 0.2), heavy = A.rainF;
        if (x < -80 || x > W + 20) return;
        const y = Math.round(c.y - 11);
        g.globalAlpha = back ? 0.78 : 0.95; g.drawImage(c.clear, x, y);
        if (heavy > 0.01) { g.globalAlpha *= heavy; g.drawImage(c.rain, x, y); }
        g.globalAlpha = 1;
    });

    A.drawCable = (g) => {
        const { x1, y1, x2, y2 } = Q.cable, t = S.time;
        line(g, sx(x1, 0.3), y1, sx(x2, 0.3), y2, '#AEB6C4');
        A.cabins = [];
        for (let i = 0; i < 5; i++) {
            const u0 = (t * 0.03 + i / 5) % 1, u = i % 2 ? u0 : 1 - u0;
            const x = sx(lerp(x1, x2, u), 0.3), y = Math.round(lerp(y1, y2, u));
            R(g, x, y, 1, 2, '#4A4A52'); R(g, x - 2, y + 2, 4, 4, '#F4F1E8'); R(g, x - 2, y + 4, 4, 1, '#D62828'); R(g, x - 1, y + 3, 2, 1, '#7FB3E0');
            A.cabins.push([x - 1, y + 3]);
        }
        Q.antennas.forEach(([ax, ay]) => { if (Math.floor(t * 1.5) % 2) R(g, sx(ax, 0.3), ay, 1, 1, '#FF3B3B'); });
    };

    A.drawCondor = (g) => {
        const a = A.condor, x = sx(300 + Math.cos(a) * 140, 0.3), y = Math.round(48 + Math.sin(a * 2) * 12), up = Math.sin(S.time * 2.4) > 0.3 ? 1 : 0;
        R(g, x - 1, y, 3, 1, '#16161A'); R(g, x, y - 1, 1, 1, '#FFFFFF');
        R(g, x - 6, y - up, 5, 1, '#16161A'); R(g, x + 2, y - up, 5, 1, '#16161A');
        R(g, x - 8, y - up * 2, 2, 1, '#16161A'); R(g, x + 7, y - up * 2, 2, 1, '#16161A');
    };

    A.drawKites = (g) => A.kites.forEach((k) => {
        const fade = clamp((26 - k.t) / 3), x = sx(k.x, 0.55) + Math.sin(k.t * 1.1 + k.seed) * 8, y = k.y + Math.sin(k.t * 1.7 + k.seed) * 4 - Math.min(k.t, 3) * 4;
        g.globalAlpha = fade;
        line(g, x, y + 3, x + 14, G - 2, '#E8E4DA');
        R(g, x, y - 3, 1, 7, k.c); R(g, x - 2, y - 1, 5, 3, k.c); R(g, x - 1, y - 2, 3, 5, k.c); R(g, x, y - 1, 1, 3, '#FFFFFF');
        for (let i = 1; i < 6; i++) R(g, x + Math.round(Math.sin(k.t * 5 + i) * 1.5), y + 3 + i * 2, 1, 1, i % 2 ? '#F2C200' : '#FFFFFF');
        g.globalAlpha = 1;
    });

    // ───────────────────────── En la calle ─────────────────────────
    const drawCar = (g, c, heads) => {
        const y = G + (c.lane ? 15 : 8), d = Math.sign(c.v), x = sx(c.x), t = S.time;
        if (x < -50 || x > W + 50) return;
        const wheel = (wx) => R(g, wx, y - 2, 3, 2, '#17171B');
        let len = 12;

        if (c.kind === 'taxi' || c.kind === 'car') {
            const col = c.kind === 'taxi' ? '#F2C200' : c.color;
            R(g, x, y - 6, 12, 4, col); R(g, x + 2, y - 9, 7, 3, col); R(g, x + 3, y - 8, 5, 2, '#9DD1E8'); R(g, x + 5, y - 8, 1, 2, col);
            R(g, x, y - 3, 12, 1, Q.mix(col, '#000000', 0.25));
            if (c.kind === 'taxi') R(g, x + 4, y - 10, 3, 1, '#17171B');
            wheel(x + 1); wheel(x + 8);
        } else if (c.kind === 'bus') {
            len = 24;
            R(g, x, y - 10, 24, 8, '#2A6FD6'); R(g, x, y - 5, 24, 1, '#FFFFFF'); R(g, x, y - 10, 24, 1, '#5C97EA');
            for (let i = 0; i < 5; i++) R(g, x + 2 + i * 4, y - 9, 3, 3, '#BFE3F0');
            wheel(x + 3); wheel(x + 18);
        } else if (c.kind === 'trole') {
            len = 38;
            [x, x + 20].forEach((bx) => {
                R(g, bx, y - 11, 18, 9, '#2FA36B'); R(g, bx, y - 11, 18, 1, '#E8ECF2'); R(g, bx, y - 5, 18, 1, '#F2C200');
                for (let i = 0; i < 4; i++) R(g, bx + 1 + i * 4, y - 10, 3, 4, '#BFE3F0');
            });
            R(g, x + 18, y - 9, 2, 6, '#1F2A3A');
            [3, 13, 23, 33].forEach((dx) => wheel(x + dx));
            const px = d > 0 ? x + 8 : x + 30;
            line(g, px, y - 11, px - d * 9, y - 17, '#6E717C'); line(g, px + d * 2, y - 11, px - d * 7, y - 17, '#6E717C');
        } else {   // chiva
            len = 30;
            R(g, x, y - 5, 30, 3, '#F2C200'); R(g, x, y - 4, 30, 1, '#1F4FA3'); R(g, x, y - 3, 30, 1, '#D62828');
            R(g, x, y - 13, 30, 2, '#D62828');
            for (let i = 0; i < 6; i++) { R(g, x + i * 6, y - 11, 1, 6, '#6B4226'); R(g, x + 2 + i * 5, y - 8, 2, 3, pick(['#F4F1E8', '#1F4FA3', '#2FA36B', '#F06292'], i)); R(g, x + 2 + i * 5, y - 10, 2, 2, '#D9A77A'); }
            for (let i = 0; i < 10; i++) R(g, x + 1 + i * 3, y - 14, 1, 1, (Math.floor(t * 6) + i) % 3 === 0 ? '#FFFFFF' : pick(['#F2C200', '#3DDC84', '#FF5470'], i));
            wheel(x + 4); wheel(x + 23);
        }
        heads.push([d > 0 ? x + len : x - 1, y - 4, d]);
        c.box = [x, y - 14, len, 14];
    };

    const drawPerson = (g, p) => {
        const x = sx(p.x), y = G + 2;
        if (x < -6 || x > W + 6) return;
        const step = Math.floor(S.time * 6 + p.x * 0.3) % 2;
        R(g, x, y, 4, 1, '#68665B');
        R(g, x, y - 5, 2, 3, p.shirt); R(g, x, y - 7, 2, 2, p.skin);
        if (p.hat) { R(g, x - 1, y - 8, 4, 1, '#3A2A1E'); R(g, x, y - 9, 2, 1, '#3A2A1E'); }
        R(g, x, y - 2, 1, step ? 2 : 1, p.pants); R(g, x + 1, y - 2, 1, step ? 1 : 2, p.pants);
        if (A.rainF > 0.4) { R(g, x - 2, y - 11, 6, 1, p.brolly); R(g, x - 1, y - 12, 4, 1, p.brolly); R(g, x + 1, y - 10, 1, 3, '#2A2A2E'); }
    };

    A.drawStreet = (g) => {
        const t = S.time;
        A.heads = [];
        // Sombras cortas al mediodía y alargadas al amanecer / atardecer.
        const sunlight = (1 - Q.night(S.hour)) * (1 - Math.max(A.rainF, A.fogF));
        const stretch = Math.round(Math.cos((S.hour - 6) / 12 * Math.PI) * 9);
        g.globalAlpha = sunlight * 0.2;
        Q.lamps.forEach(([x]) => line(g, sx(x), G + 2, sx(x) + stretch, G + 6, '#263E42'));
        A.cars.forEach((c) => R(g, sx(c.x) + 2, G + (c.lane ? 14 : 7), c.kind === 'trole' ? 37 : c.kind === 'bus' ? 23 : 12, 2, '#202F37'));
        g.globalAlpha = 1;
        Q.signals.forEach((x, i) => {
            const phase = (t + i * 3) % 14;
            R(g, sx(x) - 1, G - (phase < 6 ? 17 : phase < 8 ? 19 : 21), 1, 1, phase < 6 ? '#A2D595' : phase < 8 ? '#F9C56B' : '#ED7963');
        });

        // La pila de la Plaza Grande.
        const f = Q.fountain;
        for (let i = 0; i < 9; i++) {
            const p = (t * 1.4 + i / 9) % 1;
            R(g, sx(f.x) + Math.round((i % 2 ? 1 : -1) * p * 4), f.y - Math.round(Math.sin(p * Math.PI) * 5) + Math.round(p * 4), 1, 1, i % 3 ? '#BFE3F0' : '#FFFFFF');
        }

        // La bandera del Ecuador en Carondelet.
        for (let i = 0; i < 11; i++) {
            const o = Math.round(Math.sin(t * 5 - i * 0.7) * 1.3 * (i / 10)), x = sx(Q.flag.x) + i, y = Q.flag.y + o;
            R(g, x, y, 1, 4, '#F2C200'); R(g, x, y + 4, 1, 2, '#1F4FA3'); R(g, x, y + 6, 1, 2, '#D62828');
        }

        // Los relojes de la Basílica marcan la hora de la escena.
        Q.clocks.forEach(([cx, cy]) => {
            const m = (S.hour % 1) * Math.PI * 2, hh = ((S.hour % 12) / 12) * Math.PI * 2, x = sx(cx);
            line(g, x, cy, x + Math.round(Math.sin(m) * 2.6), cy - Math.round(Math.cos(m) * 2.6), '#3A3A40');
            line(g, x, cy, x + Math.round(Math.sin(hh) * 1.6), cy - Math.round(Math.cos(hh) * 1.6), '#16161A');
        });

        // La pantalla del centro comercial.
        const b = Q.billboard, bx = sx(b.x), mode = Math.floor(t / 4) % 3;
        g.save(); g.beginPath(); g.rect(bx, b.y, b.w, b.h); g.clip();
        if (mode === 0) { R(g, bx, b.y, b.w, b.h, '#1F4FA3'); Q.text(g, 'QUITO', bx + b.w - ((t * 14) % (b.w + 24)), b.y + 2, '#FFFFFF'); }
        else if (mode === 1) { for (let i = 0; i < 6; i++) R(g, bx + i * 4, b.y, 4, b.h, pick(['#D62828', '#F2C200', '#2FA36B', '#1F4FA3', '#8B5CF6', '#FF8A3D'], i + Math.floor(t * 3))); }
        else { R(g, bx, b.y, b.w, b.h, '#D62828'); Q.text(g, '2850 M', bx + 1, b.y + 2, '#FFE500'); }
        g.restore();

        A.pigeons.forEach((p) => {
            const x = sx(p.x);
            if (p.fly > 0) {
                const k = Math.sin(clamp(p.fly / 3) * Math.PI), fx = x + Math.round(Math.sin(p.fly * 2 + p.seed) * 14 * k), fy = G - 1 - Math.round(k * (26 + (p.seed % 5) * 3));
                R(g, fx, fy, 2, 1, '#9AA0AC'); R(g, fx - 1, fy - (Math.floor(S.time * 10 + p.seed) % 2), 4, 1, '#C9CED8');
            } else { R(g, x, G + 1, 2, 1, '#8A8F9C'); R(g, x + (p.seed % 2 ? 2 : -1), G, 1, 1, '#6E717C'); }
        });

        A.people.forEach((p) => drawPerson(g, p));
        const all = S.fiestas ? [...A.cars, A.chiva] : A.cars;
        all.filter((c) => !c.lane).forEach((c) => drawCar(g, c, A.heads));
        all.filter((c) => c.lane).forEach((c) => drawCar(g, c, A.heads));
    };

    A.drawMetro = (g) => {
        const m = A.metro, x = sx(m.x), y = 209;
        if (x < -80 || x > W + 10) return;
        for (let i = 0; i < 3; i++) {
            const cx = x + i * 24;
            R(g, cx, y - 11, 23, 10, '#E9ECF2'); R(g, cx, y - 11, 23, 1, '#FFFFFF'); R(g, cx, y - 4, 23, 1, '#D62828'); R(g, cx, y - 3, 23, 1, '#1F4FA3');
            for (let j = 0; j < 4; j++) R(g, cx + 2 + j * 5, y - 9, 4, 4, '#FFE9A8');
            R(g, cx + 3, y - 1, 3, 1, '#17171B'); R(g, cx + 17, y - 1, 3, 1, '#17171B');
        }
        R(g, m.dir > 0 ? x + 71 : x - 1, y - 6, 1, 2, '#FFF6C8');
    };

    // ───────────────────────── Luces de la noche ─────────────────────────
    const glow = (g, x, y, c = '#FFE9A8') => {
        g.globalAlpha *= 0.28; R(g, x - 3, y - 3, 7, 7, c); g.globalAlpha /= 0.28;
        g.globalAlpha *= 0.5; R(g, x - 1, y - 2, 3, 5, c); R(g, x - 2, y - 1, 5, 3, c); g.globalAlpha /= 0.5;
        R(g, x, y, 1, 1, '#FFFFFF');
    };

    A.drawGlows = (g, n) => {
        g.globalAlpha = n;
        Q.lamps.forEach(([x]) => {
            g.globalAlpha = n * 0.13;
            R(g, sx(x) - 5, G, 11, 2, '#F9D28A'); R(g, sx(x) - 8, G + 2, 17, 2, '#F9D28A');
        });
        g.globalAlpha = n;
        Q.lamps.forEach(([x, y]) => { const s = sx(x); if (s > -6 && s < W + 6) glow(g, s, y); });
        Q.floods.forEach(([x, y]) => { const s = sx(x); if (s > -6 && s < W + 6) { glow(g, s, y, '#FFFFFF'); glow(g, s - 2, y, '#FFFFFF'); glow(g, s + 2, y, '#FFFFFF'); } });
        A.cabins.forEach(([x, y]) => R(g, x, y, 2, 1, '#FFE9A8'));
        (A.heads || []).forEach(([x, y, d]) => {
            g.globalAlpha = n * 0.3; for (let i = 0; i < 9; i++) R(g, x + d * i - (d < 0 ? 1 : 0), y - Math.floor(i / 4), 1, 1 + Math.floor(i / 2), '#FFF3B0');
            g.globalAlpha = n; R(g, x - (d < 0 ? 0 : 1), y, 1, 2, '#FFFFFF');
        });
        g.globalAlpha = 1;
    };

    // ───────────────────────── Clima y fiesta ─────────────────────────
    A.drawWetRoad = (g) => {
        if (A.rainF < 0.02) return;
        const n = Q.night(S.hour);
        // Reflejo de las fachadas; franjas cortas evitan un espejo perfecto.
        for (let i = 0; i < 34; i++) {
            const wx = Math.floor(S.cam / 15) * 15 + i * 15;
            const x = sx(wx), y = G + 4 + Math.floor(hash(wx) * 10), w = 6 + Math.floor(hash(wx + 1) * 8);
            if (x < 0 || x + w > W) continue;
            g.globalAlpha = A.rainF * 0.2;
            R(g, x, y, w, 2, n > 0.5 ? '#374957' : '#98B7C0');
            g.globalAlpha = A.rainF * 0.3;
            g.drawImage(Q.scene.cv, x, G - 15, w, 12, x, y, w, 2);
            if (n > 0.1) {
                g.globalAlpha = A.rainF * n * 0.4;
                g.drawImage(Q.glowLayer.cv, x, G - 65, w, 60, x, y, w, 3);
            }
            if (i % 2 === 0) R(g, x + 1, y, w - 3, 1, n > 0.5 ? '#7F969C' : '#B8C9CB');
        }
        Q.lamps.forEach(([wx]) => {
            const x = sx(wx);
            for (let y = 0; y < 5; y++) {
                g.globalAlpha = A.rainF * n * (0.48 - y * 0.07);
                R(g, x - 2 + Math.round(Math.sin(S.time * 3 + y)), G + 4 + y * 2, 4 + y, 1, '#E8BD7A');
            }
        });
        g.globalAlpha = 1;
    };

    A.drawWeather = (g) => {
        if (A.fogF > 0.02) {
            A.fog.forEach((f, i) => {
                const x = ((f.x + S.time * f.v - S.cam * 0.4) % (W + f.w) + (W + f.w)) % (W + f.w) - f.w;
                g.globalAlpha = A.fogF * (0.2 + (i % 3) * 0.08);
                R(g, x, f.y, f.w, 9, '#E6ECF4'); R(g, x + 12, f.y - 3, f.w - 30, 4, '#E6ECF4'); R(g, x + 20, f.y + 8, f.w - 44, 4, '#E6ECF4');
            });
            g.globalAlpha = A.fogF * 0.22; R(g, 0, 60, W, G - 60 + 17, '#DCE4EE'); g.globalAlpha = 1;
        }
        if (A.rainF > 0.02) {
            g.globalAlpha = A.rainF * 0.7;
            A.drops.forEach((d) => { R(g, d.x, d.y, 1, 3, '#BFD3EE'); R(g, d.x + 1, d.y - 3, 1, 2, '#BFD3EE'); });
            A.splashes.forEach((p) => { R(g, p.x - 1, p.y, 3, 1, '#DCE8F7'); });
            g.globalAlpha = 1;
        }
        if (A.bolt.t > 0) {
            const k = A.bolt.t / 0.4;
            g.globalAlpha = k * 0.45; R(g, 0, 0, W, H, '#EAF2FF'); g.globalAlpha = Math.min(1, k * 1.6);
            A.bolt.pts.slice(1).forEach((p, i) => line(g, A.bolt.pts[i][0], A.bolt.pts[i][1], p[0], p[1], '#FFFFFF'));
            g.globalAlpha = 1;
        }
    };

    A.drawFireworks = (g) => {
        A.rockets.forEach((r) => { const x = sx(r.x, 0.7); R(g, x, r.y, 1, 3, '#FFE9A8'); R(g, x, r.y + 3, 1, 2, '#FF8A3D'); });
        A.sparks.forEach((p) => { const s = p.life > 0.45 ? 2 : 1; g.globalAlpha = clamp(p.life * 1.6); R(g, sx(p.x, 0.7), p.y, s, s, p.c); });
        g.globalAlpha = 1;
        if (S.fiestas) Q.label(g, 'QUE VIVA QUITO!', W / 2, 30 + Math.round(Math.sin(S.time * 3) * 2), pick(['#FFE500', '#FFFFFF', '#FF8A3D'], Math.floor(S.time * 3)), '#1F4FA3');
    };

    A.drawBird = (g) => {
        const b = A.bird, x = Math.round(b.x), y = Math.round(b.y), d = b.vx < -2 ? -1 : 1, flap = Math.floor(S.time * 30) % 2;
        R(g, x - 1, y, 4, 2, '#1FA37A'); R(g, x + (d > 0 ? 2 : -1), y - 1, 2, 2, '#18876A');
        R(g, x + (d > 0 ? 2 : -1), y + 1, 2, 1, '#7C4DFF');
        R(g, x + (d > 0 ? 4 : -4), y - 1, 3, 1, '#2A2A2E');
        R(g, x + (d > 0 ? -3 : 3), y + 1, 2, 1, '#0F6E55');
        g.globalAlpha = 0.75; R(g, x, flap ? y - 3 : y + 2, 2, 2, '#D9FFF2'); R(g, x - 1, flap ? y - 2 : y + 1, 1, 1, '#D9FFF2'); g.globalAlpha = 1;
    };
})();
