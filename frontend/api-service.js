/**
 * Flux API Service
 * Production-ready service for Yandex Cloud Functions
 */

class FluxApiService {
    constructor(config = null) {
        // Configuration
        this.config = config || window.FLUX_CONFIG || FLUX_CONFIG;
        
        // State
        this.cache = new Map();
        this.pendingRequests = new Map();
        this.requestHistory = [];
        this.isOnline = navigator.onLine;
        this.sessionId = this.config.generateId();
        
        // Initialize
        this._setupEventListeners();
        this._loadCacheFromStorage();
        
        // Performance metrics
        this.metrics = {
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            cacheHits: 0,
            cacheMisses: 0,
            avgResponseTime: 0
        };
        
        console.log(`🚀 Flux API Service initialized (Session: ${this.sessionId})`);
    }

    /**
     * Analyze audio by URL
     */
    async analyzeAudio(url, options = {}) {
        // Validate input
        if (!this.config.validateAudioUrl(url)) {
            throw new Error(this.config.ERRORS.INVALID_URL);
        }
        
        // Check cache first
        const cacheKey = this._generateCacheKey('analyze', url);
        const cached = this._getFromCache(cacheKey);
        
        if (cached && !options.forceRefresh) {
            this.metrics.cacheHits++;
            return this._wrapResponse(cached, true);
        }
        
        this.metrics.cacheMisses++;
        
        // Check for duplicate pending request
        if (this.pendingRequests.has(cacheKey)) {
            return this.pendingRequests.get(cacheKey);
        }
        
        // Create request
        const requestId = this.config.generateId();
        const requestPromise = this._makeApiRequest({
            endpoint: this.config.ENDPOINTS.ANALYZE_BPM,
            method: 'POST',
            data: {
                audioUrl: url,
                requestId,
                sessionId: this.sessionId,
                timestamp: new Date().toISOString(),
                options: {
                    format: options.format || 'auto',
                    detailed: options.detailed || false
                }
            },
            timeout: options.timeout || this.config.SETTINGS.TIMEOUT,
            retry: options.retry !== false
        });
        
        // Store pending request
        this.pendingRequests.set(cacheKey, requestPromise);
        
        try {
            // Track performance
            const startTime = performance.now();
            
            // Make request
            const response = await requestPromise;
            
            // Calculate response time
            const responseTime = performance.now() - startTime;
            this._updateMetrics(responseTime, true);
            
            // Cache successful response
            this._addToCache(cacheKey, response, this.config.SETTINGS.CACHE_TTL);
            
            // Track in history
            this._addToHistory({
                type: 'analyze_url',
                url,
                result: response,
                timestamp: new Date().toISOString(),
                responseTime
            });
            
            return this._wrapResponse(response, false);
            
        } catch (error) {
            // Update metrics
            this._updateMetrics(0, false);
            
            // Log error
            this._logError('analyzeAudio', error, { url });
            
            throw error;
            
        } finally {
            // Clean up pending request
            this.pendingRequests.delete(cacheKey);
        }
    }

    /**
     * Analyze audio file
     */
    async analyzeAudioFile(file, options = {}) {
        // Validate file
        if (!this.config.validateAudioFile(file)) {
            if (file.size > this.config.SETTINGS.MAX_FILE_SIZE) {
                throw new Error(this.config.ERRORS.FILE_TOO_LARGE);
            } else {
                throw new Error(this.config.ERRORS.UNSUPPORTED_FORMAT);
            }
        }
        
        // Generate file hash for caching
        const fileHash = await this._generateFileHash(file);
        const cacheKey = this._generateCacheKey('analyze_file', fileHash);
        
        // Check cache
        const cached = this._getFromCache(cacheKey);
        if (cached && !options.forceRefresh) {
            this.metrics.cacheHits++;
            return this._wrapResponse(cached, true);
        }
        
        this.metrics.cacheMisses++;
        
        // Create FormData for upload (if backend supports file upload)
        const formData = new FormData();
        formData.append('audio', file);
        formData.append('requestId', this.config.generateId());
        formData.append('sessionId', this.sessionId);
        formData.append('timestamp', new Date().toISOString());
        
        // For now, use Data URL as fallback
        // TODO: Implement proper file upload to Yandex Object Storage
        const dataUrl = await this._fileToDataUrl(file);
        
        return this.analyzeAudio(dataUrl, {
            ...options,
            metadata: {
                fileName: file.name,
                fileSize: file.size,
                fileType: file.type,
                originalSource: 'file'
            }
        });
    }

    /**
     * Get recommendations based on analysis
     */
    async getRecommendations(analysisData, options = {}) {
        const cacheKey = this._generateCacheKey('recommendations', 
            `${analysisData.bpm}_${analysisData.key}_${analysisData.camelot}`);
        
        // Check cache
        const cached = this._getFromCache(cacheKey);
        if (cached && !options.forceRefresh) {
            return cached;
        }
        
        try {
            let recommendations;
            
            // Try to get from API if endpoint exists
            if (this.config.ENDPOINTS.RECOMMENDATIONS) {
                recommendations = await this._makeApiRequest({
                    endpoint: this.config.ENDPOINTS.RECOMMENDATIONS,
                    method: 'POST',
                    data: {
                        analysis: analysisData,
                        requestId: this.config.generateId(),
                        sessionId: this.sessionId
                    },
                    timeout: options.timeout || 10000
                });
            } else {
                // Fallback to local recommendations
                recommendations = this._generateLocalRecommendations(analysisData);
            }
            
            // Cache recommendations
            this._addToCache(cacheKey, recommendations, this.config.SETTINGS.CACHE_TTL);
            
            return recommendations;
            
        } catch (error) {
            // Fallback to local recommendations on error
            console.warn('API recommendations failed, using local fallback:', error);
            return this._generateLocalRecommendations(analysisData);
        }
    }

    /**
     * Get service health status
     */
    async getHealthStatus() {
        try {
            const health = await this.config.healthCheck();
            
            return {
                ...health,
                cacheStatus: {
                    size: this.cache.size,
                    hits: this.metrics.cacheHits,
                    misses: this.metrics.cacheMisses,
                    hitRate: this.metrics.cacheHits / (this.metrics.cacheHits + this.metrics.cacheMisses) || 0
                },
                metrics: { ...this.metrics },
                sessionId: this.sessionId,
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            return {
                healthy: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Get analysis history
     */
    getHistory(limit = 20) {
        const history = JSON.parse(localStorage.getItem(this.config.STORAGE_KEYS.HISTORY) || '[]');
        return history.slice(0, limit);
    }

    /**
     * Clear cache and history
     */
    clearStorage() {
        this.cache.clear();
        this.pendingRequests.clear();
        localStorage.removeItem(this.config.STORAGE_KEYS.CACHE);
        localStorage.removeItem(this.config.STORAGE_KEYS.HISTORY);
        
        console.log('🧹 Storage cleared');
        
        return {
            cacheCleared: true,
            historyCleared: true,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Get performance metrics
     */
    getMetrics() {
        return {
            ...this.metrics,
            cacheSize: this.cache.size,
            pendingRequests: this.pendingRequests.size,
            sessionDuration: Date.now() - parseInt(this.sessionId, 36),
            timestamp: new Date().toISOString()
        };
    }

    // Private Methods

    _setupEventListeners() {
        // Network status
        window.addEventListener('online', () => {
            this.isOnline = true;
            console.log('🌐 Network: Online');
        });
        
        window.addEventListener('offline', () => {
            this.isOnline = false;
            console.warn('🌐 Network: Offline');
        });
        
        // Visibility change
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this._saveCacheToStorage();
            }
        });
        
        // Before unload
        window.addEventListener('beforeunload', () => {
            this._saveCacheToStorage();
        });
    }

    async _makeApiRequest({ endpoint, method = 'GET', data, timeout, retry = true }) {
        this.metrics.totalRequests++;
        
        const requestId = this.config.generateId();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        const headers = {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'X-Request-ID': requestId,
            'X-Session-ID': this.sessionId,
            'X-Client-Version': this.config.getBuildInfo().version
        };
        
        let lastError;
        let attempts = 0;
        const maxAttempts = retry ? this.config.SETTINGS.RETRY_ATTEMPTS + 1 : 1;
        
        while (attempts < maxAttempts) {
            attempts++;
            
            try {
                // Check network connectivity
                if (!this.isOnline) {
                    throw new Error(this.config.ERRORS.NETWORK_ERROR);
                }
                
                const response = await fetch(endpoint, {
                    method,
                    headers,
                    body: method !== 'GET' ? JSON.stringify(data) : undefined,
                    signal: controller.signal,
                    mode: 'cors',
                    credentials: 'omit'
                });
                
                clearTimeout(timeoutId);
                
                // Handle HTTP errors
                if (!response.ok) {
                    const errorText = await response.text().catch(() => 'Unknown error');
                    
                    // Rate limiting
                    if (response.status === 429) {
                        throw new Error(this.config.ERRORS.RATE_LIMITED);
                    }
                    
                    // Server errors
                    if (response.status >= 500) {
                        throw new Error(this.config.ERRORS.API_UNAVAILABLE);
                    }
                    
                    throw new Error(`HTTP ${response.status}: ${errorText}`);
                }
                
                // Parse response
                const result = await response.json();
                
                // Validate response structure
                if (!result || typeof result !== 'object') {
                    throw new Error(this.config.ERRORS.INVALID_RESPONSE);
                }
                
                return result;
                
            } catch (error) {
                lastError = error;
                
                // Don't retry on certain errors
                if (error.name === 'AbortError') {
                    throw new Error(this.config.ERRORS.TIMEOUT_ERROR);
                }
                
                if (error.message === this.config.ERRORS.NETWORK_ERROR) {
                    throw error;
                }
                
                // Exponential backoff
                if (attempts < maxAttempts) {
                    const delay = this.config.SETTINGS.RETRY_DELAY * Math.pow(2, attempts - 1);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }
        
        clearTimeout(timeoutId);
        throw lastError;
    }

    _generateCacheKey(type, identifier) {
        return `${type}:${btoa(identifier).slice(0, 64)}`;
    }

    _getFromCache(key) {
        const entry = this.cache.get(key);
        
        if (!entry) return null;
        
        // Check expiration
        if (entry.expiresAt && Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            return null;
        }
        
        return entry.data;
    }

    _addToCache(key, data, ttl = null) {
        // Limit cache size
        if (this.cache.size >= this.config.SETTINGS.MAX_CACHE_ENTRIES) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        
        const entry = {
            data,
            cachedAt: Date.now(),
            expiresAt: ttl ? Date.now() + ttl : null
        };
        
        this.cache.set(key, entry);
        this._saveCacheToStorage();
    }

    _saveCacheToStorage() {
        try {
            const cacheData = Array.from(this.cache.entries()).map(([key, entry]) => ({
                key,
                ...entry
            }));
            
            localStorage.setItem(
                this.config.STORAGE_KEYS.CACHE,
                JSON.stringify(cacheData)
            );
        } catch (error) {
            console.warn('Failed to save cache to storage:', error);
        }
    }

    _loadCacheFromStorage() {
        try {
            const cacheData = JSON.parse(
                localStorage.getItem(this.config.STORAGE_KEYS.CACHE) || '[]'
            );
            
            cacheData.forEach(item => {
                if (item.expiresAt && Date.now() > item.expiresAt) {
                    return; // Skip expired entries
                }
                
                this.cache.set(item.key, {
                    data: item.data,
                    cachedAt: item.cachedAt,
                    expiresAt: item.expiresAt
                });
            });
            
            console.log(`📦 Loaded ${this.cache.size} cache entries from storage`);
            
        } catch (error) {
            console.warn('Failed to load cache from storage:', error);
        }
    }

    _addToHistory(entry) {
        const history = this.getHistory();
        history.unshift(entry);
        
        // Keep only last 100 entries
        if (history.length > 100) {
            history.length = 100;
        }
        
        try {
            localStorage.setItem(
                this.config.STORAGE_KEYS.HISTORY,
                JSON.stringify(history)
            );
        } catch (error) {
            console.warn('Failed to save history:', error);
        }
    }

    async _generateFileHash(file) {
        // Simple hash based on file properties
        // In production, consider using SHA-256
        return `${file.name}_${file.size}_${file.lastModified}`.replace(/[^a-z0-9]/gi, '_');
    }

    async _fileToDataUrl(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error(this.config.ERRORS.DECODING_ERROR));
            
            reader.readAsDataURL(file);
        });
    }

    _wrapResponse(data, fromCache = false) {
        return {
            ...data,
            metadata: {
                ...data.metadata,
                cached: fromCache,
                timestamp: new Date().toISOString(),
                sessionId: this.sessionId
            }
        };
    }

    _updateMetrics(responseTime, success) {
        if (success) {
            this.metrics.successfulRequests++;
            this.metrics.avgResponseTime = (
                this.metrics.avgResponseTime * (this.metrics.successfulRequests - 1) + responseTime
            ) / this.metrics.successfulRequests;
        } else {
            this.metrics.failedRequests++;
        }
    }

    _logError(method, error, context = {}) {
        const errorLog = {
            method,
            error: error.message,
            stack: error.stack,
            context,
            sessionId: this.sessionId,
            timestamp: new Date().toISOString(),
            url: window.location.href,
            userAgent: navigator.userAgent
        };
        
        console.error('API Error:', errorLog);
        
        // In production, you might want to send this to an error tracking service
        // if (this.config.env.isProduction) {
        //     this._sendErrorToAnalytics(errorLog);
        // }
    }

    _generateLocalRecommendations(analysis) {
        const camelotWheel = {
            '8A': ['8A', '7A', '9A', '8B', '7B', '9B'],
            '8B': ['8B', '7B', '9B', '8A', '7A', '9A'],
            '9A': ['9A', '8A', '10A', '9B', '8B', '10B'],
            '9B': ['9B', '8B', '10B', '9A', '8A', '10A'],
            '10A': ['10A', '9A', '11A', '10B', '9B', '11B'],
            '10B': ['10B', '9B', '11B', '10A', '9A', '11A'],
            '11A': ['11A', '10A', '12A', '11B', '10B', '12B'],
            '11B': ['11B', '10B', '12B', '11A', '10A', '12A'],
            '12A': ['12A', '11A', '1A', '12B', '11B', '1B'],
            '12B': ['12B', '11B', '1B', '12A', '11A', '1A'],
            '1A': ['1A', '12A', '2A', '1B', '12B', '2B'],
            '1B': ['1B', '12B', '2B', '1A', '12A', '2A']
        };
        
        const compatibleKeys = camelotWheel[analysis.camelot] || [analysis.camelot];
        
        const energyLevel = analysis.energy > 0.7 ? 'high' : 
                           analysis.energy > 0.4 ? 'medium' : 'low';
        
        const genreMap = {
            'high': ['Techno', 'Hardstyle', 'Trance', 'Hardcore'],
            'medium': ['House', 'Tech House', 'Progressive', 'Deep House'],
            'low': ['Chillout', 'Ambient', 'Downtempo', 'Lo-fi']
        };
        
        const keyMap = {
            'C': 'Bright and happy',
            'Cm': 'Tragic, passionate',
            'G': 'Rustic, idyllic',
            'Gm': 'Serious, tragic',
            'D': 'Triumphant, victorious',
            'Dm': 'Melancholy, feminine',
            'A': 'Joyful, pastoral',
            'Am': 'Tender, plaintive'
        };
        
        const bpmRange = {
            min: Math.max(70, analysis.bpm - 10),
            max: Math.min(180, analysis.bpm + 10)
        };
        
        return {
            compatibleKeys,
            energyLevel,
            suggestedGenres: genreMap[energyLevel] || ['Electronic'],
            keyCharacteristics: keyMap[analysis.key] || 'Balanced and versatile',
            bpmRange,
            mixingTips: [
                `Mix with tracks in ${compatibleKeys.slice(1, 3).join(' or ')} for smooth transitions`,
                `${energyLevel === 'high' ? 'Use' : 'Avoid'} heavy effects during peaks`,
                `Keep transitions within ${bpmRange.min}-${bpmRange.max} BPM range`,
                analysis.keyType === 'major' 
                    ? 'Try mixing with relative minor keys for contrast'
                    : 'Try mixing with relative major keys for uplifting moments'
            ],
            timestamp: new Date().toISOString(),
            source: 'Flux AI Engine'
        };
    }
}

// Export and initialization
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FluxApiService;
} else {
    // Global initialization
    let fluxApiInstance = null;
    
    function getApiService() {
        if (!fluxApiInstance) {
            fluxApiInstance = new FluxApiService();
            
            // Make available globally for debugging
            if (window.FLUX_CONFIG?.env.isLocalhost) {
                window.__fluxApi = fluxApiInstance;
            }
        }
        return fluxApiInstance;
    }
    
    // Export
    window.FluxApiService = FluxApiService;
    window.fluxApi = getApiService();
    
    // Auto-initialize
    document.addEventListener('DOMContentLoaded', () => {
        getApiService();
    });
}
