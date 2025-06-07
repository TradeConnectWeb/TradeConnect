                                                                                                                                                                  // forum.js - Production-Ready Forum Manager
import { dbService, auth } from './firebase-config.js';
import { showToast, escapeHtml, formatDate, handleError } from './ui-utils.js';
import { ImageUploader } from './image-uploader.js';

class ForumManager {
  constructor() {
    // Initialize state and configuration
    this.initState();
    this.initConfiguration();
    
    // Setup DOM references and performance tracking
    this.initDOMElements();
    this.setupPerformanceTracking();
    
    // Initialize all functionality
    this.initAll();
  }

  initState() {
    this.currentFilter = 'all';
    this.lastVisiblePost = null;
    this.isLoading = false;
    this.hasMorePosts = true;
    this.lastPostTime = 0;
    this.postRateLimit = 30000;
    this.sessionId = this.generateSessionId();
    this.loadTimes = [];
    this.postRenderTimes = [];
    this.trackingConsent = localStorage.getItem('tracking_consent') === 'true';
  }

  initConfiguration() {
    this.postTypeEmojis = {
      review: '✅',
      scam: '⚠️',
      question: '💬',
      buy: '🔎'
    };
    this.imageUploadConfig = {
      maxSize: 2 * 1024 * 1024,
      allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
      webpConversion: true,
      quality: 0.8
    };
  }

  initDOMElements() {
    this.postsContainer = document.getElementById('forumPostsContainer');
    this.filterElement = document.getElementById('postTypeFilter');
    this.formElement = document.getElementById('forumPostForm');
    this.fallbackElement = document.getElementById('forum-fallback');
  }

  initAll() {
    this.bindEventHandlers();
    this.initEventListeners();
    this.setupIntersectionObserver();
    this.initImageUploader();
    this.checkLowEndDevice();
  }

  // [Previous methods remain the same but with these key additions/changes:]

  initImageUploader() {
    this.imageUploader = new ImageUploader({
      container: '#forumImageUpload',
      ...this.imageUploadConfig,
      onUploadStart: () => this.toggleFormLoading(true),
      onUploadComplete: (url) => this.handleImageUploadComplete(url),
      onError: (error) => handleError(error, 'image upload')
    });
  }

  checkLowEndDevice() {
    const isLowEnd = navigator.deviceMemory < 2 || 
                   (navigator.connection?.saveData === true);
    if (isLowEnd) {
      this.limitPostsToLoad = 5;
      this.disableAnimations();
    }
  }

  disableAnimations() {
    document.documentElement.style.setProperty('--animation-duration', '0ms');
  }

  trackEvent(eventName, params = {}) {
    if (!this.trackingConsent && eventName !== 'essential') return;
    
    // [Rest of the existing trackEvent implementation]
  }

  async checkContentSafety(content) {
    if (process.env.NODE_ENV === 'development') return true;
    
    try {
      const response = await fetch('/api/moderation', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify({ 
          text: content,
          lang: navigator.language || 'en-US'
        }),
        signal: AbortSignal.timeout(3000)
      });
      
      if (!response.ok) throw new Error('Moderation service unavailable');
      return await response.json();
    } catch (error) {
      console.error('Moderation check failed:', error);
      return true; // Fail open
    }
  }

  getDeviceInfo() {
    return {
      memory: navigator.deviceMemory || 'unknown',
      cores: navigator.hardwareConcurrency || 'unknown',
      connection: navigator.connection?.effectiveType || 'unknown',
      isLowEndDevice: navigator.deviceMemory < 2 || 
                     (navigator.connection?.saveData === true)
    };
  }

  destroy() {
    // [Previous cleanup code]
    
    // Additional cleanup
    if (this.fallbackElement) {
      this.fallbackElement.style.display = 'none';
    }
  }
}

// Service Worker Registration
const registerServiceWorker = async () => {
  if ('serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register('/forum-sw.js', {
        scope: '/forum/'
      });
      console.log('Service Worker registered for forum scope');
      
      // Check for update
      const registration = await navigator.serviceWorker.ready;
      registration.update();
    } catch (error) {
      console.error('Service Worker registration failed:', error);
    }
  }
};

// Progressive Enhancement Check
const checkProgressiveEnhancement = () => {
  const noScriptElement = document.querySelector('.no-js-warning');
  if (noScriptElement) {
    noScriptElement.style.display = 'block';
  }
};

// Main Initialization
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Check for required elements
    if (!document.getElementById('forumPostsContainer') && 
        !document.getElementById('forumPostForm')) {
      console.warn('Forum elements not found in DOM');
      checkProgressiveEnhancement();
      return;
    }

    // Register Service Worker
    await registerServiceWorker();

    // Clean up any existing instance
    window.forumManager?.destroy();
    
    // Initialize new instance
    window.forumManager = new ForumManager();
    performance.mark('forum_initialized');
    forumManager.loadForumPosts();
    
  } catch (error) {
    console.error('Forum initialization failed:', error);
    handleError(error, 'initializing forum');
    
    // Track error if monitoring service available
    if (window.trackJs) {
      trackJs.track(error);
    }
    
    // Show fallback content
    const fallback = document.getElementById('forum-fallback');
    if (fallback) fallback.style.display = 'block';
    
    checkProgressiveEnhancement();
  }
});

// Service Worker Implementation (forum-sw.js)
const CACHE_VERSION = 'v2';
const CACHE_NAME = `forum-cache-${CACHE_VERSION}`;
const OFFLINE_URL = '/offline-forum.html';
const PRECACHE_URLS = [
  OFFLINE_URL,
  '/styles/forum.css',
  '/scripts/ui-utils.js',
  '/images/forum-fallback.jpg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .catch(() => caches.match(OFFLINE_URL))
    );
  } else if (PRECACHE_URLS.includes(event.request.url)) {
    event.respondWith(caches.match(event.request));
  }
});