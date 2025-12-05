/**
 * Flux Analyzer UI Component
 * Production-ready user interface
 */

class FluxAnalyzerUI {
    constructor(containerId, options = {}) {
        // Configuration
        this.container = document.getElementById(containerId);
        if (!this.container) {
            throw new Error(`Container #${containerId} not found`);
        }
        
        this.config = options.config || window.FLUX_CONFIG || FLUX_CONFIG;
        this.api = options.apiService || window.fluxApi;
        this.options = {
            theme: options.theme || this.config.DEFAULTS.THEME,
            language: options.language || this.config.DEFAULTS.LANGUAGE,
            autoCheckApi: options.autoCheckApi !== false,
            enableHistory: options.enableHistory !== false,
            enableSharing: options.enableSharing !== false,
            ...options
        };
        
        // State
        this.state = {
            isAnalyzing: false,
            activeTab: 'url',
            lastResult: null,
            error: null,
            apiStatus: 'checking',
            file: null,
            history: []
        };
        
        // DOM Elements cache
        this.elements = {};
        
        // Initialize
        this._init();
    }

    /**
     * Initialize component
     */
    async _init() {
        try {
            // Load history
            if (this.options.enableHistory) {
                this.state.history = this.api.getHistory(10);
            }
            
            // Render UI
            this._render();
            
            // Bind events
            this._bindEvents();
            
            // Check API status
            if (this.options.autoCheckApi) {
                await this._checkApiStatus();
            }
            
            // Apply theme
            this._applyTheme(this.options.theme);
            
            console.log('🎨 Flux Analyzer UI initialized');
            
        } catch (error) {
            console.error('Failed to initialize Flux Analyzer UI:', error);
            this._showFatalError(error);
        }
    }

    /**
     * Render the UI
     */
    _render() {
        this.container.innerHTML = this._getTemplate();
        
        // Cache important elements
        this._cacheElements();
        
        // Update UI state
        this._updateUI();
    }

    /**
     * Get HTML template
     */
    _getTemplate() {
        const buildInfo = this.config.getBuildInfo();
        
        return `
            <div class="flux-analyzer theme-${this.options.theme}">
                <!-- Header -->
                <header class="flux-header">
                    <div class="header-content">
                        <h1 class="header-title">
                            <span class="logo">🎵</span>
                            <span class="title">Flux Analyzer</span>
                        </h1>
                        <p class="header-subtitle">AI-powered audio analysis for professionals</p>
                    </div>
                    
                    <div class="header-actions">
                        <button class="btn btn-icon" id="btn-history" title="Analysis History">
                            <span class="icon">📊</span>
                        </button>
                        <button class="btn btn-icon" id="btn-settings" title="Settings">
                            <span class="icon">⚙️</span>
                        </button>
                    </div>
                </header>

                <!-- Main Content -->
                <main class="flux-content">
                    <!-- Tabs -->
                    <div class="tabs-container">
                        <div class="tabs" role="tablist">
                            <button class="tab-btn ${this.state.activeTab === 'url' ? 'active' : ''}" 
                                    id="tab-url-btn" 
                                    role="tab" 
                                    aria-selected="${this.state.activeTab === 'url'}"
                                    aria-controls="tab-url">
                                <span class="tab-icon">🔗</span>
                                <span class="tab-text">URL</span>
                            </button>
                            <button class="tab-btn ${this.state.activeTab === 'file' ? 'active' : ''}" 
                                    id="tab-file-btn" 
                                    role="tab" 
                                    aria-selected="${this.state.activeTab === 'file'}"
                                    aria-controls="tab-file">
                                <span class="tab-icon">📁</span>
                                <span class="tab-text">File</span>
                            </button>
                            ${this.config.FEATURES.DEMO_PRESETS ? `
                            <button class="tab-btn ${this.state.activeTab === 'demo' ? 'active' : ''}" 
                                    id="tab-demo-btn" 
                                    role="tab" 
                                    aria-selected="${this.state.activeTab === 'demo'}"
                                    aria-controls="tab-demo">
                                <span class="tab-icon">🎧</span>
                                <span class="tab-text">Demo</span>
                            </button>
                            ` : ''}
                        </div>

                        <!-- URL Tab -->
                        <div class="tab-content ${this.state.activeTab === 'url' ? 'active' : ''}" 
                             id="tab-url" 
                             role="tabpanel" 
                             aria-labelledby="tab-url-btn">
                            <div class="url-input-group">
                                <input type="url" 
                                       id="input-url" 
                                       class="url-input"
                                       placeholder="https://example.com/track.mp3"
                                       aria-label="Audio URL"
                                       value="https://assets.mixkit.co/music/preview/mixkit-tech-house-vibes-130.mp3">
                                <button id="btn-analyze-url" class="btn btn-primary">
                                    <span class="btn-icon">🔍</span>
                                    <span class="btn-text">Analyze</span>
                                    <span class="spinner hidden">🌀</span>
                                </button>
                            </div>
                            <p class="help-text">
                                <span class="help-icon">💡</span>
                                Supports MP3, WAV, M4A, FLAC (max 25MB)
                            </p>
                        </div>

                        <!-- File Tab -->
                        <div class="tab-content ${this.state.activeTab === 'file' ? 'active' : ''}" 
                             id="tab-file" 
                             role="tabpanel" 
                             aria-labelledby="tab-file-btn">
                            <div class="file-upload-area" id="file-dropzone" role="button" tabindex="0">
                                <div class="upload-content">
                                    <div class="upload-icon">📁</div>
                                    <h3>Drop audio file here</h3>
                                    <p class="upload-text">or click to browse</p>
                                    <input type="file" 
                                           id="input-file" 
                                           class="file-input" 
                                           accept="audio/*"
                                           aria-label="Select audio file">
                                    <button class="btn btn-secondary" id="btn-browse">
                                        Browse Files
                                    </button>
                                    <div class="file-info" id="file-info" aria-live="polite"></div>
                                </div>
                            </div>
                        </div>

                        <!-- Demo Tab -->
                        ${this.config.FEATURES.DEMO_PRESETS ? `
                        <div class="tab-content ${this.state.activeTab === 'demo' ? 'active' : ''}" 
                             id="tab-demo" 
                             role="tabpanel" 
                             aria-labelledby="tab-demo-btn">
                            <div class="demo-presets">
                                <h3>Try with sample tracks:</h3>
                                <div class="preset-grid">
                                    <button class="preset-btn" data-url="https://assets.mixkit.co/music/preview/mixkit-tech-house-vibes-130.mp3">
                                        <span class="preset-icon">🎵</span>
                                        <span class="preset-title">Tech House</span>
                                        <span class="preset-desc">130 BPM • 8B</span>
                                    </button>
                                    <button class="preset-btn" data-url="https://assets.mixkit.co/music/preview/mixkit-deep-urban-623.mp3">
                                        <span class="preset-icon">🎵</span>
                                        <span class="preset-title">Deep House</span>
                                        <span class="preset-desc">122 BPM • 9A</span>
                                    </button>
                                    <button class="preset-btn" data-url="https://assets.mixkit.co/music/preview/mixkit-driving-ambition-32.mp3">
                                        <span class="preset-icon">🎵</span>
                                        <span class="preset-title">Progressive</span>
                                        <span class="preset-desc">128 BPM • 11B</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                        ` : ''}
                    </div>

                    <!-- Status Messages -->
                    <div class="status-container">
                        <div id="status-message" class="status-message" aria-live="polite"></div>
                        <div id="error-message" class="status-message status-error hidden" aria-live="assertive"></div>
                    </div>

                    <!-- Results Panel -->
                    <div class="results-panel hidden" id="results-panel">
                        <div class="results-header">
                            <h2>🎯 Analysis Results</h2>
                            <div class="results-meta">
                                <span id="result-time" class="meta-item"></span>
                                <span id="result-confidence" class="meta-item"></span>
                            </div>
                        </div>

                        <!-- Key Metrics -->
                        <div class="metrics-grid">
                            <div class="metric-card main">
                                <div class="metric-icon">🎵</div>
                                <div class="metric-value" id="result-bpm">--</div>
                                <div class="metric-label">BPM</div>
                                <div class="metric-desc">Beats Per Minute</div>
                            </div>

                            <div class="metric-card">
                                <div class="metric-icon">🎹</div>
                                <div class="metric-value" id="result-key">--</div>
                                <div class="metric-label">Key</div>
                                <div class="metric-desc" id="result-key-type">--</div>
                            </div>

                            <div class="metric-card">
                                <div class="metric-icon">🌀</div>
                                <div class="metric-value" id="result-camelot">--</div>
                                <div class="metric-label">Camelot</div>
                                <div class="metric-desc">DJ Wheel</div>
                            </div>

                            <div class="metric-card">
                                <div class="metric-icon">⚡</div>
                                <div class="metric-value" id="result-energy">--</div>
                                <div class="metric-label">Energy</div>
                                <div class="metric-desc">Track Intensity</div>
                            </div>
                        </div>

                        <!-- Compatibility -->
                        <section class="compatibility-section" aria-labelledby="compatibility-title">
                            <h3 id="compatibility-title">🔄 Compatible Keys</h3>
                            <div class="compatibility-grid" id="compatible-keys">
                                <div class="key-placeholder" aria-live="polite">
                                    Select a track to see compatible keys
                                </div>
                            </div>
                        </section>

                        <!-- Details -->
                        <section class="details-section" aria-labelledby="details-title">
                            <h3 id="details-title" class="visually-hidden">Track Details</h3>
                            <div class="details-grid">
                                <div class="detail-item">
                                    <div class="detail-label">Loudness</div>
                                    <div class="detail-value" id="result-loudness">-- dB</div>
                                </div>
                                <div class="detail-item">
                                    <div class="detail-label">Duration</div>
                                    <div class="detail-value" id="result-duration">-- s</div>
                                </div>
                                <div class="detail-item">
                                    <div class="detail-label">Source</div>
                                    <div class="detail-value" id="result-source">--</div>
                                </div>
                            </div>
                        </section>

                        <!-- Recommendations -->
                        ${this.config.FEATURES.RECOMMENDATIONS ? `
                        <section class="recommendations-section hidden" id="recommendations-section" aria-labelledby="recommendations-title">
                            <h3 id="recommendations-title">💡 Mixing Recommendations</h3>
                            <div class="recommendations-grid" id="recommendations-list" aria-live="polite"></div>
                        </section>
                        ` : ''}

                        <!-- Actions -->
                        <div class="actions-section">
                            ${this.config.FEATURES.SHARE ? `
                            <button id="btn-copy" class="btn btn-secondary">
                                <span class="btn-icon">📋</span>
                                Copy
                            </button>
                            <button id="btn-share" class="btn btn-secondary">
                                <span class="btn-icon">📤</span>
                                Share
                            </button>
                            ` : ''}
                            <button id="btn-new-analysis" class="btn btn-primary">
                                <span class="btn-icon">🔄</span>
                                New Analysis
                            </button>
                        </div>
                    </div>
                </main>

                <!-- Footer -->
                <footer class="flux-footer">
                    <div class="api-status">
                        <span class="status-dot" id="status-dot"></span>
                        <span class="status-text" id="status-text">Checking API...</span>
                    </div>
                    <div class="footer-info">
                        <span class="version">v${buildInfo.version}</span>
                        <span class="separator">•</span>
                        <span class="engine">Flux AI Engine</span>
                    </div>
                </footer>
            </div>
        `;
    }

    /**
     * Cache DOM elements
     */
    _cacheElements() {
        // Tabs
        this.elements.tabUrlBtn = document.getElementById('tab-url-btn');
        this.elements.tabFileBtn = document.getElementById('tab-file-btn');
        this.elements.tabDemoBtn = document.getElementById('tab-demo-btn');
        
        // Inputs
        this.elements.inputUrl = document.getElementById('input-url');
        this.elements.inputFile = document.getElementById('input-file');
        this.elements.fileDropzone = document.getElementById('file-dropzone');
        this.elements.fileInfo = document.getElementById('file-info');
        
        // Buttons
        this.elements.btnAnalyzeUrl = document.getElementById('btn-analyze-url');
        this.elements.btnBrowse = document.getElementById('btn-browse');
        this.elements.btnHistory = document.getElementById('btn-history');
        this.elements.btnSettings = document.getElementById('btn-settings');
        this.elements.btnCopy = document.getElementById('btn-copy');
        this.elements.btnShare = document.getElementById('btn-share');
        this.elements.btnNewAnalysis = document.getElementById('btn-new-analysis');
        
        // Status
        this.elements.statusMessage = document.getElementById('status-message');
        this.elements.errorMessage = document.getElementById('error-message');
        this.elements.statusDot = document.getElementById('status-dot');
        this.elements.statusText = document.getElementById('status-text');
        
        // Results
        this.elements.resultsPanel = document.getElementById('results-panel');
        this.elements.resultBPM = document.getElementById('result-bpm');
        this.elements.resultKey = document.getElementById('result-key');
        this.elements.resultKeyType = document.getElementById('result-key-type');
        this.elements.resultCamelot = document.getElementById('result-camelot');
        this.elements.resultEnergy = document.getElementById('result-energy');
        this.elements.resultLoudness = document.getElementById('result-loudness');
        this.elements.resultDuration = document.getElementById('result-duration');
        this.elements.resultSource = document.getElementById('result-source');
        this.elements.resultTime = document.getElementById('result-time');
        this.elements.resultConfidence = document.getElementById('result-confidence');
        this.elements.compatibleKeys = document.getElementById('compatible-keys');
        this.elements.recommendationsSection = document.getElementById('recommendations-section');
        this.elements.recommendationsList = document.getElementById('recommendations-list');
        
        // Demo presets
        this.elements.presetButtons = document.querySelectorAll('.preset-btn');
    }

    /**
     * Bind event listeners
     */
    _bindEvents() {
        // Tab switching
        this.elements.tabUrlBtn?.addEventListener('click', () => this._switchTab('url'));
        this.elements.tabFileBtn?.addEventListener('click', () => this._switchTab('file'));
        this.elements.tabDemoBtn?.addEventListener('click', () => this._switchTab('demo'));
        
        // URL analysis
        this.elements.btnAnalyzeUrl?.addEventListener('click', () => this._analyzeUrl());
        this.elements.inputUrl?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this._analyzeUrl();
        });
        
        // File analysis
        this.elements.btnBrowse?.addEventListener('click', () => this.elements.inputFile?.click());
        this.elements.inputFile?.addEventListener('change', (e) => this._handleFileSelect(e));
        
        // File dropzone
        if (this.elements.fileDropzone) {
            this.elements.fileDropzone.addEventListener('dragover', this._handleDragOver.bind(this));
            this.elements.fileDropzone.addEventListener('dragleave', this._handleDragLeave.bind(this));
            this.elements.fileDropzone.addEventListener('drop', this._handleFileDrop.bind(this));
            this.elements.fileDropzone.addEventListener('click', () => this.elements.inputFile?.click());
        }
        
        // Demo presets
        this.elements.presetButtons?.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const url = e.currentTarget.dataset.url;
                this.elements.inputUrl.value = url;
                this._switchTab('url');
                this._analyzeUrl();
            });
        });
        
        // Action buttons
        this.elements.btnCopy?.addEventListener('click', () => this._copyResults());
        this.elements.btnShare?.addEventListener('click', () => this._shareResults());
        this.elements.btnNewAnalysis?.addEventListener('click', () => this._resetAnalysis());
        this.elements.btnHistory?.addEventListener('click', () => this._showHistory());
        this.elements.btnSettings?.addEventListener('click', () => this._showSettings());
    }

    /**
     * Switch active tab
     */
    _switchTab(tabName) {
        if (this.state.activeTab === tabName) return;
        
        // Update state
        this.state.activeTab = tabName;
        
        // Update UI
        this._updateTabs();
        this._updateUI();
        
        // Announce to screen readers
        this._announce(`Switched to ${tabName} tab`);
    }

    /**
     * Analyze URL
     */
    async _analyzeUrl() {
        const url = this.elements.inputUrl?.value.trim();
        
        if (!url) {
            this._showError(this.config.ERRORS.NO_URL_PROVIDED);
            return;
        }
        
        if (!this.config.validateAudioUrl(url)) {
            this._showError(this.config.ERRORS.INVALID_URL);
            return;
        }
        
        await this._performAnalysis({
            type: 'url',
            source: url
        });
    }

    /**
     * Handle file selection
     */
    async _handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        await this._handleFile(file);
    }

    /**
     * Handle file drop
     */
    async _handleFileDrop(event) {
        event.preventDefault();
        this._handleDragLeave();
        
        const file = event.dataTransfer.files[0];
        if (!file) return;
        
        await this._handleFile(file);
    }

    /**
     * Handle file
     */
    async _handleFile(file) {
        // Show file info
        this._updateFileInfo(file);
        
        // Switch to file tab
        this._switchTab('file');
        
        await this._performAnalysis({
            type: 'file',
            source: file
        });
    }

    /**
     * Perform analysis
     */
    async _performAnalysis({ type, source }) {
        // Prevent duplicate analysis
        if (this.state.isAnalyzing) return;
        
        try {
            // Update state
            this.state.isAnalyzing = true;
            this.state.error = null;
            
            // Update UI
            this._updateUI();
            this._showStatus('Analyzing audio...', 'info');
            
            let result;
            
            // Perform analysis based on type
            if (type === 'url') {
                result = await this.api.analyzeAudio(source);
            } else if (type === 'file') {
                result = await this.api.analyzeAudioFile(source);
            } else {
                throw new Error('Invalid analysis type');
            }
            
            // Update state with result
            this.state.lastResult = result;
            
            // Update UI with results
            this._updateResultsUI(result);
            
            // Show recommendations
            if (this.config.FEATURES.RECOMMENDATIONS) {
                await this._showRecommendations(result);
            }
            
            // Show success message
            this._showStatus('Analysis complete!', 'success');
            
            // Announce completion
            this._announce(`Analysis complete: ${result.bpm} BPM in ${result.key}`);
            
        } catch (error) {
            // Handle error
            this.state.error = error.message;
            this._showError(error.message || this.config.ERRORS.ANALYSIS_FAILED);
            
            console.error('Analysis failed:', error);
            
        } finally {
            // Reset analyzing state
            this.state.isAnalyzing = false;
            this._updateUI();
        }
    }

    /**
     * Update results UI
     */
    _updateResultsUI(result) {
        if (!result) return;
        
        // Show results panel
        this.elements.resultsPanel.classList.remove('hidden');
        
        // Update metrics
        this.elements.resultBPM.textContent = result.bpm;
        this.elements.resultKey.textContent = result.key;
        this.elements.resultKeyType.textContent = result.keyType;
        this.elements.resultCamelot.textContent = result.camelot;
        this.elements.resultEnergy.textContent = `${Math.round(result.energy * 100)}%`;
        this.elements.resultLoudness.textContent = `${result.loudness} dB`;
        this.elements.resultDuration.textContent = `${result.duration}s`;
        this.elements.resultSource.textContent = result.source;
        
        // Update metadata
        this.elements.resultTime.textContent = new Date(result.analyzedAt).toLocaleTimeString();
        this.elements.resultConfidence.textContent = `Confidence: ${Math.round(result.confidence * 100)}%`;
        
        // Update compatible keys
        if (result.compatibleKeys && this.elements.compatibleKeys) {
            this.elements.compatibleKeys.innerHTML = result.compatibleKeys.map(key => `
                <div class="key-item ${key === result.camelot ? 'active' : ''}">
                    <div class="key-code">${key}</div>
                    <div class="key-match">${key === result.camelot ? 'Current' : 'Harmonic'}</div>
                </div>
            `).join('');
        }
        
        // Scroll to results
        this.elements.resultsPanel.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start' 
        });
    }

    /**
     * Show recommendations
     */
    async _showRecommendations(analysis) {
        try {
            const recommendations = await this.api.getRecommendations(analysis);
            
            // Show recommendations section
            this.elements.recommendationsSection?.classList.remove('hidden');
            
            // Render recommendations
            if (this.elements.recommendationsList) {
                let html = '';
                
                if (recommendations.mixingTips?.length) {
                    html += `
                        <div class="recommendation-card">
                            <div class="recommendation-icon">🎛️</div>
                            <h4>Mixing Tips</h4>
                            <ul class="recommendation-text">
                                ${recommendations.mixingTips.map(tip => `<li>${tip}</li>`).join('')}
                            </ul>
                        </div>
                    `;
                }
                
                if (recommendations.suggestedGenres?.length) {
                    html += `
                        <div class="recommendation-card">
                            <div class="recommendation-icon">🎵</div>
                            <h4>Suggested Genres</h4>
                            <p class="recommendation-text">
                                ${recommendations.suggestedGenres.join(', ')}
                            </p>
                        </div>
                    `;
                }
                
                if (recommendations.keyCharacteristics) {
                    html += `
                        <div class="recommendation-card">
                            <div class="recommendation-icon">🎹</div>
                            <h4>Key Characteristics</h4>
                            <p class="recommendation-text">
                                ${recommendations.keyCharacteristics}
                            </p>
                        </div>
                    `;
                }
                
                this.elements.recommendationsList.innerHTML = html;
            }
            
        } catch (error) {
            console.warn('Failed to load recommendations:', error);
            // Silently fail - recommendations are optional
        }
    }

    /**
     * Copy results to clipboard
     */
    async _copyResults() {
        if (!this.state.lastResult) return;
        
        const result = this.state.lastResult;
        const text = this._formatResultsForSharing(result);
        
        try {
            await navigator.clipboard.writeText(text);
            this._showStatus('Results copied to clipboard!', 'success');
        } catch (error) {
            this._showError('Failed to copy results');
        }
    }

    /**
     * Share results
     */
    async _shareResults() {
        if (!this.state.lastResult) return;
        
        const result = this.state.lastResult;
        
        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'Flux Analysis Results',
                    text: `🎵 ${result.bpm} BPM in ${result.key} (${result.camelot})`,
                    url: window.location.href
                });
            } catch (error) {
                if (error.name !== 'AbortError') {
                    // Fallback to copy if share fails
                    await this._copyResults();
                }
            }
        } else {
            // Fallback to copy
            await this._copyResults();
        }
    }

    /**
     * Reset analysis
     */
    _resetAnalysis() {
        // Reset state
        this.state.lastResult = null;
        this.state.error = null;
        
        // Reset UI
        this.elements.resultsPanel.classList.add('hidden');
        this.elements.recommendationsSection?.classList.add('hidden');
        this.elements.inputUrl.value = '';
        this._clearFileInfo();
        
        // Clear status messages
        this._clearStatus();
        
        // Show initial status
        this._showStatus('Ready to analyze audio', 'info');
        
        // Announce reset
        this._announce('Ready for new analysis');
        
        // Scroll to top
        this.container.scrollIntoView({ behavior: 'smooth' });
    }

    /**
     * Show history
     */
    _showHistory() {
        const history = this.api.getHistory(10);
        
        if (history.length === 0) {
            this._showStatus('No analysis history yet', 'info');
            return;
        }
        
        const historyText = history.map((item, index) => {
            const date = new Date(item.timestamp).toLocaleString();
            return `${index + 1}. ${date} - ${item.result?.bpm || '?'} BPM in ${item.result?.key || '?'}`;
        }).join('\n');
        
        alert(`Recent Analyses:\n\n${historyText}`);
    }

    /**
     * Show settings
     */
    _showSettings() {
        // Simple settings modal
        const settings = {
            theme: this.options.theme,
            autoCheckApi: this.options.autoCheckApi
        };
        
        const newTheme = settings.theme === 'dark' ? 'light' : 'dark';
        const newAutoCheck = !settings.autoCheckApi;
        
        if (confirm(`Toggle theme to ${newTheme}?`)) {
            this._applyTheme(newTheme);
        }
        
        if (confirm(`Auto API check: ${newAutoCheck ? 'ON' : 'OFF'}?`)) {
            this.options.autoCheckApi = newAutoCheck;
        }
    }

    /**
     * Check API status
     */
    async _checkApiStatus() {
        try {
            const health = await this.api.getHealthStatus();
            
            this.state.apiStatus = health.healthy ? 'online' : 'offline';
            
            // Update UI
            this._updateApiStatusUI();
            
            // Log if offline
            if (!health.healthy) {
                console.warn('API is offline:', health);
            }
            
        } catch (error) {
            this.state.apiStatus = 'error';
            this._updateApiStatusUI();
            console.error('API status check failed:', error);
        }
    }

    /**
     * Update UI based on state
     */
    _updateUI() {
        // Update analyzing state
        if (this.elements.btnAnalyzeUrl) {
            const btnText = this.elements.btnAnalyzeUrl.querySelector('.btn-text');
            const spinner = this.elements.btnAnalyzeUrl.querySelector('.spinner');
            
            if (this.state.isAnalyzing) {
                this.elements.btnAnalyzeUrl.disabled = true;
                btnText.textContent = 'Analyzing...';
                spinner?.classList.remove('hidden');
            } else {
                this.elements.btnAnalyzeUrl.disabled = false;
                btnText.textContent = 'Analyze';
                spinner?.classList.add('hidden');
            }
        }
        
        // Update tabs
        this._updateTabs();
        
        // Update API status
        this._updateApiStatusUI();
    }

    /**
     * Update tabs UI
     */
    _updateTabs() {
        // Update tab buttons
        [this.elements.tabUrlBtn, this.elements.tabFileBtn, this.elements.tabDemoBtn].forEach(btn => {
            if (btn) {
                const tabName = btn.id.replace('tab-', '').replace('-btn', '');
                btn.classList.toggle('active', this.state.activeTab === tabName);
                btn.setAttribute('aria-selected', this.state.activeTab === tabName);
            }
        });
        
        // Update tab content
        ['url', 'file', 'demo'].forEach(tab => {
            const content = document.getElementById(`tab-${tab}`);
            if (content) {
                content.classList.toggle('active', this.state.activeTab === tab);
                content.setAttribute('aria-hidden', this.state.activeTab !== tab);
            }
        });
    }

    /**
     * Update API status UI
     */
    _updateApiStatusUI() {
        if (!this.elements.statusDot || !this.elements.statusText) return;
        
        const statusConfig = {
            checking: { class: 'checking', text: 'Checking API...' },
            online: { class: 'online', text: 'API Online' },
            offline: { class: 'offline', text: 'API Offline' },
            error: { class: 'offline', text: 'API Error' }
        };
        
        const config = statusConfig[this.state.apiStatus] || statusConfig.checking;
        
        this.elements.statusDot.className = `status-dot ${config.class}`;
        this.elements.statusText.textContent = config.text;
    }

    /**
     * Show status message
     */
    _showStatus(message, type = 'info') {
        if (!this.elements.statusMessage) return;
        
        const typeClass = {
            info: 'status-info',
            success: 'status-success',
            warning: 'status-warning',
            error: 'status-error'
        }[type] || 'status-info';
        
        this.elements.statusMessage.className = `status-message ${typeClass}`;
        this.elements.statusMessage.textContent = message;
        this.elements.statusMessage.setAttribute('aria-live', 'polite');
        
        // Auto-hide success messages
        if (type === 'success') {
            setTimeout(() => {
                if (this.elements.statusMessage.textContent === message) {
                    this._clearStatus();
                }
            }, 3000);
        }
    }

    /**
     * Show error message
     */
    _showError(message) {
        if (!this.elements.errorMessage) return;
        
        this.elements.errorMessage.textContent = message;
        this.elements.errorMessage.classList.remove('hidden');
        this.elements.errorMessage.setAttribute('aria-live', 'assertive');
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            this.elements.errorMessage.classList.add('hidden');
        }, 5000);
    }

    /**
     * Clear status messages
     */
    _clearStatus() {
        if (this.elements.statusMessage) {
            this.elements.statusMessage.className = 'status-message';
            this.elements.statusMessage.textContent = '';
        }
        
        if (this.elements.errorMessage) {
            this.elements.errorMessage.classList.add('hidden');
            this.elements.errorMessage.textContent = '';
        }
    }

    /**
     * Update file info
     */
    _updateFileInfo(file) {
        if (!this.elements.fileInfo) return;
        
        this.state.file = file;
        
        this.elements.fileInfo.innerHTML = `
            <div class="file-details">
                <div class="file-name">📄 ${file.name}</div>
                <div class="file-size">${this.config.formatBytes(file.size)}</div>
            </div>
        `;
    }

    /**
     * Clear file info
     */
    _clearFileInfo() {
        if (!this.elements.fileInfo) return;
        
        this.state.file = null;
        this.elements.inputFile.value = '';
        this.elements.fileInfo.innerHTML = '';
    }

    /**
     * Handle drag over
     */
    _handleDragOver(event) {
        event.preventDefault();
        if (this.elements.fileDropzone) {
            this.elements.fileDropzone.classList.add('dragover');
        }
    }

    /**
     * Handle drag leave
     */
    _handleDragLeave() {
        if (this.elements.fileDropzone) {
            this.elements.fileDropzone.classList.remove('dragover');
        }
    }

    /**
     * Apply theme
     */
    _applyTheme(theme) {
        this.options.theme = theme;
        
        // Update container class
        this.container.querySelector('.flux-analyzer')?.classList.remove('theme-dark', 'theme-light');
        this.container.querySelector('.flux-analyzer')?.classList.add(`theme-${theme}`);
        
        // Save to localStorage
        localStorage.setItem(this.config.STORAGE_KEYS.THEME, theme);
        
        this._showStatus(`Switched to ${theme} theme`, 'info');
    }

    /**
     * Announce to screen readers
     */
    _announce(message) {
        // Create aria-live region
        let announcement = document.getElementById('flux-announcement');
        
        if (!announcement) {
            announcement = document.createElement('div');
            announcement.id = 'flux-announcement';
            announcement.setAttribute('aria-live', 'polite');
            announcement.setAttribute('aria-atomic', 'true');
            announcement.style.position = 'absolute';
            announcement.style.left = '-9999px';
            announcement.style.width = '1px';
            announcement.style.height = '1px';
            announcement.style.overflow = 'hidden';
            document.body.appendChild(announcement);
        }
        
        // Update message
        announcement.textContent = message;
        
        // Clear after a moment
        setTimeout(() => {
            announcement.textContent = '';
        }, 1000);
    }

    /**
     * Format results for sharing
     */
    _formatResultsForSharing(result) {
        return `
🎵 Flux Analysis Results
────────────────────
BPM: ${result.bpm}
Key: ${result.key} (${result.camelot}) • ${result.keyType}
Energy: ${Math.round(result.energy * 100)}%
Loudness: ${result.loudness}dB
Duration: ${result.duration}s
────────────────────
Compatible Keys: ${result.compatibleKeys?.join(', ') || result.camelot}
────────────────────
Analyzed: ${new Date(result.analyzedAt).toLocaleString()}
Confidence: ${Math.round(result.confidence * 100)}%
Source: ${result.source}
────────────────────
Generated by Flux AI Engine v${this.config.getBuildInfo().version}
        `.trim();
    }

    /**
     * Show fatal error
     */
    _showFatalError(error) {
        this.container.innerHTML = `
            <div class="error-screen">
                <div class="error-content">
                    <div class="error-icon">💥</div>
                    <h2>Application Error</h2>
                    <p>Failed to initialize Flux Analyzer</p>
                    <div class="error-details">
                        <code>${error.message}</code>
                    </div>
                    <div class="error-actions">
                        <button onclick="location.reload()" class="btn btn-primary">
                            Reload Application
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Public API
     */
    
    // Analyze URL (public method)
    async analyzeUrl(url) {
        if (this.elements.inputUrl) {
            this.elements.inputUrl.value = url;
        }
        await this._analyzeUrl();
    }
    
    // Analyze file (public method)
    async analyzeFile(file) {
        await this._handleFile(file);
    }
    
    // Get current state
    getState() {
        return { ...this.state };
    }
    
    // Get current result
    getResult() {
        return this.state.lastResult;
    }
    
    // Reset analyzer
    reset() {
        this._resetAnalysis();
    }
    
    // Destroy component
    destroy() {
        // Clean up event listeners
        const elements = Object.values(this.elements);
        elements.forEach(el => {
            if (el && el.removeEventListener) {
                // Note: This is simplified - in production, you'd track listeners
                el.parentNode?.replaceChild(el.cloneNode(true), el);
            }
        });
        
        // Clear container
        this.container.innerHTML = '';
        
        console.log('🧹 Flux Analyzer UI destroyed');
    }
}

// Export and auto-initialization
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FluxAnalyzerUI;
} else {
    window.FluxAnalyzerUI = FluxAnalyzerUI;
    
    // Auto-initialize if container exists
    document.addEventListener('DOMContentLoaded', () => {
        const container = document.getElementById('flux-analyzer-container');
        if (container) {
            try {
                window.fluxAnalyzer = new FluxAnalyzerUI('flux-analyzer-container');
                console.log('🎨 Flux Analyzer UI auto-initialized');
            } catch (error) {
                console.error('Failed to auto-initialize Flux Analyzer UI:', error);
            }
        }
    });
}
