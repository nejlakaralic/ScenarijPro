// =====================
//      editor.js
// =====================

// ====== KONSTANTE ======
const SCENARIO_ID = 1;
const USER_ID = 1;

// Uzmi editor div
let div = document.getElementById("divEditor");
let editor = EditorTeksta(div);

// Div za poruke
let poruke = document.getElementById("poruke");

// Helper funkcija za ispis
function ispisi(msg) {
    poruke.innerText = msg;
}

// ============================
//   UCITAVANJE SCENARIJA SA SERVERA
// ============================

PoziviAjax.getScenario(SCENARIO_ID, function (status, data) {

    if (status !== 200) {
        ispisi("Greška pri učitavanju scenarija.");
        return;
    }

    div.innerHTML = "";

    data.content.forEach(l => {
        const span = document.createElement("span");
        span.dataset.lineid = l.lineId;
        span.innerText = l.text;
        div.appendChild(span);
        div.appendChild(document.createElement("br"));
    });
});

// ============================
//   FORMATIRANJE TEKSTA
// ============================

document.getElementById("btnBold").onclick = function () {
    let ok = editor.formatirajTekst("bold");
    if (!ok) ispisi("Nije odabran tekst za bold.");
};

document.getElementById("btnItalic").onclick = function () {
    let ok = editor.formatirajTekst("italic");
    if (!ok) ispisi("Nije odabran tekst za italic.");
};

document.getElementById("btnUnderline").onclick = function () {
    let ok = editor.formatirajTekst("underline");
    if (!ok) ispisi("Nije odabran tekst za underline.");
};

// ============================
//   BROJ RIJECI + SLANJE NA SERVER
// ============================

document.getElementById("btnBrojRijeci").onclick = function () {

    // Lokalna funkcionalnost ostaje
    let rez = editor.dajBrojRijeci();
    ispisi(`Ukupno: ${rez.ukupno} | Boldiranih: ${rez.boldiranih} | Italic: ${rez.italic}`);

    // ====== ZADATAK 2: AJAX UPDATE ======
    const firstLine = div.querySelector("span");
    if (!firstLine) return;

    const lineId = firstLine.dataset.lineid;
    const text = firstLine.innerText;

    // 1) LOCK
    PoziviAjax.lockLine(SCENARIO_ID, lineId, USER_ID, function (status) {

        if (status !== 200) return;

        // 2) UPDATE
        PoziviAjax.updateLine(
            SCENARIO_ID,
            lineId,
            USER_ID,
            [text],
            function () {
                // samo dokaz da je poslano
                console.log("Izmjena poslana na server.");
            }
        );
    });
};

// ============================
//   ULOGE
// ============================

document.getElementById("btnUloge").onclick = function () {
    let rez = editor.dajUloge();
    if (rez.length === 0) ispisi("Nema detektovanih uloga.");
    else ispisi("Uloge: " + rez.join(", "));
};

// ============================
//   POGREŠNE ULOGE
// ============================

document.getElementById("btnPogresneUloge").onclick = function () {
    let rez = editor.pogresnaUloga();
    if (rez.length === 0) ispisi("Nema potencijalno pogrešnih uloga.");
    else ispisi("Potencijalno pogrešne: " + rez.join(", "));
};

// ============================
//   SCENARIJ ULOGE
// ============================

document.getElementById("btnScenarij").onclick = function () {
    let uloga = prompt("Unesite naziv uloge:");
    if (!uloga) {
        ispisi("Niste unijeli ulogu.");
        return;
    }

    let rez = editor.scenarijUloge(uloga);

    if (rez.length === 0) {
        ispisi(`Uloga "${uloga}" se ne pojavljuje u scenariju ili nema replika.`);
        return;
    }

    let output = `Replike za ulogu ${uloga.toUpperCase()}:\n\n`;

    rez.forEach(r => {

        output += `Scene: ${r.scena}\n`;
        output += `Pozicija u sceni: ${r.pozicijaUTekstu}\n`;

        output += r.prethodni
            ? `Prethodni → ${r.prethodni.uloga}: ${r.prethodni.linije.join(" ")}\n`
            : `Prethodni → N/A\n`;

        output += `Trenutni → ${r.trenutni.uloga}: ${r.trenutni.linije.join(" ")}\n`;

        output += r.sljedeci
            ? `Sljedeći → ${r.sljedeci.uloga}: ${r.sljedeci.linije.join(" ")}\n`
            : `Sljedeći → N/A\n`;

        output += `\n-----------------------------\n\n`;
    });

    poruke.innerText = output;
};

// ============================
//   BROJ LINIJA TEKSTA
// ============================

document.getElementById("btnBrojLinijaTeksta").onclick = function () {
    let uloga = prompt("Unesite naziv uloge:");
    if (!uloga) {
        ispisi("Niste unijeli ulogu.");
        return;
    }

    let broj = editor.brojLinijaTeksta(uloga);
    ispisi(`Uloga "${uloga.toUpperCase()}" izgovara ukupno ${broj} linija teksta.`);
};

// ============================
//   GRUPISANJE ULOGA
// ============================

document.getElementById("btnGrupisi").onclick = function () {
    let rez = editor.grupisiUloge();

    if (rez.length === 0) {
        ispisi("Nema dijalog-segmenata u scenariju.");
        return;
    }

    let output = "Dijalog segmenti:\n\n";

    rez.forEach(g => {
        output += `Scena: ${g.scena}\n`;
        output += `Segment: ${g.segment}\n`;
        output += `Uloge: ${g.uloge.join(", ")}\n\n`;
    });

    poruke.innerText = output;
};
