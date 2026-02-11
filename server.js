const express = require("express");
const path = require("path");

const app = express();

// serve /public as the site root
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;

app.get("/health", (_, res) => res.send("ok"));

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
