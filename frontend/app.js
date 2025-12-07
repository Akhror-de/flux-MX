/**
 * Flux PWA Main Application
 * Production entry point
 */

class FluxApp {
    constructor() {
        // Application state
        this.state = {
            isOnline: navigator.onLine,
            isPWA: window.matchMedia('(display-mode: standalone)').matches || 
                   window.navigator.standalone === true,
            isInstalled: false,
            deferredPrompt: null,
            currentView: 'analyzer',
            theme: 'dark',
            settings: {},
            analyticsConsent: null
        };
        
        // Services
        this.config = window.FLUX_CONFIG;
        this.api = window.fluxApi;
        this.analyzer = null;
        
        // Initialize
        this._init();
    }

    /**
     * Initialize application
     */
    async _init() {
        try {
            console.log('🚀 Flux PWA initializing...');
            
            // 1. Load settings
            await this._loadSettings();
            
            // 2. Setup PWA
            this._setupPWA();
            
            // 3. Setup analytics
            this._setupAnalytics();
            
            // 4. Setup network monitoring
            this._setupNetwork();
            
            // 5. Initialize UI components
            await this._setupUI();
            
            // 6. Check for updates
            this._checkForUpdates();
            
            console.log('✅ Flux PWA initialized successfully');
            
            // Track initialization
            this._trackEvent('app', 'initialized');
            
        } catch (error) {
            console.error('❌ Application initialization failed:', error);
            this._showFatalError(error);
        }
    }

    /**
     * Load application settings
     */
    async _loadSettings() {
        try {
            // Load saved settings
            const savedSettings = localStorage.getItem(this.config.STORAGE_KEYS.SETTINGS);
            if (savedSettings) {
                this.state.settings = JSON.parse(savedSettings);
            }
            
            // Load theme
            const savedTheme = localStorage.getItem(this.config.STORAGE_KEYS.THEME);
            if (savedTheme) {
                this.state.theme = savedTheme;
                this._applyTheme(savedTheme);
            }
            
            // Load analytics consent
            const savedConsent = localStorage.getItem(this.config.STORAGE_KEYS.ANALYTICS_CONSENT);
            this.state.analyticsConsent = savedConsent === 'true';
            
            console.log('⚙️ Settings loaded');
            
        } catch (error) {
            console.warn('Failed to load settings:', error);
            // Use defaults
            this.state.settings = { ...this.config.DEFAULTS };
        }
    }

    /**
     * Save application settings
     */
    _saveSettings() {
        try {
            localStorage.setItem(
                this.config.STORAGE_KEYS.SETTINGS,
                JSON.stringify(this.state.settings)
            );
        } catch (error) {
            console.warn('Failed to save settings:', error);
        }
    }

    /**
     * Setup PWA features
     */
    _setupPWA() {
        // Before install prompt
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.state.deferredPrompt = e;
            this.state.isInstalled = false;
            
            console.log('📱 PWA install available');
            
            // Show install prompt after delay
            if (this.config.FEATURES.PWA_INSTALL) {
                setTimeout(() => {
                    if (this.state.deferredPrompt && !this.state.isPWA) {
                        this._showInstallPrompt();
                    }
                }, 10000); // Show after 10 seconds
            }
        });
        
        // App installed
        window.addEventListener('appinstalled', () => {
            this.state.isInstalled = true;
            this.state.deferredPrompt = null;
            
            console.log('✅ PWA installed successfully');
            this._hideInstallPrompt();
            
            // Track installation
            this._trackEvent('pwa', 'installed');
        });
        
        // Install button handlers
        document.getElementById('install-confirm')?.addEventListener('click', () => {
            this._installPWA();
        });
        
        document.getElementById('install-cancel')?.addEventListener('click', () => {
            this._hideInstallPrompt();
        });
        
        // Check if already installed
        if (this.state.isPWA) {
            console.log('📱 Running as PWA');
            this.state.isInstalled = true;
        }
    }

    /**
     * Show install prompt
     */
    _showInstallPrompt() {
        const prompt = document.getElementById('install-prompt');
        if (prompt) {
            prompt.classList.remove('hidden');
            prompt.setAttribute('aria-hidden', 'false');
            
            // Track prompt shown
            this._trackEvent('pwa', 'prompt_shown');
        }
    }

    /**
     * Hide install prompt
     */
    _hideInstallPrompt() {
        const prompt = document.getElementById('install-prompt');
        if (prompt) {
            prompt.classList.add('hidden');
            prompt.setAttribute('aria-hidden', 'true');
        }
    }

    /**
     * Install PWA
     */
    async _installPWA() {
        if (!this.state.deferredPrompt) {
            this._showToast('Installation not available', 'warning');
            return;
        }
        
        try {
            this.state.deferredPrompt.prompt();
            const { outcome } = await this.state.deferredPrompt.userChoice;
            
            // Track installation outcome
            this._trackEvent('pwa', `install_${outcome}`);
            
            this.state.deferredPrompt = null;
            this._hideInstallPrompt();
            
        } catch (error) {
            console.error('Installation failed:', error);
            this._showToast('Installation failed', 'error');
        }
    }

    /**
     * Setup analytics
     */
    _setupAnalytics() {
        if (!this.config.ANALYTICS.ENABLED) return;
        
        // Check for consent
        if (this.state.analyticsConsent === null) {
            // Show consent dialog (simplified)
            setTimeout(() => {
                if (confirm('Help improve Flux by sharing anonymous usage data?')) {
                    this.state.analyticsConsent = true;
                    localStorage.setItem(this.config.STORAGE_KEYS.ANALYTICS_CONSENT, 'true');
                } else {
                    this.state.analyticsConsent = false;
                    localStorage.setItem(this.config.STORAGE_KEYS.ANALYTICS_CONSENT, 'false');
                }
            }, 2000);
        }
        
        // Setup error tracking
        if (this.config.ANALYTICS.TRACK_ERRORS && this.state.analyticsConsent) {
            window.addEventListener('error', (e) => {
                this._trackError(e.error || new Error(e.message));
            });
            
            window.addEventListener('unhandledrejection', (e) => {
                this._trackError(e.reason);
            });
        }
    }

    /**
     * Setup network monitoring
     */
    _setupNetwork() {
        // Network status
        window.addEventListener('online', () => {
            this.state.isOnline = true;
            this._hideOfflineBanner();
            this._showToast('Back online', 'success', 3000);
            
            console.log('🌐 Network: Online');
        });
        
        window.addEventListener('offline', () => {
            this.state.isOnline = false;
            this._showOfflineBanner();
            this._showToast('You are offline', 'warning', 5000);
            
            console.warn('🌐 Network: Offline');
        });
        
        // Initial check
        this._updateNetworkUI();
    }

    /**
     * Show offline banner
     */
    _showOfflineBanner() {
        const banner = document.getElementById('offline-banner');
        if (banner) {
            banner.classList.remove('hidden');
            banner.setAttribute('aria-hidden', 'false');
        }
    }

    /**
     * Hide offline banner
     */
    _hideOfflineBanner() {
        const banner = document.getElementById('offline-banner');
        if (banner) {
            banner.classList.add('hidden');
            banner.setAttribute('aria-hidden', 'true');
        }
    }

    /**
     * Update network UI
     */
    _updateNetworkUI() {
        if (!this.state.isOnline) {
            this._showOfflineBanner();
        }
    }

    /**
     * Setup UI components
     */
    async _setupUI() {
        // Initialize analyzer component
        const container = document.getElementById('flux-analyzer-container');
        if (container && window.FluxAnalyzerUI) {
            try {
                this.analyzer = new FluxAnalyzerUI('flux-analyzer-container', {
                    config: this.config,
                    apiService: this.api,
                    theme: this.state.theme,
                    enableHistory: true,
                    enableSharing: true
                });
                
                console.log('🎨 Analyzer UI initialized');
                
            } catch (error) {
                console.error('Failed to initialize analyzer:', error);
                this._showToast('Failed to initialize analyzer', 'error');
            }
        }
        
        // Setup debug panel
        this._setupDebugPanel();
        
        // Apply theme
        this._applyTheme(this.state.theme);
    }

    /**
     * Setup debug panel
     */
    _setupDebugPanel() {
        const debugClose = document.getElementById('debug-close');
        if (debugClose) {
            debugClose.addEventListener('click', () => {
                document.getElementById('debug-panel').classList.add('hidden');
            });
        }
        
        // Update debug info periodically
        if (this.config.env.isLocalhost) {
            setInterval(() => this._updateDebugInfo(), 5000);
        }
    }

    /**
     * Update debug information
     */
    _updateDebugInfo() {
        const debugOutput = document.getElementById('debug-output');
        if (!debugOutput) return;
        
        const info = {
            timestamp: new Date().toISOString(),
            performance: {
                memory: performance.memory ? {
                    usedJSHeapSize: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024) + 'MB',
                    totalJSHeapSize: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024) + 'MB'
                } : 'N/A',
                navigation: performance.getEntriesByType('navigation')[0]
            },
            appState: {
                isOnline: this.state.isOnline,
                isPWA: this.state.isPWA,
                isInstalled: this.state.isInstalled,
                theme: this.state.theme
            },
            apiMetrics: this.api?.getMetrics() || 'N/A',
            cache: {
                size: this.api?.cache?.size || 0
            }
        };
        
        debugOutput.textContent = JSON.stringify(info, null, 2);
    }

    /**
     * Apply theme
     */
    _applyTheme(theme) {
        this.state.theme = theme;
        
        // Update body class
        document.body.classList.remove('theme-dark', 'theme-light');
        document.body.classList.add(`theme-${theme}`);
        
        // Save to storage
        localStorage.setItem(this.config.STORAGE_KEYS.THEME, theme);
        
        // Update analyzer if exists
        if (this.analyzer) {
            this.analyzer._applyTheme(theme);
        }
    }

    /**
     * Toggle theme
     */
    toggleTheme() {
        const newTheme = this.state.theme === 'dark' ? 'light' : 'dark';
        this._applyTheme(newTheme);
        this._showToast(`Switched to ${newTheme} theme`, 'info');
    }

    /**
     * Show toast notification
     */
    _showToast(message, type = 'info', duration = 5000) {
        const container = document.getElementById('toast-container');
        if (!container) return;
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.setAttribute('role', 'alert');
        toast.setAttribute('aria-live', 'assertive');
        
        const icon = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        }[type] || 'ℹ️';
        
        toast.innerHTML = `
            <div class="toast-content">
                <span class="toast-icon">${icon}</span>
                <span class="toast-message">${message}</span>
                <button class="toast-close" aria-label="Close notification">&times;</button>
            </div>
        `;
        
        container.appendChild(toast);
        
        // Animate in
        setTimeout(() => toast.classList.add('show'), 10);
        
        // Close button
        const closeBtn = toast.querySelector('.toast-close');
        closeBtn.addEventListener('click', () => {
            this._removeToast(toast);
        });
        
        // Auto-remove
        if (duration > 0) {
            setTimeout(() => {
                this._removeToast(toast);
            }, duration);
        }
    }

    /**
     * Remove toast
     */
    _removeToast(toast) {
        if (!toast) return;
        
        toast.classList.remove('show');
        toast.classList.add('hiding');
        
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }

    /**
     * Track event
     */
    _trackEvent(category, action, label = null) {
        if (!this.config.ANALYTICS.ENABLED || !this.state.analyticsConsent) return;
        
        const event = {
            category: this.config.ANALYTICS.CATEGORIES[category] || category,
            action,
            label,
            timestamp: new Date().toISOString(),
            sessionId: this.api?.sessionId,
            version: this.config.getBuildInfo().version
        };
        
        // In production, send to analytics service
        // Example: Google Analytics, Yandex.Metrica, etc.
        console.log('[Analytics]', event);
        
        // You can implement actual analytics here
        // if (window.gtag) {
        //     gtag('event', action, {
        //         event_category: category,
        //         event_label: label
        //     });
        // }
    }

    /**
     * Track error
     */
    _trackError(error) {
        if (!this.config.ANALYTICS.TRACK_ERRORS || !this.state.analyticsConsent) return;
        
        const errorData = {
            message: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString(),
            url: window.location.href,
            userAgent: navigator.userAgent,
            sessionId: this.api?.sessionId
        };
        
        console.error('[Error Tracking]', errorData);
        
        // Send to error tracking service (e.g., Sentry, Rollbar)
        // Example: Sentry.captureException(error);
    }

    /**
     * Check for updates
     */
    _checkForUpdates() {
        // Check for service worker updates
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then(registration => {
                registration.update();
            });
        }
        
        // Check for app updates (simplified)
        const lastUpdateCheck = localStorage.getItem('flux_last_update_check');
        const now = Date.now();
        
        if (!lastUpdateCheck || now - parseInt(lastUpdateCheck) > 24 * 60 * 60 * 1000) {
            // Check once per day
            localStorage.setItem('flux_last_update_check', now.toString());
            
            // In production, you might fetch a version manifest
            // and compare with current version
        }
    }

    /**
     * Show fatal error screen
     */
    _showFatalError(error) {
        document.getElementById('app').innerHTML = `
            <div class="error-screen">
                <div class="error-content">
                    <div class="error-icon">💥</div>
                    <h2>Application Error</h2>
                    <p>Failed to initialize Flux Analyzer</p>
                    <div class="error-details">
                        <code>${error.message}</code>
                    </div>
                    <div class="error-actions">
                        <button onclick="window.fluxApp.reload()" class="btn btn-primary">
                            Reload Application
                        </button>
                        <button onclick="window.fluxApp.reset()" class="btn btn-secondary">
                            Reset Data
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Public API
     */
    
    // Reload application
    reload() {
        window.location.reload();
    }
    
    // Reset application data
    reset() {
        if (confirm('Reset all application data? This cannot be undone.')) {
            localStorage.clear();
            sessionStorage.clear();
            this.reload();
        }
    }
    
    // Get application state
    getState() {
        return { ...this.state };
    }
    
    // Get API service
    getApiService() {
        return this.api;
    }
    
    // Get analyzer component
    getAnalyzer() {
        return this.analyzer;
    }
    
    // Show toast (public method)
    showToast(message, type = 'info') {
        this._showToast(message, type);
    }
    
    // Destroy application
    destroy() {
        // Clean up analyzer
        if (this.analyzer) {
            this.analyzer.destroy();
        }
        
        // Remove event listeners
        window.removeEventListener('online', this._updateNetworkUI);
        window.removeEventListener('offline', this._updateNetworkUI);
        
        console.log('🧹 Flux App destroyed');
    }
}

// Initialize application
let fluxAppInstance = null;

function initFluxApp() {
    if (!fluxAppInstance) {
        try {
            fluxAppInstance = new FluxApp();
            window.fluxApp = fluxAppInstance;
            
            // Make available for debugging
            if (window.FLUX_CONFIG?.env.isLocalhost) {
                window.__fluxApp = fluxAppInstance;
            }
            
            // Global helper functions
            window.showFluxToast = (message, type) => {
                fluxAppInstance.showToast(message, type);
            };
            
            window.getFluxState = () => {
                return fluxAppInstance.getState();
            };
            
        } catch (error) {
            console.error('Failed to initialize Flux App:', error);
            
            // Show error to user
            document.body.innerHTML = `
                <div style="padding: 20px; font-family: sans-serif; text-align: center; color: white; background: #0f172a;">
                    <h2 style="color: #ff4757;">Application Error</h2>
                    <p>${error.message}</p>
                    <button onclick="location.reload()" style="padding: 10px 20px; margin-top: 20px;">
                        Reload Application
                    </button>
                </div>
            `;
        }
    }
    return fluxAppInstance;
}

// Start application when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFluxApp);
} else {
    initFluxApp();
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { FluxApp, initFluxApp };
}
