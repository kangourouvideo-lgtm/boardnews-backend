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
const CACHE_DUREE = 1000 * 60 * 30;

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

async function chargerActus() {
  let results = [];

  for (const source of sources) {
    try {
      const feed = await parser.parseURL(source.url);

      const items = feed.items.slice(0, 8).map(item => {
        const titre = item.title || "Titre inconnu";

        return {
          titre: titre,
          date: item.pubDate || item.isoDate || "Date inconnue",
          lien: item.link || "",
          jeu: extraireNomJeu(titre),
          image: extraireImageDepuisFlux(item),
          source: source.nom
        };
      });

      results.push(...items);

    } catch (error) {
      console.log("Erreur source :", source.nom, error.message);
    }
  }

  results.sort((a, b) => new Date(b.date) - new Date(a.date));

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
  res.send("Backend BoardNews OK");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Backend lancé sur le port ${PORT}`);
});
