import { auth, db, storage } from './firebase.js';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  startAfter,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/9.0.0/firebase-firestore.js";

// DOM Elements
const listingsFeed = document.getElementById('marketplaceListings');
const addPostForm = document.getElementById('addPostForm');
const categoryFilter = document.getElementById('categoryFilter');
const typeFilter = document.getElementById('typeFilter');
const loadMoreBtn = document.getElementById('loadMoreBtn');

// Marketplace State
let lastVisible = null;
let loading = false;
const userDataCache = {};

// Initialize Marketplace
function initMarketplace() {
  if (!auth.currentUser) {
    console.log('User not authenticated, redirecting...');
    return;
  }

  loadListings();

  // Event Listeners
  if (addPostForm) {
    addPostForm.addEventListener('submit', handlePostSubmit);
  }

  if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', loadMoreListings);
  }

  if (categoryFilter) {
    categoryFilter.addEventListener('change', applyFilters);
  }

  if (typeFilter) {
    typeFilter.addEventListener('change', applyFilters);
  }

  const listingTypeToggle = document.getElementById('listingType');
  if (listingTypeToggle) {
    listingTypeToggle.addEventListener('change', () => {
      const priceField = document.getElementById('priceField');
      if (priceField) {
        priceField.style.display = listingTypeToggle.checked ? 'block' : 'none';
      }
    });
  }
}

// Modified Load Listings with proper query
async function loadListings() {
  if (loading) return;
  loading = true;
  
  try {
    showLoadingIndicator(true);
    
    // Base query with proper indexing
    let queryRef = query(
      collection(db, 'marketplaceItems'),
      where('status', '==', 'active'),
      orderBy('createdAt', 'desc'),
      limit(10)
    );

    // Apply filters if they exist and have values
    if (categoryFilter?.value) {
      queryRef = query(queryRef, where('category', '==', categoryFilter.value));
    }

    if (typeFilter?.value) {
      queryRef = query(queryRef, where('type', '==', typeFilter.value));
    }

    const snapshot = await getDocs(queryRef);
    lastVisible = snapshot.docs[snapshot.docs.length - 1];

    if (!loadMoreBtn || loadMoreBtn.style.display === 'none') {
      if (listingsFeed) listingsFeed.innerHTML = '';
    }

    if (snapshot.empty) {
      if (listingsFeed) {
        listingsFeed.innerHTML = '<div class="empty-state">No listings found. Try changing your filters.</div>';
      }
      if (loadMoreBtn) loadMoreBtn.style.display = 'none';
      return;
    }

    const listingElements = await Promise.all(
      snapshot.docs.map(doc => processListing(doc))
    );

    if (listingsFeed) {
      listingElements.forEach(element => {
        if (element) listingsFeed.appendChild(element);
      });
    }

    if (loadMoreBtn) {
      loadMoreBtn.style.display = snapshot.docs.length === 10 ? 'block' : 'none';
    }
  } catch (error) {
    console.error('Error loading listings:', error);
    handleLoadError(error);
  } finally {
    loading = false;
    showLoadingIndicator(false);
  }
}

// Modified Load More Listings
async function loadMoreListings() {
  if (!lastVisible || loading) return;

  try {
    showLoadingIndicator(true);
    if (loadMoreBtn) loadMoreBtn.disabled = true;
    
    let queryRef = query(
      collection(db, 'marketplaceItems'),
      where('status', '==', 'active'),
      orderBy('createdAt', 'desc'),
      startAfter(lastVisible),
      limit(10)
    );

    if (categoryFilter?.value) {
      queryRef = query(queryRef, where('category', '==', categoryFilter.value));
    }

    if (typeFilter?.value) {
      queryRef = query(queryRef, where('type', '==', typeFilter.value));
    }

    const snapshot = await getDocs(queryRef);
    lastVisible = snapshot.docs[snapshot.docs.length - 1];

    if (snapshot.empty) {
      if (loadMoreBtn) loadMoreBtn.style.display = 'none';
      return;
    }

    const listingElements = await Promise.all(
      snapshot.docs.map(doc => processListing(doc))
    );

    if (listingsFeed) {
      listingElements.forEach(element => {
        if (element) listingsFeed.appendChild(element);
      });
    }

    if (loadMoreBtn) {
      loadMoreBtn.style.display = snapshot.docs.length === 10 ? 'block' : 'none';
      loadMoreBtn.disabled = false;
    }
  } catch (error) {
    console.error('Error loading more listings:', error);
    showToast('Failed to load more listings. Please try again.', 'error');
  } finally {
    showLoadingIndicator(false);
  }
}

// [Rest of your existing functions remain the same...]
// (createListingCard, viewListingDetails, handlePostSubmit, validateForm,
//  uploadImages, cleanupFailedUploads, createListing, getUserData, etc.)

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMarketplace);
} else {
  initMarketplace();
}