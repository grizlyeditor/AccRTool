// Utility Functions
class Utils {
    constructor() {
        this.initUtils();
    }

    initUtils() {
        // Add common utility methods
    }

    // Format date to readable string
    formatDate(date, format = 'full') {
        if (!date) return 'N/A';
        
        const d = date.toDate ? date.toDate() : new Date(date);
        
        if (format === 'short') {
            return d.toLocaleDateString();
        } else if (format === 'time') {
            return d.toLocaleTimeString();
        } else {
            return d.toLocaleString();
        }
    }

    // Generate random ID
    generateId(length = 8) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    // Validate email
    validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }

    // Validate password strength
    validatePassword(password) {
        const minLength = 6;
        if (password.length < minLength) {
            return { valid: false, message: `Password must be at least ${minLength} characters` };
        }
        return { valid: true, message: 'Password is valid' };
    }

    // Debounce function for search inputs
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
    }

    // Copy text to clipboard
    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            return { success: true, message: 'Copied to clipboard' };
        } catch (err) {
            console.error('Copy failed:', err);
            return { success: false, message: 'Failed to copy' };
        }
    }

    // Download file
    downloadFile(content, filename, type = 'text/plain') {
        const blob = new Blob([content], { type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // Parse query parameters
    getQueryParams() {
        const params = {};
        const queryString = window.location.search.substring(1);
        const pairs = queryString.split('&');
        
        pairs.forEach(pair => {
            const [key, value] = pair.split('=');
            if (key) {
                params[decodeURIComponent(key)] = decodeURIComponent(value || '');
            }
        });
        
        return params;
    }

    // Set query parameter
    setQueryParam(key, value) {
        const url = new URL(window.location);
        url.searchParams.set(key, value);
        window.history.pushState({}, '', url);
    }

    // Remove query parameter
    removeQueryParam(key) {
        const url = new URL(window.location);
        url.searchParams.delete(key);
        window.history.pushState({}, '', url);
    }

    // Show loading spinner
    showLoading(containerId) {
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = `
                <div class="loading-spinner">
                    <div class="spinner"></div>
                    <p>Loading...</p>
                </div>
            `;
            
            // Add styles if not already present
            if (!document.querySelector('#loading-styles')) {
                const style = document.createElement('style');
                style.id = 'loading-styles';
                style.textContent = `
                    .loading-spinner {
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        padding: 40px;
                    }
                    .loading-spinner .spinner {
                        width: 40px;
                        height: 40px;
                        border: 3px solid rgba(88, 166, 255, 0.3);
                        border-radius: 50%;
                        border-top-color: #58a6ff;
                        animation: spin 1s linear infinite;
                        margin-bottom: 16px;
                    }
                    @keyframes spin {
                        to { transform: rotate(360deg); }
                    }
                `;
                document.head.appendChild(style);
            }
        }
    }

    // Hide loading spinner
    hideLoading(containerId) {
        const container = document.getElementById(containerId);
        if (container) {
            const spinner = container.querySelector('.loading-spinner');
            if (spinner) spinner.remove();
        }
    }

    // Format bytes to human readable size
    formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    // Check if user is online
    isOnline() {
        return navigator.onLine;
    }

    // Monitor online/offline status
    monitorConnection(callback) {
        window.addEventListener('online', () => callback(true));
        window.addEventListener('offline', () => callback(false));
    }

    // Store data in localStorage
    setLocalStorage(key, value) {
        try {
            const serialized = JSON.stringify(value);
            localStorage.setItem(key, serialized);
            return true;
        } catch (error) {
            console.error('Error saving to localStorage:', error);
            return false;
        }
    }

    // Get data from localStorage
    getLocalStorage(key, defaultValue = null) {
        try {
            const serialized = localStorage.getItem(key);
            if (serialized === null) return defaultValue;
            return JSON.parse(serialized);
        } catch (error) {
            console.error('Error reading from localStorage:', error);
            return defaultValue;
        }
    }

    // Remove data from localStorage
    removeLocalStorage(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.error('Error removing from localStorage:', error);
            return false;
        }
    }

    // Clear all app data from localStorage
    clearAppData() {
        const keys = Object.keys(localStorage).filter(key => 
            key.startsWith('fftoolkit_') || key.includes('firebase')
        );
        
        keys.forEach(key => {
            localStorage.removeItem(key);
        });
        
        return keys.length;
    }

    // Create confirmation dialog
    confirmDialog(message, title = 'Confirm') {
        return new Promise((resolve) => {
            // Remove existing dialog
            const existing = document.querySelector('.confirm-dialog');
            if (existing) existing.remove();

            // Create dialog
            const dialog = document.createElement('div');
            dialog.className = 'confirm-dialog modal';
            dialog.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>${title}</h3>
                        <button class="close-dialog">&times;</button>
                    </div>
                    <div class="modal-body">
                        <p>${message}</p>
                    </div>
                    <div class="modal-footer">
                        <button class="btn" id="cancelBtn">Cancel</button>
                        <button class="btn btn-primary" id="confirmBtn">Confirm</button>
                    </div>
                </div>
            `;

            // Add styles
            const style = document.createElement('style');
            style.textContent = `
                .confirm-dialog .modal-content {
                    max-width: 400px;
                }
                .modal-footer {
                    display: flex;
                    justify-content: flex-end;
                    gap: 10px;
                    padding: 20px;
                    border-top: 1px solid var(--github-border);
                }
            `;
            document.head.appendChild(style);
            document.body.appendChild(dialog);

            // Add event listeners
            const closeBtn = dialog.querySelector('.close-dialog');
            const cancelBtn = dialog.querySelector('#cancelBtn');
            const confirmBtn = dialog.querySelector('#confirmBtn');

            const closeDialog = (result) => {
                dialog.remove();
                style.remove();
                resolve(result);
            };

            closeBtn?.addEventListener('click', () => closeDialog(false));
            cancelBtn?.addEventListener('click', () => closeDialog(false));
            confirmBtn?.addEventListener('click', () => closeDialog(true));
            
            // Close on background click
            dialog.addEventListener('click', (e) => {
                if (e.target === dialog) closeDialog(false);
            });
        });
    }

    // Create toast notification
    toast(message, type = 'info', duration = 3000) {
        // Remove existing toasts
        const existing = document.querySelectorAll('.toast');
        existing.forEach(toast => {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
        });

        // Create toast
        const toastEl = document.createElement('div');
        toastEl.className = `toast toast-${type}`;
        toastEl.textContent = message;

        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            .toast {
                position: fixed;
                bottom: 20px;
                right: 20px;
                background: var(--github-header);
                color: var(--github-text);
                padding: 12px 20px;
                border-radius: 6px;
                border: 1px solid var(--github-border);
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                z-index: 10000;
                animation: slideUp 0.3s ease;
                max-width: 300px;
            }
            .toast-success {
                border-left: 4px solid var(--github-primary);
            }
            .toast-error {
                border-left: 4px solid var(--github-red);
            }
            .toast-warning {
                border-left: 4px solid var(--github-orange);
            }
            .toast-info {
                border-left: 4px solid var(--github-blue);
            }
            @keyframes slideUp {
                from {
                    transform: translateY(100%);
                    opacity: 0;
                }
                to {
                    transform: translateY(0);
                    opacity: 1;
                }
            }
        `;
        document.head.appendChild(style);
        document.body.appendChild(toastEl);

        // Auto remove
        setTimeout(() => {
            if (toastEl.parentNode) {
                toastEl.style.animation = 'slideDown 0.3s ease';
                setTimeout(() => {
                    if (toastEl.parentNode) {
                        toastEl.parentNode.removeChild(toastEl);
                        style.remove();
                    }
                }, 300);
            }
        }, duration);

        // Add slideDown animation
        if (!document.querySelector('#slideDown-style')) {
            const slideStyle = document.createElement('style');
            slideStyle.id = 'slideDown-style';
            slideStyle.textContent = `
                @keyframes slideDown {
                    from {
                        transform: translateY(0);
                        opacity: 1;
                    }
                    to {
                        transform: translateY(100%);
                        opacity: 0;
                    }
                }
            `;
            document.head.appendChild(slideStyle);
        }
    }

    // Validate URL
    isValidUrl(string) {
        try {
            new URL(string);
            return true;
        } catch (_) {
            return false;
        }
    }

    // Sanitize HTML input
    sanitizeInput(input) {
        const div = document.createElement('div');
        div.textContent = input;
        return div.innerHTML;
    }

    // Generate color from string (for avatars)
    stringToColor(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = str.charCodeAt(i) + ((hash << 5) - hash);
        }
        
        const colors = [
            '#FF6B6B', '#4ECDC4', '#FFD166', '#06D6A0',
            '#118AB2', '#073B4C', '#EF476F', '#7209B7',
            '#3A86FF', '#FB5607', '#8338EC', '#FF006E'
        ];
        
        return colors[Math.abs(hash) % colors.length];
    }

    // Create initials from name
    getInitials(name) {
        if (!name) return '??';
        
        const parts = name.split(' ');
        if (parts.length === 1) {
            return parts[0].substring(0, 2).toUpperCase();
        } else {
            return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        }
    }
}

// Initialize utils when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.utils = new Utils();
});