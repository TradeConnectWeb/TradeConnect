// Global Modal Functions
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.style.display = 'flex';
    document.body.classList.add('modal-open');
    
    // Focus on first input if exists
    const firstInput = modal.querySelector('input, textarea, select');
    if (firstInput) {
      firstInput.focus();
    }
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.style.display = 'none';
    document.body.classList.remove('modal-open');
  }
}

// Close modal when clicking outside content
window.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal')) {
    closeModal(e.target.id);
  }
});

// Close modal with Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const openModal = document.querySelector('.modal[style="display: flex;"]');
    if (openModal) {
      closeModal(openModal.id);
    }
  }
});

// Initialize image upload previews
function initImageUploads() {
  document.querySelectorAll('.image-upload-input').forEach(input => {
    input.addEventListener('change', function(e) {
      const container = this.closest('.image-upload-box');
      const preview = container.querySelector('.image-preview');
      const text = container.querySelector('.image-upload-text');
      
      if (this.files && this.files[0]) {
        const reader = new FileReader();
        
        reader.onload = function(e) {
          preview.src = e.target.result;
          preview.style.display = 'block';
          text.style.display = 'none';
          
          // Add remove button if not exists
          if (!container.querySelector('.remove-image')) {
            const removeBtn = document.createElement('button');
            removeBtn.className = 'remove-image';
            removeBtn.innerHTML = '&times;';
            removeBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              input.value = '';
              preview.style.display = 'none';
              text.style.display = 'flex';
              removeBtn.remove();
            });
            container.appendChild(removeBtn);
          }
        };
        
        reader.readAsDataURL(this.files[0]);
      }
    });
  });
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
  initImageUploads();
  
  // Set up all close buttons
  document.querySelectorAll('.close').forEach(btn => {
    btn.addEventListener('click', () => {
      const modal = btn.closest('.modal');
      if (modal) {
        closeModal(modal.id);
      }
    });
  });
});

// Export functions for global access
window.openModal = openModal;
window.closeModal = closeModal;