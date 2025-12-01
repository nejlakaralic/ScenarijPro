// =====================
//   EditorTeksta.js
// =====================

let EditorTeksta = function (divRef) {

    // =====================
    //   VALIDACIJA DIV-a
    // =====================
    if (!divRef || divRef.tagName !== "DIV")
        throw new Error("Pogresan tip elementa!");

    if (!divRef.hasAttribute("contenteditable"))
        throw new Error("Neispravan DIV, ne posjeduje contenteditable atribut!");

    // =====================
    //  PRIVATNE FUNKCIJE
    // =====================

    // Čisti tekst – uklanja HTML tagove
    function getCistiText(el) {
        return el.innerText;
    }

    // Prebrojavanje riječi (uz bold/italic detekciju)
    

    // Da li je linija uloga?
    function jeUloga(linija) {
        if (!linija) return false;
        if (!/^[A-Z ]+$/.test(linija.trim())) return false;
        return true;
    }

// ===============================

let dajBrojRijeci = function () {

    // 1. Izvuci DOM karaktere + stil
    let chars = [];

    function collect(node, inheritedBold, inheritedItalic) {
        if (node.nodeType === Node.TEXT_NODE) {
            for (let ch of node.textContent) {
                chars.push({
                    ch,
                    bold: inheritedBold,
                    italic: inheritedItalic
                });
            }
        } else if (node.nodeType === Node.ELEMENT_NODE) {

            let cs = getComputedStyle(node);
            let isBold = cs.fontWeight === "700" || cs.fontWeight === "bold";
            let isItalic = cs.fontStyle === "italic";

            let nextBold = inheritedBold || isBold;
            let nextItalic = inheritedItalic || isItalic;

            node.childNodes.forEach(child => collect(child, nextBold, nextItalic));
        }
    }

    collect(divRef, false, false);

    // Helperi
    function isWordChar(ch) {
        return /[A-Za-zÀ-ž'-]/.test(ch);
    }

    function isLetter(ch) {
        return /[A-Za-zÀ-ž]/.test(ch);
    }

    let total = 0;
    let boldCount = 0;
    let italicCount = 0;

    let current = "";
    let wordBold = true;
    let wordItalic = true;

    function finalizeWord() {
        if (current === "") return;

        // mora sadržati barem jedno slovo
        if (!/[A-Za-zÀ-ž]/.test(current)) {
            current = "";
            wordBold = true;
            wordItalic = true;
            return;
        }

        total++;

        if (wordBold) boldCount++;
        if (wordItalic) italicCount++;

        current = "";
        wordBold = true;
        wordItalic = true;
    }

    // 2. Prođi sve karaktere i formiraj riječi
    for (let obj of chars) {

        if (isWordChar(obj.ch)) {

            current += obj.ch;

            if (!obj.bold) wordBold = false;
            if (!obj.italic) wordItalic = false;

        } else {
            finalizeWord();
        }
    }

    finalizeWord();

    return {
        ukupno: total,
        boldiranih: boldCount,
        italic: italicCount
    };
};






    // -------- dajUloge ----------
    let dajUloge = function () {

    // lines po <br>, kao testovi S2
    let raw = divRef.innerHTML.split(/<br\s*\/?>/i);
    let linije = raw.map(l => l.replace(/<[^>]+>/g, "").trim());

    let rezultat = [];
    let set = new Set();

    const jeUloga = l => /^[A-Z ]+$/.test(l);
    const jeZagrada = l => /^\(.*\)$/.test(l);
    const jeScena = l => /^((INT|EXT)\.)/i.test(l);

    for (let i = 0; i < linije.length; i++) {

        let l = linije[i];

        if (jeUloga(l)) {

            let j = i + 1;
            let imaGovor = false;

            while (j < linije.length) {
                let t = linije[j];

                // prekidi govornog bloka
                if (t === "") break;           // prazan red
                if (jeUloga(t)) break;         // nova uloga
                if (jeScena(t)) break;         // nova scena

                // ako je zagrada → napomena → preskoči
                if (jeZagrada(t)) {
                    j++;
                    continue;
                }

                // sve ostalo je govor
                imaGovor = true;
                break;
            }

            // ako uloga ima govor → dodaj
            if (imaGovor && !set.has(l)) {
                set.add(l);
                rezultat.push(l);
            }
        }
    }

    return rezultat;
};


    // -------- pogresnaUloga ----------
    let pogresnaUloga = function () {

        let tekst = getCistiText(divRef);
        let linije = tekst.split("\n");

        let frekvencije = {};

        linije.forEach(l => {
            if (jeUloga(l.trim())) {
                frekvencije[l.trim()] = (frekvencije[l.trim()] || 0) + 1;
            }
        });

        let sveUloge = Object.keys(frekvencije);
        let rezultat = new Set();

        function slicno(a, b) {
            if (Math.abs(a.length - b.length) > 2) return false;

            let dozvoljeneRazlike = (a.length > 5 && b.length > 5) ? 2 : 1;
            let razlike = 0;

            for (let i = 0; i < Math.min(a.length, b.length); i++) {
                if (a[i] !== b[i]) razlike++;
                if (razlike > dozvoljeneRazlike) return false;
            }

            return true;
        }

        for (let a of sveUloge) {
            for (let b of sveUloge) {
                if (a === b) continue;

                if (slicno(a, b)) {
                    if (frekvencije[b] >= 4 &&
                        frekvencije[b] - frekvencije[a] >= 3) {
                        rezultat.add(a);
                    }
                }
            }
        }

        return Array.from(rezultat);
    };

    // -------- brojLinijaTeksta ----------
let brojLinijaTeksta = function (uloga) {

    let target = uloga.toUpperCase();

    // ČITAMO TAČNO LINIJE KAKO TEST UBAČUJE HTML:
    // <br> tag = jedna linija teksta
    let raw = divRef.innerHTML.split(/<br\s*\/?>/i);

    // Pretvori sve u plain text (bez HTML-a), trimuj
    let linije = raw.map(l => l.replace(/<[^>]+>/g, "").trim());

    let count = 0;

    function jeUlogaLinija(l) {
        return /^[A-Z ]+$/.test(l.trim());
    }

    function jeZagrada(l) {
        return /^\(.*\)$/.test(l.trim());
    }

    for (let i = 0; i < linije.length; i++) {

        if (linije[i] === target) {

            let j = i + 1;

            while (j < linije.length) {

                let l = linije[j];

                // prekid blokova
                if (l === "") break;                  // prazna linija
                if (jeUlogaLinija(l)) break;          // nova uloga
                if (jeZagrada(l)) { j++; continue; }  // preskoči napomene

                count++;
                j++;
            }
        }
    }

    return count;
};





    // -------- scenarijUloge ----------
// -------- scenarijUloge ----------
let scenarijUloge = function (ulogaParam) {

    let target = ulogaParam.toUpperCase();
    let rezultat = [];

    // Linije po <br> (kao u testovima S2) ili fallback na innerText
    let raw;
    if (divRef.innerHTML.toLowerCase().includes("<br")) {
        raw = divRef.innerHTML.split(/<br\s*\/?>/i);
    } else {
        raw = divRef.innerText.split("\n");
    }

    let linije = raw.map(l => l.replace(/<[^>]+>/g, "").trim());

    // Helperi
    const jeScena = l => /^((INT|EXT)\.)/i.test(l.trim());
    const jeZagrada = l => /^\(.*\)$/.test(l.trim());
    const jeUlogaLinija = l => /^[A-Z ]+$/.test(l.trim());

    let trenutnaScena = "NEPOZNATA SCENA";
    let blokovi = [];

    // 1) Izgradi blokove replika: { scena, uloga, linije }
    for (let i = 0; i < linije.length; i++) {

        let l = linije[i];

        if (jeScena(l)) {
            trenutnaScena = l;
            continue;
        }

        if (jeUlogaLinija(l)) {

            let imeUloge = l;
            let linijeGovora = [];

            let j = i + 1;
            while (j < linije.length) {
                let t = linije[j];

                if (t === "") break;
                if (jeScena(t)) break;
                if (jeUlogaLinija(t)) break;

                if (jeZagrada(t)) {
                    j++;
                    continue;
                }

                linijeGovora.push(t);
                j++;
            }

            // Ako nema govora, nije validan blok
            if (linijeGovora.length === 0) {
                i = j - 1;
                continue;
            }

            blokovi.push({
                scena: trenutnaScena,
                uloga: imeUloge,
                linije: linijeGovora
            });

            i = j - 1;
        }
    }

    // 2) Iz blokova izdvoj replike tražene uloge
    for (let k = 0; k < blokovi.length; k++) {

        if (blokovi[k].uloga !== target) continue;

        let blok = blokovi[k];
        let scena = blok.scena;

        // pozicijaUTekstu = redni broj replike u toj sceni (među svim ulogama)
        let blokoviUSceni = blokovi.filter(b => b.scena === scena);
        let pozicija = blokoviUSceni.indexOf(blok) + 1;

        // pronađi PRETHODNI blok u istoj sceni
        let prethodni = null;
        for (let i = k - 1; i >= 0; i--) {
            if (blokovi[i].scena !== scena) break;
            prethodni = blokovi[i];
            break;
        }

        // pronađi SLJEDEĆI blok u istoj sceni
        let sljedeci = null;
        for (let i = k + 1; i < blokovi.length; i++) {
            if (blokovi[i].scena !== scena) break;
            sljedeci = blokovi[i];
            break;
        }

        rezultat.push({
            scena: scena,
            pozicijaUTekstu: pozicija,
            prethodni: prethodni ? {
                uloga: prethodni.uloga,
                linije: prethodni.linije
            } : null,
            trenutni: {
                uloga: blok.uloga,
                linije: blok.linije
            },
            sljedeci: sljedeci ? {
                uloga: sljedeci.uloga,
                linije: sljedeci.linije
            } : null
        });
    }

    return rezultat;
};



    // -------- grupisiUloge ----------
// -------- grupisiUloge ----------
let grupisiUloge = function () {

    // Linije po <br>, kao u testovima S2
    let raw = divRef.innerHTML.split(/<br\s*\/?>/i);
    let linije = raw.map(l => l.replace(/<[^>]+>/g, "").trim());

    let rezultat = [];

    let trenutnaScena = null;
    let segment = 0;
    let ulogeUSegmentu = [];
    let aktivanSegment = false;

    const jeScena = l => /^((INT|EXT)\.)/i.test(l);
    const jeUlogaTekst = l => /^[A-Z ]+$/.test(l);
    const jeZagrada = l => /^\(.*\)$/.test(l);

    // helper: provjeri da li linija ULOGE zaista ima govor ispod
    function imaGovorOdavde(index) {
        let j = index + 1;
        while (j < linije.length) {
            let t = linije[j];

            if (t === "") break;
            if (jeScena(t)) break;
            if (jeUlogaTekst(t)) break;

            if (jeZagrada(t)) {
                j++;
                continue;
            }

            // bilo šta što nije prazno/uloga/scena/zagrada = govor
            return true;
        }
        return false;
    }

    for (let i = 0; i < linije.length; i++) {

        let l = linije[i];

        // NOVA SCENA
        if (jeScena(l)) {

            if (aktivanSegment && ulogeUSegmentu.length > 0) {
                rezultat.push({
                    scena: trenutnaScena,
                    segment: segment,
                    uloge: [...ulogeUSegmentu]
                });
            }

            trenutnaScena = l;
            segment = 0;
            ulogeUSegmentu = [];
            aktivanSegment = false;
            continue;
        }

        // POTENCIJALNA ULOGA
        if (jeUlogaTekst(l)) {

            // ako NEMA govora ispod → tretiramo kao akciju (prekid)
            if (!imaGovorOdavde(i)) {

                if (aktivanSegment && ulogeUSegmentu.length > 0) {
                    rezultat.push({
                        scena: trenutnaScena,
                        segment: segment,
                        uloge: [...ulogeUSegmentu]
                    });
                }

                aktivanSegment = false;
                ulogeUSegmentu = [];
                continue;
            }

            // OVDJE SMO SIGURNI DA JE VALIDNA ULOGA

            if (!aktivanSegment) {
                segment++;
                ulogeUSegmentu = [];
                aktivanSegment = true;
            }

            if (!ulogeUSegmentu.includes(l)) {
                ulogeUSegmentu.push(l);
            }

            // preskoči linije govora
            let j = i + 1;
            while (
                j < linije.length &&
                linije[j] !== "" &&
                !jeScena(linije[j]) &&
                !jeUlogaTekst(linije[j]) &&
                !jeZagrada(linije[j])
            ) {
                j++;
            }

            i = j - 1;
            continue;
        }

        // AKCIJA → prekida segment
        if (l !== "" && !jeScena(l) && !jeZagrada(l)) {

            if (aktivanSegment && ulogeUSegmentu.length > 0) {
                rezultat.push({
                    scena: trenutnaScena,
                    segment: segment,
                    uloge: [...ulogeUSegmentu]
                });
            }

            aktivanSegment = false;
            ulogeUSegmentu = [];
            continue;
        }

        // prazne linije i zagrade samo preskoči
    }

    // zadnji segment
    if (aktivanSegment && ulogeUSegmentu.length > 0) {
        rezultat.push({
            scena: trenutnaScena,
            segment: segment,
            uloge: [...ulogeUSegmentu]
        });
    }

    return rezultat;
};



    // -------- formatirajTekst ----------
  let formatirajTekst = function (komanda) {

    // Dozvoljene komande po specifikaciji spirale
    const validne = ["bold", "italic", "underline"];

    // Ako komanda NIJE validna → automatski false
    if (!validne.includes(komanda)) return false;

    let selection = window.getSelection();

    if (!selection || selection.isCollapsed) return false;

    let range = selection.getRangeAt(0);
    if (!divRef.contains(range.commonAncestorContainer)) return false;

    // Sad tek pozivamo execCommand
    document.execCommand(komanda);

    return true;
};


    // =====================
    //   PUBLIC API
    // =====================
    return {
        dajBrojRijeci: dajBrojRijeci,
        dajUloge: dajUloge,
        pogresnaUloga: pogresnaUloga,
        brojLinijaTeksta: brojLinijaTeksta,
        scenarijUloge: scenarijUloge,
        grupisiUloge: grupisiUloge,
        formatirajTekst: formatirajTekst
    };
};
