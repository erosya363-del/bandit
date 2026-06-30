/** @file Рейтинг и защита от подделки */

function simpleHash(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(36);
}

function signScore(name, score) {
    const payload = `${name}|${score}|${Date.now()}`;
    const encoded = btoa(unescape(encodeURIComponent(payload)));
    return `${score}:${encoded}:${simpleHash(payload + INTEGRITY_SALT)}`;
}

function verifyScore(signed, expectedName = null) {
    try {
        if (!signed) return null;
        const parts = signed.split(':');
        if (parts.length === 2) {
            const score = parseInt(parts[0], 10);
            const decoded = decodeURIComponent(escape(atob(parts[1])));
            const seg = decoded.split('|');
            if (seg.length !== 3 || parseInt(seg[1], 10) !== score) return null;
            if (expectedName && seg[0] !== expectedName) return null;
            return { name: seg[0], score };
        }
        if (parts.length !== 3) return null;
        const score = parseInt(parts[0], 10);
        const decoded = decodeURIComponent(escape(atob(parts[1])));
        const seg = decoded.split('|');
        if (seg.length !== 3 || parseInt(seg[1], 10) !== score) return null;
        if (expectedName && seg[0] !== expectedName) return null;
        if (simpleHash(decoded + INTEGRITY_SALT) !== parts[2]) return null;
        return { name: seg[0], score };
    } catch { return null; }
}

const Leaderboard = {
    load() {
        try {
            const raw = localStorage.getItem('bandit_leaderboard');
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) return [];
            return parsed
                .filter(e => e?.signature && verifyScore(e.signature, e.name))
                .map(e => ({ name: e.name, score: verifyScore(e.signature, e.name).score, signature: e.signature, date: e.date || '' }))
                .sort((a, b) => b.score - a.score)
                .slice(0, 10);
        } catch { return []; }
    },

    save(list) {
        localStorage.setItem('bandit_leaderboard', JSON.stringify(list));
    },

    add(name, score) {
        if (score <= 0) return this.load();
        let lb = this.load();
        lb.push({ name, score, signature: signScore(name, score), date: new Date().toISOString() });
        lb.sort((a, b) => b.score - a.score);
        lb = lb.slice(0, 10);
        this.save(lb);
        return lb;
    },

    rank(name, score) {
        const all = [...this.load(), { name, score }];
        all.sort((a, b) => b.score - a.score);
        for (let i = 0; i < all.length; i++) {
            if (all[i].name === name && all[i].score === score) return i + 1;
        }
        return all.length;
    },

    liveRank(score) {
        const lb = this.load();
        let r = 1;
        for (const e of lb) { if (score >= e.score) break; r++; }
        return r;
    },

    best() {
        const s = localStorage.getItem('bandit_best');
        if (!s) return 0;
        const v = verifyScore(s);
        if (v?.name === '__best__') return v.score;
        const n = parseInt(s, 10);
        return isNaN(n) ? 0 : n;
    },

    saveBest(score) {
        localStorage.setItem('bandit_best', signScore('__best__', score));
    }
};
