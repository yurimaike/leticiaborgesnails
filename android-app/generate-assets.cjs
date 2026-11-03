const sharp = require("sharp");
const fs = require("node:fs/promises");
const path = require("node:path");
const root = path.join(process.cwd(), "android", "app", "src", "main", "res");
const sizes = { "mipmap-mdpi":48, "mipmap-hdpi":72, "mipmap-xhdpi":96, "mipmap-xxhdpi":144, "mipmap-xxxhdpi":192 };
(async () => {
  for (const [folder, size] of Object.entries(sizes)) {
    const dir = path.join(root, folder);
    await fs.mkdir(dir, { recursive: true });
    for (const name of ["ic_launcher.png", "ic_launcher_round.png"]) {
      await sharp(path.join(process.cwd(), "icon.svg")).resize(size, size).png().toFile(path.join(dir, name));
    }
  }
  console.log("Branded Letícia Borges Nails launcher icons generated.");
})().catch(error => { console.error(error); process.exit(1); });
