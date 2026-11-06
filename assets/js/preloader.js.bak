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

}