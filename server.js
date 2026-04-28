const express = require("express");
const Parser = require("rss-parser");
const cors = require("cors");

const app = express();
app.use(cors());

const parser = new Parser();

const sources = [
  {
    nom: "Ludovox",
    url: "https://ludovox.fr/feed/"
  },
  {
    nom: "Gus & Co",
    url: "https://gusandco.net/feed/"
  }
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

function extraireImageDepuisArticle(item) {
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

app.get("/actus", async (req, res) => {
  try {
    let results = [];

    for (const source of sources) {
      try {
        const feed = await parser.parseURL(source.url);

        const items = feed.items.slice(0, 10).map(item => {
          const titre = item.title || "Titre inconnu";
          const jeu = extraireNomJeu(titre);
          const image = extraireImageDepuisArticle(item);

          return {
            titre: titre,
            date: item.pubDate || item.isoDate || "Date inconnue",
            lien: item.link || "",
            jeu: jeu,
            image: image,
            source: source.nom
          };
        });

        results.push(...items);

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
