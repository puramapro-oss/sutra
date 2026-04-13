import sharp from "sharp";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import https from "https";
import http from "http";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const assetsDir = path.join(__dirname, "..", "assets");

if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

const PROMPT =
  "Minimalist modern app icon, cinematic film reel and camera lens merged together, glowing purple and cyan neon gradients on pure black background, glass morphism effect, no text, centered, 3D depth, professional design";

const IMAGE_URL = `https://image.pollinations.ai/prompt/${encodeURIComponent(PROMPT)}?width=1024&height=1024&model=flux&enhance=true&nologo=true`;

function downloadImage(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https") ? https : http;
    client.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadImage(res.headers.location).then(resolve).catch(reject);
      }
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve(Buffer.concat(chunks)));
      res.on("error", reject);
    }).on("error", reject);
  });
}

async function generateIcons() {
  console.log("Downloading icon from Pollinations...");

  let iconBuffer;
  try {
    iconBuffer = await downloadImage(IMAGE_URL);
    console.log(`Downloaded ${iconBuffer.length} bytes`);
  } catch (err) {
    console.log("Pollinations unavailable, generating fallback SVG icon...");
    const svg = `<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#0A0A0F"/>
          <stop offset="100%" style="stop-color:#1a1a2e"/>
        </linearGradient>
        <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#8B5CF6"/>
          <stop offset="100%" style="stop-color:#06B6D4"/>
        </linearGradient>
      </defs>
      <rect width="1024" height="1024" rx="200" fill="url(#bg)"/>
      <circle cx="512" cy="440" r="200" fill="none" stroke="url(#accent)" stroke-width="40"/>
      <circle cx="512" cy="440" r="80" fill="url(#accent)"/>
      <rect x="360" y="680" width="304" height="60" rx="30" fill="url(#accent)" opacity="0.8"/>
    </svg>`;
    iconBuffer = await sharp(Buffer.from(svg)).resize(1024, 1024).png().toBuffer();
  }

  // Icon 1024x1024
  await sharp(iconBuffer).resize(1024, 1024).png().toFile(path.join(assetsDir, "icon.png"));
  console.log("✓ icon.png (1024x1024)");

  // Adaptive icon with padding on dark background
  const adaptiveSize = 1024;
  const padding = 100;
  const innerSize = adaptiveSize - padding * 2;
  const adaptiveBuffer = await sharp(iconBuffer).resize(innerSize, innerSize).toBuffer();
  await sharp({
    create: { width: adaptiveSize, height: adaptiveSize, channels: 4, background: { r: 10, g: 10, b: 15, alpha: 1 } },
  })
    .composite([{ input: adaptiveBuffer, left: padding, top: padding }])
    .png()
    .toFile(path.join(assetsDir, "adaptive-icon.png"));
  console.log("✓ adaptive-icon.png (1024x1024 with padding)");

  // Splash 1284x2778
  const splashIcon = await sharp(iconBuffer).resize(400, 400).toBuffer();
  await sharp({
    create: { width: 1284, height: 2778, channels: 4, background: { r: 10, g: 10, b: 15, alpha: 1 } },
  })
    .composite([{ input: splashIcon, left: 442, top: 1100 }])
    .png()
    .toFile(path.join(assetsDir, "splash.png"));
  console.log("✓ splash.png (1284x2778)");

  // Favicon 48x48
  await sharp(iconBuffer).resize(48, 48).png().toFile(path.join(assetsDir, "favicon.png"));
  console.log("✓ favicon.png (48x48)");

  // Notification icon 96x96
  await sharp(iconBuffer).resize(96, 96).png().toFile(path.join(assetsDir, "notification-icon.png"));
  console.log("✓ notification-icon.png (96x96)");

  // Feature graphic 1024x500
  const featureIcon = await sharp(iconBuffer).resize(300, 300).toBuffer();
  const featureSvg = `<svg width="1024" height="500" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="fbg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#0A0A0F"/>
        <stop offset="50%" style="stop-color:#1a1a2e"/>
        <stop offset="100%" style="stop-color:#0A0A0F"/>
      </linearGradient>
    </defs>
    <rect width="1024" height="500" fill="url(#fbg)"/>
    <text x="620" y="220" font-family="Arial, sans-serif" font-size="64" font-weight="bold" fill="white">SUTRA</text>
    <text x="620" y="280" font-family="Arial, sans-serif" font-size="24" fill="rgba(255,255,255,0.6)">Crée des vidéos virales avec l'IA</text>
  </svg>`;
  const featureBg = await sharp(Buffer.from(featureSvg)).resize(1024, 500).png().toBuffer();
  await sharp(featureBg)
    .composite([{ input: featureIcon, left: 100, top: 100 }])
    .png()
    .toFile(path.join(assetsDir, "feature-graphic.png"));
  console.log("✓ feature-graphic.png (1024x500)");

  console.log("\n✅ All icons generated successfully!");
}

generateIcons().catch(console.error);
