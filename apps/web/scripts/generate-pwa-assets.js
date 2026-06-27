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
const repoRoot = path.resolve(__dirname, '..', '..', '..');
const sourceLogoPath = path.join(publicDir, 'ontrack-logo.png');
const iosLaunchLogoDir = path.join(
    repoRoot,
    'apps',
    'ios',
    'OnTrack',
    'Assets.xcassets',
    'LaunchLogo.imageset'
);
const splashBackgrounds = {
    light: '#f8fafc',
    dark: '#0f172a',
};

// Create splash directory if it doesn't exist
if (!fs.existsSync(splashDir)) {
    fs.mkdirSync(splashDir, { recursive: true });
}

// Shared constant: icon size in CSS pixels (must match .native-splash img)
const ICON_SIZE_CSS = 100;

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
        console.error(
            'Sharp is required to generate app icons and splash PNGs.'
        );
        console.error('Install dependencies, then run this script again.');
        return;
    }

    if (!fs.existsSync(sourceLogoPath)) {
        throw new Error(`Missing logo source: ${sourceLogoPath}`);
    }

    console.log('Generating PWA assets from the transparent logo...\n');

    // Generate splash screens
    for (const { name, width, height, dpr, safeAreaTop } of splashSizes) {
        const iconSize = Math.round(ICON_SIZE_CSS * dpr);
        const halfIcon = iconSize / 2;
        const yOffset = safeAreaTop / 2;
        const icon = await sharp(sourceLogoPath)
            .resize(iconSize, iconSize, { fit: 'contain' })
            .png()
            .toBuffer();

        for (const [theme, background] of Object.entries(splashBackgrounds)) {
            const themedName =
                theme === 'light' ? name : name.replace('.png', '-dark.png');

            await sharp({
                create: {
                    width,
                    height,
                    channels: 4,
                    background,
                },
            })
                .composite([
                    {
                        input: icon,
                        left: Math.round(width / 2 - halfIcon),
                        top: Math.round(height / 2 - halfIcon + yOffset),
                    },
                ])
                .png()
                .toFile(path.join(splashDir, themedName));
            console.log(`Generated: splash/${themedName}`);
        }
    }

    // Generate icons
    for (const { name, size } of iconSizes) {
        if (name === 'favicon.ico') {
            await sharp(sourceLogoPath)
                .resize(32, 32)
                .png()
                .toFile(path.join(publicDir, 'favicon.png'));
            console.log(
                `Generated: favicon.png (convert to .ico manually if needed)`
            );
        } else {
            await sharp(sourceLogoPath)
                .resize(size, size)
                .png()
                .toFile(path.join(publicDir, name));
            console.log(`Generated: ${name}`);
        }
    }

    // Generate iOS launch screen logo renditions.
    for (const scale of [1, 2, 3]) {
        const size = 160 * scale;
        const filename =
            scale === 1 ? 'launch-logo.png' : `launch-logo@${scale}x.png`;

        await sharp(sourceLogoPath)
            .resize(size, size, { fit: 'contain' })
            .png()
            .toFile(path.join(iosLaunchLogoDir, filename));
        console.log(`Generated: iOS LaunchLogo/${filename}`);
    }

    console.log('\nAll PWA assets generated successfully!');
}

generateAssets().catch(console.error);
