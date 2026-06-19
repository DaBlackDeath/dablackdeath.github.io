export async function startPreloader() {

    const bar = document.getElementById("loader-bar");
    const text = document.getElementById("loader-text");
    const preloader = document.getElementById("preloader");

    let filesToLoad = [];

    /* ------------------------------
       1) Playlist laden
    ------------------------------ */
    try {
        const res = await fetch("assets/playlist.json");
        const playlist = await res.json();
        filesToLoad.push(...playlist.map(p => p.src));
    } catch (e) {
        console.warn("Playlist konnte nicht geladen werden:", e);
    }

    /* ------------------------------
       2) index2.html parsen
    ------------------------------ */
    try {
        const res = await fetch("index2.html");
        const html = await res.text();
        const doc = new DOMParser().parseFromString(html, "text/html");

        const imgs = [...doc.querySelectorAll("img")];
        const imgFiles = imgs
            .map(img => img.getAttribute("src"))
            .filter(src => src && !src.startsWith("data:"));

        filesToLoad.push(...imgFiles);
    } catch (e) {
        console.warn("index2 konnte nicht geladen werden:", e);
    }

    /* ------------------------------
       3) Duplikate entfernen
    ------------------------------ */
    filesToLoad = [...new Set(filesToLoad)];

    let loaded = 0;

    function update() {
        loaded++;
        const percent = Math.round((loaded / filesToLoad.length) * 100);

        if (bar) bar.style.width = percent + "%";
        if (text) text.textContent = percent + "%";

        if (loaded >= filesToLoad.length) {
            document.dispatchEvent(new Event("preloaderComplete"));
        }
    }

    /* ------------------------------
       4) Sicheres Laden (404-proof)
    ------------------------------ */
    async function safeLoad(url) {
        try {
            const res = await fetch(url, { cache: "force-cache" });

            if (!res.ok) {
                console.warn("Fehler:", url, res.status);
                update();
                return;
            }

            // Bild?
            if (url.match(/\.(png|jpg|jpeg|gif|webp)$/i)) {
                const img = new Image();
                img.onload = update;
                img.onerror = update;
                img.src = url;
                return;
            }

            // Binary?
            await res.arrayBuffer();
            update();

        } catch (e) {
            console.warn("Ladefehler:", url, e);
            update();
        }
    }

    /* ------------------------------
       5) Alle Dateien laden
    ------------------------------ */
    if (filesToLoad.length === 0) {
        console.warn("Keine Dateien zu laden – Preloader sofort fertig.");
        document.dispatchEvent(new Event("preloaderComplete"));
        return;
    }

    for (const file of filesToLoad) {
        safeLoad(file);
    }

    /* ------------------------------
       6) Failsafe: Preloader MUSS fertig werden
    ------------------------------ */
    setTimeout(() => {
        console.warn("Failsafe aktiv – Preloader wird beendet.");
        document.dispatchEvent(new Event("preloaderComplete"));
    }, 10000);
}
