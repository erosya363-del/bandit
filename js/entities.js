/** @file Сущности: платформы, игрок, предметы */

let playerAvatarImage = null;

class Platform {
    constructor(x, y, w, color, alt, worldW) {
        this.x = x;
        this.y = y;
        this.width = w;
        this.height = CONFIG.platformH;
        this.color = color;
        this.broken = false;
        this.deltaX = 0;
        this.squash = 1;
        this.squashT = 0;
        this.warning = false;
        this.warningT = 0;
        this.moveSpeed = 0;
        this.moveDir = 1;
        this.collectibles = [];

        const breakP = 0.08 + alt * 0.22;
        const moveP = alt < 0.15 ? 0 : 0.12 + alt * 0.5;
        if (Math.random() < breakP) this.type = 'breakable';
        else if (Math.random() < moveP) {
            this.type = 'moving';
            this.moveSpeed = 0.3 + alt * 2;
            this.moveDir = Math.random() < 0.5 ? -1 : 1;
        } else this.type = 'normal';
    }

    onLand() {
        this.squash = 0.55;
        this.squashT = 8;
        if (this.type === 'breakable' && !this.warning) {
            this.warning = true;
            this.warningT = CONFIG.breakableWarningSec * CONFIG.FIXED_HZ;
        }
    }

    update(worldW) {
        this.deltaX = 0;
        const px = this.x;
        if (this.squashT > 0) { this.squashT--; this.squash += (1 - this.squash) * 0.35; } else this.squash = 1;
        if (this.type === 'moving' && !this.broken) {
            this.x += this.moveSpeed * this.moveDir;
            if (this.x <= 0) { this.x = 0; this.moveDir = 1; }
            else if (this.x + this.width >= worldW) { this.x = worldW - this.width; this.moveDir = -1; }
        }
        this.deltaX = this.x - px;
        if (this.warning && !this.broken) {
            this.warningT--;
            if (this.warningT <= 0) this.broken = true;
        }
        for (const c of this.collectibles) if (!c.collected) c.x += this.deltaX;
    }

    draw(ctx, camY, time) {
        if (this.broken) return;
        const sy = this.y - camY;
        const h = this.height * this.squash;
        const dy = sy + this.height - h;
        ctx.save();
        if (this.warning) {
            const blink = Math.floor(this.warningT / 10) % 2 === 0;
            ctx.globalAlpha = blink ? 1 : 0.4;
            if (blink) { ctx.shadowColor = '#ff6b6b'; ctx.shadowBlur = 16; }
        } else if (this.type === 'moving') {
            ctx.shadowColor = CONFIG.palette.accent;
            ctx.shadowBlur = 10;
        }
        ctx.fillStyle = this.warning && Math.floor(this.warningT / 10) % 2 ? '#e17055' : this.color;
        ctx.beginPath();
        ctx.roundRect(this.x, dy, this.width, h, 8);
        ctx.fill();
        ctx.shadowBlur = 0;
        if (this.type === 'breakable' || this.warning) {
            ctx.strokeStyle = 'rgba(255,100,100,0.8)';
            ctx.setLineDash([5, 4]);
            ctx.stroke();
            ctx.setLineDash([]);
        }
        if (this.warning) {
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 11px Inter,sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(`${Math.ceil(this.warningT / CONFIG.FIXED_HZ)}с`, this.x + this.width / 2, dy - 5);
        }
        ctx.restore();
    }
}

class Collectible {
    constructor(x, y, type) {
        this.x = x; this.y = y; this.type = type;
        this.w = 28; this.h = 28;
        this.collected = false;
        this.phase = Math.random() * Math.PI * 2;
    }
    box() { return { x: this.x, y: this.y, width: this.w, height: this.h }; }
    draw(ctx, camY, t) {
        if (this.collected) return;
        const bob = Math.sin(t * 4 + this.phase) * 5;
        const sy = this.y - camY + bob;
        const cx = this.x + this.w / 2;
        const cy = sy + this.h / 2;
        const glow = { star: CONFIG.palette.gold, pillow: CONFIG.palette.pink, toy: CONFIG.palette.accent }[this.type];
        ctx.save();
        ctx.shadowColor = glow;
        ctx.shadowBlur = 14;
        ctx.translate(cx, cy);
        ctx.rotate(t * 1.2);
        if (this.type === 'star') {
            ctx.fillStyle = glow;
            drawStar(ctx, 0, 0, 5, 13, 6);
            ctx.fill();
        } else if (this.type === 'pillow') {
            ctx.fillStyle = glow;
            ctx.beginPath(); ctx.roundRect(-12, -8, 24, 16, 5); ctx.fill();
        } else {
            ctx.fillStyle = glow;
            ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
    }
}

function drawStar(ctx, cx, cy, spikes, outer, inner) {
    let rot = Math.PI / 2 * 3;
    const step = Math.PI / spikes;
    ctx.beginPath();
    ctx.moveTo(cx, cy - outer);
    for (let i = 0; i < spikes; i++) {
        ctx.lineTo(cx + Math.cos(rot) * outer, cy + Math.sin(rot) * outer);
        rot += step;
        ctx.lineTo(cx + Math.cos(rot) * inner, cy + Math.sin(rot) * inner);
        rot += step;
    }
    ctx.closePath();
}

class Player {
    constructor(x, y) {
        this.x = x; this.y = y;
        this.w = 32; this.h = 46;
        this.vel = new Vector(0, 0);
        this.grounded = false;
        this.platform = null;
        this.jumps = 0;
        this.facing = 1;
        this.displayFacing = 1;
        this.walkCycle = 0;
        this.jumpAnim = 0;
        this.invuln = 0;
    }

    box() {
        return { x: this.x + 5, y: this.y + 7, width: this.w - 10, height: this.h - 8 };
    }

    update(input, phys, boundsW) {
        const { walkSpeed, moveSpeed, airControl, touchAirPush } = phys;
        const drag = input.touch.active && input.touch.moved ? input.touch.dir : 0;

        if (this.grounded) {
            let mx = 0;
            if (input.actions.left) mx -= 1;
            if (input.actions.right) mx += 1;
            if (drag) {
                mx += drag;
                this.facing = drag;
            }
            if (mx) {
                this.vel.x = Math.sign(mx) * walkSpeed * Math.min(Math.abs(mx), 1.3);
                if (input.actions.left || input.actions.right) this.facing = mx > 0 ? 1 : -1;
                this.walkCycle += 0.45;
            } else {
                this.vel.x *= CONFIG.groundFriction;
                if (Math.abs(this.vel.x) < 0.2) this.vel.x = 0;
            }
            this.vel.y = 0;
        } else {
            if (input.actions.left) this.vel.x -= moveSpeed * airControl;
            if (input.actions.right) this.vel.x += moveSpeed * airControl;
            if (drag) {
                this.vel.x += drag * touchAirPush * moveSpeed;
                this.facing = drag;
            }
            this.vel.x *= CONFIG.friction;
            this.vel.x = clamp(this.vel.x, -moveSpeed, moveSpeed);
            if (Math.abs(this.vel.x) > 0.5) this.facing = this.vel.x > 0 ? 1 : -1;
            this.vel.y += CONFIG.gravity;
            this.vel.y = Math.min(this.vel.y, CONFIG.maxFallSpeed);
            this.y += this.vel.y;
        }

        this.x += this.vel.x;
        this.x = clamp(this.x, 0, boundsW - this.w);
        this.displayFacing += (this.facing - this.displayFacing) * 0.4;
        if (this.jumpAnim > 0) this.jumpAnim--;
        if (this.invuln > 0) this.invuln--;
    }

    tryJump(force) {
        if (this.grounded) {
            this._jump(force);
            this.grounded = false;
            this.platform = null;
            this.jumps = 1;
            return true;
        }
        if (this.jumps < CONFIG.maxJumps) {
            this._jump(force);
            this.jumps++;
            return true;
        }
        return false;
    }

    _jump(force) {
        this.vel.y = force;
        this.jumpAnim = 22;
    }

    land(p) {
        this.grounded = true;
        this.platform = p;
        this.jumps = 0;
        this.vel.y = 0;
        this.y = p.y - this.h;
        p.onLand();
    }

    leave() {
        this.grounded = false;
        this.platform = null;
    }

    draw(ctx, camY, t) {
        if (this.invuln > 0 && Math.floor(this.invuln / 4) % 2 === 0) return;

        const footX = this.x + this.w / 2;
        const footY = this.y - camY + this.h;
        const red = CONFIG.palette.spiderRed;
        const blue = CONFIG.palette.spiderBlue;
        const webbing = this.jumpAnim > 0;
        const webA = this.jumpAnim / 22;
        const walk = this.grounded ? Math.sin(this.walkCycle) : 0;
        const airLean = this.grounded ? 0 : clamp(this.vel.x * 0.04, -0.18, 0.18);

        ctx.save();
        ctx.translate(footX, footY);
        ctx.rotate(airLean);
        ctx.scale(this.displayFacing, 1);

        // ── Ноги (прямые, ступни на платформе) ──
        const walking = this.grounded && Math.abs(walk) > 0.2;
        const legSpread = walking ? 5 + walk * 0.5 : (this.grounded ? 2.5 : 4);
        const stepLift = walking ? Math.max(0, walk) * 4 : (this.grounded ? 0 : Math.sin(t * 14) * 2);
        ctx.fillStyle = blue;
        ctx.beginPath();
        ctx.roundRect(-legSpread - 3, -30 + stepLift, 6, 22, 2);
        ctx.fill();
        ctx.beginPath();
        ctx.roundRect(legSpread - 3, -30 - stepLift, 6, 22, 2);
        ctx.fill();
        ctx.fillStyle = red;
        ctx.beginPath();
        ctx.roundRect(-10, -32, 20, 5, 2);
        ctx.fill();
        ctx.fillStyle = red;
        ctx.beginPath();
        ctx.roundRect(-legSpread - 3.5, -9 + stepLift, 7, 9, 3);
        ctx.fill();
        ctx.beginPath();
        ctx.roundRect(legSpread - 3.5, -9 - stepLift, 7, 9, 3);
        ctx.fill();

        // ── Туловище ──
        ctx.fillStyle = blue;
        ctx.beginPath();
        ctx.roundRect(-10, -48, 20, 20, 5);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.lineWidth = 1;
        for (let i = -7; i <= 7; i += 4) {
            ctx.beginPath();
            ctx.moveTo(i, -46);
            ctx.lineTo(i + (i < 0 ? 2 : -2), -32);
            ctx.stroke();
        }
        ctx.fillStyle = red;
        ctx.beginPath();
        ctx.moveTo(0, -44);
        ctx.lineTo(6, -38);
        ctx.lineTo(0, -32);
        ctx.lineTo(-6, -38);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#111';
        ctx.beginPath();
        ctx.ellipse(0, -38, 2, 2.5, 0, 0, Math.PI * 2);
        ctx.fill();
        for (let i = 0; i < 4; i++) {
            const a = (Math.PI * 2 * i) / 4 + Math.PI / 4;
            ctx.beginPath();
            ctx.moveTo(0, -38);
            ctx.lineTo(Math.cos(a) * 4.5, -38 + Math.sin(a) * 4.5);
            ctx.strokeStyle = '#111';
            ctx.lineWidth = 1.2;
            ctx.stroke();
        }

        // ── Голова / маска ──
        if (playerAvatarImage?.complete) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(0, -54, 11, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(playerAvatarImage, -11, -65, 22, 22);
            ctx.restore();
            ctx.strokeStyle = red;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, -54, 11, 0, Math.PI * 2);
            ctx.stroke();
        } else {
            ctx.fillStyle = red;
            ctx.beginPath();
            ctx.arc(0, -54, 11, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.ellipse(-4, -54, 4, 6.5, -0.25, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(4, -54, 4, 6.5, 0.25, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#111';
            ctx.beginPath();
            ctx.ellipse(-4, -53, 1.8, 4, -0.25, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(4, -53, 1.8, 4, 0.25, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#0d0d0d';
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(-2.5, -47);
            ctx.quadraticCurveTo(0, -45.5, 2.5, -47);
            ctx.stroke();
        }

        // ── Руки ──
        const armSwing = this.grounded && !webbing ? walk * 5 : 0;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        if (webbing) {
            const reach = lerp(0, 1, 1 - webA);
            const handY = -62 - reach * 16;
            const handX = 12 + reach * 5;
            ctx.strokeStyle = blue;
            ctx.lineWidth = 6;
            ctx.beginPath();
            ctx.moveTo(-8, -42);
            ctx.lineTo(-handX, handY);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(8, -42);
            ctx.lineTo(handX, handY);
            ctx.stroke();
            ctx.fillStyle = red;
            ctx.beginPath();
            ctx.arc(-handX, handY, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(handX, handY, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = `rgba(255,255,255,${webA * 0.9})`;
            ctx.lineWidth = 2 * webA;
            for (const side of [-1, 1]) {
                const hx = side * handX;
                ctx.beginPath();
                ctx.moveTo(hx, handY);
                ctx.quadraticCurveTo(side * 22, handY - 18, side * 28, handY - 52);
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(hx, handY);
                ctx.quadraticCurveTo(side * 8, handY - 30, side * 14, handY - 58);
                ctx.stroke();
            }
        } else {
            ctx.strokeStyle = blue;
            ctx.lineWidth = 6;
            ctx.beginPath();
            ctx.moveTo(-8, -42);
            ctx.lineTo(-12, -28 + armSwing);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(8, -42);
            ctx.lineTo(12, -28 - armSwing);
            ctx.stroke();
            ctx.fillStyle = red;
            ctx.beginPath();
            ctx.arc(-12, -26 + armSwing, 3.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(12, -26 - armSwing, 3.5, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }
}
