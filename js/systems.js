/** @file Системы: частицы, звук, фон, juice, спавнер */

class ParticlePool {
    constructor() {
        this.pool = [];
        this.active = [];
    }

    emit(x, y, color, n, opts = {}) {
        for (let i = 0; i < n; i++) {
            let p = this.pool.pop();
            if (!p) p = {};
            p.x = x; p.y = y;
            p.vx = (Math.random() - 0.5) * (opts.speed || 6);
            p.vy = (Math.random() - 0.5) * (opts.speed || 6) - (opts.up || 2);
            p.life = 1;
            p.decay = opts.decay || 0.025;
            p.size = opts.size || rand(2, 5);
            p.color = color;
            p.shape = opts.shape || 'circle';
            this.active.push(p);
        }
    }

    update() {
        for (let i = this.active.length - 1; i >= 0; i--) {
            const p = this.active[i];
            p.vy += 0.12;
            p.x += p.vx;
            p.y += p.vy;
            p.life -= p.decay;
            if (p.life <= 0) {
                this.pool.push(p);
                this.active.splice(i, 1);
            }
        }
    }

    draw(ctx) {
        for (const p of this.active) {
            ctx.save();
            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;
            if (p.shape === 'square') ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
            else { ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill(); }
            ctx.restore();
        }
    }
}

class SoundEngine {
    constructor() { this.ctx = null; }
    init() {
        if (this.ctx) return;
        try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch {}
    }
    tone(freq, dur = 0.1, type = 'sine', vol = 0.12) {
        if (!this.ctx) return;
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.connect(g); g.connect(this.ctx.destination);
        o.type = type; o.frequency.value = freq;
        g.gain.setValueAtTime(vol, this.ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
        o.start(); o.stop(this.ctx.currentTime + dur);
    }
    jump() { this.tone(540, 0.1); }
    collect() { this.tone(880, 0.12, 'triangle', 0.08); }
    combo() { this.tone(1200, 0.15); }
    hit() { this.tone(140, 0.25, 'sawtooth', 0.1); }
    over() {
        this.tone(380, 0.25, 'square', 0.08);
        setTimeout(() => this.tone(260, 0.35, 'square', 0.08), 180);
    }
}

class JuiceSystem {
    constructor() {
        this.shake = 0;
        this.floatTexts = [];
    }

    addShake(mag) { this.shake = Math.max(this.shake, mag); }

    popText(x, y, text, color = '#fdcb6e', size = 22) {
        this.floatTexts.push({ x, y, text, color, size, life: 1, vy: -2 });
    }

    update() {
        this.shake *= 0.85;
        if (this.shake < 0.3) this.shake = 0;
        for (let i = this.floatTexts.length - 1; i >= 0; i--) {
            const t = this.floatTexts[i];
            t.y += t.vy;
            t.life -= 0.03;
            if (t.life <= 0) this.floatTexts.splice(i, 1);
        }
    }

    offset() {
        if (!this.shake) return { x: 0, y: 0 };
        return { x: (Math.random() - 0.5) * this.shake, y: (Math.random() - 0.5) * this.shake };
    }

    draw(ctx) {
        for (const t of this.floatTexts) {
            ctx.save();
            ctx.globalAlpha = t.life;
            ctx.font = `800 ${t.size}px Inter,sans-serif`;
            ctx.fillStyle = t.color;
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 3;
            ctx.textAlign = 'center';
            ctx.strokeText(t.text, t.x, t.y);
            ctx.fillText(t.text, t.x, t.y);
            ctx.restore();
        }
    }
}

class BackgroundRenderer {
    draw(ctx, w, h, camY, t) {
        const g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, CONFIG.palette.skyTop);
        g.addColorStop(0.45, CONFIG.palette.skyMid);
        g.addColorStop(1, CONFIG.palette.skyBot);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);

        // Parallax city silhouettes
        ctx.save();
        for (let layer = 0; layer < 3; layer++) {
            const parallax = 0.08 + layer * 0.06;
            const alpha = 0.06 + layer * 0.04;
            const baseY = h * 0.55 + layer * 30;
            ctx.fillStyle = layer === 0 ? '#1a1a3e' : layer === 1 ? '#12122a' : '#0d0d20';
            ctx.globalAlpha = alpha + 0.08;
            for (let i = 0; i < 12; i++) {
                const bw = 40 + (i * 17) % 60;
                const bh = 60 + (i * 23) % 120;
                const bx = (i * 97 - camY * parallax) % (w + 100) - 20;
                const by = baseY - bh + (i % 3) * 15;
                ctx.fillRect(bx, by, bw, bh);
                if (i % 2 === 0) {
                    ctx.fillStyle = 'rgba(255,220,100,0.15)';
                    for (let wn = 0; wn < 3; wn++) {
                        ctx.fillRect(bx + 8 + wn * 12, by + 15 + wn * 18, 6, 8);
                    }
                    ctx.fillStyle = layer === 0 ? '#1a1a3e' : layer === 1 ? '#12122a' : '#0d0d20';
                }
            }
        }
        ctx.restore();

        // Stars + web pattern
        ctx.save();
        ctx.globalAlpha = 0.5;
        for (let i = 0; i < 50; i++) {
            const sx = (i * 73.1) % w;
            const sy = (i * 51.7 + camY * 0.04) % h;
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(sx, sy, i % 4 === 0 ? 1.8 : 1, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 0.05;
        ctx.strokeStyle = CONFIG.palette.spiderRed;
        const wo = camY * 0.12;
        for (let i = 0; i < 6; i++) {
            const wx = (i * 140) % w;
            const wy = ((i * 90 - wo) % (h + 100)) - 30;
            ctx.beginPath();
            ctx.arc(wx, wy, 35, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.restore();
    }
}

class PlatformSpawner {
    gapFor(alt, baseGap) {
        return baseGap * (1.1 + alt * alt * 1.5);
    }

    altFactor(startY, y) {
        return clamp((startY - y) / 6000, 0, 1);
    }

    spawn(world, y, worldW, baseGap) {
        const alt = this.altFactor(world.startY, y);
        const minW = CONFIG.platformMinW + (1 - alt) * 15;
        const maxW = CONFIG.platformMaxW - alt * 45;
        const w = rand(Math.max(65, minW), Math.max(minW + 10, maxW));
        const x = rand(0, Math.max(0, worldW - w));
        const color = pick(CONFIG.palette.platforms);
        const p = new Platform(x, y, w, color, alt, worldW);
        world.platforms.push(p);
        if (Math.random() < CONFIG.collectibleRate * (1 - alt * 0.35)) {
            const c = new Collectible(x + w / 2 - 14, y - 48, pick(['star', 'pillow', 'toy']));
            p.collectibles.push(c);
            world.collectibles.push(c);
        }
    }

    seed(world, worldW, baseGap) {
        const start = new Platform(worldW / 2 - 90, world.startY, Math.min(180, worldW - 20), CONFIG.palette.platforms[0], 0, worldW);
        world.platforms.push(start);
        world.player.land(start);
        let y = world.startY;
        for (let i = 0; i < 10; i++) {
            y -= this.gapFor(this.altFactor(world.startY, y), baseGap);
            this.spawn(world, y, worldW, baseGap);
        }
    }

    fillAbove(world, worldW, baseGap, camY) {
        if (!world.platforms.length) return;
        let top = Math.min(...world.platforms.map(p => p.y));
        let guard = 0;
        while (top > camY - 400 && guard < 25) {
            top -= this.gapFor(this.altFactor(world.startY, top), baseGap);
            this.spawn(world, top, worldW, baseGap);
            guard++;
        }
    }
}

function removeWhiteBackground(img, threshold = 235) {
    return new Promise(resolve => {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth || img.width;
        c.height = img.naturalHeight || img.height;
        if (!c.width) { resolve(img); return; }
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const id = ctx.getImageData(0, 0, c.width, c.height);
        const d = id.data;
        for (let i = 0; i < d.length; i += 4) {
            const max = Math.max(d[i], d[i + 1], d[i + 2]);
            if (max > threshold && max - Math.min(d[i], d[i + 1], d[i + 2]) < 40) d[i + 3] = 0;
        }
        ctx.putImageData(id, 0, 0);
        const out = new Image();
        out.onload = () => resolve(out);
        out.onerror = () => resolve(img);
        out.src = c.toDataURL();
    });
}
