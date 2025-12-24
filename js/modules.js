// Modules Management
class ModulesManager {
    constructor() {
        this.currentModule = null;
        this.apiResults = {};
        this.initModules();
    }

    initModules() {
        this.initEventListeners();
        this.loadModules();
        this.initAPIs();
    }

    initEventListeners() {
        // Module selection
        document.querySelectorAll('.module-option').forEach(option => {
            option.addEventListener('click', (e) => this.selectModule(e));
        });

        // Framework selection
        const frameworkSelect = document.getElementById('frameworkSelect');
        if (frameworkSelect) {
            frameworkSelect.addEventListener('change', (e) => this.onFrameworkChange(e));
        }

        // Execute button
        const executeBtn = document.getElementById('executeBtn');
        if (executeBtn) {
            executeBtn.addEventListener('click', () => this.executeModule());
        }

        // Clear button
        const clearBtn = document.getElementById('clearBtn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clearResults());
        }

        // Copy button
        const copyBtn = document.getElementById('copyBtn');
        if (copyBtn) {
            copyBtn.addEventListener('click', () => this.copyResults());
        }

        // Input fields
        const uidInput = document.getElementById('uidInput');
        const passwordInput = document.getElementById('passwordInput');
        const tokenInput = document.getElementById('tokenInput');
        const base64Input = document.getElementById('base64Input');

        if (uidInput) uidInput.addEventListener('input', () => this.validateInputs());
        if (passwordInput) passwordInput.addEventListener('input', () => this.validateInputs());
        if (tokenInput) tokenInput.addEventListener('input', () => this.validateInputs());
        if (base64Input) base64Input.addEventListener('input', () => this.validateInputs());
    }

    loadModules() {
        const modules = [
            {
                id: 'uid_password',
                name: 'UID & Password → Access Token',
                icon: 'fas fa-key',
                description: 'Convert FreeFire UID and password to access token',
                inputs: ['uid', 'password'],
                api: 'getAccessToken'
            },
            {
                id: 'access_token_jwt',
                name: 'Access Token → JWT',
                icon: 'fas fa-exchange-alt',
                description: 'Convert access token to JWT format',
                inputs: ['token'],
                api: 'convertToJWT'
            },
            {
                id: 'jwt_analyse',
                name: 'JWT Analyse',
                icon: 'fas fa-search',
                description: 'Analyze JWT token structure and claims',
                inputs: ['jwt'],
                api: 'analyzeJWT'
            },
            {
                id: 'base64_response',
                name: 'Base64 Response Decode',
                icon: 'fas fa-code',
                description: 'Decode Base64 encoded response data',
                inputs: ['base64'],
                api: 'decodeBase64Response'
            },
            {
                id: 'base64_request',
                name: 'Base64 Request Decode',
                icon: 'fas fa-shield-alt',
                description: 'Decode Base64 encoded request data',
                inputs: ['base64'],
                api: 'decodeBase64Request'
            }
        ];

        const modulesGrid = document.getElementById('modulesGrid');
        if (!modulesGrid) return;

        modulesGrid.innerHTML = '';
        
        modules.forEach(module => {
            const moduleEl = this.createModuleElement(module);
            modulesGrid.appendChild(moduleEl);
        });
    }

    createModuleElement(module) {
        const div = document.createElement('div');
        div.className = 'module-option';
        div.dataset.moduleId = module.id;
        
        div.innerHTML = `
            <div class="module-icon">
                <i class="${module.icon}"></i>
            </div>
            <div class="module-info">
                <h4>${module.name}</h4>
                <p>${module.description}</p>
            </div>
            <div class="module-arrow">
                <i class="fas fa-chevron-right"></i>
            </div>
        `;

        return div;
    }

    selectModule(e) {
        const moduleEl = e.target.closest('.module-option');
        if (!moduleEl) return;

        const moduleId = moduleEl.dataset.moduleId;
        
        // Remove active class from all modules
        document.querySelectorAll('.module-option').forEach(el => {
            el.classList.remove('active');
        });
        
        // Add active class to selected module
        moduleEl.classList.add('active');
        
        // Load module details
        this.loadModuleDetails(moduleId);
    }

    loadModuleDetails(moduleId) {
        const modules = {
            'uid_password': {
                name: 'UID & Password to Access Token',
                description: 'Enter FreeFire UID and password to generate access token',
                inputs: [
                    { id: 'uid', label: 'FreeFire UID', type: 'text', placeholder: 'Enter UID', required: true },
                    { id: 'password', label: 'Password', type: 'password', placeholder: 'Enter password', required: true }
                ]
            },
            'access_token_jwt': {
                name: 'Access Token to JWT',
                description: 'Convert access token to JWT format using API',
                inputs: [
                    { id: 'token', label: 'Access Token', type: 'textarea', placeholder: 'Paste access token here...', required: true }
                ]
            },
            'jwt_analyse': {
                name: 'JWT Analysis',
                description: 'Analyze JWT token structure and extract claims',
                inputs: [
                    { id: 'jwt', label: 'JWT Token', type: 'textarea', placeholder: 'Paste JWT token here...', required: true }
                ]
            },
            'base64_response': {
                name: 'Base64 Response Decode',
                description: 'Decode Base64 encoded FreeFire response',
                inputs: [
                    { id: 'base64', label: 'Base64 String', type: 'textarea', placeholder: 'Paste Base64 encoded response...', required: true }
                ]
            },
            'base64_request': {
                name: 'Base64 Request Decode',
                description: 'Decode Base64 encoded FreeFire request',
                inputs: [
                    { id: 'base64', label: 'Base64 String', type: 'textarea', placeholder: 'Paste Base64 encoded request...', required: true }
                ]
            }
        };

        const module = modules[moduleId];
        if (!module) return;

        this.currentModule = moduleId;

        // Update module details section
        const detailsSection = document.getElementById('moduleDetails');
        if (!detailsSection) return;

        // Build inputs HTML
        let inputsHTML = '';
        module.inputs.forEach(input => {
            if (input.type === 'textarea') {
                inputsHTML += `
                    <div class="form-group">
                        <label>${input.label}</label>
                        <textarea 
                            id="${input.id}Input" 
                            placeholder="${input.placeholder}"
                            rows="4"
                            ${input.required ? 'required' : ''}
                        ></textarea>
                    </div>
                `;
            } else {
                inputsHTML += `
                    <div class="form-group">
                        <label>${input.label}</label>
                        <input 
                            type="${input.type}" 
                            id="${input.id}Input" 
                            placeholder="${input.placeholder}"
                            ${input.required ? 'required' : ''}
                        >
                    </div>
                `;
            }
        });

        detailsSection.innerHTML = `
            <div class="module-details-header">
                <h3>${module.name}</h3>
                <p class="module-description">${module.description}</p>
            </div>
            <div class="module-inputs">
                ${inputsHTML}
            </div>
            <div class="module-actions">
                <button class="btn" id="clearBtn">
                    <i class="fas fa-trash"></i> Clear
                </button>
                <button class="btn btn-primary" id="executeBtn">
                    <i class="fas fa-play"></i> Execute
                </button>
            </div>
            <div class="results-section">
                <div class="results-header">
                    <h4>Results</h4>
                    <button class="btn btn-sm" id="copyBtn">
                        <i class="fas fa-copy"></i> Copy
                    </button>
                </div>
                <div class="results-output" id="resultsOutput">
                    <!-- Results will appear here -->
                </div>
            </div>
        `;

        // Re-attach event listeners
        this.initEventListeners();
    }

    onFrameworkChange(e) {
        const framework = e.target.value;
        console.log('Selected framework:', framework);
        // Implement framework-specific logic here
    }

    validateInputs() {
        const executeBtn = document.getElementById('executeBtn');
        if (!executeBtn) return;

        let isValid = true;
        
        // Check UID and password for token generation
        if (this.currentModule === 'uid_password') {
            const uid = document.getElementById('uidInput')?.value;
            const password = document.getElementById('passwordInput')?.value;
            isValid = uid && password && uid.length > 0 && password.length > 0;
        }
        
        // Check token for JWT conversion
        else if (this.currentModule === 'access_token_jwt') {
            const token = document.getElementById('tokenInput')?.value;
            isValid = token && token.length > 10;
        }
        
        // Check JWT for analysis
        else if (this.currentModule === 'jwt_analyse') {
            const jwt = document.getElementById('jwtInput')?.value;
            isValid = jwt && jwt.includes('.');
        }
        
        // Check Base64 for decoding
        else if (this.currentModule === 'base64_response' || this.currentModule === 'base64_request') {
            const base64 = document.getElementById('base64Input')?.value;
            isValid = base64 && base64.length > 0;
        }

        executeBtn.disabled = !isValid;
    }

    async executeModule() {
        if (!this.currentModule) {
            this.showNotification('Please select a module first', 'error');
            return;
        }

        const executeBtn = document.getElementById('executeBtn');
        if (executeBtn) {
            executeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
            executeBtn.disabled = true;
        }

        try {
            let result;
            
            switch (this.currentModule) {
                case 'uid_password':
                    result = await this.getAccessToken();
                    break;
                case 'access_token_jwt':
                    result = await this.convertToJWT();
                    break;
                case 'jwt_analyse':
                    result = await this.analyzeJWT();
                    break;
                case 'base64_response':
                    result = await this.decodeBase64Response();
                    break;
                case 'base64_request':
                    result = await this.decodeBase64Request();
                    break;
                default:
                    throw new Error('Unknown module');
            }

            this.displayResults(result);

            // Log activity
            if (currentUser) {
                await db.collection(collections.ACTIVITIES).add({
                    userId: currentUser.uid,
                    type: 'module_executed',
                    title: `Executed ${this.currentModule} module`,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                    module: this.currentModule
                });
            }

            this.showNotification('Module executed successfully!', 'success');

        } catch (error) {
            console.error('Error executing module:', error);
            this.displayResults({ error: error.message });
            this.showNotification('Module execution failed', 'error');
        } finally {
            if (executeBtn) {
                executeBtn.innerHTML = '<i class="fas fa-play"></i> Execute';
                executeBtn.disabled = false;
            }
        }
    }

    async getAccessToken() {
        const uid = document.getElementById('uidInput').value;
        const password = document.getElementById('passwordInput').value;

        // Call your API endpoint for token generation
        // For now, simulate with mock data
        return {
            success: true,
            open_id: "13701189912",
            access_token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
            expires_in: 28800,
            token_type: "Bearer",
            refresh_token: "refresh_token_here"
        };
    }

    async convertToJWT() {
        const token = document.getElementById('tokenInput').value;
        
        // Call API endpoint
        const response = await fetch(`https://api.freefireservice.dnc.su/oauth/account:login?data=${encodeURIComponent(token)}`);
        
        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }
        
        return await response.json();
    }

    async analyzeJWT() {
        const jwt = document.getElementById('jwtInput').value;
        
        // Parse JWT
        const parts = jwt.split('.');
        if (parts.length !== 3) {
            throw new Error('Invalid JWT format');
        }

        try {
            const header = JSON.parse(atob(parts[0]));
            const payload = JSON.parse(atob(parts[1]));
            
            return {
                header,
                payload,
                signature: parts[2],
                isValid: true,
                issuedAt: payload.iat ? new Date(payload.iat * 1000).toISOString() : null,
                expiresAt: payload.exp ? new Date(payload.exp * 1000).toISOString() : null
            };
        } catch (error) {
            throw new Error('Failed to parse JWT');
        }
    }

    async decodeBase64Response() {
        const base64 = document.getElementById('base64Input').value;
        
        try {
            // Decode Base64
            const binaryData = atob(base64);
            
            // Try to parse as JSON if possible
            try {
                const jsonData = JSON.parse(binaryData);
                return {
                    type: 'json',
                    data: jsonData,
                    raw: binaryData
                };
            } catch {
                // Return as raw text
                return {
                    type: 'raw',
                    data: binaryData,
                    length: binaryData.length
                };
            }
        } catch (error) {
            throw new Error('Invalid Base64 string');
        }
    }

    async decodeBase64Request() {
        const base64 = document.getElementById('base64Input').value;
        
        try {
            // For now, simulate decoding
            // In real implementation, use your AES decryption logic
            return {
                type: 'encrypted_request',
                original: base64,
                decoded: 'Simulated decoded data',
                note: 'Real implementation requires AES decryption with keys'
            };
        } catch (error) {
            throw new Error('Failed to decode request');
        }
    }

    displayResults(result) {
        const resultsOutput = document.getElementById('resultsOutput');
        if (!resultsOutput) return;

        let outputHTML = '';
        
        if (result.error) {
            outputHTML = `
                <div class="error-result">
                    <i class="fas fa-exclamation-triangle"></i>
                    <strong>Error:</strong> ${result.error}
                </div>
            `;
        } else {
            outputHTML = `
                <div class="success-result">
                    <i class="fas fa-check-circle"></i>
                    <strong>Success!</strong> Operation completed.
                </div>
                <pre class="result-data">${JSON.stringify(result, null, 2)}</pre>
            `;
        }

        resultsOutput.innerHTML = outputHTML;
        
        // Auto-scroll to results
        resultsOutput.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    clearResults() {
        const resultsOutput = document.getElementById('resultsOutput');
        if (resultsOutput) resultsOutput.innerHTML = '';
        
        // Clear inputs
        document.querySelectorAll('.module-inputs input, .module-inputs textarea').forEach(input => {
            input.value = '';
        });
        
        // Reset validation
        this.validateInputs();
    }

    copyResults() {
        const resultsOutput = document.getElementById('resultsOutput');
        if (!resultsOutput) return;

        const resultText = resultsOutput.textContent;
        
        navigator.clipboard.writeText(resultText).then(() => {
            this.showNotification('Results copied to clipboard!', 'success');
        }).catch(err => {
            console.error('Copy failed:', err);
            this.showNotification('Failed to copy results', 'error');
        });
    }

    initAPIs() {
        // Initialize API endpoints
        this.apis = {
            getAccessToken: async (uid, password) => {
                // Implement actual API call
                return { mock: true, uid, timestamp: new Date().toISOString() };
            },
            // ... other APIs
        };
    }

    showNotification(message, type = 'info') {
        if (window.authManager && window.authManager.showNotification) {
            window.authManager.showNotification(message, type);
        } else {
            alert(message);
        }
    }
}

// Initialize modules when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.modulesManager = new ModulesManager();
});