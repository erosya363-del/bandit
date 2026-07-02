/** @file Ядро игры — state machine, fixed timestep (game-development / game-engine) */

class BanditGame {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.container = document.querySelector('.game-container');
        this.state = 'menu';
        this.accumulator = 0;
        this.lastTime = performance.now();
        this.time = 0;

        this.isMobile = 'ontouchstart' in window || /Android|iPhone|iPad/i.test(navigator.userAgent);
        this.phys = this.buildPhys();
        this.input = new InputManager(this.canvas, this.container);
        this.particles = new ParticlePool();
        this.sound = new SoundEngine();
        this.juice = new JuiceSystem();
        this.bg = new BackgroundRenderer();
        this.spawner = new PlatformSpawner();

        this.playerName = '';
        this.difficulty = 'medium';
        this.activeDiff = CONFIG.difficulty.medium;
        this.bestScore = Leaderboard.best();

        this.world = null;
        this.bindUI();
        this.resize();
        this.renderLeaderboard('leaderboardList');
        window.addEventListener('resize', () => this.resize());
        requestAnimationFrame(t => this.loop(t));
    }

    buildPhys() {
        const m = this.isMobile ? CONFIG.mobile : {};
        return {
            walkSpeed: m.walkSpeed ?? CONFIG.walkSpeed,
            moveSpeed: m.moveSpeed ?? CONFIG.moveSpeed,
            jumpForce: m.jumpForce ?? CONFIG.jumpForce,
            airControl: m.airControl ?? CONFIG.airControl,
            touchAirPush: CONFIG.touchAirPush
        };
    }

    resize() {
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = this.canvas.offsetWidth * dpr;
        this.canvas.height = this.canvas.offsetHeight * dpr;
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.w = this.canvas.offsetWidth;
        this.h = this.canvas.offsetHeight;
    }

    newWorld() {
        return {
            player: new Player(this.w / 2 - 16, this.h - 160),
            platforms: [],
            collectibles: [],
            camY: 0,
            targetCamY: 0,
            startY: this.h - 100,
            score: 0,
            combo: 1,
            comboT: 0,
            lives: 3,
            highestY: this.h - 160,
            ramp: 1
        };
    }

    initWorld() {
        this.world = this.newWorld();
        this.spawner.seed(this.world, this.w, this.activeDiff.gap);
    }

    bindUI() {
        this.bindTap('startBtn', () => this.startGame());
        this.bindTap('restartBtn', () => this.restart());
        document.querySelectorAll('.difficulty-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.difficulty-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.difficulty = btn.dataset.diff;
            });
        });
        document.getElementById('showLeaderboardBtn')?.addEventListener('click', () => {
            const lb = document.getElementById('leaderboard');
            lb.style.display = lb.style.display === 'none' ? 'block' : 'none';
            this.renderLeaderboard('leaderboardList');
        });
        this.setupAvatar();
    }

    bindTap(id, fn) {
        const btn = document.getElementById(id);
        if (!btn) return;
        let touched = false;
        btn.addEventListener('touchend', e => { e.preventDefault(); touched = true; fn(); setTimeout(() => touched = false, 400); }, { passive: false });
        btn.addEventListener('click', e => { if (!touched) fn(); });
    }

    setupAvatar() {
        const preview = document.getElementById('avatarPreview');
        const input = document.getElementById('avatarInput');
        const clear = document.getElementById('clearAvatar');
        preview?.addEventListener('click', () => input?.click());
        input?.addEventListener('change', async e => {
            const file = e.target.files?.[0];
            if (!file) return;
            document.getElementById('avatarLoader')?.classList.add('active');
            const img = new Image();
            img.onload = async () => {
                playerAvatarImage = await removeWhiteBackground(img);
                preview.innerHTML = '';
                const pi = document.createElement('img');
                pi.src = playerAvatarImage.src;
                preview.appendChild(pi);
                preview.classList.add('has-image');
                if (clear) clear.style.display = 'inline-block';
                document.getElementById('avatarLoader')?.classList.remove('active');
            };
            img.src = URL.createObjectURL(file);
        });
        clear?.addEventListener('click', e => {
            e.stopPropagation();
            playerAvatarImage = null;
            preview.innerHTML = '<div class="avatar-placeholder">📷</div><div class="avatar-loader" id="avatarLoader"><div class="loader-spinner"></div><span>Обработка...</span></div>';
            preview.classList.remove('has-image');
            input.value = '';
            clear.style.display = 'none';
        });
    }

    validateName(name) {
        return /^[a-zA-Zа-яА-ЯёЁіІїЇєЄ0-9]{2,20}$/u.test(name.replace(/[\u200B-\u200D\uFEFF]/g, '').trim());
    }

    startGame() {
        const inp = document.getElementById('playerName');
        const err = document.getElementById('nameError');
        this.playerName = inp.value.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
        if (!this.validateName(this.playerName)) {
            err.style.display = 'block';
            inp.classList.add('error');
            inp.focus();
            if (navigator.vibrate) navigator.vibrate(60);
            return;
        }
        err.style.display = 'none';
        inp.classList.remove('error');
        inp.blur();

        this.activeDiff = CONFIG.difficulty[this.difficulty] || CONFIG.difficulty.medium;
        this.phys = this.buildPhys();
        this.resize();
        this.initWorld();
        this.sound.init();
        this.state = 'playing';
        this.accumulator = 0;

        document.getElementById('startScreen').classList.add('hidden');
        document.getElementById('gameOverScreen').classList.add('hidden');
        document.getElementById('leaderboard').style.display = 'none';
        this.setMobileControls(true);
        this.updateHUD();
    }

    restart() {
        this.phys = this.buildPhys();
        this.resize();
        this.initWorld();
        this.state = 'playing';
        document.getElementById('gameOverScreen').classList.add('hidden');
        this.setMobileControls(true);
        this.updateHUD();
    }

    setMobileControls(on) {
        const c = document.getElementById('mobileControls');
        if (!c) return;
        const show = on && this.isMobile;
        c.style.display = show ? 'flex' : 'none';
        c.classList.toggle('visible', show);
    }

    gameOver() {
        this.state = 'gameover';
        this.sound.over();
        const w = this.world;
        if (w.score > this.bestScore) {
            this.bestScore = w.score;
            Leaderboard.saveBest(w.score);
        }
        if (w.score > 0) Leaderboard.add(this.playerName, w.score);
        const rank = Leaderboard.rank(this.playerName, w.score);

        document.getElementById('finalScore').textContent = w.score;
        document.getElementById('bestScore').textContent = this.bestScore;
        document.getElementById('gameOverPlayerName').textContent = this.playerName;
        const rd = document.getElementById('rankDisplay');
        if (w.score <= 0) rd.textContent = 'Попробуйте ещё раз!';
        else if (rank === 1) rd.textContent = '🥇 Первое место!';
        else if (rank === 2) rd.textContent = '🥈 Второе место!';
        else if (rank === 3) rd.textContent = '🥉 Третье место!';
        else if (rank <= 10) rd.textContent = `#${rank} место в топ‑10`;
        else rd.textContent = `#${rank} в рейтинге`;

        this.renderLeaderboard('gameOverLeaderboardList', true);
        document.getElementById('gameOverScreen').classList.remove('hidden');
        this.setMobileControls(false);
    }

    renderLeaderboard(id, highlight = false) {
        const el = document.getElementById(id);
        if (!el) return;
        const lb = Leaderboard.load();
        if (!lb.length) {
            el.innerHTML = '<div class="leaderboard-item" style="color:var(--text-dim)">Пока нет записей</div>';
            return;
        }
        el.innerHTML = lb.map((e, i) => {
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`;
            const cur = highlight && e.name === this.playerName && e.score === this.world?.score;
            return `<div class="leaderboard-item${cur ? ' current' : ''}"><span><span class="rank">${medal}</span><span class="name">${escapeHtml(e.name)}</span></span><span class="score">${e.score}</span></div>`;
        }).join('');
    }

    fixedUpdate() {
        const w = this.world;
        const p = w.player;

        if (this.input.consumeJump()) {
            if (p.tryJump(this.phys.jumpForce)) {
                this.sound.jump();
                this.particles.emit(p.x + p.w / 2, p.y - w.camY + p.h, CONFIG.palette.spiderRed, 8, { up: 3, speed: 5 });
            }
        }

        for (const pl of w.platforms) if (!pl.broken) pl.update(this.w);

        if (p.grounded && p.platform?.broken) {
            p.leave();
            this.sound.hit();
            this.juice.addShake(6);
        }

        if (p.grounded && p.platform && !p.platform.broken) {
            const pl = p.platform;
            p.x += pl.deltaX;
            p.y = pl.y - p.h;
            const b = p.box();
            const on = b.x + b.width > pl.x + 4 && b.x < pl.x + pl.width - 4 && Math.abs(b.y + b.height - pl.y) < 14;
            if (!on) p.leave();
        }

        p.update(this.input, this.phys, this.w);

        if (!p.grounded && p.vel.y > 0) {
            for (const pl of w.platforms) {
                if (pl.broken) continue;
                const b = p.box();
                if (b.x < pl.x + pl.width && b.x + b.width > pl.x &&
                    b.y + b.height >= pl.y && b.y + b.height <= pl.y + pl.height + 12) {
                    p.land(pl);
                    this.juice.addShake(2);
                    break;
                }
            }
        }

        for (const c of w.collectibles) {
            if (c.collected) continue;
            if (aabbOverlap(p.box(), c.box())) {
                c.collected = true;
                const pts = { star: 50, pillow: 25, toy: 100 }[c.type];
                w.score += pts * w.combo;
                w.combo = Math.min(w.combo + 1, 10);
                w.comboT = 180;
                this.sound.collect();
                if (w.combo > 2) { this.sound.combo(); this.juice.popText(c.x, c.y - w.camY, `x${w.combo}!`, CONFIG.palette.gold, 20 + w.combo * 2); }
                this.particles.emit(c.x + 14, c.y - w.camY + 14, CONFIG.palette.gold, 14, { up: 4 });
            }
        }

        if (p.y < w.highestY) {
            w.score += Math.floor((w.highestY - p.y) * 0.1) * w.combo;
            w.highestY = p.y;
        }

        if (w.comboT > 0) w.comboT--;
        else if (w.combo > 1) w.combo = 1;

        w.ramp += this.activeDiff.ramp;
        this.spawner.fillAbove(w, this.w, this.activeDiff.gap, w.camY);

        const psy = p.y - w.camY;
        if (psy < this.h * 0.38) w.targetCamY = p.y - this.h * 0.38;
        w.camY += (w.targetCamY - w.camY) * CONFIG.cameraSmooth;

        w.platforms = w.platforms.filter(pl => pl.y - w.camY < this.h + 200);
        w.collectibles = w.collectibles.filter(c => !c.collected && c.y - w.camY < this.h + 200);

        if (p.y - w.camY > this.h + 90) {
            w.lives--;
            this.sound.hit();
            this.juice.addShake(10);
            this.particles.emit(p.x + p.w / 2, this.h - 20, '#e17055', 20, { speed: 7 });
            if (w.lives <= 0) this.gameOver();
            else {
                const safe = w.platforms.filter(pl => !pl.broken && pl.y > w.camY && pl.y < w.camY + this.h).sort((a, b) => b.y - a.y)[0];
                if (safe) { p.x = safe.x + safe.width / 2 - p.w / 2; p.land(safe); p.vel.x = 0; p.invuln = 90; }
                else { p.leave(); p.y = w.camY + this.h * 0.45; p.vel.y = 0; p.invuln = 90; }
            }
        }

        this.particles.update();
        this.juice.update();
        this.updateHUD();
    }

    render() {
        const ctx = this.ctx;
        const shake = this.juice.offset();
        ctx.save();
        ctx.translate(shake.x, shake.y);

        if (this.state === 'playing' && this.world) {
            const w = this.world;
            this.bg.draw(ctx, this.w, this.h, w.camY, this.time);
            for (const pl of w.platforms) if (!pl.broken) pl.draw(ctx, w.camY, this.time);
            for (const c of w.collectibles) c.draw(ctx, w.camY, this.time);
            this.particles.draw(ctx);
            w.player.draw(ctx, w.camY, this.time);
            this.juice.draw(ctx);
        } else {
            this.bg.draw(ctx, this.w, this.h, 0, this.time);
        }
        ctx.restore();
    }

    updateHUD() {
        if (!this.world) return;
        const w = this.world;
        document.getElementById('score').textContent = w.score;
        const jumps = w.player.grounded ? CONFIG.maxJumps : Math.max(0, CONFIG.maxJumps - w.player.jumps);
        document.getElementById('combo').textContent = `x${w.combo} · ⬆${jumps}`;
        document.getElementById('lives').textContent = '♥'.repeat(w.lives) + '♡'.repeat(Math.max(0, 3 - w.lives));
        document.getElementById('liveRank').textContent = `#${Leaderboard.liveRank(w.score)}`;
    }

    loop(now) {
        const dt = Math.min((now - this.lastTime) / 1000, 0.05);
        this.lastTime = now;
        this.time += dt;

        if (this.state === 'playing') {
            this.accumulator += dt;
            while (this.accumulator >= CONFIG.FIXED_DT) {
                this.fixedUpdate();
                this.accumulator -= CONFIG.FIXED_DT;
            }
        }

        this.render();
        requestAnimationFrame(t => this.loop(t));
    }
}

window.addEventListener('load', () => { window.game = new BanditGame(); });
