/**
 * Flux PWA Server
 * Node.js 22 Production Server
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class FluxServer {
    constructor() {
        this.app = express();
        this.port = process.env.PORT || 3000;
        this.env = process.env.NODE_ENV || 'development';
        
        // Rate limiting
        this.rateLimiter = new RateLimiterMemory({
            points: 100, // 100 requests
            duration: 60, // per 60 seconds
            blockDuration: 300 // block for 5 minutes
        });
        
        this.initialize();
    }

    initialize() {
        // Trust proxy for Vercel/Render
        this.app.set('trust proxy', 1);
        
        // Security headers
        this.setupSecurity();
        
        // Middleware
        this.setupMiddleware();
        
        // Routes
        this.setupRoutes();
        
        // Error handling
        this.setupErrorHandling();
    }

    setupSecurity() {
        // Helmet security headers
        this.app.use(helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    styleSrc: ["'self'", "'unsafe-inline'", "fonts.googleapis.com"],
                    scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
                    fontSrc: ["'self'", "fonts.gstatic.com"],
                    imgSrc: ["'self'", "data:", "https:", "blob:"],
                    connectSrc: [
                        "'self'",
                        "https://functions.yandexcloud.net",
                        "https://*.yandexcloud.net"
                    ],
                    frameSrc: ["'none'"],
                    objectSrc: ["'none'"]
                }
            },
            crossOriginEmbedderPolicy: false,
            crossOriginResourcePolicy: { policy: "cross-origin" }
        }));
        
        // CORS configuration
        const corsOptions = {
            origin: this.env === 'development' 
                ? ['http://localhost:3000', 'http://127.0.0.1:3000']
                : ['https://flux-pwa.vercel.app', 'https://*.vercel.app'],
            methods: ['GET', 'POST', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
            credentials: true,
            maxAge: 86400
        };
        
        this.app.use(cors(corsOptions));
        
        // Rate limiting middleware
        this.app.use(this.rateLimitMiddleware.bind(this));
    }

    setupMiddleware() {
        // Compression
        this.app.use(compression({
            level: 6,
            threshold: 0,
            filter: (req, res) => {
                if (req.headers['x-no-compression']) {
                    return false;
                }
                return compression.filter(req, res);
            }
        }));
        
        // Body parsing
        this.app.use(express.json({
            limit: '10mb',
            verify: (req, res, buf) => {
                req.rawBody = buf.toString();
            }
        }));
        
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
        
        // Logging
        if (this.env !== 'test') {
            this.app.use(morgan(this.env === 'development' ? 'dev' : 'combined'));
        }
        
        // Static files
        this.app.use(express.static(join(__dirname, 'public'), {
            maxAge: this.env === 'production' ? '1y' : '0',
            setHeaders: (res, path) => {
                if (path.endsWith('.html')) {
                    res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
                }
            }
        }));
        
        // Request ID
        this.app.use((req, res, next) => {
            req.id = Date.now().toString(36) + Math.random().toString(36).substr(2);
            res.setHeader('X-Request-ID', req.id);
            next();
        });
    }

    setupRoutes() {
        // Health check
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                nodeVersion: process.version,
                environment: this.env,
                memory: process.memoryUsage(),
                uptime: process.uptime()
            });
        });
        
        // API endpoints
        this.app.post('/api/analyze', this.analyzeHandler.bind(this));
        this.app.get('/api/metrics', this.metricsHandler.bind(this));
        this.app.get('/api/config', this.configHandler.bind(this));
        
        // PWA manifest
        this.app.get('/manifest.json', (req, res) => {
            res.setHeader('Content-Type', 'application/manifest+json');
            res.sendFile(join(__dirname, 'public/manifest.json'));
        });
        
        // Service Worker
        this.app.get('/service-worker.js', (req, res) => {
            res.setHeader('Content-Type', 'application/javascript');
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.sendFile(join(__dirname, 'public/service-worker.js'));
        });
        
        // SPA fallback
        this.app.get('*', (req, res) => {
            if (req.accepts('html')) {
                res.sendFile(join(__dirname, 'public/index.html'));
            } else {
                res.status(404).json({ error: 'Not found' });
            }
        });
    }

    async analyzeHandler(req, res) {
        try {
            const { audioUrl } = req.body;
            
            if (!audioUrl || typeof audioUrl !== 'string') {
                return res.status(400).json({
                    error: 'Invalid request',
                    message: 'audioUrl is required'
                });
            }
            
            // Validate URL
            try {
                new URL(audioUrl);
            } catch {
                return res.status(400).json({
                    error: 'Invalid URL',
                    message: 'Please provide a valid audio URL'
                });
            }
            
            // Forward to Yandex Cloud Function
            const yandexResponse = await fetch(
                process.env.YANDEX_FUNCTION_URL || 
                'https://functions.yandexcloud.net/d4ecmila416om4c1gh93',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Forwarded-For': req.ip,
                        'X-Request-ID': req.id
                    },
                    body: JSON.stringify({ audioUrl })
                }
            );
            
            if (!yandexResponse.ok) {
                throw new Error(`Yandex API error: ${yandexResponse.status}`);
            }
            
            const data = await yandexResponse.json();
            
            res.json({
                success: true,
                data,
                metadata: {
                    processedBy: 'Flux Node.js 22 Server',
                    requestId: req.id,
                    timestamp: new Date().toISOString()
                }
            });
            
        } catch (error) {
            console.error('Analysis error:', error);
            
            res.status(500).json({
                error: 'Analysis failed',
                message: error.message,
                requestId: req.id
            });
        }
    }

    metricsHandler(req, res) {
        const metrics = {
            node: {
                version: process.version,
                memory: process.memoryUsage(),
                uptime: process.uptime(),
                cpu: process.cpuUsage()
            },
            system: {
                arch: process.arch,
                platform: process.platform,
                cpus: require('os').cpus().length
            },
            requests: {
                total: this.rateLimiter.points,
                remaining: this.rateLimiter.remainingPoints
            },
            timestamp: new Date().toISOString()
        };
        
        res.json(metrics);
    }

    configHandler(req, res) {
        const config = {
            endpoints: {
                analyze: '/api/analyze',
                health: '/health',
                metrics: '/api/metrics'
            },
            limits: {
                maxFileSize: '25MB',
                rateLimit: '100 requests per minute'
            },
            features: {
                audioFormats: ['mp3', 'wav', 'm4a', 'flac'],
                analysisTypes: ['bpm', 'key', 'energy', 'loudness']
            },
            environment: this.env,
            nodeVersion: process.version,
            timestamp: new Date().toISOString()
        };
        
        res.json(config);
    }

    rateLimitMiddleware(req, res, next) {
        const key = req.ip || req.connection.remoteAddress;
        
        this.rateLimiter.consume(key)
            .then(() => {
                next();
            })
            .catch(() => {
                res.status(429).json({
                    error: 'Too many requests',
                    message: 'Rate limit exceeded. Please try again later.',
                    retryAfter: 300
                });
            });
    }

    setupErrorHandling() {
        // 404 handler
        this.app.use((req, res) => {
            res.status(404).json({
                error: 'Not Found',
                message: `Cannot ${req.method} ${req.path}`,
                requestId: req.id
            });
        });
        
        // Error handler
        this.app.use((error, req, res, next) => {
            console.error('Server error:', error);
            
            const status = error.status || 500;
            const message = this.env === 'production' 
                ? 'Internal server error' 
                : error.message;
            
            res.status(status).json({
                error: 'Server Error',
                message,
                requestId: req.id,
                ...(this.env === 'development' && { stack: error.stack })
            });
        });
        
        // Graceful shutdown
        process.on('SIGTERM', () => {
            console.log('SIGTERM received. Shutting down gracefully...');
            this.server.close(() => {
                console.log('Server closed');
                process.exit(0);
            });
        });
    }

    start() {
        this.server = this.app.listen(this.port, () => {
            console.log(`
🚀 Flux Server v2.0.0
──────────────────────────────
Environment: ${this.env}
Node.js: ${process.version}
Port: ${this.port}
URL: http://localhost:${this.port}
──────────────────────────────
            `);
        });
        
        return this.server;
    }

    stop() {
        if (this.server) {
            this.server.close();
        }
    }
}

// Start server if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const server = new FluxServer();
    server.start();
}

export { FluxServer };
