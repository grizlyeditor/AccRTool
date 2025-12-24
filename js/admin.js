// Admin Panel Management
class AdminManager {
    constructor() {
        this.users = [];
        this.requests = [];
        this.currentRate = null;
        this.initAdmin();
    }

    async initAdmin() {
        await this.checkAdminAccess();
        this.initEventListeners();
        this.loadDashboardStats();
        this.loadUsers();
        this.loadRequests();
    }

    async checkAdminAccess() {
        if (!currentUser) {
            window.location.href = 'login.html';
            return;
        }

        const isAdmin = await firebaseApp.isAdmin(currentUser.uid);
        if (!isAdmin) {
            window.location.href = 'dashboard.html';
            return;
        }
    }

    initEventListeners() {
        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e));
        });

        // User search
        const userSearch = document.getElementById('userSearch');
        if (userSearch) {
            userSearch.addEventListener('input', () => this.filterUsers());
        }

        // Export button
        const exportBtn = document.getElementById('exportBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportData());
        }

        // Rate modal
        const rateModal = document.getElementById('rateModal');
        if (rateModal) {
            rateModal.addEventListener('click', (e) => {
                if (e.target === rateModal) this.closeRateModal();
            });
        }

        // Rate wheel options
        document.querySelectorAll('.wheel-option').forEach(option => {
            option.addEventListener('click', (e) => this.selectRateOption(e));
        });

        // Save rate button
        const saveRateBtn = document.getElementById('saveRateBtn');
        if (saveRateBtn) {
            saveRateBtn.addEventListener('click', () => this.saveRate());
        }

        // Cancel rate button
        const cancelRateBtn = document.getElementById('cancelRateBtn');
        if (cancelRateBtn) {
            cancelRateBtn.addEventListener('click', () => this.closeRateModal());
        }

        // Modal close buttons
        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', () => this.closeRateModal());
        });

        // Logout button
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                if (window.authManager) {
                    window.authManager.handleLogout();
                }
            });
        }
    }

    async loadDashboardStats() {
        try {
            // Get total users
            const usersSnapshot = await db.collection(collections.USERS).get();
            const totalUsers = document.getElementById('totalUsers');
            if (totalUsers) totalUsers.textContent = usersSnapshot.size;

            // Get pending requests
            const pendingSnapshot = await db.collection(collections.REQUESTS)
                .where('status', '==', 'pending')
                .get();
            const pendingRequests = document.getElementById('pendingRequests');
            if (pendingRequests) pendingRequests.textContent = pendingSnapshot.size;

            // Get completed requests
            const completedSnapshot = await db.collection(collections.REQUESTS)
                .where('status', '==', 'approved')
                .get();
            const completedRequests = document.getElementById('completedRequests');
            if (completedRequests) completedRequests.textContent = completedSnapshot.size;

            // Get failed requests
            const failedSnapshot = await db.collection(collections.REQUESTS)
                .where('status', '==', 'rejected')
                .get();
            const failedRequests = document.getElementById('failedRequests');
            if (failedRequests) failedRequests.textContent = failedSnapshot.size;

        } catch (error) {
            console.error('Error loading dashboard stats:', error);
            this.showNotification('Failed to load statistics', 'error');
        }
    }

    async loadUsers() {
        try {
            const usersSnapshot = await db.collection(collections.USERS).get();
            this.users = [];
            const usersTable = document.getElementById('usersTable');
            
            if (usersTable) usersTable.innerHTML = '';

            usersSnapshot.forEach((doc) => {
                const user = { id: doc.id, ...doc.data() };
                this.users.push(user);

                if (usersTable) {
                    usersTable.appendChild(this.createUserRow(user));
                }
            });

        } catch (error) {
            console.error('Error loading users:', error);
            this.showNotification('Failed to load users', 'error');
        }
    }

    createUserRow(user) {
        const tr = document.createElement('tr');
        
        // Determine status and emoji
        let status = 'Active';
        let statusClass = 'success';
        let emoji = '😊';
        let rate = 'Unknown';

        // Get user's latest request
        const userRequests = this.requests.filter(r => r.userId === user.id);
        if (userRequests.length > 0) {
            const latestRequest = userRequests[userRequests.length - 1];
            status = latestRequest.status || 'Pending';
            statusClass = latestRequest.status === 'approved' ? 'success' : 
                         latestRequest.status === 'rejected' ? 'danger' : 'warning';
            emoji = latestRequest.emoji || '😊';
            rate = latestRequest.chances || 'Unknown';
        }

        tr.innerHTML = `
            <td>
                <div class="user-cell">
                    <img src="https://avatars.githubusercontent.com/u/${user.id.substring(0, 8)}?v=4" 
                         alt="${user.username}" class="user-avatar">
                    <div class="user-info">
                        <strong>${user.username || 'Unknown'}</strong>
                        <small>${user.email || 'No email'}</small>
                    </div>
                </div>
            </td>
            <td>${user.host || 'N/A'}</td>
            <td><span class="status-badge ${statusClass}">${status}</span></td>
            <td>${rate}</td>
            <td class="emoji-cell">${emoji}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-sm" onclick="adminManager.viewUser('${user.id}')">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-sm btn-primary" onclick="adminManager.editRate('${user.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                </div>
            </td>
        `;

        return tr;
    }

    async loadRequests() {
        try {
            const requestsSnapshot = await db.collection(collections.REQUESTS)
                .orderBy('createdAt', 'desc')
                .get();

            this.requests = [];
            const requestsTable = document.getElementById('requestsTable');
            
            if (requestsTable) requestsTable.innerHTML = '';

            for (const doc of requestsSnapshot.docs) {
                const request = { id: doc.id, ...doc.data() };
                this.requests.push(request);

                // Get project details
                if (request.projectId) {
                    const projectDoc = await db.collection(collections.PROJECTS).doc(request.projectId).get();
                    if (projectDoc.exists) {
                        request.project = projectDoc.data();
                    }
                }

                if (requestsTable) {
                    requestsTable.appendChild(this.createRequestRow(request));
                }
            }

        } catch (error) {
            console.error('Error loading requests:', error);
            this.showNotification('Failed to load requests', 'error');
        }
    }

    createRequestRow(request) {
        const tr = document.createElement('tr');
        
        // Calculate days
        const days = request.createdAt ? 
            Math.floor((new Date() - request.createdAt.toDate()) / (1000 * 60 * 60 * 24)) : 0;
        
        // Determine status
        let statusClass = 'warning';
        let statusText = 'Pending';
        
        if (request.status === 'approved') {
            statusClass = 'success';
            statusText = 'Approved';
        } else if (request.status === 'rejected') {
            statusClass = 'danger';
            statusText = 'Rejected';
        }

        // Get emoji based on chances
        let emoji = this.getEmojiByChances(request.chances);

        tr.innerHTML = `
            <td>
                <strong>${request.userName || 'Unknown User'}</strong>
                <br>
                <small>${request.project?.name || 'No project name'}</small>
            </td>
            <td>${request.host || 'N/A'}</td>
            <td>${days} days</td>
            <td><span class="status-badge ${statusClass}">${statusText}</span></td>
            <td>${request.chances || 'Unknown'}</td>
            <td>
                <code class="debug-code">${request.debugCode || 'No debug code'}</code>
            </td>
            <td>
                <div class="action-buttons">
                    <button class="btn btn-sm" onclick="adminManager.viewRequest('${request.id}')">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-sm btn-primary" onclick="adminManager.editRequest('${request.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="adminManager.deleteRequest('${request.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;

        return tr;
    }

    switchTab(e) {
        const tabBtn = e.target.closest('.tab-btn');
        if (!tabBtn) return;

        // Update active tab
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        tabBtn.classList.add('active');

        const tab = tabBtn.dataset.tab;
        this.filterRequestsByTab(tab);
    }

    filterRequestsByTab(tab) {
        const rows = document.querySelectorAll('#requestsTable tr');
        rows.forEach(row => {
            if (tab === 'all') {
                row.style.display = '';
                return;
            }

            const statusBadge = row.querySelector('.status-badge');
            if (statusBadge) {
                const status = statusBadge.textContent.toLowerCase();
                row.style.display = status.includes(tab) ? '' : 'none';
            }
        });
    }

    filterUsers() {
        const searchTerm = document.getElementById('userSearch').value.toLowerCase();
        const rows = document.querySelectorAll('#usersTable tr');

        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            row.style.display = text.includes(searchTerm) ? '' : 'none';
        });
    }

    getEmojiByChances(chances) {
        switch (chances) {
            case 'ready': return '✅';
            case 'pending': return '🔄';
            case '15': return '⚠️';
            case 'nochance': return '❌';
            case 'dead': return '💀';
            default: return '😊';
        }
    }

    viewUser(userId) {
        const user = this.users.find(u => u.id === userId);
        if (!user) return;

        const details = `
            Username: ${user.username}
            Email: ${user.email}
            Role: ${user.role}
            Created: ${user.createdAt?.toDate().toLocaleString()}
            Last Login: ${user.lastLogin?.toDate().toLocaleString()}
        `;

        alert(`User Details:\n\n${details}`);
    }

    editRate(userId) {
        this.currentRate = { userId };
        this.showRateModal();
    }

    viewRequest(requestId) {
        const request = this.requests.find(r => r.id === requestId);
        if (!request) return;

        const details = `
            User: ${request.userName}
            Host: ${request.host}
            Status: ${request.status}
            Chances: ${request.chances}
            Created: ${request.createdAt?.toDate().toLocaleString()}
            Debug Code: ${request.debugCode || 'None'}
        `;

        alert(`Request Details:\n\n${details}`);
    }

    editRequest(requestId) {
        const request = this.requests.find(r => r.id === requestId);
        if (!request) return;

        this.currentRate = { 
            requestId, 
            userId: request.userId,
            currentRate: request.chances,
            currentDebug: request.debugCode 
        };
        
        // Pre-fill debug code if exists
        const debugTextarea = document.getElementById('debugCode');
        if (debugTextarea && request.debugCode) {
            debugTextarea.value = request.debugCode;
        }

        this.showRateModal();
    }

    async deleteRequest(requestId) {
        if (!confirm('Are you sure you want to delete this request?')) return;

        try {
            await db.collection(collections.REQUESTS).doc(requestId).delete();
            this.showNotification('Request deleted successfully', 'success');
            this.loadRequests();
        } catch (error) {
            console.error('Error deleting request:', error);
            this.showNotification('Failed to delete request', 'error');
        }
    }

    showRateModal() {
        const modal = document.getElementById('rateModal');
        if (modal) {
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        }
    }

    closeRateModal() {
        const modal = document.getElementById('rateModal');
        if (modal) {
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
            this.currentRate = null;
            
            // Clear debug code
            const debugTextarea = document.getElementById('debugCode');
            if (debugTextarea) debugTextarea.value = '';
        }
    }

    selectRateOption(e) {
        const option = e.target.closest('.wheel-option');
        if (!option) return;

        // Remove selection from all options
        document.querySelectorAll('.wheel-option').forEach(opt => {
            opt.classList.remove('selected');
        });

        // Add selection to clicked option
        option.classList.add('selected');
        this.currentRate.rate = option.dataset.value;
    }

    async saveRate() {
        if (!this.currentRate || !this.currentRate.rate) {
            this.showNotification('Please select a rate option', 'error');
            return;
        }

        const saveBtn = document.getElementById('saveRateBtn');
        if (saveBtn) {
            saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
            saveBtn.disabled = true;
        }

        try {
            const debugCode = document.getElementById('debugCode')?.value || '';
            const emoji = this.getEmojiByChances(this.currentRate.rate);
            const status = this.currentRate.rate === 'ready' ? 'approved' : 
                          this.currentRate.rate === 'dead' ? 'rejected' : 'pending';

            if (this.currentRate.requestId) {
                // Update existing request
                await db.collection(collections.REQUESTS).doc(this.currentRate.requestId).update({
                    chances: this.currentRate.rate,
                    debugCode: debugCode,
                    emoji: emoji,
                    status: status,
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    reviewedBy: currentUser.uid,
                    reviewedAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                // Update corresponding project status
                const requestDoc = await db.collection(collections.REQUESTS).doc(this.currentRate.requestId).get();
                const requestData = requestDoc.data();
                
                if (requestData.projectId) {
                    await db.collection(collections.PROJECTS).doc(requestData.projectId).update({
                        status: status,
                        debugStatus: debugCode ? 'Code provided' : 'No code',
                        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                    });
                }

                this.showNotification('Request updated successfully', 'success');

            } else if (this.currentRate.userId) {
                // Create new rate for user
                // This would typically create a request or update user's rating
                this.showNotification('User rate updated', 'success');
            }

            this.closeRateModal();
            
            // Refresh data
            setTimeout(() => {
                this.loadDashboardStats();
                this.loadRequests();
                this.loadUsers();
            }, 500);

        } catch (error) {
            console.error('Error saving rate:', error);
            this.showNotification('Failed to save rate', 'error');
        } finally {
            if (saveBtn) {
                saveBtn.innerHTML = 'Save & Update';
                saveBtn.disabled = false;
            }
        }
    }

    async exportData() {
        try {
            // Prepare data for export
            const exportData = {
                users: this.users,
                requests: this.requests,
                exportDate: new Date().toISOString(),
                exportedBy: currentUser.email
            };

            // Convert to JSON
            const jsonData = JSON.stringify(exportData, null, 2);
            
            // Create download link
            const blob = new Blob([jsonData], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `admin_export_${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            this.showNotification('Data exported successfully', 'success');

        } catch (error) {
            console.error('Error exporting data:', error);
            this.showNotification('Failed to export data', 'error');
        }
    }

    showNotification(message, type = 'info') {
        if (window.authManager && window.authManager.showNotification) {
            window.authManager.showNotification(message, type);
        } else {
            alert(message);
        }
    }
}

// Initialize admin panel when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.adminManager = new AdminManager();
});