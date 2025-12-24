// Dashboard Management
class DashboardManager {
    constructor() {
        this.projects = [];
        this.activities = [];
        this.initDashboard();
    }

    async initDashboard() {
        await this.checkAuth();
        this.initEventListeners();
        this.loadUserData();
        this.loadProjects();
        this.loadActivities();
        this.updateStats();
    }

    async checkAuth() {
        return new Promise((resolve) => {
            const unsubscribe = auth.onAuthStateChanged((user) => {
                if (!user) {
                    window.location.href = 'login.html';
                } else {
                    resolve(user);
                }
                unsubscribe();
            });
        });
    }

    initEventListeners() {
        // Workbench button
        const workbenchBtn = document.getElementById('workbenchBtn');
        if (workbenchBtn) {
            workbenchBtn.addEventListener('click', () => this.showWorkbenchModal());
        }

        // Create workbench button
        const createWorkbenchBtn = document.getElementById('createWorkbenchBtn');
        if (createWorkbenchBtn) {
            createWorkbenchBtn.addEventListener('click', () => this.showWorkbenchModal());
        }

        // New project button
        const newProjectBtn = document.getElementById('newProjectBtn');
        if (newProjectBtn) {
            newProjectBtn.addEventListener('click', () => this.showWorkbenchModal());
        }

        // Refresh button
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.refreshDashboard());
        }

        // Modal close buttons
        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', () => this.closeModal());
        });

        // Click outside modal
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) this.closeModal();
            });
        });

        // Cancel button
        const cancelBtn = document.getElementById('cancelBtn');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => this.closeModal());
        }

        // Workbench form submission
        const workbenchForm = document.getElementById('workbenchForm');
        if (workbenchForm) {
            workbenchForm.addEventListener('submit', (e) => this.handleWorkbenchSubmit(e));
        }

        // Modules button
        const modulesBtn = document.getElementById('modulesBtn');
        if (modulesBtn) {
            modulesBtn.addEventListener('click', () => {
                window.location.href = 'modules.html';
            });
        }

        // Settings button
        const settingsBtn = document.getElementById('settingsBtn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => {
                this.showNotification('Settings page coming soon!', 'info');
            });
        }
    }

    async loadUserData() {
        if (!currentUser) return;

        try {
            const userDoc = await db.collection(collections.USERS).doc(currentUser.uid).get();
            if (userDoc.exists) {
                const data = userDoc.data();
                
                // Update UI
                const userNameEl = document.getElementById('userName');
                if (userNameEl) userNameEl.textContent = data.username || currentUser.email;
                
                const userRoleEl = document.getElementById('userRole');
                if (userRoleEl) userRoleEl.textContent = data.role || 'User';
            }
        } catch (error) {
            console.error('Error loading user data:', error);
        }
    }

    async loadProjects() {
        if (!currentUser) return;

        try {
            const projectsQuery = await db.collection(collections.PROJECTS)
                .where('userId', '==', currentUser.uid)
                .orderBy('createdAt', 'desc')
                .limit(10)
                .get();

            this.projects = [];
            const projectsGrid = document.getElementById('projectsGrid');
            const projectList = document.getElementById('projectList');

            if (projectsGrid) projectsGrid.innerHTML = '';
            if (projectList) projectList.innerHTML = '';

            projectsQuery.forEach((doc) => {
                const project = { id: doc.id, ...doc.data() };
                this.projects.push(project);

                // Add to projects grid
                if (projectsGrid) {
                    projectsGrid.appendChild(this.createProjectCard(project));
                }

                // Add to sidebar list
                if (projectList) {
                    projectList.appendChild(this.createProjectListItem(project));
                }
            });

            // Update project count
            const projectCountEl = document.getElementById('projectCount');
            if (projectCountEl) {
                projectCountEl.textContent = this.projects.length;
            }

        } catch (error) {
            console.error('Error loading projects:', error);
            this.showNotification('Failed to load projects', 'error');
        }
    }

    createProjectCard(project) {
        const card = document.createElement('div');
        card.className = 'project-card';
        card.dataset.projectId = project.id;
        
        // Determine emoji based on status
        let emoji = '🔄';
        let statusClass = 'pending';
        let statusText = 'Pending';
        
        if (project.status === 'ready') {
            emoji = '✅';
            statusClass = 'ready';
            statusText = 'Ready';
        } else if (project.status === 'failed') {
            emoji = '❌';
            statusClass = 'failed';
            statusText = 'Failed';
        }

        // Format date
        const daysAgo = project.createdAt ? 
            Math.floor((new Date() - project.createdAt.toDate()) / (1000 * 60 * 60 * 24)) : 0;

        card.innerHTML = `
            <div class="project-card-header">
                <h3 class="project-name">${project.name || 'Untitled Project'}</h3>
                <span class="project-days">${daysAgo} days</span>
            </div>
            <p class="project-host">${project.host || 'No host specified'}</p>
            <div class="project-status">
                <span class="status-badge ${statusClass}">${statusText}</span>
                <span class="debug-status">Debug: ${project.debugStatus || 'Not found'}</span>
            </div>
            <div class="emoji-container">
                <span class="emoji">${emoji}</span>
            </div>
        `;

        // Add click event
        card.addEventListener('click', () => this.viewProjectDetails(project.id));

        return card;
    }

    createProjectListItem(project) {
        const item = document.createElement('div');
        item.className = 'project-item';
        item.dataset.projectId = project.id;
        
        item.innerHTML = `
            <div class="project-item-name">${project.name || 'Untitled'}</div>
            <div class="project-item-host">${project.host || 'No host'}</div>
        `;

        item.addEventListener('click', () => this.viewProjectDetails(project.id));

        return item;
    }

    async loadActivities() {
        if (!currentUser) return;

        try {
            const activitiesQuery = await db.collection(collections.ACTIVITIES)
                .where('userId', '==', currentUser.uid)
                .orderBy('timestamp', 'desc')
                .limit(5)
                .get();

            this.activities = [];
            const activityList = document.getElementById('activityList');

            if (activityList) activityList.innerHTML = '';

            activitiesQuery.forEach((doc) => {
                const activity = doc.data();
                this.activities.push(activity);

                if (activityList) {
                    activityList.appendChild(this.createActivityItem(activity));
                }
            });

        } catch (error) {
            console.error('Error loading activities:', error);
        }
    }

    createActivityItem(activity) {
        const item = document.createElement('div');
        item.className = 'activity-item';
        
        let icon = 'fas fa-code';
        let color = '#58a6ff';
        
        switch (activity.type) {
            case 'project_created':
                icon = 'fas fa-plus';
                color = '#238636';
                break;
            case 'project_updated':
                icon = 'fas fa-edit';
                color = '#f0883e';
                break;
            case 'project_completed':
                icon = 'fas fa-check';
                color = '#238636';
                break;
            case 'error':
                icon = 'fas fa-exclamation-triangle';
                color = '#f85149';
                break;
        }

        const timeAgo = this.formatTimeAgo(activity.timestamp?.toDate());

        item.innerHTML = `
            <div class="activity-icon" style="background-color: ${color}20;">
                <i class="${icon}" style="color: ${color};"></i>
            </div>
            <div class="activity-details">
                <div class="activity-title">${activity.title}</div>
                <div class="activity-time">${timeAgo}</div>
            </div>
        `;

        return item;
    }

    async updateStats() {
        if (!currentUser) return;

        try {
            // Count pending projects
            const pendingQuery = await db.collection(collections.PROJECTS)
                .where('userId', '==', currentUser.uid)
                .where('status', '==', 'pending')
                .get();

            // Count successful projects
            const successQuery = await db.collection(collections.PROJECTS)
                .where('userId', '==', currentUser.uid)
                .where('status', '==', 'ready')
                .get();

            const pendingCountEl = document.getElementById('pendingCount');
            const successCountEl = document.getElementById('successCount');

            if (pendingCountEl) pendingCountEl.textContent = pendingQuery.size;
            if (successCountEl) successCountEl.textContent = successQuery.size;

        } catch (error) {
            console.error('Error updating stats:', error);
        }
    }

    showWorkbenchModal() {
        const modal = document.getElementById('workbenchModal');
        if (modal) {
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
            
            // Reset form
            const form = document.getElementById('workbenchForm');
            if (form) form.reset();
        }
    }

    closeModal() {
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            modal.style.display = 'none';
        });
        document.body.style.overflow = 'auto';
    }

    async handleWorkbenchSubmit(e) {
        e.preventDefault();
        
        if (!currentUser) {
            this.showNotification('Please login first', 'error');
            return;
        }

        const form = e.target;
        const commitBtn = document.getElementById('commitBtn');
        
        // Disable button and show loading
        if (commitBtn) {
            commitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating...';
            commitBtn.disabled = true;
        }

        try {
            // Collect form data
            const projectData = {
                userId: currentUser.uid,
                route: document.getElementById('route').value,
                host: document.getElementById('host').value,
                bearerToken: document.getElementById('bearerToken').value,
                xVersion: document.getElementById('xVersion').value,
                name: document.getElementById('projectName').value || 'Untitled Project',
                status: 'pending',
                debugStatus: 'Not found',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            // Validate data
            if (!projectData.route || !projectData.host || !projectData.bearerToken) {
                throw new Error('Please fill all required fields');
            }

            // Save to Firestore
            const docRef = await db.collection(collections.PROJECTS).add(projectData);

            // Create activity log
            await db.collection(collections.ACTIVITIES).add({
                userId: currentUser.uid,
                type: 'project_created',
                title: `Created project "${projectData.name}"`,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                projectId: docRef.id
            });

            this.showNotification('Project created successfully!', 'success');
            this.closeModal();

            // Refresh dashboard
            setTimeout(() => {
                this.refreshDashboard();
            }, 500);

        } catch (error) {
            console.error('Error creating project:', error);
            this.showNotification(error.message || 'Failed to create project', 'error');
        } finally {
            // Reset button
            if (commitBtn) {
                commitBtn.innerHTML = '<i class="fas fa-code-commit"></i> Commit';
                commitBtn.disabled = false;
            }
        }
    }

    async viewProjectDetails(projectId) {
        try {
            const projectDoc = await db.collection(collections.PROJECTS).doc(projectId).get();
            if (!projectDoc.exists) {
                this.showNotification('Project not found', 'error');
                return;
            }

            const project = projectDoc.data();
            
            // Show project details in modal (you can expand this)
            this.showNotification(`Viewing project: ${project.name}`, 'info');
            
            // For now, just show basic info
            const details = `
                Route: ${project.route}
                Host: ${project.host}
                Status: ${project.status}
                Created: ${project.createdAt?.toDate().toLocaleDateString()}
            `;
            
            console.log('Project details:', details);

        } catch (error) {
            console.error('Error viewing project:', error);
            this.showNotification('Failed to load project details', 'error');
        }
    }

    refreshDashboard() {
        this.loadProjects();
        this.loadActivities();
        this.updateStats();
        this.showNotification('Dashboard refreshed', 'success');
    }

    formatTimeAgo(date) {
        if (!date) return 'Just now';
        
        const seconds = Math.floor((new Date() - date) / 1000);
        
        let interval = Math.floor(seconds / 31536000);
        if (interval >= 1) return interval + ' year' + (interval === 1 ? '' : 's') + ' ago';
        
        interval = Math.floor(seconds / 2592000);
        if (interval >= 1) return interval + ' month' + (interval === 1 ? '' : 's') + ' ago';
        
        interval = Math.floor(seconds / 86400);
        if (interval >= 1) return interval + ' day' + (interval === 1 ? '' : 's') + ' ago';
        
        interval = Math.floor(seconds / 3600);
        if (interval >= 1) return interval + ' hour' + (interval === 1 ? '' : 's') + ' ago';
        
        interval = Math.floor(seconds / 60);
        if (interval >= 1) return interval + ' minute' + (interval === 1 ? '' : 's') + ' ago';
        
        return 'Just now';
    }

    showNotification(message, type = 'info') {
        // Reuse auth manager's notification system or create own
        if (window.authManager && window.authManager.showNotification) {
            window.authManager.showNotification(message, type);
        } else {
            alert(message);
        }
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.dashboardManager = new DashboardManager();
});