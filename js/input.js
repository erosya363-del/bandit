/** @file Абстракция ввода — actions, не клавиши (game-development) */

class InputManager {
    constructor(canvas, container) {
        this.actions = { left: false, right: false, jump: false };
        this.touch = { active: false, dir: 0, moved: false, prevX: 0, startX: 0, startY: 0, startTime: 0 };
        this.canvas = canvas;
        this.container = container;
        this.jumpQueued = false;
        this._bind();
    }

    consumeJump() {
        if (!this.jumpQueued) return false;
        this.jumpQueued = false;
        return true;
    }

    _bind() {
        document.addEventListener('keydown', e => {
            if (e.code === 'ArrowLeft' || e.code === 'KeyA') this.actions.left = true;
            if (e.code === 'ArrowRight' || e.code === 'KeyD') this.actions.right = true;
            if (['Space', 'ArrowUp', 'KeyW'].includes(e.code)) {
                e.preventDefault();
                this.jumpQueued = true;
            }
        });
        document.addEventListener('keyup', e => {
            if (e.code === 'ArrowLeft' || e.code === 'KeyA') this.actions.left = false;
            if (e.code === 'ArrowRight' || e.code === 'KeyD') this.actions.right = false;
        });

        const isBtn = el => el?.closest?.('.mobile-btn');
        const onStart = (cx, cy) => {
            this.touch.active = true;
            this.touch.moved = false;
            this.touch.dir = 0;
            this.touch.prevX = cx;
            this.touch.startX = cx;
            this.touch.startY = cy;
            this.touch.startTime = performance.now();
        };
        const onMove = (cx, cy) => {
            if (!this.touch.active) return;
            const dx = cx - this.touch.prevX;
            this.touch.prevX = cx;
            if (Math.hypot(cx - this.touch.startX, cy - this.touch.startY) > 8) {
                this.touch.moved = true;
            }
            if (this.touch.moved) {
                this.touch.dir = Math.abs(dx) >= 2 ? Math.sign(dx) : 0;
            }
        };
        const onEnd = () => {
            if (this.touch.active && !this.touch.moved && performance.now() - this.touch.startTime < 280) {
                this.jumpQueued = true;
            }
            this.touch.active = false;
            this.touch.moved = false;
            this.touch.dir = 0;
        };

        this.container.addEventListener('touchstart', e => {
            if (isBtn(e.target)) return;
            e.preventDefault();
            onStart(e.touches[0].clientX, e.touches[0].clientY);
        }, { passive: false });
        this.container.addEventListener('touchmove', e => {
            if (isBtn(e.target)) return;
            e.preventDefault();
            onMove(e.touches[0].clientX, e.touches[0].clientY);
        }, { passive: false });
        this.container.addEventListener('touchend', e => { if (!isBtn(e.target)) onEnd(); });
        this.container.addEventListener('touchcancel', onEnd);

        this.bindMobileButtons();
    }

    bindMobileButtons() {
        const hold = (id, down, up) => {
            const btn = document.getElementById(id);
            if (!btn) return;
            const press = e => { e.preventDefault(); down(); btn.classList.add('active'); };
            const release = () => { up(); btn.classList.remove('active'); };
            btn.addEventListener('touchstart', press, { passive: false });
            btn.addEventListener('touchend', release);
            btn.addEventListener('touchcancel', release);
            btn.addEventListener('mousedown', down);
            btn.addEventListener('mouseup', release);
            btn.addEventListener('mouseleave', release);
        };
        hold('btnLeft', () => { this.actions.left = true; }, () => { this.actions.left = false; });
        hold('btnRight', () => { this.actions.right = true; }, () => { this.actions.right = false; });
        const jumpBtn = document.getElementById('btnJump');
        if (jumpBtn) {
            const j = e => { e.preventDefault(); this.jumpQueued = true; jumpBtn.classList.add('active'); setTimeout(() => jumpBtn.classList.remove('active'), 100); };
            jumpBtn.addEventListener('touchstart', j, { passive: false });
            jumpBtn.addEventListener('mousedown', () => { this.jumpQueued = true; });
        }
    }
}
