const sharp = require("sharp");
const fs = require("node:fs/promises");
const path = require("node:path");
const root = path.join(process.cwd(), "android", "app", "src", "main", "res");
const sizes = {
  "mipmap-mdpi": { icon: 48, foreground: 108 },
  "mipmap-hdpi": { icon: 72, foreground: 162 },
  "mipmap-xhdpi": { icon: 96, foreground: 216 },
  "mipmap-xxhdpi": { icon: 144, foreground: 324 },
  "mipmap-xxxhdpi": { icon: 192, foreground: 432 }
};
(async () => {
  for (const [folder, size] of Object.entries(sizes)) {
    const dir = path.join(root, folder);
    await fs.mkdir(dir, { recursive: true });
    for (const name of ["ic_launcher.png", "ic_launcher_round.png"]) {
      await sharp(path.join(process.cwd(), "icon.svg")).resize(size.icon, size.icon).png().toFile(path.join(dir, name));
    }
    await sharp(path.join(process.cwd(), "icon.svg")).resize(size.foreground, size.foreground, { fit: "contain" }).png().toFile(path.join(dir, "ic_launcher_foreground.png"));
  }
  const values = path.join(root, "values");
  await fs.mkdir(values, { recursive: true });
  const colorsPath = path.join(values, "colors.xml");
  let colors = "";
  try { colors = await fs.readFile(colorsPath, "utf8"); } catch {}
  if (colors.includes("</resources>")) {
    if (colors.includes('name="ic_launcher_background"')) {
      colors = colors.replace(/<color name="ic_launcher_background">.*?<\/color>/, '<color name="ic_launcher_background">#F4DFCC</color>');
    } else {
      colors = colors.replace("</resources>", '    <color name="ic_launcher_background">#F4DFCC</color>\n</resources>');
    }
  } else {
    colors = '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#F4DFCC</color>\n</resources>\n';
  }
  await fs.writeFile(colorsPath, colors);
  console.log("Branded Letícia Borges Nails launcher icons generated.");
})().catch(error => { console.error(error); process.exit(1); });
