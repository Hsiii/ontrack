#!/usr/bin/env node
/**
 * Generate PWA assets: splash screens, app icons
 * Run with: node scripts/generate-pwa-assets.js
 *
 * Requires: npm install sharp (dev dependency)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '..', 'public');
const splashDir = path.join(publicDir, 'splash');

// Create splash directory if it doesn't exist
if (!fs.existsSync(splashDir)) {
    fs.mkdirSync(splashDir, { recursive: true });
}

// Shared constant: icon size in CSS pixels (must match InitialLoadingScreen.css)
const ICON_SIZE_CSS = 100;

// SVG template for splash screens
const createSplashSVG = (width, height, dpr, safeAreaTop = 0) => {
    // Convert CSS pixels to physical pixels using the device pixel ratio
    const iconSize = ICON_SIZE_CSS * dpr;
    const halfIcon = iconSize / 2;
    // Offset icon down by half safe area so it centers on viewport, not full screen
    const yOffset = safeAreaTop / 2;

    return `
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#0f172a"/>
  <g transform="translate(${width / 2 - halfIcon}, ${height / 2 - halfIcon + yOffset})">
    <svg width="${iconSize}" height="${iconSize}" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M8 3.1V7a4 4 0 0 0 8 0V3.1"/>
      <path d="m9 15-1-1"/>
      <path d="m15 15 1-1"/>
      <path d="M9 19c-2.8 0-5-2.2-5-5v-4a8 8 0 0 1 16 0v4c0 2.8-2.2 5-5 5Z"/>
      <path d="m8 19-2 3"/>
      <path d="m16 19 2 3"/>
    </svg>
  </g>
</svg>
`;
};

// SVG template for app icons
const createIconSVG = (size) => `
<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#0f172a" rx="${size * 0.2}"/>
  <g transform="translate(${size * 0.15}, ${size * 0.15})">
    <svg width="${size * 0.7}" height="${size * 0.7}" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M8 3.1V7a4 4 0 0 0 8 0V3.1"/>
      <path d="m9 15-1-1"/>
      <path d="m15 15 1-1"/>
      <path d="M9 19c-2.8 0-5-2.2-5-5v-4a8 8 0 0 1 16 0v4c0 2.8-2.2 5-5 5Z"/>
      <path d="m8 19-2 3"/>
      <path d="m16 19 2 3"/>
    </svg>
  </g>
</svg>
`;

// Splash screen sizes for iOS devices (with device pixel ratios and safe area insets)
// safeAreaTop is the status bar/notch/Dynamic Island height in physical pixels
const splashSizes = [
    {
        name: 'apple-splash-750x1334.png',
        width: 750,
        height: 1334,
        dpr: 2,
        safeAreaTop: 40,
    }, // iPhone SE, 8 (20pt * 2)
    {
        name: 'apple-splash-1242x2208.png',
        width: 1242,
        height: 2208,
        dpr: 3,
        safeAreaTop: 60,
    }, // iPhone 8 Plus (20pt * 3)
    {
        name: 'apple-splash-1125x2436.png',
        width: 1125,
        height: 2436,
        dpr: 3,
        safeAreaTop: 132,
    }, // iPhone X, XS, 11 Pro (44pt * 3)
    {
        name: 'apple-splash-828x1792.png',
        width: 828,
        height: 1792,
        dpr: 2,
        safeAreaTop: 96,
    }, // iPhone XR, 11 (48pt * 2)
    {
        name: 'apple-splash-1242x2688.png',
        width: 1242,
        height: 2688,
        dpr: 3,
        safeAreaTop: 132,
    }, // iPhone XS Max, 11 Pro Max (44pt * 3)
    {
        name: 'apple-splash-1080x2340.png',
        width: 1080,
        height: 2340,
        dpr: 3,
        safeAreaTop: 150,
    }, // iPhone 12 mini, 13 mini (50pt * 3)
    {
        name: 'apple-splash-1170x2532.png',
        width: 1170,
        height: 2532,
        dpr: 3,
        safeAreaTop: 141,
    }, // iPhone 12, 12 Pro, 13, 13 Pro, 14 (47pt * 3)
    {
        name: 'apple-splash-1284x2778.png',
        width: 1284,
        height: 2778,
        dpr: 3,
        safeAreaTop: 141,
    }, // iPhone 12 Pro Max, 13 Pro Max, 14 Plus (47pt * 3)
    {
        name: 'apple-splash-1179x2556.png',
        width: 1179,
        height: 2556,
        dpr: 3,
        safeAreaTop: 177,
    }, // iPhone 14 Pro, 15, 15 Pro (59pt * 3)
    {
        name: 'apple-splash-1290x2796.png',
        width: 1290,
        height: 2796,
        dpr: 3,
        safeAreaTop: 177,
    }, // iPhone 14 Pro Max, 15 Plus, 15 Pro Max (59pt * 3)
    {
        name: 'apple-splash-1536x2048.png',
        width: 1536,
        height: 2048,
        dpr: 2,
        safeAreaTop: 40,
    }, // iPad Mini, iPad Air (20pt * 2)
    {
        name: 'apple-splash-1668x2388.png',
        width: 1668,
        height: 2388,
        dpr: 2,
        safeAreaTop: 40,
    }, // iPad Pro 11" (20pt * 2)
    {
        name: 'apple-splash-2048x2732.png',
        width: 2048,
        height: 2732,
        dpr: 2,
        safeAreaTop: 40,
    }, // iPad Pro 12.9" (20pt * 2)
];

// Icon sizes
const iconSizes = [
    { name: 'apple-touch-icon.png', size: 180 },
    { name: 'pwa-192x192.png', size: 192 },
    { name: 'pwa-512x512.png', size: 512 },
    { name: 'favicon.ico', size: 32 },
];

async function generateAssets() {
    let sharp;
    try {
        sharp = (await import('sharp')).default;
    } catch (e) {
        console.log('Sharp not installed. Creating SVG placeholders instead.');
        console.log('To generate PNG files, run: npm install -D sharp');
        console.log('Then run this script again.\n');

        // Create SVG placeholders
        for (const { name, width, height, dpr, safeAreaTop } of splashSizes) {
            const svgPath = path.join(splashDir, name.replace('.png', '.svg'));
            fs.writeFileSync(
                svgPath,
                createSplashSVG(width, height, dpr, safeAreaTop)
            );
            console.log(
                `Created SVG placeholder: splash/${name.replace('.png', '.svg')}`
            );
        }

        for (const { name, size } of iconSizes) {
            if (name !== 'favicon.ico') {
                const svgPath = path.join(
                    publicDir,
                    name.replace('.png', '.svg')
                );
                fs.writeFileSync(svgPath, createIconSVG(size));
                console.log(
                    `Created SVG placeholder: ${name.replace('.png', '.svg')}`
                );
            }
        }

        console.log("\nNote: SVG splash screens won't work on iOS.");
        console.log('Install sharp and re-run to generate proper PNG files.');
        return;
    }

    console.log('Generating PWA assets with sharp...\n');

    // Generate splash screens
    for (const { name, width, height, dpr, safeAreaTop } of splashSizes) {
        const svg = createSplashSVG(width, height, dpr, safeAreaTop);
        await sharp(Buffer.from(svg)).png().toFile(path.join(splashDir, name));
        console.log(`Generated: splash/${name}`);
    }

    // Generate icons
    for (const { name, size } of iconSizes) {
        const svg = createIconSVG(size);
        if (name === 'favicon.ico') {
            await sharp(Buffer.from(svg))
                .resize(32, 32)
                .png()
                .toFile(path.join(publicDir, 'favicon.png'));
            console.log(
                `Generated: favicon.png (convert to .ico manually if needed)`
            );
        } else {
            await sharp(Buffer.from(svg))
                .png()
                .toFile(path.join(publicDir, name));
            console.log(`Generated: ${name}`);
        }
    }

    console.log('\nAll PWA assets generated successfully!');
}

generateAssets().catch(console.error);
