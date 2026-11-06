/* =============================================================================
   HINTERGRUND-EFFEKTE
   -----------------------------------------------------------------------------
   Jeder Effekt ist eine Fabrik:  (env, params) => { frame(now), destroy() }
     env.canvas / env.ctx : der Vollbild-Hintergrund-Canvas (#bgCanvas)
     env.playerBox        : die Player-Box (für CRT-Glitch u.ä.)
     params               : das "background"-Objekt aus der Config-JSON
   Alle Parameter haben Defaults, die JSON muss also nur Abweichungen enthalten.
   Neuer Effekt = neue Funktion in BD_EFFECTS + Name in der JSON eintragen.
   ============================================================================= */
const rand = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];

/* beliebige CSS-Farbe ("#f0a", "rgb(..)", "255,0,0", "hotpink") -> [r,g,b] */
const _colCtx = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
function colRGB(col) {
    if (Array.isArray(col)) return col.slice(0, 3);
    if (/^\s*\d+\s*,\s*\d+\s*,\s*\d+\s*$/.test(col)) return col.split(",").map(Number);
    _colCtx.clearRect(0, 0, 1, 1);
    _colCtx.fillStyle = "#000";
    _colCtx.fillStyle = col;
    _colCtx.fillRect(0, 0, 1, 1);
    return Array.from(_colCtx.getImageData(0, 0, 1, 1).data.slice(0, 3));
}
const mixRGB = (a, b, f) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f];

/* Farbverlauf als Tabelle (n Einträge, r,g,b hintereinander); cyclic = Ende läuft zurück zum Anfang */
function buildPalette(colors, n, cyclic, gain = 1) {
    const stops = colors.map(colRGB);
    if (cyclic) stops.push(stops[0]);
    const pal = new Uint8ClampedArray(n * 3);
    for (let i = 0; i < n; i++) {
        const pos = i / (n - (cyclic ? 0 : 1)) * (stops.length - 1);
        const k = Math.min(Math.floor(pos), stops.length - 2), f = pos - k;
        const c = mixRGB(stops[k], stops[k + 1], f);
        pal[i * 3] = c[0] * gain; pal[i * 3 + 1] = c[1] * gain; pal[i * 3 + 2] = c[2] * gain;
    }
    return pal;
}

function makeCanvas(w, h) {
    const cv = document.createElement("canvas");
    cv.width = w; cv.height = h;
    return cv;
}

/* Low-Res-Puffer, der mit dem Hauptcanvas mitwächst (für Pixel-Effekte) */
function lowRes(res) {
    const cv = makeCanvas(1, 1), x = cv.getContext("2d");
    let img = null;
    return {
        cv, x,
        fit(w, h) {
            const ow = Math.max(8, Math.ceil(w * res)), oh = Math.max(8, Math.ceil(h * res));
            if (cv.width !== ow || cv.height !== oh || !img) { cv.width = ow; cv.height = oh; img = x.createImageData(ow, oh); }
            return img;
        },
        blit(ctx, w, h, img) {
            x.putImageData(img, 0, 0);
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = "high";
            ctx.drawImage(cv, 0, 0, w, h);
        }
    };
}

function skyGradient(ctx, w, h, colors, diagonal) {
    const g = diagonal ? ctx.createLinearGradient(0, 0, w, h) : ctx.createLinearGradient(0, 0, 0, h);
    colors.forEach((col, i) => g.addColorStop(colors.length > 1 ? i / (colors.length - 1) : 0, col));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
}

const BD_EFFECTS = {

    /* --- Sternenhimmel (Synthwave) --- */
    starfield(env, p) {
        p = Object.assign({ count: 500, maxSize: 2.5, speed: [0.2, 0.7], fade: "rgba(0,0,0,0.25)",
            colors: ["255,255,255"] }, p);
        const { canvas: c, ctx } = env;
        const stars = Array.from({ length: p.count }, () => ({
            x: Math.random() * c.width, y: Math.random() * c.height,
            size: Math.random() * p.maxSize, speed: rand(p.speed[0], p.speed[1]),
            color: pick(p.colors), tw: rand(0.01, 0.04), off: Math.random() * Math.PI * 2
        }));
        return {
            frame(now) {
                ctx.fillStyle = p.fade;
                ctx.fillRect(0, 0, c.width, c.height);
                for (const s of stars) {
                    s.y += s.speed;
                    if (s.y > c.height) { s.y = 0; s.x = Math.random() * c.width; }
                    const twinkle = Math.sin(now * s.tw + s.off) * 0.4 + 0.6;
                    ctx.fillStyle = `rgba(${s.color},${twinkle})`;
                    ctx.beginPath();
                    ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        };
    },

    /* --- Partikel-Netzwerk (Darktech) --- */
    network(env, p) {
        p = Object.assign({ count: 150, speed: 0.8, linkDistance: 120, hues: [145, 180],
            fade: "rgba(5,7,10,0.4)" }, p);
        const { canvas: c, ctx } = env;
        const pts = Array.from({ length: p.count }, () => ({
            x: Math.random() * c.width, y: Math.random() * c.height,
            vx: (Math.random() - 0.5) * p.speed, vy: (Math.random() - 0.5) * p.speed,
            size: rand(1.5, 3.5), hue: pick(p.hues),
            tw: rand(0.005, 0.025), off: Math.random() * Math.PI * 2
        }));
        const D = p.linkDistance;
        return {
            frame(now) {
                ctx.fillStyle = p.fade;
                ctx.fillRect(0, 0, c.width, c.height);
                for (const q of pts) {
                    q.x += q.vx; q.y += q.vy;
                    if (q.x < 0 || q.x > c.width) q.vx *= -1;
                    if (q.y < 0 || q.y > c.height) q.vy *= -1;
                }
                ctx.lineWidth = 0.8;
                for (let i = 0; i < pts.length; i++) {
                    for (let j = i + 1; j < pts.length; j++) {
                        const a = pts[i], b = pts[j];
                        const dist = Math.hypot(a.x - b.x, a.y - b.y);
                        if (dist < D) {
                            ctx.strokeStyle = `hsla(${a.hue},90%,65%,${(1 - dist / D) * 0.4})`;
                            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
                        }
                    }
                }
                for (const q of pts) {
                    ctx.fillStyle = `hsla(${q.hue},90%,65%,${Math.sin(now * q.tw + q.off) * 0.3 + 0.7})`;
                    ctx.beginPath(); ctx.arc(q.x, q.y, q.size, 0, Math.PI * 2); ctx.fill();
                }
            }
        };
    },

    /* --- 3D-Sterntunnel (Holo) --- */
    tunnel(env, p) {
        p = Object.assign({ count: 900, speed: 5, fade: "rgba(0,0,0,0.3)",
            colors: ["#00fff0", "#a066ff", "#ffffff"] }, p);
        const { canvas: c, ctx } = env;
        const spawn = s => {
            s.x = (Math.random() - 0.5) * c.width;
            s.y = (Math.random() - 0.5) * c.height;
            return s;
        };
        const stars = Array.from({ length: p.count }, () => {
            const z = Math.random() * c.width;
            return spawn({ z, pz: z, color: pick(p.colors), tw: rand(0.005, 0.025), off: Math.random() * Math.PI * 2 });
        });
        return {
            frame(now) {
                const W = c.width, H = c.height;
                ctx.fillStyle = p.fade;
                ctx.fillRect(0, 0, W, H);
                for (const s of stars) {
                    s.pz = s.z;
                    s.z -= p.speed;
                    if (s.z <= 1) { spawn(s); s.z = s.pz = W; }
                    const k = 960 / s.z, pk = 960 / s.pz;
                    const px = s.x * k + W / 2, py = s.y * k + H / 2;
                    if (px < 0 || px > W || py < 0 || py > H) continue;
                    const size = (1 - s.z / W) * 3 + 0.5;
                    ctx.strokeStyle = ctx.fillStyle = s.color;
                    ctx.globalAlpha = 0.4 + (Math.sin(now * s.tw + s.off) * 0.5 + 0.5) * 0.6;
                    ctx.beginPath();
                    ctx.moveTo(s.x * pk + W / 2, s.y * pk + H / 2);
                    ctx.lineTo(px, py);
                    ctx.lineWidth = size * 0.4;
                    ctx.stroke();
                    ctx.beginPath(); ctx.arc(px, py, size, 0, Math.PI * 2); ctx.fill();
                }
                ctx.globalAlpha = 1;
            }
        };
    },

    /* --- Schwebende Emoji-Sprites (Kawaii) --- */
    sprites(env, p) {
        p = Object.assign({ count: 60, speed: [0.3, 1.0], sprites: [["⭐", 22]] }, p);
        const { canvas: c, ctx } = env;
        const parts = Array.from({ length: p.count }, () => ({
            x: Math.random() * c.width, y: Math.random() * c.height,
            speed: rand(p.speed[0], p.speed[1]), sprite: pick(p.sprites),
            opacity: rand(0.6, 1)
        }));
        return {
            frame() {
                ctx.clearRect(0, 0, c.width, c.height);
                for (const q of parts) {
                    const [emoji, size] = q.sprite;
                    ctx.globalAlpha = q.opacity;
                    ctx.font = `${size}px "Comic Sans MS"`;
                    ctx.fillText(emoji, q.x, q.y);
                    q.y -= q.speed;
                    if (q.y < -30) { q.y = c.height + 30; q.x = Math.random() * c.width; }
                }
                ctx.globalAlpha = 1;
            }
        };
    },

    /* --- Regen / Mond / Staub (Sad Mood) --- */
    rain(env, p) {
        p = Object.assign({ rainMin: 70, rainMax: 150, dustCount: 85,
            rainColor: "164,176,212", dustColor: "174,171,205",
            sky: ["rgba(5,7,18,0.98)", "rgba(8,10,24,0.97)", "rgba(11,7,18,0.99)"],
            moon: { x: 0.5, y: 0.17, size: 0.075 } }, p);
        const { canvas: c, ctx } = env;
        const rainCount = Math.min(p.rainMax, Math.max(p.rainMin, Math.floor(c.width / 11)));
        const rain = Array.from({ length: rainCount }, () => ({
            x: Math.random() * c.width, y: Math.random() * c.height,
            length: rand(7, 25), speed: rand(2.5, 6.5), alpha: rand(0.035, 0.125), drift: rand(-0.38, -0.18)
        }));
        const dust = Array.from({ length: p.dustCount }, () => ({
            x: Math.random() * c.width, y: Math.random() * c.height,
            size: rand(0.4, 1.5), speed: rand(0.05, 0.23), phase: Math.random() * Math.PI * 2, alpha: rand(0.06, 0.22)
        }));
        return {
            frame(now) {
                const w = c.width, h = c.height;
                ctx.clearRect(0, 0, w, h);

                const sky = ctx.createLinearGradient(0, 0, 0, h);
                p.sky.forEach((col, i) => sky.addColorStop(i / (p.sky.length - 1), col));
                ctx.fillStyle = sky;
                ctx.fillRect(0, 0, w, h);

                const mx = w * p.moon.x, my = h * p.moon.y, mr = Math.min(w, h) * p.moon.size;
                const glow = ctx.createRadialGradient(mx, my, 1, mx, my, mr * 4.8);
                glow.addColorStop(0, "rgba(205,211,238,0.20)");
                glow.addColorStop(0.25, "rgba(155,166,207,0.09)");
                glow.addColorStop(1, "rgba(90,90,130,0)");
                ctx.fillStyle = glow;
                ctx.fillRect(0, 0, w, h);

                const moon = ctx.createRadialGradient(mx - mr * 0.25, my - mr * 0.25, mr * 0.12, mx, my, mr);
                moon.addColorStop(0, "rgba(245,244,238,0.60)");
                moon.addColorStop(0.65, "rgba(205,209,225,0.30)");
                moon.addColorStop(1, "rgba(145,151,181,0.05)");
                ctx.fillStyle = moon;
                ctx.beginPath(); ctx.arc(mx, my, mr, 0, Math.PI * 2); ctx.fill();

                for (const d of dust) {
                    d.y -= d.speed;
                    if (d.y < -5) { d.y = h + 5; d.x = Math.random() * w; }
                    ctx.fillStyle = `rgba(${p.dustColor},${d.alpha * (0.55 + Math.sin(now * 0.0007 + d.phase) * 0.35)})`;
                    ctx.beginPath(); ctx.arc(d.x, d.y, d.size, 0, Math.PI * 2); ctx.fill();
                }

                ctx.lineWidth = 0.7;
                for (const r of rain) {
                    r.y += r.speed; r.x += r.drift;
                    if (r.y > h + r.length) { r.y = -r.length; r.x = Math.random() * w; }
                    if (r.x < -20) r.x = w + 20;
                    ctx.strokeStyle = `rgba(${p.rainColor},${r.alpha})`;
                    ctx.beginPath(); ctx.moveTo(r.x, r.y); ctx.lineTo(r.x + r.drift * 3, r.y + r.length); ctx.stroke();
                }

                const v = ctx.createRadialGradient(w / 2, h * 0.28, Math.min(w, h) * 0.12, w / 2, h * 0.45, Math.max(w, h) * 0.72);
                v.addColorStop(0, "rgba(0,0,0,0)");
                v.addColorStop(0.72, "rgba(0,0,0,0.10)");
                v.addColorStop(1, "rgba(0,0,0,0.64)");
                ctx.fillStyle = v;
                ctx.fillRect(0, 0, w, h);
            }
        };
    },

    /* --- Comicbuch / Halftone / Bursts (Happy Chaos) --- */
    comic(env, p) {
        p = Object.assign({ burstCount: 18, wordCount: 9,
            sky: ["#66ddff", "#9b83ff", "#ff66c6"],
            burstColors: ["#ff4bb7", "#ffe34d", "#66e8ff", "#7ee36d", "#9a7cff"],
            wordColors: ["#171225", "#ff3fae", "#ffe34d", "#0d9fc4"],
            words: ["LOL", "ZAP!", "BOOM"] }, p);
        const { canvas: c, ctx } = env;
        const bursts = Array.from({ length: p.burstCount }, (_, i) => ({
            x: Math.random() * c.width, y: Math.random() * c.height * 0.78,
            r: rand(18, 73), rot: Math.random() * Math.PI, speed: (Math.random() - 0.5) * 0.004,
            color: p.burstColors[i % p.burstColors.length]
        }));
        const bubbles = Array.from({ length: p.wordCount }, (_, i) => ({
            x: Math.random() * c.width, y: 70 + Math.random() * c.height * 0.48,
            text: pick(p.words), scale: rand(0.65, 1.4), rot: (Math.random() - 0.5) * 0.28,
            phase: Math.random() * Math.PI * 2, color: p.wordColors[i % p.wordColors.length]
        }));
        return {
            frame(now) {
                const w = c.width, h = c.height, m = Math.min(w, h);
                ctx.clearRect(0, 0, w, h);

                const bg = ctx.createLinearGradient(0, 0, w, h);
                p.sky.forEach((col, i) => bg.addColorStop(i / (p.sky.length - 1), col));
                ctx.fillStyle = bg;
                ctx.fillRect(0, 0, w, h);

                const sx = w * 0.5, sy = h * 0.22, sr = m * 0.17;
                const sun = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr);
                sun.addColorStop(0, "rgba(255,240,72,0.72)");
                sun.addColorStop(0.45, "rgba(255,222,64,0.34)");
                sun.addColorStop(1, "rgba(255,222,64,0)");
                ctx.fillStyle = sun;
                ctx.fillRect(0, 0, w, h);

                ctx.fillStyle = "rgba(23,18,37,0.10)";
                const step = Math.max(12, Math.floor(m / 42));
                const offset = (now * 0.002) % step;
                for (let y = -step; y < h; y += step) {
                    for (let x = -step; x < w; x += step) {
                        ctx.beginPath(); ctx.arc(x + offset, y, 1.4, 0, Math.PI * 2); ctx.fill();
                    }
                }

                ctx.save();
                ctx.translate(sx, sy);
                ctx.strokeStyle = "rgba(255,255,255,0.24)";
                ctx.lineWidth = 2;
                for (let i = 0; i < 34; i++) {
                    const a = (i / 34) * Math.PI * 2 + now * 0.00003;
                    ctx.beginPath();
                    ctx.moveTo(Math.cos(a) * m * 0.16, Math.sin(a) * m * 0.16);
                    ctx.lineTo(Math.cos(a) * m * 0.60, Math.sin(a) * m * 0.60);
                    ctx.stroke();
                }
                ctx.restore();

                for (const b of bursts) {
                    b.rot += b.speed;
                    const pulse = 1 + Math.sin(now * 0.0012 + b.x) * 0.05;
                    ctx.save();
                    ctx.translate(b.x, b.y); ctx.rotate(b.rot); ctx.scale(pulse, pulse);
                    ctx.strokeStyle = "#171225"; ctx.lineWidth = 5; ctx.fillStyle = b.color;
                    ctx.beginPath();
                    for (let i = 0; i < 28; i++) {
                        const a = (i / 28) * Math.PI * 2;
                        const rr = i % 2 === 0 ? b.r : b.r * 0.45;
                        i === 0 ? ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr) : ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
                    }
                    ctx.closePath(); ctx.fill(); ctx.stroke();
                    ctx.restore();
                }

                for (const b of bubbles) {
                    ctx.save();
                    ctx.translate(b.x, b.y + Math.sin(now * 0.001 + b.phase) * 5);
                    ctx.rotate(b.rot); ctx.scale(b.scale, b.scale);
                    ctx.font = "900 26px 'Comic Sans MS', 'Nunito', sans-serif";
                    ctx.textAlign = "center"; ctx.textBaseline = "middle";
                    ctx.lineWidth = 7; ctx.strokeStyle = "#fff";
                    ctx.strokeText(b.text, 0, 0);
                    ctx.fillStyle = b.color;
                    ctx.fillText(b.text, 0, 0);
                    ctx.restore();
                }

                ctx.strokeStyle = "rgba(23,18,37,0.48)";
                ctx.lineWidth = Math.max(5, m * 0.007);
                ctx.strokeRect(ctx.lineWidth * 1.5, ctx.lineWidth * 1.5, w - ctx.lineWidth * 3, h - ctx.lineWidth * 3);

                const v = ctx.createRadialGradient(w / 2, h / 2, m * 0.18, w / 2, h / 2, Math.max(w, h) * 0.76);
                v.addColorStop(0, "rgba(255,255,255,0)");
                v.addColorStop(1, "rgba(23,18,37,0.18)");
                ctx.fillStyle = v;
                ctx.fillRect(0, 0, w, h);
            }
        };
    },

    /* --- CRT-Sync-Glitch (Amber) – bewegt die Player-Box, kein Canvas --- */
    crt(env, p) {
        p = Object.assign({ glitchRange: 180, glitchStrength: 8 }, p);
        const box = env.playerBox;
        return {
            frame(now) {
                const linePos = ((now * 0.1) % (window.innerHeight + 400)) - 300;
                document.documentElement.style.setProperty("--crt-line", `${linePos}px`);
                const rect = box.getBoundingClientRect();
                const distance = Math.abs(rect.top + rect.height / 2 - linePos);
                if (distance < p.glitchRange) {
                    const offset = (Math.random() - 0.5) * p.glitchStrength * ((p.glitchRange - distance) / p.glitchRange);
                    box.style.transform = `translate(calc(-50% + ${offset / 3}px), 0) perspective(900px) rotateX(2deg)`;
                } else {
                    box.style.transform = `translateX(-50%) perspective(900px) rotateX(2deg)`;
                }
            },
            destroy() { box.style.transform = ""; }
        };
    },

    /* --- Digitaler Zeichen-Regen (Matrix-Stil) --- */
    matrix(env, p) {
        p = Object.assign({ fontSize: 16, speed: 1, color: "#00ff66", headColor: "#e6ffef", bg: "#000000",
            fade: 0.08, reset: 0.975, chars: "" }, p);
        const { canvas: c, ctx } = env;
        // Standard: Katakana (U+30A1..U+30F6) + Ziffern/Hex – per Code erzeugt, damit die Datei-Kodierung egal ist
        const chars = p.chars ? Array.from(p.chars)
            : Array.from({ length: 86 }, (_, i) => String.fromCharCode(0x30A1 + i)).concat(Array.from("0123456789ABCDEF"));
        const bg = colRGB(p.bg);
        let drops = [], last = 0;
        return {
            frame(now) {
                const fs = p.fontSize, n = Math.ceil(c.width / fs);
                if (drops.length !== n)
                    drops = Array.from({ length: n }, (_, i) => drops[i] ?? Math.floor(rand(-0.6, 1) * c.height / fs));
                if (now - last < 50 / p.speed) return;
                last = now;
                ctx.fillStyle = `rgba(${bg},${p.fade})`;
                ctx.fillRect(0, 0, c.width, c.height);
                ctx.font = `${fs}px "MS Gothic", "Consolas", monospace`;
                ctx.textBaseline = "top";
                for (let i = 0; i < n; i++) {
                    const x = i * fs, y = drops[i] * fs;
                    if (y >= 0) {
                        ctx.fillStyle = p.bg;                      // alten Kopf durch Spurfarbe ersetzen
                        ctx.fillRect(x, y - fs, fs, fs);
                        ctx.fillStyle = p.color;
                        ctx.fillText(pick(chars), x, y - fs);
                        ctx.fillStyle = p.headColor;
                        ctx.fillText(pick(chars), x, y);
                    }
                    if (y > c.height && Math.random() > p.reset) drops[i] = 0;
                    drops[i]++;
                }
            }
        };
    },

    /* --- Polarlicht mit Sternenhimmel --- */
    aurora(env, p) {
        p = Object.assign({ bands: 4, colors: ["#00ffa3", "#00c8ff", "#8a5cff", "#ff4fd8"], speed: 1,
            height: 0.45, intensity: 0.55, stars: 180, sky: ["#01020a", "#051230", "#0b0820"] }, p);
        const { canvas: c, ctx } = env;
        const off = makeCanvas(1, 1), o = off.getContext("2d");
        // je Farbe ein 1px breiter Vorhang-Streifen (oben hell, nach unten auslaufend)
        const strips = p.colors.map(col => {
            const rgb = colRGB(col), s = makeCanvas(1, 128), x = s.getContext("2d");
            const g = x.createLinearGradient(0, 0, 0, 128);
            g.addColorStop(0, `rgba(${rgb},0)`);
            g.addColorStop(0.12, `rgba(${rgb},1)`);
            g.addColorStop(0.4, `rgba(${rgb},0.45)`);
            g.addColorStop(1, `rgba(${rgb},0)`);
            x.fillStyle = g; x.fillRect(0, 0, 1, 128);
            return s;
        });
        const stars = Array.from({ length: p.stars }, () => ({
            x: Math.random(), y: Math.random() * 0.85, s: rand(0.4, 1.6), tw: rand(0.001, 0.004), off: Math.random() * 6.28
        }));
        return {
            frame(now) {
                const w = c.width, h = c.height, t = now * 0.001 * p.speed;
                skyGradient(ctx, w, h, p.sky);
                ctx.fillStyle = "#fff";
                for (const s of stars) {
                    ctx.globalAlpha = 0.35 + 0.65 * (Math.sin(now * s.tw + s.off) * 0.5 + 0.5);
                    ctx.fillRect(s.x * w, s.y * h, s.s, s.s);
                }
                ctx.globalAlpha = 1;

                const ow = Math.max(8, Math.ceil(w / 4)), oh = Math.max(8, Math.ceil(h / 4));
                if (off.width !== ow || off.height !== oh) { off.width = ow; off.height = oh; }
                o.clearRect(0, 0, ow, oh);
                o.globalCompositeOperation = "lighter";
                for (let b = 0; b < p.bands; b++) {
                    const strip = strips[b % strips.length], base = oh * (0.1 + b * 0.07);
                    for (let x = 0; x < ow; x += 2) {
                        const nx = x / ow;
                        const top = base + Math.sin(nx * 5 + t * 0.5 + b * 1.7) * oh * 0.07
                                         + Math.sin(nx * 13 - t * 0.8 + b) * oh * 0.025;
                        const len = oh * p.height * (0.55 + 0.45 * Math.sin(nx * 7 + t * 0.6 + b * 2.3));
                        const ray = 0.5 + 0.5 * Math.sin(nx * 40 + t * 1.7 + b * 5) * Math.sin(nx * 9 - t * 0.4);
                        o.globalAlpha = p.intensity * ray * ray * (0.35 + 0.65 * Math.sin(Math.PI * nx));
                        o.drawImage(strip, x, top, 2, len);
                    }
                }
                o.globalAlpha = 1;
                ctx.save();
                ctx.globalCompositeOperation = "lighter";
                ctx.imageSmoothingQuality = "high";
                ctx.drawImage(off, 0, 0, w, h);
                ctx.restore();
            }
        };
    },

    /* --- Demoszene-Plasma --- */
    plasma(env, p) {
        p = Object.assign({ colors: ["#1a0033", "#ff0080", "#ff9900", "#00e5ff", "#3d00b8"],
            scale: 6, speed: 1, resolution: 0.15, brightness: 0.65 }, p);
        const { canvas: c, ctx } = env;
        const pal = buildPalette(p.colors, 256, true, p.brightness);
        const buf = lowRes(p.resolution);
        return {
            frame(now) {
                const w = c.width, h = c.height, t = now * 0.001 * p.speed;
                const img = buf.fit(w, h), d = img.data, ow = img.width, oh = img.height;
                const k = p.scale / ow;
                const cx = p.scale * 0.5 * (1 + Math.sin(t * 0.37));
                const cy = p.scale * (oh / ow) * 0.5 * (1 + Math.cos(t * 0.29));
                const shift = t * 25;
                if (!this.sx || this.sx.length !== ow) this.sx = new Float32Array(ow);
                const sx = this.sx;
                for (let x = 0; x < ow; x++) sx[x] = Math.sin(x * k * 2 + t);
                let i = 0;
                for (let y = 0; y < oh; y++) {
                    const ny = y * k, sy = Math.sin(ny * 2.3 - t * 0.8), dy2 = (ny - cy) ** 2;
                    for (let x = 0; x < ow; x++, i += 4) {
                        const nx = x * k;
                        const v = sx[x] + sy + Math.sin((nx + ny) * 1.4 + t * 1.2)
                                + Math.sin(Math.sqrt((nx - cx) ** 2 + dy2) * 2.6 - t * 1.5);
                        const idx = (((v + 4) * 48 + shift) | 0) & 255;
                        d[i] = pal[idx * 3]; d[i + 1] = pal[idx * 3 + 1]; d[i + 2] = pal[idx * 3 + 2]; d[i + 3] = 255;
                    }
                }
                buf.blit(ctx, w, h, img);
            }
        };
    },

    /* --- Weiche Bokeh-Lichter --- */
    bokeh(env, p) {
        p = Object.assign({ count: 45, minSize: 20, maxSize: 110, speed: 0.25,
            colors: ["#ff3d7f", "#ffb84d", "#4dd6ff", "#b86bff", "#5dffb0"], alpha: [0.08, 0.35],
            sky: ["#07040f", "#160a2a", "#0a0a1e"] }, p);
        const { canvas: c, ctx } = env;
        const sprites = p.colors.map(col => {
            const rgb = colRGB(col), s = makeCanvas(128, 128), x = s.getContext("2d");
            const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
            g.addColorStop(0, `rgba(${rgb},0.85)`);
            g.addColorStop(0.55, `rgba(${rgb},0.5)`);
            g.addColorStop(0.82, `rgba(${rgb},0.35)`);
            g.addColorStop(0.92, `rgba(${rgb},0.55)`);     // leichter Rand wie bei echtem Bokeh
            g.addColorStop(1, `rgba(${rgb},0)`);
            x.fillStyle = g; x.fillRect(0, 0, 128, 128);
            return s;
        });
        const parts = Array.from({ length: p.count }, () => {
            const r = rand(p.minSize, p.maxSize), slow = 1 - (r / p.maxSize) * 0.6;
            return { x: Math.random() * c.width, y: Math.random() * c.height, r,
                vx: rand(-1, 1) * p.speed * slow, vy: rand(-1, 0.3) * p.speed * slow,
                a: rand(p.alpha[0], p.alpha[1]), ph: Math.random() * 6.28, sp: pick(sprites) };
        });
        return {
            frame(now) {
                const w = c.width, h = c.height;
                skyGradient(ctx, w, h, p.sky, true);
                ctx.globalCompositeOperation = "lighter";
                for (const q of parts) {
                    q.x += q.vx; q.y += q.vy;
                    if (q.x < -q.r) q.x = w + q.r; else if (q.x > w + q.r) q.x = -q.r;
                    if (q.y < -q.r) q.y = h + q.r; else if (q.y > h + q.r) q.y = -q.r;
                    ctx.globalAlpha = q.a * (0.6 + 0.4 * Math.sin(now * 0.0008 + q.ph));
                    ctx.drawImage(q.sp, q.x - q.r, q.y - q.r, q.r * 2, q.r * 2);
                }
                ctx.globalAlpha = 1;
                ctx.globalCompositeOperation = "source-over";
            }
        };
    },

    /* --- Lavalampe (Metaballs) --- */
    lava(env, p) {
        p = Object.assign({ count: 7, size: 0.11, speed: 1, colors: ["#ffde3b", "#ff2d55"],
            bg: ["#14001f", "#3b0030"], glow: 0.5, resolution: 0.2 }, p);
        const { canvas: c, ctx } = env;
        const top = colRGB(p.colors[0]), bot = colRGB(p.colors[p.colors.length - 1]);
        const bgT = colRGB(p.bg[0]), bgB = colRGB(p.bg[p.bg.length - 1]);
        const buf = lowRes(p.resolution);
        const blobs = Array.from({ length: p.count }, () => ({
            x: rand(0.15, 0.85), ph: rand(0, 6.28), sp: rand(0.6, 1.4), r: rand(0.7, 1.3), dr: rand(0, 6.28)
        }));
        const bx = new Float32Array(p.count), by = new Float32Array(p.count), br = new Float32Array(p.count);
        return {
            frame(now) {
                const w = c.width, h = c.height, t = now * 0.001 * p.speed;
                const img = buf.fit(w, h), d = img.data, ow = img.width, oh = img.height, m = Math.min(ow, oh);
                blobs.forEach((b, n) => {
                    bx[n] = (b.x + 0.08 * Math.sin(t * 0.3 * b.sp + b.dr)) * ow;
                    by[n] = (0.5 + 0.42 * Math.sin(t * 0.25 * b.sp + b.ph)) * oh;
                    br[n] = (p.size * m * b.r) ** 2;
                });
                let i = 0;
                for (let y = 0; y < oh; y++) {
                    const fy = y / oh, bgc = mixRGB(bgT, bgB, fy), col = mixRGB(top, bot, fy);
                    for (let x = 0; x < ow; x++, i += 4) {
                        let f = 0;
                        for (let n = 0; n < p.count; n++) {
                            const dx = x - bx[n], dy = y - by[n];
                            f += br[n] / (dx * dx + dy * dy + 1);
                        }
                        // außen: Hintergrund + Glühen, innen: Blasenfarbe; weicher Übergang um f = 1
                        const e = f > 0.45 ? p.glow * Math.min(1, (f - 0.45) / 0.55) ** 2 : 0;
                        const s = Math.min(1.15, 0.8 + Math.max(0, f - 1) * 0.12);
                        let a = (f - 0.95) / 0.1;
                        a = a <= 0 ? 0 : a >= 1 ? 1 : a * a * (3 - 2 * a);
                        for (let ch = 0; ch < 3; ch++) {
                            const out = bgc[ch] + (col[ch] - bgc[ch]) * e;
                            d[i + ch] = out + (col[ch] * s - out) * a;
                        }
                        d[i + 3] = 255;
                    }
                }
                buf.blit(ctx, w, h, img);
            }
        };
    },

    /* --- Leuchtende Oszilloskop-Wellen --- */
    waves(env, p) {
        p = Object.assign({ lines: 7, colors: ["#00f0ff", "#ff00e6", "#7a5cff"], amplitude: 0.14, frequency: 1,
            speed: 1, thickness: 2, glow: 18, y: 0.55, fade: "rgba(3,2,12,0.3)" }, p);
        const { canvas: c, ctx } = env;
        return {
            frame(now) {
                const w = c.width, h = c.height, t = now * 0.001 * p.speed, f = p.frequency;
                ctx.fillStyle = p.fade;
                ctx.fillRect(0, 0, w, h);
                ctx.save();
                ctx.globalCompositeOperation = "lighter";
                ctx.lineWidth = p.thickness;
                ctx.shadowBlur = p.glow;
                for (let i = 0; i < p.lines; i++) {
                    const col = p.colors[i % p.colors.length], ph = i * 0.55;
                    ctx.strokeStyle = ctx.shadowColor = col;
                    ctx.globalAlpha = 0.35 + 0.65 * (1 - i / p.lines);
                    ctx.beginPath();
                    for (let x = 0; x <= w + 6; x += 6) {
                        const nx = x / w, fadeEdge = 0.2 + 0.8 * Math.pow(Math.sin(Math.PI * Math.min(1, nx)), 1.5);
                        const y = h * p.y + (i - (p.lines - 1) / 2) * h * 0.012 + h * p.amplitude * fadeEdge * (
                            Math.sin(nx * 6 * f + t * 1.1 + ph) * 0.6 +
                            Math.sin(nx * 13 * f - t * 1.7 + ph * 1.7) * 0.3 +
                            Math.sin(nx * 2.5 * f + t * 0.4 + ph * 0.5) * 0.4);
                        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
                    }
                    ctx.stroke();
                }
                ctx.restore();
            }
        };
    },

    /* --- Nächtliche Neon-Stadt im Regen (Neon-Noir) --- */
    neoncity(env, p) {
        p = Object.assign({ sky: ["#04010c", "#14052a", "#36093d"], neon: ["#ff2bd6", "#00e5ff", "#ff3860", "#b86bff"],
            windowColor: "255,196,120", layers: 3, signs: 0.3, rain: 240, rainColor: "160,185,255", glow: "255,43,214" }, p);
        const { canvas: c, ctx } = env;
        let city = null, cw = 0, ch = 0;
        const build = (w, h) => Array.from({ length: p.layers }, (_, l) => {
            const depth = (l + 1) / p.layers, bld = [];
            for (let x = -20; x < w + 20;) {
                const bw = rand(40, 120) * (0.6 + depth * 0.6);
                const bh = h * rand(0.18, 0.55) * (1.15 - depth * 0.45);
                const wins = [];
                for (let wy = 12; wy < bh - 10; wy += 14)
                    for (let wx = 8; wx < bw - 10; wx += 12)
                        if (Math.random() < 0.33) wins.push({ x: wx, y: wy, ph: rand(0, 6.28), sp: rand(0.0002, 0.001), bad: Math.random() < 0.04 });
                const sign = depth === 1 && Math.random() < p.signs
                    ? { col: pick(p.neon), y: rand(0.08, 0.4), len: rand(0.15, 0.35), ph: rand(0, 100) } : null;
                bld.push({ x, w: bw, h: bh, wins, sign });
                x += bw + rand(2, 14);
            }
            return { depth, bld };
        });
        const drops = Array.from({ length: p.rain }, () => ({ x: Math.random(), y: Math.random(), len: rand(10, 30), sp: rand(0.008, 0.016), a: rand(0.06, 0.28) }));
        return {
            frame(now) {
                const w = c.width, h = c.height;
                if (!city || cw !== w || ch !== h) { city = build(w, h); cw = w; ch = h; }
                skyGradient(ctx, w, h, p.sky);
                const g = ctx.createRadialGradient(w / 2, h, 0, w / 2, h, Math.max(w, h) * 0.7);
                g.addColorStop(0, `rgba(${p.glow},0.22)`);
                g.addColorStop(1, `rgba(${p.glow},0)`);
                ctx.fillStyle = g;
                ctx.fillRect(0, 0, w, h);

                for (const L of city) {
                    const s = Math.round(6 + L.depth * 10);
                    for (const b of L.bld) {
                        const top = h - b.h;
                        ctx.fillStyle = `rgb(${s},${s - 2},${s + 14})`;
                        ctx.fillRect(b.x, top, b.w, b.h);
                        for (const q of b.wins) {
                            let a = 0.2 + 0.55 * (Math.sin(now * q.sp + q.ph) * 0.5 + 0.5);
                            if (q.bad && Math.random() < 0.15) a = 0.03;          // kaputte Leuchtstoffröhre
                            ctx.fillStyle = `rgba(${p.windowColor},${a * L.depth})`;
                            ctx.fillRect(b.x + q.x, top + q.y, 5, 7);
                        }
                        if (b.sign) {
                            const t = (now * 0.001 + b.sign.ph) % 6;
                            const on = !(t < 0.35 && Math.random() < 0.6);         // ab und zu Aussetzer
                            if (!on) continue;
                            ctx.save();
                            ctx.shadowBlur = 22; ctx.shadowColor = b.sign.col;
                            ctx.fillStyle = b.sign.col;
                            ctx.fillRect(b.x + b.w / 2 - 4, top + b.h * b.sign.y, 8, b.h * b.sign.len);
                            ctx.restore();
                        }
                    }
                }

                ctx.lineWidth = 1;
                for (const r of drops) {
                    r.y += r.sp; r.x -= r.sp * 0.12;
                    if (r.y > 1.05) { r.y = -0.05; r.x = Math.random() * 1.1; }
                    const x = r.x * w, y = r.y * h;
                    ctx.strokeStyle = `rgba(${p.rainColor},${r.a})`;
                    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - r.len * 0.12, y + r.len); ctx.stroke();
                }
            }
        };
    },

    /* --- Drehende Messing-Zahnräder + Dampf (Steampunk) --- */
    gears(env, p) {
        p = Object.assign({ count: 10, colors: ["#b5893b", "#8a5a2b", "#c9a45c", "#6e4a26"], speed: 1, alpha: 0.5,
            idleSpeed: 0.15, sky: ["#1c110a", "#2b1a0e", "#100804"], steam: 26 }, p);
        const { canvas: c, ctx } = env;
        const T = Math.PI * 2, REF = 1000;      // Sprites in Referenzgröße, beim Zeichnen skaliert
        const sprite = (r, teeth, col) => {
            const m = Math.ceil(r) + 2, s = makeCanvas(m * 2, m * 2), x = s.getContext("2d");
            const rgb = colRGB(col), step = T / teeth, inner = r * 0.82;
            const shade = f => `rgb(${mixRGB(rgb, f > 0 ? [255, 240, 200] : [0, 0, 0], Math.abs(f)).map(Math.round)})`;
            x.translate(m, m);
            x.beginPath();
            for (let i = 0; i < teeth; i++) {
                const a = i * step, pt = (an, rad) => x.lineTo(Math.cos(an) * rad, Math.sin(an) * rad);
                pt(a, inner); pt(a + step * 0.12, r); pt(a + step * 0.42, r); pt(a + step * 0.54, inner);
            }
            x.closePath();
            const g = x.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
            g.addColorStop(0, shade(0.35));
            g.addColorStop(1, shade(-0.45));
            x.fillStyle = g; x.fill();
            x.lineWidth = Math.max(1, r * 0.025); x.strokeStyle = "rgba(0,0,0,0.55)"; x.stroke();
            x.globalCompositeOperation = "destination-out";             // Speichen-Fenster ausschneiden
            const spokes = r > 120 ? 6 : 4;
            for (let i = 0; i < spokes; i++) {
                const a0 = i / spokes * T + 0.2, a1 = (i + 1) / spokes * T - 0.2;
                x.beginPath(); x.arc(0, 0, r * 0.64, a0, a1); x.arc(0, 0, r * 0.3, a1, a0, true); x.closePath(); x.fill();
            }
            x.globalCompositeOperation = "source-over";
            x.beginPath(); x.arc(0, 0, r * 0.16, 0, T); x.fillStyle = shade(-0.25); x.fill(); x.stroke();
            x.beginPath(); x.arc(0, 0, r * 0.06, 0, T); x.fillStyle = "#120a05"; x.fill();
            return s;
        };
        const gears = Array.from({ length: p.count }, (_, i) => {
            const r = rand(0.05, 0.22) * REF;
            return { x: rand(-0.05, 1.05), y: rand(-0.05, 1.05), r, a: rand(0, T), dir: Math.random() < 0.5 ? -1 : 1,
                sp: rand(0.6, 1.2) * 40 / r, img: sprite(r, Math.max(8, Math.round(r / 9)), p.colors[i % p.colors.length]) };
        }).sort((a, b) => b.r - a.r);
        const puffSprite = (() => {
            const s = makeCanvas(64, 64), x = s.getContext("2d"), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
            g.addColorStop(0, "rgba(235,225,210,0.55)"); g.addColorStop(1, "rgba(235,225,210,0)");
            x.fillStyle = g; x.fillRect(0, 0, 64, 64);
            return s;
        })();
        const puff = q => Object.assign(q, { x: rand(0, 1), y: rand(1, 1.3), r: rand(20, 50), vy: rand(0.0006, 0.0016), life: 1 });
        const puffs = Array.from({ length: p.steam }, () => { const q = puff({}); q.y = rand(0.2, 1.2); return q; });
        let last = 0, spd = p.idleSpeed;
        return {
            frame(now) {
                const w = c.width, h = c.height, k = Math.min(w, h) / REF, dt = Math.min(50, now - (last || now));
                last = now;
                spd += ((document.body.classList.contains("is-playing") ? 1 : p.idleSpeed) - spd) * 0.03;
                skyGradient(ctx, w, h, p.sky);
                ctx.globalAlpha = p.alpha;
                for (const g of gears) {
                    g.a += g.dir * g.sp * spd * p.speed * dt * 0.001;
                    const s = g.img.width * k;
                    ctx.save();
                    ctx.translate(g.x * w, g.y * h); ctx.rotate(g.a);
                    ctx.drawImage(g.img, -s / 2, -s / 2, s, s);
                    ctx.restore();
                }
                for (const q of puffs) {
                    q.y -= q.vy * (0.5 + spd); q.r += 0.15;
                    q.life = Math.min(1, (q.y - 0.05) / 0.6);
                    if (q.y < 0.05) puff(q);
                    ctx.globalAlpha = Math.max(0, q.life) * 0.5;
                    ctx.drawImage(puffSprite, q.x * w - q.r, q.y * h - q.r, q.r * 2, q.r * 2);
                }
                ctx.globalAlpha = 1;
                const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.max(w, h) * 0.75);
                v.addColorStop(0, "rgba(0,0,0,0)"); v.addColorStop(1, "rgba(0,0,0,0.7)");
                ctx.fillStyle = v; ctx.fillRect(0, 0, w, h);
            }
        };
    },

    /* --- Wüsten-Sonnenuntergang mit Tafelbergen, Staub, Steppenläufer (Western) --- */
    desert(env, p) {
        p = Object.assign({ sky: ["#1e0f33", "#7a2648", "#d9572f", "#f6a94d"], sun: "#ffd98a", ground: ["#4a2412", "#1e0d06"],
            mesa: ["#6b3020", "#3b190f"], dust: 80, dustColor: "246,200,140", tumbleweed: [4000, 12000] }, p);
        const { canvas: c, ctx } = env;
        const ridge = (base) => {
            const pts = [[-0.02, base]];
            for (let x = rand(0, 0.1); x < 1.02;) {
                const mw = rand(0.07, 0.2), top = base - rand(0.06, 0.2);
                pts.push([x, base], [x + 0.012, top + 0.01], [x + 0.02, top], [x + mw - 0.02, top], [x + mw - 0.01, top + 0.012], [x + mw, base]);
                x += mw + rand(0.04, 0.18);
            }
            pts.push([1.02, base]);
            return pts;
        };
        const ridges = [ridge(0.74), ridge(0.8)];
        const cacti = [[0.12, 1], [0.83, 0.8], [0.93, 0.55]];
        const dust = Array.from({ length: p.dust }, () => ({ x: Math.random(), y: rand(0.55, 1), s: rand(0.6, 2), v: rand(0.0002, 0.0009), a: rand(0.1, 0.4), ph: rand(0, 6.28) }));
        const weed = (() => {
            const s = makeCanvas(80, 80), x = s.getContext("2d");
            x.strokeStyle = "#3a2210"; x.lineWidth = 1.4;
            for (let i = 0; i < 26; i++) {
                x.beginPath(); x.arc(40 + rand(-10, 10), 40 + rand(-10, 10), rand(12, 30), rand(0, 6.28), rand(0, 6.28) + rand(1.5, 4)); x.stroke();
            }
            return s;
        })();
        let tw = null, next = performance.now() + rand(1500, 4000);
        const cactus = (x, y, s) => {
            ctx.lineCap = "round"; ctx.strokeStyle = "#160904";
            ctx.lineWidth = 14 * s;
            ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 110 * s); ctx.stroke();
            ctx.lineWidth = 9 * s;
            ctx.beginPath(); ctx.moveTo(x, y - 45 * s); ctx.lineTo(x - 26 * s, y - 45 * s); ctx.lineTo(x - 26 * s, y - 80 * s); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(x, y - 60 * s); ctx.lineTo(x + 22 * s, y - 60 * s); ctx.lineTo(x + 22 * s, y - 92 * s); ctx.stroke();
        };
        return {
            frame(now) {
                const w = c.width, h = c.height, m = Math.min(w, h);
                skyGradient(ctx, w, h, p.sky);
                const sx = w * 0.5, sy = h * 0.7, sr = m * 0.13;
                const glow = ctx.createRadialGradient(sx, sy, sr * 0.5, sx, sy, sr * 5);
                glow.addColorStop(0, "rgba(255,200,110,0.45)"); glow.addColorStop(1, "rgba(255,160,80,0)");
                ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);
                ctx.fillStyle = p.sun;
                ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill();

                ridges.forEach((pts, i) => {
                    ctx.fillStyle = p.mesa[i];
                    ctx.beginPath(); ctx.moveTo(-10, h);
                    for (const [x, y] of pts) ctx.lineTo(x * w, y * h);
                    ctx.lineTo(w + 10, h); ctx.closePath(); ctx.fill();
                });
                const gy = h * 0.82;
                const gg = ctx.createLinearGradient(0, gy, 0, h);
                gg.addColorStop(0, p.ground[0]); gg.addColorStop(1, p.ground[1]);
                ctx.fillStyle = gg; ctx.fillRect(0, gy, w, h - gy);
                for (const [x, s] of cacti) cactus(x * w, h * 0.9, s * m / 900);

                if (!tw && now > next) tw = { x: -60, v: rand(2.2, 3.8), a: 0, s: rand(0.6, 1.1) };
                if (tw) {
                    tw.x += tw.v; tw.a += tw.v / 30;
                    const y = h * 0.9 - 30 * tw.s - Math.abs(Math.sin(tw.x * 0.012)) * 45 * tw.s;
                    ctx.save(); ctx.translate(tw.x, y); ctx.rotate(tw.a); ctx.scale(tw.s, tw.s);
                    ctx.drawImage(weed, -40, -40); ctx.restore();
                    if (tw.x > w + 80) { tw = null; next = now + rand(p.tumbleweed[0], p.tumbleweed[1]); }
                }

                for (const d of dust) {
                    d.x += d.v; if (d.x > 1.02) d.x = -0.02;
                    ctx.fillStyle = `rgba(${p.dustColor},${d.a * (0.6 + 0.4 * Math.sin(now * 0.001 + d.ph))})`;
                    ctx.fillRect(d.x * w, d.y * h + Math.sin(now * 0.0008 + d.ph) * 6, d.s, d.s);
                }
                const v = ctx.createRadialGradient(w / 2, h * 0.6, m * 0.3, w / 2, h * 0.6, Math.max(w, h) * 0.8);
                v.addColorStop(0, "rgba(40,15,0,0)"); v.addColorStop(1, "rgba(30,10,0,0.55)");
                ctx.fillStyle = v; ctx.fillRect(0, 0, w, h);
            }
        };
    }
};
