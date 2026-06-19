export async function startPreloader() {

    const bar = document.getElementById("loader-bar");
    const text = document.getElementById("loader-text");
    const preloader = document.getElementById("preloader");

    let filesToLoad = [];

    // ---------------------------------------------------------
    // 1) Playlist.json laden → data.xx Dateien extrahieren
    // ---------------------------------------------------------
    try {
        const res = await fetch("assets/playlist.json");
        const playlist = await res.json();

        const dataFiles = playlist.map(item => item.src);
        filesToLoad.push(...dataFiles);

    } catch (e) {
        console.error("Playlist konnte nicht geladen werden:", e);
    }

    // ---------------------------------------------------------
    // 2) index2.html parsen → alle <img src="..."> extrahieren
    // ---------------------------------------------------------
    try {
        const res = await fetch("index2.html");
        const html = await res.text();

        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");

        const imgs = [...doc.querySelectorAll("img")];

        const imgFiles = imgs
            .map(img => img.getAttribute("src"))
            .filter(src => src && !src.startsWith("data:"));

        filesToLoad.push(...imgFiles);

    } catch (e) {
        console.error("index2 konnte nicht geladen werden:", e);
    }

    // ---------------------------------------------------------
    // 3) Duplikate entfernen
    // ---------------------------------------------------------
    filesToLoad = [...new Set(filesToLoad)];

    // ---------------------------------------------------------
    // 4) Preload starten
    // ---------------------------------------------------------
    let loaded = 0;

    function update() {
        loaded++;
        const percent = Math.round((loaded / filesToLoad.length) * 100);
        bar.style.width = percent + "%";
        text.textContent = percent + "%";

        if (loaded === filesToLoad.length) {
            document.dispatchEvent(new Event("preloaderComplete"));

            setTimeout(() => {
                preloader.style.opacity = "0";
                preloader.style.transition = "opacity 0.5s ease-out";

                setTimeout(() => preloader.remove(), 600);
            }, 200);
        }
    }

    // ---------------------------------------------------------
    // 5) Dateien laden (Images + Binary)
    // ---------------------------------------------------------
    for (const file of filesToLoad) {

        if (file.match(/\.(png|jpg|jpeg|webp|gif)$/i)) {
            // Bild
            const img = new Image();
            img.onload = update;
            img.onerror = update;
            img.src = file;
        } else {
            // Binary / data.xx
            fetch(file)
                .then(() => update())
                .catch(() => update());
        }
    }

    // ---------------------------------------------------------
    // 6) Failsafe nach 10 Sekunden
    // ---------------------------------------------------------
    setTimeout(() => {
        document.dispatchEvent(new Event("preloaderComplete"));
    }, 10000);
}
