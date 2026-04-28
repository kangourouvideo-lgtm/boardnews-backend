const express = require("express");
const Parser = require("rss-parser");
const cors = require("cors");

const app = express();
app.use(cors());

const parser = new Parser();

const sources = [
  "https://ludovox.fr/feed/"
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

async function chercherImageBGG(nomJeu) {
  try {
    if (!nomJeu) return null;

    const searchUrl =
      "https://boardgamegeek.com/xmlapi2/search?type=boardgame&query=" +
      encodeURIComponent(nomJeu);

    const searchResponse = await fetch(searchUrl);
    const searchXml = await searchResponse.text();

    const idMatch = searchXml.match(/<item[^>]*id="([^"]+)"/);
    if (!idMatch) return null;

    const id = idMatch[1];

    const detailUrl =
      "https://boardgamegeek.com/xmlapi2/thing?id=" + id;

    const detailResponse = await fetch(detailUrl);
    const detailXml = await detailResponse.text();

    const imageMatch = detailXml.match(/<image>(.*?)<\/image>/);
    if (!imageMatch) return null;

    return imageMatch[1];
  } catch (error) {
    console.log("Erreur image BGG :", error.message);
    return null;
  }
}

app.get("/actus", async (req, res) => {
  try {
    let results = [];

    for (const url of sources) {
      const feed = await parser.parseURL(url);

      for (const item of feed.items.slice(0, 10)) {
        const titre = item.title || "";
        const jeu = extraireNomJeu(titre);
        const image = await chercherImageBGG(jeu);

        results.push({
         image: image || "https://cf.geekdo-images.com/original/img/0PNL3k-xTm2iLj8P8yE1gzKPVyw=/0x0/filters:format(jpeg)/pic3536616.jpg"
        });
      }
    }

    res.json(results);

  } catch (err) {
    res.status(500).json({ error: "Erreur backend" });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Backend lancé sur le port ${PORT}`);
});
