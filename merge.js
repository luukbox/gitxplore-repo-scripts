const fs = require("fs");
const path = require("path");

const target = "pkgs";
const files = fs.readdirSync(path.join(__dirname, target));
const json = files.map((file) => require(path.join(__dirname, target, file)));

const combined = {};
json.forEach((data) => {
  for (let projName in data) {
    if (data[projName].dependencies) combined[projName] = data[projName];
  }
});

console.log(Object.keys(combined).length);
fs.writeFileSync("merged.json", JSON.stringify(combined, null, 2));
