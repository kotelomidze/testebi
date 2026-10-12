// საიტის აწყობისას (Cloudflare → Build command: node list-files.js) ქმნის files.json-ს:
// სიას ყველა ფაილისა, რაც დევს საქაღალდეებში wignebi, prezentaciebi და masala.
// ასე აპლიკაცია ახალ ფაილებს თავისით პოულობს — ხელით დამატება აღარ სჭირდება.
const fs = require("fs");
const path = require("path");

const DIRS = ["wignebi", "prezentaciebi", "masala"];
const out = { generated: new Date().toISOString(), files: {} };

for (const d of DIRS) {
  let names = [];
  try {
    names = fs.readdirSync(path.join(__dirname, d), { withFileTypes: true })
      .filter(e => e.isFile() && !e.name.startsWith(".") && !/\.(txt|md)$/i.test(e.name))
      .map(e => e.name)
      .sort((a, b) => a.localeCompare(b, "ka"));
  } catch (e) { /* საქაღალდე ჯერ არ არსებობს */ }
  out.files[d] = names;
}

fs.writeFileSync(path.join(__dirname, "files.json"), JSON.stringify(out, null, 1));
console.log("files.json:", Object.entries(out.files).map(([d, f]) => d + " " + f.length).join(", "));
