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
        const { walkSpeed, moveSpeed, airControl, touchFollow, touchAirPush } = phys;

        if (this.grounded) {
            let mx = 0;
            if (input.actions.left) mx -= 1;
            if (input.actions.right) mx += 1;
            if (input.touch.active && input.touch.x != null) {
                const tx = input.touch.x - this.w / 2;
                const d = tx - this.x;
                if (Math.abs(d) > 2) {
                    mx += Math.sign(d) * Math.min(1, Math.abs(d) * touchFollow / walkSpeed);
                    this.facing = d > 0 ? 1 : -1;
                }
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
            if (input.touch.active && input.touch.x != null) {
                const d = input.touch.x - (this.x + this.w / 2);
                if (Math.abs(d) > 5) {
                    this.vel.x += Math.sign(d) * touchAirPush * moveSpeed;
                    this.facing = d > 0 ? 1 : -1;
                }
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
        this.jumpAnim = 14;
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
        const sy = this.y - camY;
        const cx = this.x + this.w / 2;
        const cy = sy + this.h / 2;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(this.grounded ? Math.sin(this.walkCycle) * 0.05 : this.vel.x * 0.05);
        if (this.displayFacing < 0) ctx.scale(-1, 1);

        const red = CONFIG.palette.spiderRed;
        const blue = CONFIG.palette.spiderBlue;

        if (playerAvatarImage?.complete) {
            ctx.save();
            ctx.beginPath(); ctx.arc(0, -8, 14, 0, Math.PI * 2); ctx.clip();
            ctx.drawImage(playerAvatarImage, -14, -22, 28, 28);
            ctx.restore();
        } else {
            ctx.fillStyle = red;
            ctx.beginPath(); ctx.arc(0, -16, 11, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.beginPath(); ctx.ellipse(-4, -14, 5, 7, -0.2, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(4, -14, 5, 7, 0.2, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#111';
            ctx.beginPath(); ctx.ellipse(-4, -13, 2, 3.5, -0.2, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(4, -13, 2, 3.5, 0.2, 0, Math.PI * 2); ctx.fill();
        }

        ctx.fillStyle = blue;
        ctx.beginPath(); ctx.roundRect(-12, -2, 24, 30, 5); ctx.fill();
        ctx.fillStyle = red;
        ctx.beginPath();
        ctx.moveTo(-12, 2); ctx.lineTo(12, 2); ctx.lineTo(9, 14); ctx.lineTo(-9, 14);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = red;
        ctx.beginPath(); ctx.ellipse(0, 8, 3, 5, 0, 0, Math.PI * 2); ctx.fill();

        const ls = this.grounded ? Math.sin(this.walkCycle) * 5 : Math.sin(t * 12) * 4;
        ctx.fillStyle = blue;
        ctx.beginPath(); ctx.roundRect(-11, 26, 9, 12 + ls * 0.3, 3); ctx.fill();
        ctx.beginPath(); ctx.roundRect(2, 26, 9, 12 - ls * 0.3, 3); ctx.fill();
        ctx.fillStyle = red;
        ctx.beginPath(); ctx.roundRect(-14, 16, 7, 11, 2); ctx.fill();
        ctx.beginPath(); ctx.roundRect(7, 16, 7, 11, 2); ctx.fill();

        if (this.jumpAnim > 0) {
            const a = this.jumpAnim / 14;
            ctx.strokeStyle = `rgba(255,255,255,${a * 0.85})`;
            ctx.lineWidth = 1.5 * a;
            for (let i = -1; i <= 1; i += 2) {
                ctx.beginPath();
                ctx.moveTo(i * 5, -22);
                ctx.quadraticCurveTo(i * 20, -40, i * 30, -55);
                ctx.stroke();
            }
        }
        ctx.restore();
    }
}
