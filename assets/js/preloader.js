/* Wartet, bis alle Bilder geladen UND dekodiert sind, und feuert dann
   "preloaderComplete". Unterstützt <img src="..."> und <img data-src="...">.
   Optional: #loader-bar / #loader-text für eine Fortschrittsanzeige. */
export async function startPreloader() {
    const bar = document.getElementById("loader-bar");
    const text = document.getElementById("loader-text");
    const preloader = document.getElementById("preloader");

    const images = [...document.querySelectorAll("img")];
    const total = images.length;
    let loaded = 0;

    const update = () => {
        loaded++;
        const percent = total ? Math.round((loaded / total) * 100) : 100;
        if (bar) bar.style.width = percent + "%";
        if (text) text.textContent = percent + "%";
    };

    await Promise.all(images.map(async img => {
        if (img.dataset.src && !img.getAttribute("src")) img.src = img.dataset.src;
        try {
            // decode() lädt + dekodiert vorab → kein Ruckeln beim ersten Anzeigen
            await img.decode();
        } catch (e) {
            // Fehlendes/defektes Bild soll den Boot nicht blockieren
        }
        update();
    }));

    if (preloader) preloader.style.opacity = "0";
    document.dispatchEvent(new Event("preloaderComplete"));
}
