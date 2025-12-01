// =====================
//      editor.js
// =====================

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
//   FORMATIRANJE TEKSTA
// ============================

// Bold
document.getElementById("btnBold").onclick = function () {
    let ok = editor.formatirajTekst("bold");
    if (!ok) ispisi("Nije odabran tekst za bold.");
};

// Italic
document.getElementById("btnItalic").onclick = function () {
    let ok = editor.formatirajTekst("italic");
    if (!ok) ispisi("Nije odabran tekst za italic.");
};

// Underline
document.getElementById("btnUnderline").onclick = function () {
    let ok = editor.formatirajTekst("underline");
    if (!ok) ispisi("Nije odabran tekst za underline.");
};

// ============================
//   BROJ RIJECI
// ============================

document.getElementById("btnBrojRijeci").onclick = function () {
    let rez = editor.dajBrojRijeci();
    ispisi(`Ukupno: ${rez.ukupno} | Boldiranih: ${rez.boldiranih} | Italic: ${rez.italic}`);
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

    // Formatiran ispis
    let output = `Replike za ulogu ${uloga.toUpperCase()}:\n\n`;

    rez.forEach((r, idx) => {

        output += `Scene: ${r.scena}\n`;
        output += `Pozicija u sceni: ${r.pozicijaUTekstu}\n`;

        if (r.prethodni)
            output += `Prethodni → ${r.prethodni.uloga}: ${r.prethodni.linije.join(" ")}\n`;
        else
            output += `Prethodni → N/A\n`;

        output += `Trenutni → ${r.trenutni.uloga}: ${r.trenutni.linije.join(" ")}\n`;

        if (r.sljedeci)
            output += `Sljedeći → ${r.sljedeci.uloga}: ${r.sljedeci.linije.join(" ")}\n`;
        else
            output += `Sljedeći → N/A\n`;

        output += `\n-----------------------------\n\n`;
    });

    poruke.innerText = output;
};

// ============================
//   BROJ LINIJA TEKSTA (uloga)
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
