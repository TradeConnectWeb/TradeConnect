import { auth } from './firebase.js';

// DOM Elements
const loginForm = document.getElementById('loginForm');
const registerForm = document.getElementById('registerForm');
const settingsForm = document.getElementById('settingsForm');

// Auth State Listener
auth.onAuthStateChanged((user) => {
  if (user) {
    // User is signed in
    console.log('User logged in:', user.email);
    updateUIForUser(user);
    
    // Redirect if on auth pages
    if (window.location.pathname === '/login.html' || 
        window.location.pathname === '/register.html') {
      window.location.href = '/index.html';
    }
  } else {
    // User is signed out
    console.log('User signed out');
    updateUIForGuest();
    
    // Redirect to login if on protected pages
    const protectedPages = ['/profile.html', '/messages.html'];
    if (protectedPages.includes(window.location.pathname)) {
      window.location.href = '/login.html';
    }
  }
});

// Login Function
async function login(email, password) {
  try {
    const userCredential = await auth.signInWithEmailAndPassword(email, password);
    return userCredential.user;
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
}

// Register Function
async function register(email, password, displayName) {
  try {
    const userCredential = await auth.createUserWithEmailAndPassword(email, password);
    await userCredential.user.updateProfile({
      displayName: displayName
    });
    return userCredential.user;
  } catch (error) {
    console.error('Registration error:', error);
    throw error;
  }
}

// Logout Function
async function logout() {
  try {
    await auth.signOut();
    window.location.href = '/login.html';
  } catch (error) {
    console.error('Logout error:', error);
  }
}

// Update UI based on auth state
function updateUIForUser(user) {
  // Update user info in header
  const userNameElements = document.querySelectorAll('#userName, #profileName');
  const userAvatarElements = document.querySelectorAll('#userAvatar, #profileAvatar');
  
  userNameElements.forEach(el => {
    if (el) el.textContent = user.displayName || 'User';
  });
  
  userAvatarElements.forEach(el => {
    if (el) el.src = user.photoURL || '/assets/images/placeholder.png';
  });
  
  // Show/hide auth buttons
  const authButtons = document.querySelectorAll('.auth-btn');
  authButtons.forEach(btn => {
    btn.style.display = 'none';
  });
  
  const profileButtons = document.querySelectorAll('.profile-btn');
  profileButtons.forEach(btn => {
    btn.style.display = 'block';
  });
}

function updateUIForGuest() {
  // Show/hide auth buttons
  const authButtons = document.querySelectorAll('.auth-btn');
  authButtons.forEach(btn => {
    btn.style.display = 'block';
  });
  
  const profileButtons = document.querySelectorAll('.profile-btn');
  profileButtons.forEach(btn => {
    btn.style.display = 'none';
  });
}

// Event Listeners
if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    try {
      await login(email, password);
      showToast('Login successful!', 'success');
    } catch (error) {
      showToast(error.message, 'error');
    }
  });
}

if (registerForm) {
  registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const displayName = document.getElementById('registerName').value;
    
    try {
      await register(email, password, displayName);
      showToast('Registration successful!', 'success');
    } catch (error) {
      showToast(error.message, 'error');
    }
  });
}

if (settingsForm) {
  settingsForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const displayName = document.getElementById('settingsName').value;
    
    try {
      await auth.currentUser.updateProfile({
        displayName: displayName
      });
      showToast('Profile updated!', 'success');
    } catch (error) {
      showToast(error.message, 'error');
    }
  });
}

// Helper function to show toast messages
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.add('show');
    setTimeout(() => {
      toast.remove();
    }, 3000);
  }, 10);
}