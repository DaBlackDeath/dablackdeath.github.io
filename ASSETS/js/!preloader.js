export function startPreloader(extraFiles = []) {

    console.log("Preloader gestartet…");

    const bar = document.getElementById("loader-bar");
    const text = document.getElementById("loader-text");
    const preloader = document.getElementById("preloader");

    // 1. Alle Bilder im DOM sammeln
    const imgElements = [...document.querySelectorAll("img[data-src]")];
    const imgFiles = imgElements.map(img => img.dataset.src);

    // 2. Externe Dateien hinzufügen (z.B. data.00, data.01)
    const allFiles = [...imgFiles, ...extraFiles];

    let loaded = 0;

    function update() {
        loaded++;

        const percent = Math.round((loaded / allFiles.length) * 100);
        bar.style.width = percent + "%";
        text.textContent = percent + "%";

        if (loaded === allFiles.length) {
            console.log("Alle Dateien geladen → Preloader fertig.");

            setTimeout(() => {
                preloader.style.opacity = "0";
                preloader.style.transition = "opacity 0.5s ease-out";

                setTimeout(() => {
                    preloader.remove();
                    document.body.style.opacity = "1";

                    // CRT Bootscreen informieren
                    document.dispatchEvent(new Event("preloaderComplete"));

                }, 600);
            }, 200);
        }
    }

    // Seite unsichtbar starten
    document.body.style.opacity = "0";

    // 3. Dateien laden
    allFiles.forEach(file => {

        // Bild?
        if (file.match(/\.(png|jpg|jpeg|webp|gif)$/i)) {

            const img = new Image();
            img.onload = () => {
                // Bild ins DOM setzen
                const target = imgElements.find(i => i.dataset.src === file);
                if (target) target.src = file;
                update();
            };
            img.onerror = () => {
                console.warn("Bild konnte nicht geladen werden:", file);
                update(); // trotzdem weiter
            };
            img.src = file;
        }

        // Andere Dateien (data.00, json, txt, bin, etc.)
        else {
            fetch(file)
                .then(res => {
                    if (!res.ok) console.warn("Fehler beim Laden:", file);
                    return res;
                })
                .then(() => update())
                .catch(() => {
                    console.warn("Fetch-Fehler:", file);
                    update(); // trotzdem weiter
                });
        }
    });
}
