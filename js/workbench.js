// Workbench Management
class WorkbenchManager {
    constructor() {
        this.currentProject = null;
        this.initWorkbench();
    }

    initWorkbench() {
        this.initEventListeners();
        this.loadWorkbenchData();
    }

    initEventListeners() {
        // Workbench form submission
        const workbenchForm = document.getElementById('workbenchForm');
        if (workbenchForm) {
            workbenchForm.addEventListener('submit', (e) => this.handleCommit(e));
        }

        // Route validation
        const routeInput = document.getElementById('route');
        if (routeInput) {
            routeInput.addEventListener('blur', () => this.validateRoute());
        }

        // Host validation
        const hostInput = document.getElementById('host');
        if (hostInput) {
            hostInput.addEventListener('input', () => this.formatHost());
        }

        // Token validation
        const tokenInput = document.getElementById('bearerToken');
        if (tokenInput) {
            tokenInput.addEventListener('input', () => this.validateToken());
        }
    }

    async loadWorkbenchData() {
        // Load existing project if editing
        const urlParams = new URLSearchParams(window.location.search);
        const projectId = urlParams.get('project');
        
        if (projectId) {
            await this.loadProject(projectId);
        }
    }

    async loadProject(projectId) {
        try {
            const projectDoc = await db.collection(collections.PROJECTS).doc(projectId).get();
            if (projectDoc.exists) {
                this.currentProject = { id: projectDoc.id, ...projectDoc.data() };
                this.populateForm(this.currentProject);
            }
        } catch (error) {
            console.error('Error loading project:', error);
            this.showNotification('Failed to load project', 'error');
        }
    }

    populateForm(project) {
        const routeInput = document.getElementById('route');
        const hostInput = document.getElementById('host');
        const tokenInput = document.getElementById('bearerToken');
        const versionSelect = document.getElementById('xVersion');
        const nameInput = document.getElementById('projectName');

        if (routeInput) routeInput.value = project.route || '';
        if (hostInput) hostInput.value = project.host || '';
        if (tokenInput) tokenInput.value = project.bearerToken || '';
        if (versionSelect) versionSelect.value = project.xVersion || 'OB99';
        if (nameInput) nameInput.value = project.name || '';
    }

    validateRoute() {
        const routeInput = document.getElementById('route');
        if (!routeInput) return true;

        const route = routeInput.value.trim();
        
        if (!route.startsWith('/')) {
            this.showFieldError(routeInput, 'Route must start with /');
            return false;
        }

        if (route.length < 2) {
            this.showFieldError(routeInput, 'Route is too short');
            return false;
        }

        this.clearFieldError(routeInput);
        return true;
    }

    formatHost() {
        const hostInput = document.getElementById('host');
        if (!hostInput) return;

        let host = hostInput.value.trim();
        
        // Format as example:PK if not already
        if (host && !host.includes(':')) {
            hostInput.value = host + ':PK';
        }
    }

    validateToken() {
        const tokenInput = document.getElementById('bearerToken');
        if (!tokenInput) return true;

        const token = tokenInput.value.trim();
        
        if (token.length < 10) {
            this.showFieldError(tokenInput, 'Token seems too short');
            return false;
        }

        if (!token.startsWith('Bearer ') && !token.includes('eyJ')) {
            this.showFieldError(tokenInput, 'Token format seems invalid');
            return false;
        }

        this.clearFieldError(tokenInput);
        return true;
    }

    showFieldError(input, message) {
        this.clearFieldError(input);
        
        const errorDiv = document.createElement('div');
        errorDiv.className = 'field-error';
        errorDiv.textContent = message;
        errorDiv.style.color = '#f85149';
        errorDiv.style.fontSize = '0.75rem';
        errorDiv.style.marginTop = '4px';
        
        input.parentNode.appendChild(errorDiv);
        input.style.borderColor = '#f85149';
    }

    clearFieldError(input) {
        const errorDiv = input.parentNode.querySelector('.field-error');
        if (errorDiv) errorDiv.remove();
        input.style.borderColor = '';
    }

    async handleCommit(e) {
        e.preventDefault();
        
        if (!currentUser) {
            this.showNotification('Please login first', 'error');
            return;
        }

        // Validate all fields
        if (!this.validateRoute() || !this.validateToken()) {
            this.showNotification('Please fix validation errors', 'error');
            return;
        }

        const form = e.target;
        const commitBtn = form.querySelector('button[type="submit"]');
        
        // Show confirmation
        const confirmed = confirm('Are you sure you want to commit this workbench?');
        if (!confirmed) return;

        // Disable button and show loading
        if (commitBtn) {
            commitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Committing...';
            commitBtn.disabled = true;
        }

        try {
            // Collect form data
            const projectData = {
                userId: currentUser.uid,
                route: document.getElementById('route').value.trim(),
                host: document.getElementById('host').value.trim(),
                bearerToken: document.getElementById('bearerToken').value.trim(),
                xVersion: document.getElementById('xVersion').value,
                name: document.getElementById('projectName').value.trim() || 'Untitled Project',
                status: 'pending',
                debugStatus: 'Not found',
                createdAt: this.currentProject ? 
                    this.currentProject.createdAt : 
                    firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            // Save to Firestore
            let docRef;
            if (this.currentProject) {
                // Update existing
                await db.collection(collections.PROJECTS).doc(this.currentProject.id).update(projectData);
                docRef = { id: this.currentProject.id };
            } else {
                // Create new
                docRef = await db.collection(collections.PROJECTS).add(projectData);
            }

            // Create activity log
            const activityType = this.currentProject ? 'project_updated' : 'project_created';
            await db.collection(collections.ACTIVITIES).add({
                userId: currentUser.uid,
                type: activityType,
                title: `${this.currentProject ? 'Updated' : 'Created'} project "${projectData.name}"`,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                projectId: docRef.id
            });

            // Create request for admin review
            await db.collection(collections.REQUESTS).add({
                projectId: docRef.id,
                userId: currentUser.uid,
                userName: userData.username || currentUser.email,
                host: projectData.host,
                status: 'pending',
                chances: 'unknown',
                emoji: '🔄',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            this.showNotification(
                `Project ${this.currentProject ? 'updated' : 'created'} successfully! Waiting for admin approval.`,
                'success'
            );

            // Redirect to dashboard after delay
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1500);

        } catch (error) {
            console.error('Error committing workbench:', error);
            this.showNotification(error.message || 'Failed to commit workbench', 'error');
        } finally {
            // Reset button
            if (commitBtn) {
                commitBtn.innerHTML = '<i class="fas fa-code-commit"></i> Commit';
                commitBtn.disabled = false;
            }
        }
    }

    async testConnection() {
        // This would test the API connection with provided credentials
        const route = document.getElementById('route')?.value;
        const token = document.getElementById('bearerToken')?.value;
        
        if (!route || !token) {
            this.showNotification('Please fill route and token first', 'error');
            return;
        }

        this.showNotification('Testing connection...', 'info');
        
        // Implement actual API test here
        // For now, simulate test
        setTimeout(() => {
            const success = Math.random() > 0.3;
            if (success) {
                this.showNotification('Connection test successful!', 'success');
            } else {
                this.showNotification('Connection test failed', 'error');
            }
        }, 2000);
    }

    showNotification(message, type = 'info') {
        if (window.authManager && window.authManager.showNotification) {
            window.authManager.showNotification(message, type);
        } else {
            alert(message);
        }
    }
}

// Initialize workbench when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.workbenchManager = new WorkbenchManager();
});