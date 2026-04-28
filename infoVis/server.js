const express = require("express");
const fs = require("fs");
const app = express();


app.use(express.static("."));


const rawData = fs.readFileSync("data.json"); 
const crimeData = JSON.parse(rawData);

app.get("/data", (req, res) => {
   res.json(crimeData);
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
