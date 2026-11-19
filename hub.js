/* RoboTools hub. Picks the language, keeps one robot chosen, plays its short animation once, and in the local build shows which services run. */
(() => {
    const root = document.documentElement;
    root.classList.add('js');
    const LANGS = ['ja', 'en', 'zh'];
    const KEY = 'robotools.lang';
    const store = { get() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }, set(v) { try { localStorage.setItem(KEY, v); } catch (e) { /* private window */ } } };
    const nav = (navigator.language || 'en').toLowerCase();
    const saved = store.get();
    const first = LANGS.includes(saved) ? saved : nav.startsWith('ja') ? 'ja' : nav.startsWith('zh') ? 'zh' : 'en';
    root.lang = first;

    document.addEventListener('DOMContentLoaded', () => {
        const mode = root.dataset.mode;
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
        const narrow = window.matchMedia('(max-width: 879px), (hover: none) and (pointer: coarse)');   // the same test as the CSS
        const wide = { get matches() { return !narrow.matches; }, addEventListener: (t, f) => narrow.addEventListener(t, f) };
        const bots = [...document.querySelectorAll('.bot')];
        const links = bots.map((b) => b.querySelector('a.bot-link'));
        const imgOf = (b) => b.querySelector('.fig img');
        let cur = -1;
        let swapTimer = 0;

        document.querySelectorAll('.lang button').forEach((btn) => {
            const sync = () => btn.setAttribute('aria-pressed', String(btn.dataset.lang === root.lang));
            sync();
            btn.addEventListener('click', () => { root.lang = btn.dataset.lang; store.set(btn.dataset.lang); document.querySelectorAll('.lang button').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.lang === root.lang))); });
        });

        const preload = (i) => {
            const b = bots[i]; if (!b || !imgOf(b)) return;
            const conn = navigator.connection;
            if (reduce.matches || (conn && conn.saveData)) return;
            const im = new Image(); im.src = imgOf(b).dataset.large;   // the still only: one animation at a time, the chosen one
        };

        const roster = document.querySelector('.roster');
        function setCurrent(i, fromScroll) {
            if (i === cur || i < 0 || i >= bots.length) return;
            clearTimeout(swapTimer);
            const before = cur;
            if (cur >= 0) {
                const p = bots[cur]; p.removeAttribute('data-current');
                const pi = imgOf(p); pi.src = pi.dataset.small;
            }
            cur = i;
            const b = bots[i]; b.setAttribute('data-current', '');
            const im = imgOf(b); im.src = im.dataset.large;
            if (!reduce.matches) swapTimer = setTimeout(() => { if (cur === i) im.src = im.dataset.anim; }, 380);
            const idle = window.requestIdleCallback || ((f) => setTimeout(f, 400));
            idle(() => { preload(i - 1); preload(i + 1); });
            if (!wide.matches && !fromScroll && before >= 0) b.scrollIntoView({ behavior: reduce.matches ? 'auto' : 'smooth', inline: 'center', block: 'nearest' });   // the row of cards follows a key or a tap
        }

        // phone width: the card nearest the middle of the row is the chosen one, judged when the sliding has settled
        let settle = 0;
        let down = null;
        roster.addEventListener('scroll', () => {
            if (wide.matches) return;
            clearTimeout(settle);
            settle = setTimeout(() => {
                const r = roster.getBoundingClientRect(); const mid = r.left + r.width / 2;
                let best = 0; let bd = Infinity;
                bots.forEach((b, i) => { const q = b.getBoundingClientRect(); const d = Math.abs(q.left + q.width / 2 - mid); if (d < bd) { bd = d; best = i; } });
                setCurrent(best, true);
            }, 90);
        }, { passive: true });

        bots.forEach((b, i) => {
            // only a real movement of the mouse chooses: the layout moves under a resting pointer, and that must not choose
            b.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse' && (e.movementX || e.movementY)) setCurrent(i); });
            const a = links[i];
            if (!a) return;
            a.addEventListener('focus', () => setCurrent(i));
            a.addEventListener('pointerdown', () => { down = { i, was: i === cur }; }, true);   // the focus that a press causes would choose the card before the click
            a.addEventListener('pointercancel', () => { down = null; }, true);   // a swipe starts as a press on a card and ends as a cancel: no tap
            a.addEventListener('click', (e) => {
                const was = down && down.i === i ? down.was : i === cur; down = null;
                if (!wide.matches && !was) { e.preventDefault(); setCurrent(i); }   // a phone: the first tap on a side card brings it to the middle, the next one opens it
            });
                    });

        const live = () => links.map((a, i) => (a ? i : -1)).filter((i) => i >= 0);
        document.addEventListener('keydown', (e) => {
            if (e.altKey || e.ctrlKey || e.metaKey) return;
            const inRoster = bots.some((b) => b.contains(document.activeElement)) || (document.activeElement === document.body && wide.matches);
            if (!inRoster) return;
            const ids = live(); if (!ids.length) return;
            const fi = links.indexOf(document.activeElement);   // a step starts from the focused link: at phone width the chosen entry stays the first
            const at = ids.indexOf(fi >= 0 ? fi : cur >= 0 && links[cur] ? cur : ids[0]);
            let to = null;
            if (e.key === 'ArrowRight' || e.key === 'ArrowDown') to = ids[(at + 1) % ids.length];
            else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') to = ids[(at - 1 + ids.length) % ids.length];
            else if (e.key === 'Home') to = ids[0];
            else if (e.key === 'End') to = ids[ids.length - 1];
            if (to === null) return;
            e.preventDefault(); setCurrent(to); links[to].focus();
        });

        setCurrent(0);
        wide.addEventListener('change', () => { if (!wide.matches && cur >= 0) bots[cur].scrollIntoView({ inline: 'center', block: 'nearest' }); });

        if (mode === 'local' || mode === 'dist') {
            const dots = new Map([...document.querySelectorAll('[data-dot]')].map((d) => [d.dataset.dot, d]));
            const texts = new Map([...document.querySelectorAll('[data-status-text]')].map((d) => [d.dataset.statusText, d]));
            const paint = (tool, s) => {
                const d = dots.get(tool); if (d) { d.dataset.s = s; d.title = { up: 'running', down: 'stopped', unknown: 'unknown' }[s]; }
                const t = texts.get(tool); if (t) { t.querySelectorAll('span[data-s]').forEach((x) => { x.hidden = x.dataset.s !== s; }); }
            };
            const poll = async () => {
                if (document.visibilityState !== 'visible') return;
                try {
                    const r = await fetch('health.json', { cache: 'no-store' });
                    const j = await r.json();
                    for (const tool of dots.keys()) paint(tool, j[tool] === 'up' ? 'up' : j[tool] === 'down' ? 'down' : 'unknown');
                } catch (e) { for (const tool of dots.keys()) paint(tool, 'unknown'); }
            };
            poll(); setInterval(poll, 30000);
            document.addEventListener('visibilitychange', poll);
        }
    });
})();
