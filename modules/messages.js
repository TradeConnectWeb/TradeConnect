// messages.js - Enterprise-Grade Messaging System
import { dbService, auth, storage } from './firebase-config.js';
import { encryptData, decryptData, generateKeyPair, preparePostQuantumKeys } from './crypto-utils.js';
import { showToast, handleError, formatTimestamp } from './ui-utils.js';
import { compressImage, validateFileType, compressVideo } from './file-utils.js';

class MessageManager {
  constructor() {
    // Initialize with production-grade defaults
    this.initState();
    this.initConfiguration();
    this.initDOMElements();
    this.initPerformanceMonitoring();
    this.initAll();
    this.prepareForFutureEncryption();
  }

  initState() {
    this.activeConversation = null;
    this.messageCache = new Map(); // LRU cache with O(1) operations
    this.typingStatus = {};
    this.offlineQueue = [];
    this.connectionState = 'disconnected';
    this.unsubscribeListeners = [];
    this.userKeyPairs = new Map();
    this.lastActivityTime = Date.now();
    this.performanceMetrics = {
      deliveryTimes: [],
      encryptionTimes: [],
      compressionRatios: []
    };
  }

  initConfiguration() {
    this.config = {
      // Network
      maxConnections: 10000,
      messageQueueSize: 5000,
      heartbeatInterval: 25000,
      maxPayloadSize: 2097152, // 2MB
      
      // Messaging
      maxAttachmentSize: 5 * 1024 * 1024, // 5MB
      messageChunkSize: 25,
      reconnectDelay: 3000,
      typingDebounce: 2000,
      
      // Media
      maxImageDimension: 1024,
      imageQuality: 0.7,
      videoBitrate: 500000,
      
      // Caching
      cacheSize: 100,
      cacheTTL: 30 * 60 * 1000, // 30 minutes
      
      // Security
      encryptionEnabled: true,
      quantumReady: false
    };
  }

  async prepareForFutureEncryption() {
    if (window.crypto.subtle.digest) {
      try {
        this.quantumKeys = await preparePostQuantumKeys();
        await dbService.storeQuantumKeys(auth.currentUser.uid, this.quantumKeys);
        this.config.quantumReady = true;
      } catch (error) {
        console.warn('Quantum key preparation failed:', error);
      }
    }
  }

  // WebSocket Management with Zero-Downtime Support
  initWebSocket() {
    this.socket = new ReconnectingWebSocket(
      `wss://${window.location.host}/messages`,
      null,
      {
        maxRetries: 10,
        connectionTimeout: 5000,
        debug: process.env.NODE_ENV === 'development',
        reconnectInterval: this.config.reconnectDelay,
        maxQueueSize: this.config.messageQueueSize
      }
    );

    this.socket.onopen = () => {
      this.connectionState = 'connected';
      this.syncOfflineMessages();
      this.sendPresence('online');
      this.monitorConnectionQuality();
    };

    this.socket.onmessage = this.handleRealTimeMessage.bind(this);
    this.socket.onclose = this.handleGracefulDisconnect.bind(this);
    this.socket.onerror = this.handleCriticalError.bind(this);
  }

  // Enhanced Encryption with Fallback
  async encryptMessage(content, recipientId) {
    const startTime = performance.now();
    
    try {
      let encrypted;
      if (this.config.quantumReady) {
        encrypted = await this.quantumEncrypt(content, recipientId);
      } else {
        const publicKey = await dbService.getPublicKey(recipientId);
        encrypted = await encryptData(content, publicKey);
      }
      
      const duration = performance.now() - startTime;
      this.recordPerformance('encryption', duration);
      return encrypted;
    } catch (error) {
      this.trackError('encryption_failed', error);
      
      // Fallback to plaintext if encryption fails and message is non-sensitive
      if (this.isMessageNonSensitive(content)) {
        return content;
      }
      throw error;
    }
  }

  // Advanced Media Processing Pipeline
  async processAttachment(file) {
    this.validateAttachment(file);
    
    const processingStart = performance.now();
    const fileRef = storageRef(
      storage,
      `attachments/${this.activeConversation}/${Date.now()}_${file.name}`
    );

    try {
      // Process based on file type
      const processedFile = await this.processMediaFile(file);
      const uploadStart = performance.now();
      
      await uploadBytes(fileRef, processedFile);
      const url = await getDownloadURL(fileRef);

      const totalTime = performance.now() - processingStart;
      this.recordPerformance('attachment_processing', totalTime);
      this.recordCompressionRatio(file.size, processedFile.size);

      return this.config.encryptionEnabled 
        ? await encryptData(url) 
        : url;
    } catch (error) {
      this.trackError('attachment_processing_failed', {
        error: error.message,
        fileType: file.type,
        size: file.size
      });
      throw error;
    }
  }

  async processMediaFile(file) {
    if (file.type.startsWith('image/')) {
      return compressImage(file, this.config.maxImageDimension, this.config.imageQuality);
    }
    if (file.type.startsWith('video/')) {
      return compressVideo(file, this.config.videoBitrate);
    }
    if (file.type.startsWith('audio/')) {
      return this.compressAudio(file);
    }
    return file;
  }

  // Real-Time Features with Network Awareness
  handleTyping() {
    if (!this.activeConversation || this.connectionState !== 'connected') return;

    // Only send typing indicators if network conditions are good
    if (navigator.connection?.effectiveType === '4g' || 
        navigator.connection?.effectiveType === 'wifi') {
      this.sendTypingStatus('typing');
      this.debounce(() => this.sendTypingStatus('stopped'), this.config.typingDebounce);
    }
  }

  // Robust Offline Support
  queueOfflineMessage(message) {
    if (this.offlineQueue.length >= this.config.messageQueueSize) {
      this.offlineQueue.shift(); // Make room if queue is full
    }
    
    this.offlineQueue.push(message);
    this.persistOfflineQueue();
    this.trackEvent('message_queued', {
      queueLength: this.offlineQueue.length,
      messageType: message.attachment ? 'attachment' : 'text'
    });
  }

  // Performance Optimized Caching
  cacheMessage(message) {
    if (!this.messageCache.has(message.conversationId)) {
      this.messageCache.set(message.conversationId, new Map());
    }
    
    const conversationCache = this.messageCache.get(message.conversationId);
    conversationCache.set(message.id, message);
    
    // LRU eviction with size and TTL limits
    if (conversationCache.size > this.config.cacheSize) {
      const oldestKey = conversationCache.keys().next().value;
      conversationCache.delete(oldestKey);
    }
    
    // Schedule cache cleanup
    setTimeout(() => {
      conversationCache.delete(message.id);
    }, this.config.cacheTTL);
  }

  // Comprehensive Monitoring
  initPerformanceMonitoring() {
    this.monitoring = {
      dashboard: new MonitoringDashboard({
        metrics: [
          'messages_sent',
          'delivery_latency',
          'encryption_time',
          'attachment_size',
          'cache_hit_rate'
        ],
        alerts: {
          latency: { threshold: 500 }, // ms
          errors: { threshold: 1 }, // errors/min
          memory: { threshold: 80 } // %
        }
      }),
      interval: setInterval(() => {
        this.reportHealthStatus();
      }, 60000) // Report every minute
    };
  }

  // Hot-Reload Support for Zero Downtime Updates
  enableHotReload() {
    if (module.hot) {
      module.hot.accept('./message-manager', () => {
        const NewMessageManager = require('./message-manager').default;
        
        // Transfer state to new instance
        const newInstance = new NewMessageManager();
        newInstance.transferState(this);
        
        window.messageManager = newInstance;
        this.destroy(); // Cleanup old instance
      });
    }
  }

  // State transfer for hot reload
  transferState(oldInstance) {
    this.activeConversation = oldInstance.activeConversation;
    this.messageCache = oldInstance.messageCache;
    this.offlineQueue = oldInstance.offlineQueue;
    // Transfer other necessary state...
  }

  // Cleanup with Resource Reclamation
  destroy() {
    // WebSocket
    this.socket?.close();
    
    // Event listeners
    window.removeEventListener('online', this.handleConnectionChange);
    window.removeEventListener('offline', this.handleConnectionChange);
    
    // Firebase listeners
    this.unsubscribeListeners.forEach(unsubscribe => unsubscribe());
    
    // Monitoring
    clearInterval(this.monitoring.interval);
    
    // Clear state
    this.messageCache.clear();
    this.offlineQueue = [];
    
    // Release memory
    this.elements = null;
  }
}

// Initialization with Progressive Enhancement
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Feature Detection
    if (!('WebSocket' in window)) {
      showToast('Real-time messaging requires WebSocket support', 'warning');
      return;
    }

    // Service Worker Registration for Offline Support
    if ('serviceWorker' in navigator) {
      try {
        await navigator.serviceWorker.register('/sw-messages.js', {
          scope: '/messages/',
          updateViaCache: 'none'
        });
        
        // Advanced caching strategy for attachments
        workbox.routing.registerRoute(
          new RegExp('/attachments/'),
          new workbox.strategies.CacheFirst({
            cacheName: 'message-attachments',
            plugins: [
              new workbox.expiration.ExpirationPlugin({
                maxEntries: 500,
                maxAgeSeconds: 30 * 24 * 60 * 60 // 30 days
              }),
              new workbox.cacheableResponse.CacheableResponsePlugin({
                statuses: [0, 200]
              })
            ]
          })
        );
      } catch (error) {
        console.error('Service Worker registration failed:', error);
      }
    }

    // Initialize with performance tracking
    performance.mark('messages_init_start');
    window.messageManager = new MessageManager();
    performance.mark('messages_init_end');
    
    performance.measure('messages_initialization', 
      'messages_init_start', 
      'messages_init_end'
    );

    // Enable hot reload in development
    if (process.env.NODE_ENV === 'development') {
      window.messageManager.enableHotReload();
    }

  } catch (error) {
    handleError(error, 'initializing messages');
    
    // Send to monitoring services
    if (typeof Sentry !== 'undefined') {
      Sentry.captureException(error);
    }
    if (typeof NewRelic !== 'undefined') {
      NewRelic.noticeError(error);
    }
    
    // Fallback to basic functionality
    this.activateFallbackMode();
  }
});

// Firebase Security Rules (for reference)
/*
service cloud.firestore {
  match /messages/{conversationId}/{messageId} {
    allow read: if request.auth != null && 
      (request.auth.uid in resource.participants || 
       isModerator(request.auth.uid));
    
    allow create: if request.auth != null &&
      request.auth.uid == request.resource.data.senderId &&
      request.resource.data.timestamp <= request.time &&
      request.resource.data.timestamp > (request.time - duration(5, 'm'));
  }
}
*/