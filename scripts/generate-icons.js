const sharp = require('sharp');
const path = require('path');

async function generateIcon(size, filename) {
  const fontSize = Math.floor(size / 5);

  // Create SVG with OKNO text
  const svg = `
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${size}" height="${size}" fill="#000000"/>
      <text
        x="50%"
        y="50%"
        font-family="Arial, sans-serif"
        font-size="${fontSize}"
        font-weight="bold"
        fill="#FFFFFF"
        text-anchor="middle"
        dominant-baseline="middle">OKNO</text>
    </svg>
  `;

  await sharp(Buffer.from(svg))
    .png()
    .toFile(path.join(__dirname, '..', 'public', 'icons', filename));

  console.log(`Generated ${filename} (${size}x${size})`);
}

async function main() {
  await generateIcon(192, 'icon-192.png');
  await generateIcon(512, 'icon-512.png');
  await generateIcon(180, 'apple-touch-icon.png');
  console.log('All icons generated successfully!');
}

main().catch(console.error);
