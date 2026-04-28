const express = require("express");
const Parser = require("rss-parser");
const cors = require("cors");
const cheerio = require("cheerio");

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
const CACHE_DUREE = 1000 * 60 * 30; // 30 minutes

function extraireNomJeu(titre) {
  if (!titre) return "";

  return titre
    .replace(/[^\p{L}\p{N} ]/gu, " ")
    .split(" ")
    .filter(mot => mot.length > 3)
    .slice(0, 3)
    .join(" ");
}

function imageValide(url) {
  if (!url) return false;
  const u = url.toLowerCase();

  return !(
    u.includes("logo") ||
    u.includes("avatar") ||
    u.includes("icon") ||
    u.includes("placeholder") ||
    u.includes("blank") ||
    u.includes(".svg")
  );
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

async function fetchAvecTimeout(url, ms = 4000) {
  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, ms);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 BoardNewsBot"
      }
    });

    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function extraireImageDepuisArticle(lienArticle) {
  try {
    if (!lienArticle) return null;

    const html = await fetchAvecTimeout(lienArticle, 4000);
    const $ = cheerio.load(html);

    const candidates = [
      $('meta[property="og:image"]').attr("content"),
      $('meta[property="og:image:secure_url"]').attr("content"),
      $('meta[name="twitter:image"]').attr("content"),
      $("article img").first().attr("src"),
      $(".entry-content img").first().attr("src"),
      $(".post-content img").first().attr("src")
    ];

    for (const candidate of candidates) {
      if (imageValide(candidate)) {
        return candidate;
      }
    }

    return null;

  } catch (error) {
    return null;
  }
}

async function chargerActus() {
  let results = [];

  for (const source of sources) {
    try {
      const feed = await parser.parseURL(source.url);

      for (const item of feed.items.slice(0, 4)) {
        const titre = item.title || "Titre inconnu";
        const lien = item.link || "";
        const jeu = extraireNomJeu(titre);

        let image = extraireImageDepuisFlux(item);

        const imageArticle = await extraireImageDepuisArticle(lien);
        if (imageArticle) {
          image = imageArticle;
        }

        results.push({
          titre: titre,
          date: item.pubDate || item.isoDate || "Date inconnue",
          lien: lien,
          jeu: jeu,
          image: image,
          source: source.nom
        });
      }

    } catch (sourceError) {
      console.log("Erreur source :", source.nom, sourceError.message);
    }
  }

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

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Backend lancé sur le port ${PORT}`);
});
