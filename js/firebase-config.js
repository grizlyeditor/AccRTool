// Firebase Configuration - Environment variables se load karega
const firebaseConfig = {
    apiKey: "AIzaSyB_Bv5jEIJrV6K8EbjO5lzZ5oX7Qm8N9d8",
    authDomain: "ejene-d8ff7.firebaseapp.com",
    projectId: "ejene-d8ff7",
    storageBucket: "ejene-d8ff7.appspot.com",
    messagingSenderId: "123456789012",
    appId: "1:123456789012:web:abcdef1234567890"
};

// Initialize Firebase
try {
    firebase.initializeApp(firebaseConfig);
    console.log('✅ Firebase initialized successfully');
} catch (error) {
    console.error('❌ Firebase initialization error:', error);
}

// Initialize services
const auth = firebase.auth();
const db = firebase.firestore();

// Firebase collections
const collections = {
    USERS: 'users',
    PROJECTS: 'projects',
    REQUESTS: 'requests',
    ACTIVITIES: 'activities'
};

// Current user state
let currentUser = null;
let userData = {};

// Auth state listener
auth.onAuthStateChanged(async (user) => {
    currentUser = user;
    
    if (user) {
        console.log('✅ User logged in:', user.email);
        
        // Load user data from Firestore
        try {
            const userDoc = await db.collection(collections.USERS).doc(user.uid).get();
            if (userDoc.exists) {
                userData = userDoc.data();
                console.log('✅ User data loaded:', userData.username);
            } else {
                // Create new user document if doesn't exist
                await db.collection(collections.USERS).doc(user.uid).set({
                    email: user.email,
                    username: user.email.split('@')[0],
                    role: 'user',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    lastLogin: firebase.firestore.FieldValue.serverTimestamp()
                });
                userData = { email: user.email, username: user.email.split('@')[0], role: 'user' };
            }
        } catch (error) {
            console.error('Error loading user data:', error);
        }
        
        // Redirect to dashboard if on login page
        if (window.location.pathname.includes('login.html')) {
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1000);
        }
    } else {
        console.log('⚠️ No user logged in');
        // Redirect to login if not on public pages
        const publicPages = ['/', '/index.html', '/login.html'];
        if (!publicPages.includes(window.location.pathname)) {
            window.location.href = 'login.html';
        }
    }
});

// Export for use in other files
window.firebaseApp = {
    auth,
    db,
    collections,
    currentUser,
    userData,
    isAdmin: async (userId) => {
        try {
            const userDoc = await db.collection(collections.USERS).doc(userId).get();
            return userDoc.exists && userDoc.data().role === 'admin';
        } catch (error) {
            console.error('Error checking admin status:', error);
            return false;
        }
    }
};

// Utility function to show notifications
window.showNotification = function(message, type = 'info') {
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
    
    // Add to body
    document.body.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 5000);
    
    // Close button functionality
    notification.querySelector('.notification-close').addEventListener('click', () => {
        notification.remove();
    });
};

// Add notification styles if not present
if (!document.querySelector('#notification-styles')) {
    const style = document.createElement('style');
    style.id = 'notification-styles';
    style.textContent = `
        .notification {
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 8px;
            color: white;
            display: flex;
            align-items: center;
            gap: 10px;
            z-index: 9999;
            animation: slideIn 0.3s ease;
            max-width: 400px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        .notification-success { background: #238636; }
        .notification-error { background: #f85149; }
        .notification-info { background: #58a6ff; }
        .notification-warning { background: #f0883e; }
        .notification-close {
            background: none;
            border: none;
            color: white;
            font-size: 20px;
            cursor: pointer;
            padding: 0;
            margin-left: 10px;
        }
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
    `;
    document.head.appendChild(style);
}
