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

function extraireNomJeu(titre) {
  if (!titre) return "";

  return titre
    .replace(/[^\p{L}\p{N} ]/gu, " ")
    .split(" ")
    .filter(mot => mot.length > 3)
    .slice(0, 3)
    .join(" ");
}

function rendreUrlAbsolue(url, baseUrl) {
  if (!url) return null;

  if (url.startsWith("http")) {
    return url;
  }

  try {
    return new URL(url, baseUrl).href;
  } catch {
    return null;
  }
}

function imageValide(url) {
  if (!url) return false;

  const u = url.toLowerCase();

  if (u.includes("logo")) return false;
  if (u.includes("avatar")) return false;
  if (u.includes("icon")) return false;
  if (u.includes("placeholder")) return false;
  if (u.includes("blank")) return false;
  if (u.includes("svg")) return false;

  return true;
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

async function extraireImageDepuisArticle(lienArticle) {
  try {
    if (!lienArticle) return null;

    const response = await fetch(lienArticle, {
      headers: {
        "User-Agent": "Mozilla/5.0 BoardNewsBot"
      }
    });

    const html = await response.text();
    const $ = cheerio.load(html);

    const candidates = [
      $('meta[property="og:image"]').attr("content"),
      $('meta[property="og:image:secure_url"]').attr("content"),
      $('meta[name="twitter:image"]').attr("content"),
      $("article img").first().attr("src"),
      $(".entry-content img").first().attr("src"),
      $(".post-content img").first().attr("src"),
      $("img").first().attr("src")
    ];

    for (const candidate of candidates) {
      const image = rendreUrlAbsolue(candidate, lienArticle);

      if (imageValide(image)) {
        return image;
      }
    }

    return null;

  } catch (error) {
    console.log("Erreur image article :", error.message);
    return null;
  }
}

app.get("/actus", async (req, res) => {
  try {
    let results = [];

    for (const source of sources) {
      try {
        const feed = await parser.parseURL(source.url);

        for (const item of feed.items.slice(0, 8)) {
          const titre = item.title || "Titre inconnu";
          const lien = item.link || "";
          const jeu = extraireNomJeu(titre);

          let image = await extraireImageDepuisArticle(lien);

          if (!image) {
            image = extraireImageDepuisFlux(item);
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

    res.json(results);

  } catch (err) {
    console.log("Erreur backend :", err.message);
    res.status(500).json({ error: "Erreur backend" });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Backend lancé sur le port ${PORT}`);
});
