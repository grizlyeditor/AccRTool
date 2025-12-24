// Authentication Functions
class AuthManager {
    constructor() {
        this.initEventListeners();
        this.checkAuthState();
    }

    initEventListeners() {
        // Login form
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }

        // Register form
        const registerForm = document.getElementById('registerForm');
        if (registerForm) {
            registerForm.addEventListener('submit', (e) => this.handleRegister(e));
        }

        // Login button on homepage
        const loginBtn = document.getElementById('loginBtn');
        if (loginBtn) {
            loginBtn.addEventListener('click', () => this.showLoginModal());
        }

        // Register button on homepage
        const registerBtn = document.getElementById('registerBtn');
        if (registerBtn) {
            registerBtn.addEventListener('click', () => this.showRegisterModal());
        }

        // Create account button on login page
        const createAccountBtn = document.getElementById('createAccountBtn');
        if (createAccountBtn) {
            createAccountBtn.addEventListener('click', () => {
                window.location.href = 'login.html?action=register';
            });
        }

        // Modal close buttons
        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', () => this.closeAllModals());
        });

        // Click outside modal to close
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeAllModals();
                }
            });
        });

        // Logout button
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.handleLogout());
        }
    }

    async handleLogin(e) {
        if (e) e.preventDefault();
        
        const email = document.getElementById('loginEmail')?.value || document.getElementById('email')?.value;
        const password = document.getElementById('loginPassword')?.value || document.getElementById('password')?.value;
        
        if (!email || !password) {
            this.showNotification('Please fill all fields', 'error');
            return;
        }

        const btn = document.getElementById('signInBtn') || document.querySelector('#loginForm button[type="submit"]');
        const btnText = btn.querySelector('#btnText') || btn;
        const spinner = document.getElementById('spinner');
        
        if (btnText) btnText.textContent = 'Signing in...';
        if (spinner) spinner.classList.remove('hidden');
        btn.disabled = true;

        try {
            const userCredential = await auth.signInWithEmailAndPassword(email, password);
            const user = userCredential.user;

            // Check if user exists in Firestore
            const userDoc = await db.collection(collections.USERS).doc(user.uid).get();
            
            if (!userDoc.exists) {
                // Create user document if doesn't exist
                await db.collection(collections.USERS).doc(user.uid).set({
                    email: user.email,
                    username: user.email.split('@')[0],
                    role: 'user',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    lastLogin: firebase.firestore.FieldValue.serverTimestamp()
                });
            } else {
                // Update last login
                await db.collection(collections.USERS).doc(user.uid).update({
                    lastLogin: firebase.firestore.FieldValue.serverTimestamp()
                });
            }

            this.showNotification('Login successful!', 'success');
            
            // Redirect to dashboard
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1000);

        } catch (error) {
            console.error('Login error:', error);
            let message = 'Login failed';
            
            switch (error.code) {
                case 'auth/user-not-found':
                    message = 'User not found';
                    break;
                case 'auth/wrong-password':
                    message = 'Invalid password';
                    break;
                case 'auth/invalid-email':
                    message = 'Invalid email format';
                    break;
                case 'auth/user-disabled':
                    message = 'Account disabled';
                    break;
                case 'auth/too-many-requests':
                    message = 'Too many attempts. Try again later';
                    break;
            }
            
            this.showNotification(message, 'error');
        } finally {
            if (btnText) btnText.textContent = 'Sign in';
            if (spinner) spinner.classList.add('hidden');
            if (btn) btn.disabled = false;
        }
    }

    async handleRegister(e) {
        if (e) e.preventDefault();
        
        const username = document.getElementById('registerUsername')?.value;
        const email = document.getElementById('registerEmail')?.value;
        const password = document.getElementById('registerPassword')?.value;
        
        if (!username || !email || !password) {
            this.showNotification('Please fill all fields', 'error');
            return;
        }

        if (password.length < 6) {
            this.showNotification('Password must be at least 6 characters', 'error');
            return;
        }

        const btn = document.querySelector('#registerForm button[type="submit"]');
        if (btn) {
            btn.textContent = 'Creating account...';
            btn.disabled = true;
        }

        try {
            // Create user in Firebase Auth
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;

            // Create user document in Firestore
            await db.collection(collections.USERS).doc(user.uid).set({
                username: username,
                email: email,
                role: 'user',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
                profileComplete: false,
                settings: {
                    theme: 'dark',
                    notifications: true
                }
            });

            // Send email verification
            await user.sendEmailVerification();

            this.showNotification('Account created successfully! Please verify your email.', 'success');
            this.closeAllModals();

            // Auto login
            await this.handleLogin();

        } catch (error) {
            console.error('Registration error:', error);
            let message = 'Registration failed';
            
            switch (error.code) {
                case 'auth/email-already-in-use':
                    message = 'Email already in use';
                    break;
                case 'auth/invalid-email':
                    message = 'Invalid email format';
                    break;
                case 'auth/weak-password':
                    message = 'Password is too weak';
                    break;
                case 'auth/operation-not-allowed':
                    message = 'Registration is currently disabled';
                    break;
            }
            
            this.showNotification(message, 'error');
        } finally {
            if (btn) {
                btn.textContent = 'Create account';
                btn.disabled = false;
            }
        }
    }

    async handleLogout() {
        try {
            await auth.signOut();
            this.showNotification('Logged out successfully', 'success');
            window.location.href = 'index.html';
        } catch (error) {
            console.error('Logout error:', error);
            this.showNotification('Logout failed', 'error');
        }
    }

    showLoginModal() {
        const modal = document.getElementById('loginModal');
        if (modal) {
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        } else {
            window.location.href = 'login.html';
        }
    }

    showRegisterModal() {
        const modal = document.getElementById('registerModal');
        if (modal) {
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        }
    }

    closeAllModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.style.display = 'none';
        });
        document.body.style.overflow = 'auto';
    }

    checkAuthState() {
        // Check URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('action') === 'register') {
            this.showRegisterModal();
        }
    }

    showNotification(message, type = 'info') {
        // Remove existing notifications
        const existing = document.querySelector('.notification');
        if (existing) existing.remove();

        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
                <span>${message}</span>
            </div>
            <button class="notification-close">&times;</button>
        `;

        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            .notification {
                position: fixed;
                top: 20px;
                right: 20px;
                background: ${type === 'success' ? '#238636' : type === 'error' ? '#f85149' : '#58a6ff'};
                color: white;
                padding: 12px 20px;
                border-radius: 6px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                z-index: 9999;
                animation: slideIn 0.3s ease;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                max-width: 400px;
            }
            .notification-content {
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .notification-close {
                background: none;
                border: none;
                color: white;
                font-size: 20px;
                cursor: pointer;
                padding: 0;
                width: 24px;
                height: 24px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 4px;
            }
            .notification-close:hover {
                background: rgba(255,255,255,0.1);
            }
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        
        document.head.appendChild(style);
        document.body.appendChild(notification);

        // Add close button functionality
        notification.querySelector('.notification-close').addEventListener('click', () => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        });

        // Auto remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideOut 0.3s ease';
                setTimeout(() => notification.remove(), 300);
            }
        }, 5000);
    }

    // Forgot password functionality
    async handleForgotPassword(email) {
        try {
            await auth.sendPasswordResetEmail(email);
            this.showNotification('Password reset email sent!', 'success');
        } catch (error) {
            console.error('Password reset error:', error);
            this.showNotification('Failed to send reset email', 'error');
        }
    }
}

// Initialize auth manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.authManager = new AuthManager();
});