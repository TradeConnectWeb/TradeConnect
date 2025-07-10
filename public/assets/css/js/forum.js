import { auth, db } from './firebase.js';

// DOM Elements
const forumPostsContainer = document.getElementById('forumPostsContainer');
const addForumPostForm = document.getElementById('addForumPostForm');
const forumCategoryFilter = document.getElementById('forumCategoryFilter');
const forumSortFilter = document.getElementById('forumSortFilter');
const loadMoreForumBtn = document.getElementById('loadMoreForumBtn');

// Forum State
let lastVisiblePost = null;
let loadingPosts = false;
let currentQuery = null;

// Initialize Forum
function initForum() {
  if (!forumPostsContainer) return;
  
  loadForumPosts();
  
  // Set up event listeners
  if (addForumPostForm) {
    addForumPostForm.addEventListener('submit', handlePostSubmit);
  }
  
  if (loadMoreForumBtn) {
    loadMoreForumBtn.addEventListener('click', loadMoreForumPosts);
  }

  if (forumCategoryFilter) {
    forumCategoryFilter.addEventListener('change', applyForumFilters);
  }

  if (forumSortFilter) {
    forumSortFilter.addEventListener('change', applyForumFilters);
  }
}

// Build Forum Query
function buildForumQuery(startAfter = null) {
  let query = db.collection('forumPosts')
    .where('isPublished', '==', true);

  // Apply category filter if available and not 'all'
  if (forumCategoryFilter && forumCategoryFilter.value !== 'all') {
    query = query.where('category', '==', forumCategoryFilter.value);
  }

  // Determine sort field and direction
  let sortField = 'createdAt';
  let sortDirection = 'desc';

  if (forumSortFilter) {
    sortField = forumSortFilter.value === 'popular' ? 'likes' : 'createdAt';
    sortDirection = forumSortFilter.value === 'oldest' ? 'asc' : 'desc';
  }

  // Apply sorting
  query = query.orderBy(sortField, sortDirection);

  // Apply pagination if needed
  if (startAfter) {
    query = query.startAfter(startAfter);
  }

  // Always limit results
  query = query.limit(10);

  return query;
}

// Load Forum Posts
async function loadForumPosts() {
  if (loadingPosts) return;
  loadingPosts = true;
  
  try {
    currentQuery = buildForumQuery();
    const snapshot = await currentQuery.get();
    
    // Update last visible post for pagination
    lastVisiblePost = snapshot.docs[snapshot.docs.length - 1];
    
    // Clear existing posts
    forumPostsContainer.innerHTML = '';
    
    if (snapshot.empty) {
      forumPostsContainer.innerHTML = '<div class="empty-state">No forum posts found</div>';
      if (loadMoreForumBtn) loadMoreForumBtn.style.display = 'none';
      return;
    }
    
    // Process each post
    const postsPromises = snapshot.docs.map(async (doc) => {
      const post = doc.data();
      const userData = await getUserData(post.userId);
      return createForumPostCard(doc.id, post, userData);
    });

    const posts = await Promise.all(postsPromises);
    posts.forEach(post => forumPostsContainer.appendChild(post));
    
    // Show/hide load more button
    if (loadMoreForumBtn) {
      loadMoreForumBtn.style.display = snapshot.docs.length === 10 ? 'block' : 'none';
    }
  } catch (error) {
    console.error('Error loading forum posts:', error);
    handleFirestoreError(error);
  } finally {
    loadingPosts = false;
  }
}

// Load More Forum Posts
async function loadMoreForumPosts() {
  if (!lastVisiblePost || loadingPosts) return;
  loadingPosts = true;
  
  try {
    currentQuery = buildForumQuery(lastVisiblePost);
    const snapshot = await currentQuery.get();
    
    // Update last visible post
    lastVisiblePost = snapshot.docs[snapshot.docs.length - 1];
    
    if (snapshot.empty) {
      if (loadMoreForumBtn) loadMoreForumBtn.style.display = 'none';
      return;
    }
    
    // Process each post
    const postsPromises = snapshot.docs.map(async (doc) => {
      const post = doc.data();
      const userData = await getUserData(post.userId);
      return createForumPostCard(doc.id, post, userData);
    });

    const posts = await Promise.all(postsPromises);
    posts.forEach(post => forumPostsContainer.appendChild(post));
    
    // Show/hide load more button
    if (loadMoreForumBtn) {
      loadMoreForumBtn.style.display = snapshot.docs.length === 10 ? 'block' : 'none';
    }
  } catch (error) {
    console.error('Error loading more forum posts:', error);
    handleFirestoreError(error);
  } finally {
    loadingPosts = false;
  }
}

// Handle Firestore Errors
function handleFirestoreError(error) {
  let errorMessage = 'Failed to load forum posts';
  
  if (error.code === 'failed-precondition') {
    errorMessage = 'Query requires an index. Please create it in Firebase console.';
    console.error('Index creation link:', error.message.match(/https:\/\/[^\s]+/)[0]);
  } else if (error.code === 'permission-denied') {
    errorMessage = 'You don\'t have permission to access this data';
  }
  
  showToast(errorMessage, 'error');
}

// Create Forum Post Card
function createForumPostCard(id, post, user) {
  const card = document.createElement('div');
  card.className = 'forum-post-card';
  card.dataset.id = id;
  
  // Format date safely
  let postDate = 'Unknown date';
  try {
    postDate = post.createdAt?.toDate()?.toLocaleDateString() || 'Unknown date';
  } catch (e) {
    console.error('Error formatting date:', e);
  }
  
  // Truncate content safely
  let contentPreview = post.content || '';
  if (contentPreview.length > 200) {
    contentPreview = contentPreview.substring(0, 200) + '...';
  }
  
  card.innerHTML = `
    <div class="post-header">
      <img src="${user.photoURL || '/assets/images/placeholder.png'}" alt="${user.displayName || 'User'}" 
           onerror="this.src='/assets/images/placeholder.png'">
      <div class="post-user-info">
        <h4>${user.displayName || 'Anonymous'}</h4>
        <span class="post-date">${postDate}</span>
      </div>
    </div>
    
    <div class="post-content">
      <h3>${post.title || 'No title'}</h3>
      <p>${contentPreview}</p>
    </div>
    
    <div class="post-footer">
      <div class="post-category">
        <span class="badge">${post.category || 'general'}</span>
      </div>
      
      <div class="post-actions">
        <button class="like-btn" onclick="likePost('${id}')">
          <i class="far fa-thumbs-up"></i> ${post.likes || 0}
        </button>
        <button class="comment-btn" onclick="viewPost('${id}')">
          <i class="far fa-comment"></i> ${post.commentCount || 0}
        </button>
      </div>
    </div>
  `;
  
  return card;
}

// Handle Post Submission
async function handlePostSubmit(e) {
  e.preventDefault();
  
  if (!auth.currentUser) {
    showToast('Please login to create forum posts', 'error');
    return;
  }
  
  const formData = new FormData(addForumPostForm);
  const title = formData.get('title');
  const content = formData.get('content');
  const category = formData.get('category');
  
  // Validate form
  if (!title || !content || !category) {
    showToast('Please fill all required fields', 'error');
    return;
  }
  
  if (title.length > 100) {
    showToast('Title must be less than 100 characters', 'error');
    return;
  }
  
  if (content.length > 5000) {
    showToast('Content must be less than 5000 characters', 'error');
    return;
  }
  
  try {
    // Create post in Firestore
    await db.collection('forumPosts').add({
      title,
      content,
      category,
      userId: auth.currentUser.uid,
      isPublished: true,
      likes: 0,
      commentCount: 0,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    // Reset form and close modal
    addForumPostForm.reset();
    closeModal('addForumPostModal');
    showToast('Post created successfully!', 'success');
    
    // Reload posts
    loadForumPosts();
  } catch (error) {
    console.error('Error creating forum post:', error);
    showToast('Failed to create forum post', 'error');
  }
}

// Like Post
async function likePost(postId) {
  if (!auth.currentUser) {
    showToast('Please login to like posts', 'error');
    return;
  }
  
  try {
    // Check if user already liked this post
    const likeDoc = await db.collection('forumPostLikes')
      .where('postId', '==', postId)
      .where('userId', '==', auth.currentUser.uid)
      .get();
    
    if (!likeDoc.empty) {
      showToast('You already liked this post', 'info');
      return;
    }
    
    // Add like
    await db.collection('forumPostLikes').add({
      postId,
      userId: auth.currentUser.uid,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    // Update post like count
    await db.collection('forumPosts').doc(postId).update({
      likes: firebase.firestore.FieldValue.increment(1)
    });
    
    showToast('Post liked!', 'success');
    
    // Refresh the post display
    const postElement = document.querySelector(`.forum-post-card[data-id="${postId}"] .like-btn`);
    if (postElement) {
      const likeCount = parseInt(postElement.textContent.trim()) || 0;
      postElement.innerHTML = `<i class="far fa-thumbs-up"></i> ${likeCount + 1}`;
    }
  } catch (error) {
    console.error('Error liking post:', error);
    showToast('Failed to like post', 'error');
  }
}

// View Post Details
function viewPost(postId) {
  // In a real app, you would show a modal or navigate to a post details page
  console.log('Viewing post:', postId);
  openModal('postDetailsModal');
  
  // You would fetch the post details here and populate the modal
}

// Get User Data
async function getUserData(userId) {
  if (!userId) {
    return {
      displayName: 'Anonymous',
      photoURL: '/assets/images/placeholder.png'
    };
  }

  try {
    const userDoc = await db.collection('users').doc(userId).get();
    if (userDoc.exists) {
      const data = userDoc.data();
      return {
        displayName: data.nickname || data.displayName || 'Anonymous',
        photoURL: data.photoURL || '/assets/images/placeholder.png'
      };
    }
    return {
      displayName: 'Anonymous',
      photoURL: '/assets/images/placeholder.png'
    };
  } catch (error) {
    console.error('Error getting user data:', error);
    return {
      displayName: 'Anonymous',
      photoURL: '/assets/images/placeholder.png'
    };
  }
}

// Apply Forum Filters
function applyForumFilters() {
  loadForumPosts();
}

// Initialize when page loads
if (document.readyState !== 'loading') {
  initForum();
} else {
  document.addEventListener('DOMContentLoaded', initForum);
}

// Make functions available globally
window.likePost = likePost;
window.viewPost = viewPost;
window.applyForumFilters = applyForumFilters;