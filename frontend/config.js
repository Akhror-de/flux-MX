/**
 * Flux PWA Configuration
 * Production Environment Settings
 */

const FLUX_CONFIG = (function() {
    'use strict';
    
    // Environment detection
    const env = {
        isProduction: window.location.hostname !== 'localhost' && 
                     window.location.hostname !== '127.0.0.1',
        isLocalhost: window.location.hostname === 'localhost' || 
                    window.location.hostname === '127.0.0.1',
        isSecure: window.location.protocol === 'https:',
        isPWA: window.matchMedia('(display-mode: standalone)').matches ||
               window.navigator.standalone === true
    };
    
    // API Endpoints
    const ENDPOINTS = {
        // ⚠️ ВАЖНО: Замените на ваш реальный URL функции Яндекс.Облака
        ANALYZE_BPM: env.isProduction 
            ? 'https://functions.yandexcloud.net/d4ecmila416om4c1gh93'  // Production
            : 'https://functions.yandexcloud.net/d4ecmila416om4c1gh93', // Development (можете использовать другой)
        
        // Future endpoints
        AUDIO_PROCESSOR: 'https://functions.yandexcloud.net/audio-processor',
        RECOMMENDATIONS: 'https://functions.yandexcloud.net/recommendations'
    };
    
    // Application Settings
    const SETTINGS = {
        // Request settings
        TIMEOUT: 30000,           // 30 seconds
        MAX_FILE_SIZE: 25 * 1024 * 1024, // 25MB
        RETRY_ATTEMPTS: 2,
        RETRY_DELAY: 1000,
        
        // Cache settings
        CACHE_TTL: 5 * 60 * 1000, // 5 minutes
        MAX_CACHE_ENTRIES: 50,
        
        // UI settings
        ANIMATION_DURATION: 300,
        TOAST_DURATION: 5000,
        DEBOUNCE_DELAY: 300,
        
        // Audio settings
        SUPPORTED_FORMATS: [
            'audio/mpeg',
            'audio/mp3',
            'audio/wav',
            'audio/wave',
            'audio/x-wav',
            'audio/mp4',
            'audio/x-m4a',
            'audio/flac'
        ],
        
        // Performance settings
        LAZY_LOAD_DELAY: 100,
        IMAGE_QUALITY: 0.8
    };
    
    // Error Codes and Messages
    const ERRORS = {
        // Network errors
        NETWORK_ERROR: 'Network connection failed. Please check your internet connection.',
        TIMEOUT_ERROR: 'Request timeout. Please try again.',
        CORS_ERROR: 'Cross-origin request blocked. Please contact support.',
        
        // API errors
        API_UNAVAILABLE: 'Analysis service is temporarily unavailable.',
        INVALID_RESPONSE: 'Invalid response from server.',
        RATE_LIMITED: 'Too many requests. Please wait a moment.',
        
        // Input errors
        INVALID_URL: 'Please enter a valid audio URL (http:// or https://).',
        UNSUPPORTED_FORMAT: 'Unsupported audio format. Please use MP3, WAV, M4A, or FLAC.',
        FILE_TOO_LARGE: 'File is too large. Maximum size is 25MB.',
        NO_FILE_SELECTED: 'Please select an audio file.',
        NO_URL_PROVIDED: 'Please enter an audio URL.',
        
        // Processing errors
        ANALYSIS_FAILED: 'Audio analysis failed. Please try again.',
        DECODING_ERROR: 'Could not decode audio file.',
        UPLOAD_FAILED: 'File upload failed.'
    };
    
    // Feature Flags (can be toggled remotely if needed)
    const FEATURES = {
        ANALYZE_URL: true,
        ANALYZE_FILE: true,
        DEMO_PRESETS: true,
        RECOMMENDATIONS: true,
        HISTORY: true,
        SHARE: true,
        OFFLINE_MODE: true,
        PWA_INSTALL: true
    };
    
    // Analytics (optional)
    const ANALYTICS = {
        ENABLED: env.isProduction,
        TRACK_PAGEVIEWS: true,
        TRACK_EVENTS: true,
        TRACK_ERRORS: true,
        
        // Event categories
        CATEGORIES: {
            ANALYSIS: 'analysis',
            UI: 'ui',
            ERROR: 'error',
            PERFORMANCE: 'performance'
        }
    };
    
    // Performance Monitoring
    const PERFORMANCE = {
        ENABLE_METRICS: env.isProduction,
        SAMPLE_RATE: 0.1, // 10% of users
        METRICS: [
            'load_time',
            'analysis_time',
            'cache_hit_rate',
            'error_rate'
        ]
    };
    
    // Local Storage Keys
    const STORAGE_KEYS = {
        SETTINGS: 'flux_settings',
        HISTORY: 'flux_history',
        CACHE: 'flux_cache',
        SESSION: 'flux_session',
        THEME: 'flux_theme',
        ANALYTICS_CONSENT: 'flux_analytics_consent'
    };
    
    // Default Values
    const DEFAULTS = {
        THEME: 'dark',
        LANGUAGE: 'en',
        VOLUME: 0.5,
        QUALITY: 'high',
        AUTO_PLAY: false,
        NOTIFICATIONS: true
    };
    
    // Public API
    return {
        // Environment
        env,
        
        // Core configuration
        ENDPOINTS,
        SETTINGS,
        ERRORS,
        FEATURES,
        
        // Services
        ANALYTICS,
        PERFORMANCE,
        
        // Storage
        STORAGE_KEYS,
        DEFAULTS,
        
        // Methods
        async healthCheck() {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5000);
                
                const response = await fetch(ENDPOINTS.ANALYZE_BPM, {
                    method: 'GET',
                    headers: { 'Accept': 'application/json' },
                    signal: controller.signal,
                    cache: 'no-cache'
                });
                
                clearTimeout(timeoutId);
                
                return {
                    healthy: response.ok,
                    status: response.status,
                    timestamp: new Date().toISOString(),
                    endpoint: ENDPOINTS.ANALYZE_BPM
                };
                
            } catch (error) {
                return {
                    healthy: false,
                    error: error.message,
                    timestamp: new Date().toISOString(),
                    endpoint: ENDPOINTS.ANALYZE_BPM
                };
            }
        },
        
        getBuildInfo() {
            return {
                version: '2.0.0',
                build: '2024.12.05',
                environment: env.isProduction ? 'production' : 'development',
                timestamp: new Date().toISOString()
            };
        },
        
        validateAudioUrl(url) {
            if (!url || typeof url !== 'string') return false;
            
            try {
                const parsed = new URL(url);
                return parsed.protocol === 'http:' || 
                       parsed.protocol === 'https:';
            } catch {
                return false;
            }
        },
        
        validateAudioFile(file) {
            if (!file) return false;
            
            const isValidSize = file.size <= SETTINGS.MAX_FILE_SIZE;
            const isValidType = SETTINGS.SUPPORTED_FORMATS.includes(file.type.toLowerCase());
            
            return isValidSize && isValidType;
        },
        
        // Utility methods
        debounce(func, wait) {
            let timeout;
            return function executedFunction(...args) {
                const later = () => {
                    clearTimeout(timeout);
                    func(...args);
                };
                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
            };
        },
        
        throttle(func, limit) {
            let inThrottle;
            return function(...args) {
                if (!inThrottle) {
                    func.apply(this, args);
                    inThrottle = true;
                    setTimeout(() => inThrottle = false, limit);
                }
            };
        },
        
        generateId() {
            return Date.now().toString(36) + Math.random().toString(36).substr(2);
        },
        
        formatBytes(bytes, decimals = 2) {
            if (bytes === 0) return '0 Bytes';
            
            const k = 1024;
            const dm = decimals < 0 ? 0 : decimals;
            const sizes = ['Bytes', 'KB', 'MB', 'GB'];
            
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            
            return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
        },
        
        formatTime(seconds) {
            const mins = Math.floor(seconds / 60);
            const secs = Math.floor(seconds % 60);
            return `${mins}:${secs.toString().padStart(2, '0')}`;
        }
    };
})();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FLUX_CONFIG;
} else {
    // Global initialization
    window.FLUX_CONFIG = FLUX_CONFIG;
    
    // Log initialization (only in development)
    if (FLUX_CONFIG.env.isLocalhost) {
        console.log('⚙️ Flux Configuration loaded:', FLUX_CONFIG.getBuildInfo());
        console.log('🔗 Endpoints:', FLUX_CONFIG.ENDPOINTS);
    }
}
