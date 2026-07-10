#!/usr/bin/env node
/**
 * optimize-demo-photos.js
 *
 * Reads JPEG/PNG files from demo-originals/ directory, resizes to 2048px
 * on longest edge, outputs as optimized JPEG in public/demo/, and generates
 * manifest.json with metadata for each photo.
 *
 * Originals should be named original-01.jpg through original-12.jpg.
 * Missing slots get colored placeholder photos instead.
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const ORIGINALS_DIR = path.join(__dirname, '..', 'demo-originals');
const OUTPUT_DIR = path.join(__dirname, '..', 'public', 'demo');
const MAX_DIMENSION = 2048;
const JPEG_QUALITY = 80;

// Photo metadata -- fake dates spanning 2019-2024 for diverse date overlays
const PHOTO_META = [
  { id: 'demo-01', createTime: '2019-03-15T14:30:00Z', description: 'Mountain landscape' },
  { id: 'demo-02', createTime: '2019-08-22T09:15:00Z', description: 'Ocean beach' },
  { id: 'demo-03', createTime: '2020-06-18T16:45:00Z', description: 'City skyline at night' },
  { id: 'demo-04', createTime: '2020-12-25T10:30:00Z', description: 'Autumn forest path' },
  { id: 'demo-05', createTime: '2021-04-10T08:20:00Z', description: 'Cafe table with coffee' },
  { id: 'demo-06', createTime: '2021-09-14T18:00:00Z', description: 'Pet dog portrait' },
  { id: 'demo-07', createTime: '2022-02-14T13:00:00Z', description: 'Friends at dinner' },
  { id: 'demo-08', createTime: '2022-07-04T19:00:00Z', description: 'Street market scene' },
  { id: 'demo-09', createTime: '2023-05-20T07:45:00Z', description: 'Flower close-up' },
  { id: 'demo-10', createTime: '2023-11-23T12:00:00Z', description: 'Architectural doorway' },
  { id: 'demo-11', createTime: '2024-01-01T11:00:00Z', description: 'Person walking on path' },
  { id: 'demo-12', createTime: '2024-08-08T15:30:00Z', description: 'Tall waterfall' },
];

// Placeholder dimensions and colors (8 landscape, 4 portrait -- slots 9-12 are portrait)
const PLACEHOLDER_SPECS = [
  { width: 2048, height: 1365, color: { r: 70, g: 130, b: 180 } },   // steel blue - mountain
  { width: 2048, height: 1365, color: { r: 0, g: 128, b: 128 } },    // teal - ocean
  { width: 2048, height: 1365, color: { r: 25, g: 25, b: 80 } },     // midnight blue - city night
  { width: 1365, height: 2048, color: { r: 210, g: 105, b: 30 } },   // chocolate - autumn (portrait)
  { width: 2048, height: 1365, color: { r: 139, g: 90, b: 43 } },    // brown - cafe
  { width: 2048, height: 1365, color: { r: 184, g: 134, b: 11 } },   // goldenrod - pet
  { width: 2048, height: 1365, color: { r: 178, g: 34, b: 34 } },    // firebrick - dinner
  { width: 2048, height: 1365, color: { r: 255, g: 140, b: 0 } },    // dark orange - market
  { width: 1365, height: 2048, color: { r: 219, g: 112, b: 147 } },  // pale violet red - flower
  { width: 1365, height: 2048, color: { r: 105, g: 105, b: 105 } },  // dim gray - doorway
  { width: 1365, height: 2048, color: { r: 34, g: 139, b: 34 } },    // forest green - walking
  { width: 1365, height: 2048, color: { r: 65, g: 105, b: 225 } },   // royal blue - waterfall
];

async function processOriginal(inputPath, outputPath) {
  const image = sharp(inputPath);
  const metadata = await image.metadata();

  // Resize to 2048px on longest edge
  const resizeOpts = {};
  if (metadata.width >= metadata.height) {
    resizeOpts.width = MAX_DIMENSION;
  } else {
    resizeOpts.height = MAX_DIMENSION;
  }

  await image
    .resize({ ...resizeOpts, withoutEnlargement: true })
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toFile(outputPath);

  const outputMeta = await sharp(outputPath).metadata();
  return { width: outputMeta.width, height: outputMeta.height };
}

async function generatePlaceholder(index, outputPath, description) {
  const spec = PLACEHOLDER_SPECS[index];
  const { r, g, b } = spec.color;

  const svg = `<svg width="${spec.width}" height="${spec.height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:rgb(${r},${g},${b});stop-opacity:1" />
        <stop offset="100%" style="stop-color:rgb(${Math.max(0, r - 40)},${Math.max(0, g - 40)},${Math.max(0, b - 40)});stop-opacity:1" />
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#grad)" />
    <text x="50%" y="45%" font-family="sans-serif" font-size="48" fill="rgba(255,255,255,0.3)" text-anchor="middle" dominant-baseline="middle">${description}</text>
    <text x="50%" y="55%" font-family="sans-serif" font-size="32" fill="rgba(255,255,255,0.2)" text-anchor="middle" dominant-baseline="middle">PLACEHOLDER</text>
  </svg>`;

  await sharp(Buffer.from(svg))
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toFile(outputPath);

  return { width: spec.width, height: spec.height };
}

async function main() {
  console.log('Demo Photo Optimizer');
  console.log('====================\n');

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  if (!fs.existsSync(ORIGINALS_DIR)) {
    fs.mkdirSync(ORIGINALS_DIR, { recursive: true });
  }

  const supportedExts = ['.jpg', '.jpeg', '.png', '.webp', '.tiff'];
  const manifest = [];
  let placeholderCount = 0;

  for (let i = 0; i < PHOTO_META.length; i++) {
    const num = String(i + 1).padStart(2, '0');
    const meta = PHOTO_META[i];
    const outputFile = `photo-${num}.jpg`;
    const outputPath = path.join(OUTPUT_DIR, outputFile);

    // Look for original file with matching number
    const originalName = fs.readdirSync(ORIGINALS_DIR)
      .filter(f => supportedExts.includes(path.extname(f).toLowerCase()))
      .find(f => f.includes(`-${num}.`) || f.includes(`_${num}.`));

    let dims;
    let source;

    if (originalName) {
      const inputPath = path.join(ORIGINALS_DIR, originalName);
      try {
        dims = await processOriginal(inputPath, outputPath);
        source = 'original';
      } catch (err) {
        console.warn(`  Error processing ${originalName}: ${err.message}`);
        dims = await generatePlaceholder(i, outputPath, meta.description);
        source = 'placeholder (processing error)';
        placeholderCount++;
      }
    } else {
      dims = await generatePlaceholder(i, outputPath, meta.description);
      source = 'placeholder';
      placeholderCount++;
    }

    const sizeKB = Math.round(fs.statSync(outputPath).size / 1024);
    const orientation = dims.height > dims.width ? 'portrait' : 'landscape';
    console.log(`  ${outputFile}: ${dims.width}x${dims.height} (${sizeKB}KB) ${orientation} - ${meta.description} [${source}]`);

    manifest.push({
      id: meta.id,
      file: outputFile,
      createTime: meta.createTime,
      width: dims.width,
      height: dims.height,
      description: meta.description,
    });
  }

  // Write manifest
  const manifestPath = path.join(OUTPUT_DIR, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  const portraitCount = manifest.filter(m => m.height > m.width).length;
  const totalBytes = manifest.reduce((sum, m) => {
    const filePath = path.join(OUTPUT_DIR, m.file);
    return sum + (fs.existsSync(filePath) ? fs.statSync(filePath).size : 0);
  }, 0);
  const manifestSize = fs.statSync(manifestPath).size;

  console.log(`\nManifest written: ${manifestPath}`);
  console.log(`Total photos: ${manifest.length}`);
  console.log(`  From originals: ${manifest.length - placeholderCount}`);
  console.log(`  Placeholders: ${placeholderCount}`);
  console.log(`Portrait photos: ${portraitCount}`);
  console.log(`Total size: ${((totalBytes + manifestSize) / 1024 / 1024).toFixed(2)} MB`);

  if (placeholderCount > 0) {
    console.log(`\nNOTE: ${placeholderCount} placeholder(s) in use.`);
    console.log('Add original photos to demo-originals/ and re-run to replace them.');
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
