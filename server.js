const express = require("express");
const Parser = require("rss-parser");
const cors = require("cors");

const app = express();
app.use(cors());

const parser = new Parser();

const sources = [
  { nom: "Ludovox", url: "https://ludovox.fr/feed/" },
  { nom: "Gus & Co", url: "https://gusandco.net/feed/" },
  { nom: "Tric Trac", url: "https://www.trictrac.net/rss" },
  { nom: "Vindjeu", url: "https://vindjeu.eu/feed/" },
  { nom: "Un Monde de Jeux", url: "https://unmondedejeux.fr/feed/" }
];

let cacheActus = [];
let cacheDate = 0;
const CACHE_DUREE = 1000 * 60 * 10; // 10 minutes
const JOURS_A_GARDER = 3;

function extraireNomJeu(titre) {
  if (!titre) return "";

  return titre
    .replace(/[^\p{L}\p{N} ]/gu, " ")
    .split(" ")
    .filter(mot => mot.length > 3)
    .slice(0, 3)
    .join(" ");
}

function extraireImageDepuisFlux(item) {
  const contenu =
    item["content:encoded"] ||
    item.content ||
    item.summary ||
    item.description ||
    "";

  const imageMatch = contenu.match(/<img[^>]+src="([^">]+)"/);

  if (imageMatch && imageMatch[1]) {
    return imageMatch[1];
  }

  if (item.enclosure && item.enclosure.url) {
    return item.enclosure.url;
  }

  return null;
}

function dateArticle(item) {
  const dateBrute = item.isoDate || item.pubDate || item.date;

  if (!dateBrute) return null;

  const date = new Date(dateBrute);

  if (isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function ageEnJours(date) {
  const maintenant = new Date();
  const difference = maintenant.getTime() - date.getTime();
  return Math.floor(difference / (1000 * 60 * 60 * 24));
}

function libelleJour(age) {
  if (age === 0) return "Actu du jour";
  if (age === 1) return "Actu J-1";
  if (age === 2) return "Actu J-2";
  return "Ancienne actu";
}

function cleDoublon(titre, lien) {
  return `${titre || ""}-${lien || ""}`
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

async function chargerActus() {
  let results = [];

  for (const source of sources) {
    try {
      const feed = await parser.parseURL(source.url);

      const items = feed.items.slice(0, 20);

      for (const item of items) {
        const date = dateArticle(item);

        if (!date) continue;

        const age = ageEnJours(date);

        // On garde seulement les actus de J, J-1 et J-2
        if (age < 0 || age >= JOURS_A_GARDER) {
          continue;
        }

        const titre = item.title || "Titre inconnu";
        const lien = item.link || "";

        results.push({
          titre: titre,
          date: date.toISOString(),
          dateLisible: date.toLocaleDateString("fr-FR"),
          lien: lien,
          jeu: extraireNomJeu(titre),
          image: extraireImageDepuisFlux(item),
          source: source.nom,
          age: age,
          jour: libelleJour(age)
        });
      }

    } catch (error) {
      console.log("Erreur source :", source.nom, error.message);
    }
  }

  // Suppression des doublons
  const dejaVus = new Set();

  results = results.filter(actu => {
    const cle = cleDoublon(actu.titre, actu.lien);

    if (dejaVus.has(cle)) {
      return false;
    }

    dejaVus.add(cle);
    return true;
  });

  // Tri du plus récent au plus ancien
  results.sort((a, b) => {
    return new Date(b.date) - new Date(a.date);
  });

  return results;
}

app.get("/actus", async (req, res) => {
  try {
    const maintenant = Date.now();

    if (cacheActus.length > 0 && maintenant - cacheDate < CACHE_DUREE) {
      return res.json(cacheActus);
    }

    const actus = await chargerActus();

    cacheActus = actus;
    cacheDate = Date.now();

    res.json(actus);

  } catch (err) {
    console.log("Erreur backend :", err.message);
    res.status(500).json({ error: "Erreur backend" });
  }
});

app.get("/", (req, res) => {
  res.send("Backend LaParentheseLudiqueNews OK");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Backend lancé sur le port ${PORT}`);
});
