const fs = require("fs");
const path = require("path");

const root = process.cwd();
const dist = path.join(root, "dist");

console.log("Build script:", __filename);
console.log("Project root:", root);

function copyTree(source, target) {
  if (!fs.existsSync(source)) {
    throw new Error("Missing required path: " + source);
  }

  const stat = fs.statSync(source);

  if (stat.isDirectory()) {
    fs.mkdirSync(target, { recursive: true });

    for (const name of fs.readdirSync(source)) {
      copyTree(
        path.join(source, name),
        path.join(target, name)
      );
    }

    return;
  }

  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

if (!fs.existsSync(path.join(dist, "index.html"))) {
  throw new Error("Vite output is missing. Run this script through npm run build.");
}

console.log("Copying public-resources");
copyTree(
  path.join(root, "public-resources"),
  path.join(dist, "public-resources")
);

const appSource = path.join(root, "app");

if (fs.existsSync(appSource)) {
  console.log("Copying app");
  copyTree(
    appSource,
    path.join(dist, "app")
  );
} else {
  console.log("Optional app directory not found");
}

const imagePattern = /\.(jpg|jpeg|png|webp|svg|ico)$/i;

for (const name of fs.readdirSync(root)) {
  const source = path.join(root, name);

  if (
    fs.statSync(source).isFile() &&
    imagePattern.test(name)
  ) {
    copyTree(source, path.join(dist, name));
  }
}

const vocabDir = path.join(
  dist,
  "public-resources",
  "kaoyan-english-2027-vocabulary"
);

if (!fs.existsSync(vocabDir)) {
  throw new Error("Vocabulary output directory was not created.");
}

const vocabFiles = fs
  .readdirSync(vocabDir)
  .filter(name => name.toLowerCase().endsWith(".json"));

if (vocabFiles.length < 3) {
  throw new Error(
    "Expected at least 3 vocabulary JSON files, found " +
    vocabFiles.length
  );
}

console.log("Vocabulary JSON files:", vocabFiles.length);
console.log("Static resources added to the Vite production build.");
