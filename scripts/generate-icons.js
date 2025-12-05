#!/usr/bin/env node
/**
 * Icon Generator for Flux PWA
 * Node.js 22 Script
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ICON_SIZES = [72, 96, 128, 144, 152, 192, 384, 512];
const OUTPUT_DIR = join(__dirname, '../public/icons');

class IconGenerator {
    constructor() {
        this.sourceImage = join(__dirname, '../assets/icon-source.png');
        this.outputDir = OUTPUT_DIR;
    }

    async generate() {
        console.log('🎨 Generating PWA icons...');
        
        try {
            // Create output directory
            await fs.mkdir(this.outputDir, { recursive: true });
            
            // Generate icons for each size
            const promises = ICON_SIZES.map(size => this.generateIcon(size));
            
            await Promise.all(promises);
            
            console.log('✅ Icons generated successfully');
            console.log(`📁 Location: ${this.outputDir}`);
            
            // Generate manifest entry
            await this.generateManifestEntry();
            
        } catch (error) {
            console.error('❌ Error generating icons:', error);
            process.exit(1);
        }
    }

    async generateIcon(size) {
        const outputPath = join(this.outputDir, `icon-${size}x${size}.png`);
        
        try {
            await sharp(this.sourceImage)
                .resize(size, size, {
                    fit: 'contain',
                    background: { r: 102, g: 126, b: 234, alpha: 1 }
                })
                .png({
                    compressionLevel: 9,
                    palette: true,
                    quality: 100
                })
                .toFile(outputPath);
            
            console.log(`   ✓ ${size}x${size}`);
            
        } catch (error) {
            console.warn(`   ✗ ${size}x${size} (${error.message})`);
            
            // Generate fallback icon
            await this.generateFallbackIcon(size, outputPath);
        }
    }

    async generateFallbackIcon(size, outputPath) {
        const svg = `
            <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stop-color="#667eea"/>
                        <stop offset="100%" stop-color="#764ba2"/>
                    </linearGradient>
                </defs>
                <rect width="100%" height="100%" fill="url(#gradient)"/>
                <text x="50%" y="50%" 
                      font-family="Arial, sans-serif" 
                      font-size="${size / 4}" 
                      fill="white" 
                      text-anchor="middle" 
                      dominant-baseline="middle">
                    🎵
                </text>
            </svg>
        `;
        
        await sharp(Buffer.from(svg))
            .png()
            .toFile(outputPath);
    }

    async generateManifestEntry() {
        const manifestPath = join(__dirname, '../public/manifest.json');
        
        try {
            const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
            
            manifest.icons = ICON_SIZES.map(size => ({
                src: `/icons/icon-${size}x${size}.png`,
                sizes: `${size}x${size}`,
                type: 'image/png',
                purpose: 'any maskable'
            }));
            
            await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
            
            console.log('✅ Manifest updated');
            
        } catch (error) {
            console.warn('⚠️  Could not update manifest:', error.message);
        }
    }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const generator = new IconGenerator();
    generator.generate();
}

export { IconGenerator };
