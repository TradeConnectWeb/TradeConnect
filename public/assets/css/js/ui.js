// UI Utility Functions

// Toggle Mobile Menu
function toggleMobileMenu() {
  const nav = document.querySelector('.main-nav');
  nav.classList.toggle('active');
}

// Switch Profile Tab
function switchProfileTab(tabId) {
  document.querySelectorAll('.profile-content').forEach(tab => {
    tab.classList.remove('active');
  });

  document.getElementById(tabId + 'Tab').classList.add('active');

  document.querySelectorAll('.profile-tab').forEach(tab => {
    tab.classList.remove('active');
  });

  document.querySelector(`.profile-tab[data-tab="${tabId}"]`).classList.add('active');
}

// Toggle User Dropdown
function toggleUserDropdown() {
  const dropdown = document.querySelector('.user-dropdown');
  dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
}

// Show Toast Notification
function showToast(message, type = 'info') {
  // Create or find toast container
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  // Create toast element
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <i class="fas ${
      type === 'success' ? 'fa-check-circle' :
      type === 'error' ? 'fa-exclamation-circle' :
      type === 'warning' ? 'fa-exclamation-triangle' :
      'fa-info-circle'
    }"></i>
    <span>${message}</span>
    <span class="toast-close" onclick="this.parentElement.remove()">×</span>
  `;

  // Append and show toast
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('show');
  }, 10);

  // Auto-dismiss after 3s
  setTimeout(() => {
    toast.classList.add('toast-fade-out');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Show Loading Indicator
function showLoading() {
  let loading = document.querySelector('.loading-indicator');
  if (!loading) {
    loading = document.createElement('div');
    loading.className = 'loading-indicator';
    loading.innerHTML = `<div class="spinner"></div><p>Loading...</p>`;
    document.body.appendChild(loading);
  }
}

// Hide Loading Indicator
function hideLoading() {
  const loading = document.querySelector('.loading-indicator');
  if (loading) loading.remove();
}

// Initialize UI Components
function initUI() {
  // Set up user dropdown toggle
  const userProfile = document.querySelector('.user-profile');
  if (userProfile) {
    userProfile.addEventListener('click', toggleUserDropdown);
  }

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.user-profile')) {
      const dropdown = document.querySelector('.user-dropdown');
      if (dropdown) dropdown.style.display = 'none';
    }
  });

  // Set up mobile menu toggle
  const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
  if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', toggleMobileMenu);
  }
}

// Run when page loads
document.addEventListener('DOMContentLoaded', initUI);

// Export functions globally
window.switchProfileTab = switchProfileTab;
window.showToast = showToast;
window.showLoading = showLoading;
window.hideLoading = hideLoading;
window.toggleMobileMenu = toggleMobileMenu;
