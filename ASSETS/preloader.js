export async function startPreloader() {
    const bar = document.getElementById("loader-bar");
    const text = document.getElementById("loader-text");
    const preloader = document.getElementById("preloader");

    // 1) Bilder aus dem DOM sammeln
    const images = [...document.querySelectorAll("img[data-src]")];
    
    let loaded = 0;
    let total = 0;

    function update() {
        loaded++;
        const percent = Math.round((loaded / total) * 100);
        
        if (bar) bar.style.width = percent + "%";
        if (text) text.textContent = percent + "%";

        if (loaded === total) {
            // Wenn alles fertig ist, Preloader ausblenden und Event feuern
            if (preloader) preloader.style.opacity = "0";
            document.dispatchEvent(new Event("preloaderComplete"));
        }
    }

    // Zeige die Seite/Body wieder an (falls du sie am Anfang ausblendest)
    document.body.style.opacity = "1";

    let audioTracks = [];
    try {
        // 2) Playlist laden für die dynamischen Tracks (data.00, data.01, etc.)
        const response = await fetch("assets/playlist.json");
        if (response.ok) {
            const playlist = await response.json();
            audioTracks = playlist.map(item => item.src).filter(src => src);
        }
    } catch (e) {
        console.error("Preloader konnte die playlist.json nicht lesen:", e);
    }

    // 🔥 HIER: data.99 manuell hinzufügen, da sie nicht in der JSON steht
    audioTracks.push("assets/dat/data.99");

    // 3) Jetzt berechnen wir das absolut exakte 'total', BEVOR das Laden anfängt
    total = images.length + audioTracks.length;

    if (total === 0) {
        if (preloader) preloader.style.opacity = "0";
        document.dispatchEvent(new Event("preloaderComplete"));
        return;
    }

    // 4) Bilder vorladen
    images.forEach(img => {
        const realSrc = img.dataset.src;
        const loader = new Image();
        loader.onload = () => {
            img.src = realSrc;
            update();
        };
        loader.onerror = update; // Weiterzählen, falls ein Bild fehlt
        loader.src = realSrc;
    });

    // 5) Alle Audiodateien (inklusive data.99) als echtes Audio vorladen
    audioTracks.forEach(fileUrl => {
        const audio = new Audio();
        
        audio.addEventListener("canplaythrough", update, { once: true });
        audio.addEventListener("error", update, { once: true }); // Weiterzählen bei Fehler
        
        audio.src = fileUrl;
        audio.load(); // Startet das Laden in den Browser-Cache
    });
}