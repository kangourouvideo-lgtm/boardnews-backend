const express = require("express");
const Parser = require("rss-parser");
const cors = require("cors");

const app = express();
app.use(cors());

const parser = new Parser();

// 📡 sources de news
const sources = [
  "https://ludovox.fr/feed/"
];

app.get("/actus", async (req, res) => {
  try {
    let results = [];

    for (const url of sources) {
      const feed = await parser.parseURL(url);

      results.push(...feed.items.map(item => ({
        titre: item.title,
        date: item.pubDate,
        lien: item.link
      })));
    }

    res.json(results);

  } catch (err) {
    res.status(500).json({ error: "Erreur backend" });
  }
});

// 🚀 lancement serveur
const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Backend lancé sur le port ${PORT}`);
});