const express    = require("express");
const fs         = require("fs");
const compression = require("compression");
const app        = express();

app.use(compression());
app.use(express.static("."));

const rawData = fs.readFileSync("data.json");

app.get("/data", (req, res) => {
    res.type('json').send(rawData);
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
