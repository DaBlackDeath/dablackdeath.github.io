/* =============================================================================
   BLACKDEATH PLAYER
   1. Player-Engine (theme-unabhängig, Streaming über HTML5 Audio)
   2. Visualizer   (Form/Farben kommen aus theme.visualizer der Config)
   3. Theme-Loader (CSS, Deko, Texte, Logo, Hintergrund-Effekt)
   4. App-Start    (Config laden, Auswahllisten bauen)
   Die Config-Datei wird über <body data-config="..."> angegeben.
   ============================================================================= */

/* =============================================================================
   1. PLAYER CORE ENGINE
   ============================================================================= */
class CyberPlaylistPlayer {
    constructor(root, playlist) {
        this.root = root;
        this.playlist = playlist;
        this.currentIndex = 0;

        this.audio = new Audio();
        this.audio.crossOrigin = "anonymous";

        this.ctx = null;
        this.analyser = null;
        this.dataArray = null;

        this.loop = true;
        this.isDragging = false;
        this.visualizerActive = false;

        this.buildRefs();
        this.renderPlaylist();
        this.loadTrack(0, false);
    }

    buildRefs() {
        const q = sel => this.root.querySelector(sel);
        this.seek = q(".cyber-seek");
        this.loopToggle = q(".loop");
        this.listBox = q(".cyber-playlist");

        q(".play").onclick = () => this.play();
        q(".pause").onclick = () => this.pause();
        q(".stop").onclick = () => this.stop();
        q(".prev").onclick = () => this.prevTrack();
        q(".next").onclick = () => this.nextTrack();

        this.loopToggle.onchange = () => {
            this.loop = this.loopToggle.checked;
            this.audio.loop = this.loop;
        };

        this.seek.oninput = () => { this.isDragging = true; };
        this.seek.onchange = () => {
            if (isNaN(this.audio.duration)) return;
            this.audio.currentTime = (this.seek.value / 100) * this.audio.duration;
            this.isDragging = false;
        };
        this.seek.onmouseup = this.seek.ontouchend = () => { this.isDragging = false; };

        this.audio.ontimeupdate = () => this.updateSeek();

        // Zustand für Theme-CSS: body.is-playing (z.B. drehende Spulen) + --progress (0..1)
        const setPlaying = on => document.body.classList.toggle("is-playing", on);
        this.audio.onplaying = () => setPlaying(true);
        this.audio.onpause = () => setPlaying(false);
        this.audio.onemptied = () => { setPlaying(false); this.setProgress(0); };
        this.audio.onended = () => { setPlaying(false); if (!this.loop) this.nextTrack(); };
    }

    renderPlaylist() {
        this.listBox.innerHTML = "";
        this.playlist.forEach((track, i) => {
            const item = document.createElement("div");
            item.className = "cyber-track" + (i === this.currentIndex ? " active" : "");
            item.textContent = track.name;
            item.onclick = () => this.loadTrack(i, true);
            this.listBox.appendChild(item);
        });
    }

    updatePlaylist(newPlaylist) {
        this.stop();
        this.playlist = newPlaylist;
        this.currentIndex = 0;
        this.renderPlaylist();
        this.loadTrack(0, false);
    }

    highlightActive() {
        this.listBox.querySelectorAll(".cyber-track").forEach((el, i) => {
            const isActive = i === this.currentIndex;
            el.classList.toggle("active", isActive);
            if (isActive) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
        });
    }

    initAudioEngine() {
        if (this.ctx) return;
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.analyser = this.ctx.createAnalyser();
        this.analyser.fftSize = 128;
        this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        this.ctx.createMediaElementSource(this.audio).connect(this.analyser);
        this.analyser.connect(this.ctx.destination);
    }

    loadTrack(index, autoplay = false) {
        this.currentIndex = index;
        this.highlightActive();
        this.audio.src = this.playlist[index].src;
        this.audio.loop = this.loop;
        this.seek.value = 0;
        if (autoplay) this.play();
    }

    play() {
        this.initAudioEngine();
        if (this.ctx.state === "suspended") this.ctx.resume();
        this.audio.play().catch(e => console.error("Audio Startfehler:", e));
        if (!this.visualizerActive) {
            this.visualizerActive = true;
            Visualizer.start(this);
        }
    }

    pause() { this.audio.pause(); }

    stop() {
        this.audio.pause();
        this.audio.currentTime = 0;
        this.seek.value = 0;
        this.setProgress(0);
    }

    setProgress(f) { document.documentElement.style.setProperty("--progress", f.toFixed(4)); }

    nextTrack() { this.loadTrack((this.currentIndex + 1) % this.playlist.length, true); }
    prevTrack() { this.loadTrack((this.currentIndex - 1 + this.playlist.length) % this.playlist.length, true); }

    updateSeek() {
        if (this.isDragging || isNaN(this.audio.duration) || this.audio.duration === 0) return;
        const f = this.audio.currentTime / this.audio.duration;
        this.seek.value = f * 100;
        this.setProgress(f);
    }
}

/* =============================================================================
   2. AUDIO VISUALIZER
   Styles:  "bars"     – Balken (flat: true = eckig/pixelig, sonst abgerundet)
            "segments" – LED-Segmentanzeige (Amber)
   Farben (colors): { gradient: [[r,g,b], ...] }  Verlauf über alle Balken
                    { solid:    [r,g,b] }
                    { palette:  [[r,g,b], ...] }  zyklisch pro Balken
                    { rainbow:  { spread, speed, saturation, lightness } }
   alpha: [min, max]  – Deckkraft leiser bzw. lauter Balken
   ============================================================================= */
const Visualizer = {
    canvas: null,
    ctx: null,
    config: {},
    player: null,
    running: false,

    init(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");
    },

    setConfig(cfg) {
        this.config = cfg || { style: "bars" };
        // Frischen Canvas einsetzen: Chrome markiert einen Canvas intern als "undurchsichtig", sobald er
        // einmal komplett deckend übermalt wurde (Segment-Anzeige mit background) – danach erscheint er
        // auch nach clearRect schwarz. Ein neues Element setzt das (und alle Kontext-Zustände) zurück.
        if (this.canvas && this.canvas.parentNode) {
            const fresh = this.canvas.cloneNode(false);
            this.canvas.replaceWith(fresh);
            this.init(fresh);
        }
    },

    start(player) {
        this.player = player;
        if (this.running) return;
        this.running = true;
        const loop = () => { this.draw(); requestAnimationFrame(loop); };
        loop();
    },

    color(t, v, i) {
        const cfg = this.config;
        const c = cfg.colors || { solid: [255, 255, 255] };
        const [aMin, aMax] = cfg.alpha || [0.5, 1];
        const a = aMin + v * (aMax - aMin);
        if (c.rainbow) {
            const r = Object.assign({ spread: 300, speed: 0.02, saturation: 100, lightness: 60 }, c.rainbow);
            return `hsla(${(t * r.spread + performance.now() * r.speed) % 360}, ${r.saturation}%, ${r.lightness}%, ${a})`;
        }
        let rgb;
        if (c.solid) rgb = c.solid;
        else if (c.palette) rgb = c.palette[i % c.palette.length];
        else {
            const stops = c.gradient;
            const pos = t * (stops.length - 1);
            const k = Math.min(Math.floor(pos), stops.length - 2);
            const f = pos - k;
            rgb = stops[k].map((x, n) => x + (stops[k + 1][n] - x) * f);
        }
        return `rgba(${Math.floor(rgb[0])},${Math.floor(rgb[1])},${Math.floor(rgb[2])},${a})`;
    },

    drawBars(data, w, h) {
        const cfg = this.config, ctx = this.ctx;
        const flat = !!cfg.flat;
        const barCount = data.length * (cfg.bins ?? (flat ? 0.8 : 0.5));
        const barWidth = w / barCount;
        const fill = cfg.barWidth ?? (flat ? 0.7 : 0.8);
        const radius = cfg.radius ?? (flat ? 0 : 3);
        const headroom = cfg.headroom ?? (flat ? 0 : 20);

        for (let i = 0; i < barCount; i++) {
            const v = data[i] / 255;
            const bh = v * (h - headroom);
            if (bh <= 0) continue;
            const bw = barWidth * fill;
            const bx = i * barWidth + (barWidth - bw) / 2;
            const y = h - bh;
            ctx.fillStyle = this.color(i / barCount, v, i);
            if (radius > 0) {
                ctx.beginPath();
                ctx.roundRect ? ctx.roundRect(bx, y, bw, bh, Math.min(radius, bh / 2)) : ctx.rect(bx, y, bw, bh);
                ctx.fill();
            } else {
                ctx.fillRect(Math.round(bx), Math.round(y), Math.round(bw), Math.round(bh));
            }
        }
    },

    drawSegments(data, w, h) {
        const cfg = Object.assign({ columns: 16, segments: 11, spacing: 10, segmentHeight: 8, segmentGap: 4,
            from: [255, 120, 20], to: [255, 220, 20], background: null, glow: 12 }, this.config);
        const ctx = this.ctx;

        if (cfg.background) {
            const g = ctx.createLinearGradient(0, 0, 0, h);
            g.addColorStop(0, cfg.background[0]);
            g.addColorStop(1, cfg.background[1]);
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, w, h);
        }

        const colW = (w - cfg.spacing * (cfg.columns + 1)) / cfg.columns;
        for (let i = 0; i < cfg.columns; i++) {
            const value = data[Math.floor(i * (data.length / cfg.columns))] / 255;
            const active = Math.floor(value * cfg.segments);
            const x = cfg.spacing + i * (colW + cfg.spacing);
            for (let s = 0; s < cfg.segments; s++) {
                const f = s / (cfg.segments - 1);
                const rgb = cfg.from.map((c, n) => Math.floor(c + (cfg.to[n] - c) * f)).join(",");
                const lit = s < active;
                ctx.fillStyle = `rgba(${rgb},${lit ? 0.25 + (s / cfg.segments) * 0.75 : 0.08})`;
                ctx.shadowBlur = lit ? cfg.glow : 0;
                ctx.shadowColor = `rgba(${rgb},0.8)`;
                ctx.fillRect(x, h - 10 - s * (cfg.segmentHeight + cfg.segmentGap), colW, cfg.segmentHeight);
            }
        }
        ctx.shadowBlur = 0;

        const glass = ctx.createLinearGradient(0, 0, w, 0);
        glass.addColorStop(0, "rgba(255,255,255,0.02)");
        glass.addColorStop(0.5, "rgba(255,255,255,0.06)");
        glass.addColorStop(1, "rgba(255,255,255,0.01)");
        ctx.fillStyle = glass;
        ctx.fillRect(0, 0, w, h);
    },

    draw() {
        const p = this.player;
        if (!p || !p.analyser) return;
        if (!p.audio.paused) p.analyser.getByteFrequencyData(p.dataArray);
        else for (let i = 0; i < p.dataArray.length; i++) p.dataArray[i] = Math.floor(p.dataArray[i] * 0.85);

        const { width: w, height: h } = this.canvas;
        this.ctx.clearRect(0, 0, w, h);
        if (this.config.style === "segments") this.drawSegments(p.dataArray, w, h);
        else this.drawBars(p.dataArray, w, h);
    }
};

/* =============================================================================
   3. THEME-LOADER
   ============================================================================= */
const ThemeManager = {
    config: null,
    current: null,
    effect: null,
    decorCache: {},

    init(config, env) {
        this.config = config;
        this.env = env;
        this.cssLink = null;

        const resize = () => { env.canvas.width = innerWidth; env.canvas.height = innerHeight; };
        addEventListener("resize", resize);
        resize();

        const loop = now => {
            if (this.effect) this.effect.frame(now);
            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    },

    themeUrl(id, file) { return `${this.config.themeDir}/${id}/${file}`; },

    loadCss(href) {
        return new Promise(resolve => {
            const link = document.createElement("link");
            link.rel = "stylesheet";
            link.href = href;
            link.onload = link.onerror = () => resolve(link);
            document.head.appendChild(link);
        });
    },

    async loadDecor(id, cfg) {
        if (!cfg.decor) return "";
        const url = typeof cfg.decor === "string" ? cfg.decor : this.themeUrl(id, "decor.html");
        if (!(url in this.decorCache)) {
            try {
                const r = await fetch(url);
                this.decorCache[url] = r.ok ? await r.text() : "";
            } catch (e) { this.decorCache[url] = ""; }
        }
        return this.decorCache[url];
    },

    async apply(id) {
        const themes = this.config.themes;
        if (!themes[id]) id = this.config.defaultTheme;
        const cfg = themes[id];
        this.current = id;

        // CSS + Deko parallel laden, erst danach umschalten (kein Flackern)
        const [link, decorHtml] = await Promise.all([
            this.loadCss(cfg.css || this.themeUrl(id, "theme.css")),
            this.loadDecor(id, cfg)
        ]);
        if (this.current !== id) { link.remove(); return; }   // inzwischen anderes Theme gewählt
        if (this.cssLink) this.cssLink.remove();
        this.cssLink = link;

        // Deko austauschen
        document.querySelectorAll("[data-decor]").forEach(el => el.remove());
        const tpl = document.createElement("template");
        tpl.innerHTML = decorHtml;
        [...tpl.content.children].forEach(el => {
            el.setAttribute("data-decor", id);
            if (el.dataset.into === "player") this.env.playerBox.prepend(el);
            else document.getElementById("themeDecor").appendChild(el);
        });

        // Texte + Logo
        document.body.dataset.theme = id;
        document.title = cfg.pageTitle || "";
        document.querySelector(".cyber-player-title").textContent = cfg.playerTitle || "";
        document.querySelector(".loop-label-text").textContent = cfg.loopLabel || "";
        const logo = document.getElementById("themeLogo");
        if (cfg.logo) logo.src = cfg.logo; else logo.removeAttribute("src");

        // Hintergrund-Effekt
        if (this.effect && this.effect.destroy) this.effect.destroy();
        this.effect = null;
        this.env.ctx.clearRect(0, 0, this.env.canvas.width, this.env.canvas.height);
        const bg = cfg.background;
        if (bg && bg.effect) {
            const factory = BD_EFFECTS[bg.effect];
            if (factory) this.effect = factory(this.env, bg);
            else console.warn(`Unbekannter Effekt "${bg.effect}" in Theme "${id}"`);
        }

        Visualizer.setConfig(cfg.visualizer);

        const sel = document.getElementById("themeSelect");
        if (sel.value !== id) sel.value = id;
        try { localStorage.setItem(this.config.storageKey, id); } catch (e) {}
    }
};

/* =============================================================================
   4. APP-START
   ============================================================================= */
function fillSelect(select, entries) {
    select.innerHTML = "";
    for (const [value, label] of entries) select.add(new Option(label, value));
}

async function fetchJson(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`Fehler beim Laden von ${url} (${r.status})`);
    return r.json();
}

async function initApp() {
    document.addEventListener("contextmenu", e => e.preventDefault());

    const config = await fetchJson(document.body.dataset.config || "config.json");
    config.themeDir = config.themeDir || "player/themes";
    config.storageKey = config.storageKey || "playerTheme";
    config.defaultTheme = config.defaultTheme || Object.keys(config.themes)[0];

    (config.fonts || []).forEach(href => {
        const l = document.createElement("link");
        l.rel = "stylesheet"; l.href = href;
        document.head.appendChild(l);
    });

    const playerBox = document.querySelector(".cyber-player-box");
    const bgCanvas = document.getElementById("bgCanvas");
    Visualizer.init(document.getElementById("cyberVisualizer"));
    ThemeManager.init(config, { canvas: bgCanvas, ctx: bgCanvas.getContext("2d"), playerBox });

    // Theme-Auswahl
    const themeSelect = document.getElementById("themeSelect");
    fillSelect(themeSelect, Object.entries(config.themes).map(([id, t]) => [id, t.label || id]));
    themeSelect.addEventListener("change", e => ThemeManager.apply(e.target.value));

    let saved = config.defaultTheme;
    try { saved = localStorage.getItem(config.storageKey) || saved; } catch (e) {}
    saved = new URLSearchParams(location.search).get("theme") || saved;   // z.B. player.html?theme=c64
    ThemeManager.apply(saved);

    // Playlist-Auswahl
    const playlistSelect = document.getElementById("playlistSelect");
    fillSelect(playlistSelect, config.playlists.map(p => [p.src, p.label]));
    playlistSelect.parentElement.hidden = config.playlists.length < 2;

    const player = new CyberPlaylistPlayer(playerBox, await fetchJson(playlistSelect.value));
    playlistSelect.addEventListener("change", async () => {
        try { player.updatePlaylist(await fetchJson(playlistSelect.value)); }
        catch (e) { console.error("Fehler beim Wechseln der Playlist:", e); }
    });
}

initApp().catch(e => console.error("Kritischer Fehler beim Initialisieren des Players:", e));
