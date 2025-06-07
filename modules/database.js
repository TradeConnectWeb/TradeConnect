// js/modules/database.js - Ultimate Database Service Module

import { 
  db, 
  realtimeDb,
  logEvent,
  showToast,
  analytics
} from '../main.js';
import { 
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
  writeBatch,
  serverTimestamp,
  onSnapshot,
  arrayUnion,
  arrayRemove
} from "firebase/firestore";
import { 
  ref as dbRef,
  get as dbGet,
  set as dbSet,
  update as dbUpdate,
  remove as dbRemove,
  onValue,
  off,
  query as rtdbQuery,
  orderByChild,
  equalTo,
  limitToLast
} from "firebase/database";

// Error types
const DB_ERRORS = {
  NOT_FOUND: 'document-not-found',
  PERMISSION_DENIED: 'permission-denied',
  INVALID_DATA: 'invalid-data',
  CONNECTION_ERROR: 'connection-error'
};

// Collection names
const COLLECTIONS = {
  USERS: 'users',
  POSTS: 'posts',
  MESSAGES: 'messages',
  TRANSACTIONS: 'transactions',
  SETTINGS: 'settings'
};

// Cache configuration
const CACHE_CONFIG = {
  USER_PROFILE_TTL: 5 * 60 * 1000, // 5 minutes
  POSTS_TTL: 2 * 60 * 1000 // 2 minutes
};

export const dbService = {
  // ======================
  // Firestore Operations
  // ======================
  
  /**
   * Get document with optional caching
   * @param {string} collectionName 
   * @param {string} docId 
   * @param {boolean} useCache
   * @returns {Promise<DocumentSnapshot>}
   */
  async getDocument(collectionName, docId, useCache = true) {
    try {
      // Check cache first if enabled
      if (useCache) {
        const cached = this._getFromCache(collectionName, docId);
        if (cached) return cached;
      }

      const docRef = doc(db, collectionName, docId);
      const snapshot = await getDoc(docRef);
      
      if (!snapshot.exists()) {
        throw new Error(DB_ERRORS.NOT_FOUND);
      }
      
      const data = snapshot.data();
      
      // Update cache
      if (useCache) {
        this._setCache(collectionName, docId, data);
      }
      
      return data;
    } catch (error) {
      console.error('Get document error:', error);
      showToast('Failed to load data', 'error');
      throw error;
    }
  },

  /**
   * Set document with merge and cache options
   * @param {string} collectionName 
   * @param {string} docId 
   * @param {object} data 
   * @param {boolean} merge 
   * @param {boolean} updateCache
   */
  async setDocument(collectionName, docId, data, merge = true, updateCache = true) {
    try {
      const docRef = doc(db, collectionName, docId);
      const docData = {
        ...data,
        updatedAt: serverTimestamp()
      };
      
      await setDoc(docRef, docData, { merge });
      
      // Update cache if enabled
      if (updateCache) {
        this._setCache(collectionName, docId, docData);
      }
      
      logEvent('firestore_write', { collection: collectionName });
      
      // Analytics tracking for important collections
      if (collectionName === COLLECTIONS.POSTS) {
        analytics?.logEvent('post_created', { postId: docId });
      }
    } catch (error) {
      console.error('Set document error:', error);
      showToast('Failed to save data', 'error');
      throw error;
    }
  },

  /**
   * Update specific document fields with cache support
   * @param {string} collectionName 
   * @param {string} docId 
   * @param {object} updates 
   * @param {boolean} updateCache
   */
  async updateDocument(collectionName, docId, updates, updateCache = true) {
    try {
      const docRef = doc(db, collectionName, docId);
      const updateData = {
        ...updates,
        updatedAt: serverTimestamp()
      };
      
      await updateDoc(docRef, updateData);
      
      // Update cache if enabled
      if (updateCache) {
        const current = this._getFromCache(collectionName, docId) || {};
        this._setCache(collectionName, docId, { ...current, ...updateData });
      }
    } catch (error) {
      console.error('Update document error:', error);
      throw error;
    }
  },

  /**
   * Delete document and clear cache
   * @param {string} collectionName 
   * @param {string} docId 
   */
  async deleteDocument(collectionName, docId) {
    try {
      const docRef = doc(db, collectionName, docId);
      await deleteDoc(docRef);
      
      // Clear from cache
      this._clearCache(collectionName, docId);
      
      logEvent('firestore_delete', { collection: collectionName });
    } catch (error) {
      console.error('Delete document error:', error);
      throw error;
    }
  },

  /**
   * Advanced query with pagination support
   * @param {string} collectionName 
   * @param {Array} queryConditions 
   * @param {number} resultLimit 
   * @param {DocumentSnapshot} lastDoc 
   * @returns {Promise<{results: Array, lastDoc: DocumentSnapshot}>}
   */
  async queryDocuments(collectionName, queryConditions = [], resultLimit = 20, lastDoc = null) {
    try {
      const collectionRef = collection(db, collectionName);
      let q = query(collectionRef);
      
      // Apply conditions
      queryConditions.forEach(condition => {
        q = query(q, where(...condition));
      });
      
      // Apply ordering
      q = query(q, orderBy('createdAt', 'desc'));
      
      // Apply pagination if last document provided
      if (lastDoc) {
        q = query(q, startAfter(lastDoc));
      }
      
      // Apply limit
      q = query(q, limit(resultLimit));
      
      const snapshot = await getDocs(q);
      const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      return {
        results,
        lastDoc: snapshot.docs[snapshot.docs.length - 1] || null
      };
    } catch (error) {
      console.error('Query error:', error);
      throw error;
    }
  },

  /**
   * Atomic batch write operation
   * @param {Array} operations 
   */
  async batchWrite(operations) {
    try {
      const batch = writeBatch(db);
      
      operations.forEach(op => {
        const docRef = doc(db, op.collection, op.id);
        if (op.type === 'set') {
          batch.set(docRef, {
            ...op.data,
            updatedAt: serverTimestamp()
          }, op.options);
        } else if (op.type === 'update') {
          batch.update(docRef, {
            ...op.data,
            updatedAt: serverTimestamp()
          });
        } else if (op.type === 'delete') {
          batch.delete(docRef);
        }
      });
      
      await batch.commit();
      logEvent('firestore_batch_write', { operations: operations.length });
    } catch (error) {
      console.error('Batch write error:', error);
      throw error;
    }
  },

  /**
   * Add item to array field
   * @param {string} collectionName 
   * @param {string} docId 
   * @param {string} field 
   * @param {any} item 
   */
  async addToArray(collectionName, docId, field, item) {
    try {
      const docRef = doc(db, collectionName, docId);
      await updateDoc(docRef, {
        [field]: arrayUnion(item),
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Array update error:', error);
      throw error;
    }
  },

  /**
   * Remove item from array field
   * @param {string} collectionName 
   * @param {string} docId 
   * @param {string} field 
   * @param {any} item 
   */
  async removeFromArray(collectionName, docId, field, item) {
    try {
      const docRef = doc(db, collectionName, docId);
      await updateDoc(docRef, {
        [field]: arrayRemove(item),
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error('Array update error:', error);
      throw error;
    }
  },

  // ======================
  // Realtime DB Operations
  // ======================

  /**
   * Get data from Realtime DB with optional query
   * @param {string} path 
   * @param {object} queryOptions
   * @returns {Promise<any>}
   */
  async getRealtimeData(path, queryOptions = null) {
    try {
      let reference = dbRef(realtimeDb, path);
      
      if (queryOptions) {
        let q = rtdbQuery(reference);
        
        if (queryOptions.orderBy) {
          q = rtdbQuery(q, orderByChild(queryOptions.orderBy));
        }
        
        if (queryOptions.equalTo) {
          q = rtdbQuery(q, equalTo(queryOptions.equalTo));
        }
        
        if (queryOptions.limit) {
          q = rtdbQuery(q, limitToLast(queryOptions.limit));
        }
        
        reference = q;
      }
      
      const snapshot = await dbGet(reference);
      return snapshot.val();
    } catch (error) {
      console.error('Realtime DB read error:', error);
      throw error;
    }
  },

  /**
   * Set data in Realtime DB with optional merge
   * @param {string} path 
   * @param {any} data 
   * @param {boolean} merge 
   */
  async setRealtimeData(path, data, merge = false) {
    try {
      await dbSet(dbRef(realtimeDb, path), data);
      logEvent('realtime_db_write', { path });
    } catch (error) {
      console.error('Realtime DB write error:', error);
      throw error;
    }
  },

  /**
   * Update multiple paths in Realtime DB atomically
   * @param {object} updates 
   */
  async updateRealtimePaths(updates) {
    try {
      await dbUpdate(dbRef(realtimeDb), updates);
    } catch (error) {
      console.error('Realtime DB multi-path update error:', error);
      throw error;
    }
  },

  /**
   * Delete data from Realtime DB
   * @param {string} path 
   */
  async deleteRealtimeData(path) {
    try {
      await dbRemove(dbRef(realtimeDb, path));
      logEvent('realtime_db_delete', { path });
    } catch (error) {
      console.error('Realtime DB delete error:', error);
      throw error;
    }
  },

  // ======================
  // Realtime Listeners
  // ======================

  /**
   * Subscribe to Firestore document changes with error handling
   * @param {string} collectionName 
   * @param {string} docId 
   * @param {function} callback 
   * @param {function} errorCallback
   * @returns {function} Unsubscribe function
   */
  subscribeToDocument(collectionName, docId, callback, errorCallback = null) {
    const docRef = doc(db, collectionName, docId);
    return onSnapshot(docRef, 
      (snapshot) => {
        callback({
          id: snapshot.id,
          ...snapshot.data()
        });
      },
      (error) => {
        console.error('Document subscription error:', error);
        if (errorCallback) errorCallback(error);
      }
    );
  },

  /**
   * Subscribe to Firestore collection changes
   * @param {string} collectionName 
   * @param {Array} queryConditions 
   * @param {function} callback 
   * @returns {function} Unsubscribe function
   */
  subscribeToCollection(collectionName, queryConditions, callback) {
    const collectionRef = collection(db, collectionName);
    let q = query(collectionRef);
    
    queryConditions.forEach(condition => {
      q = query(q, where(...condition));
    });
    
    return onSnapshot(q, (snapshot) => {
      callback(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
  },

  /**
   * Subscribe to Realtime DB path with error handling
   * @param {string} path 
   * @param {function} callback 
   * @param {function} errorCallback
   * @returns {function} Unsubscribe function
   */
  subscribeToRealtimeData(path, callback, errorCallback = null) {
    const reference = dbRef(realtimeDb, path);
    const onData = (snapshot) => {
      callback(snapshot.val());
    };
    const onError = (error) => {
      console.error('Realtime subscription error:', error);
      if (errorCallback) errorCallback(error);
    };
    
    onValue(reference, onData, onError);
    
    return () => off(reference, 'value', onData);
  },

  // ======================
  // Specialized Methods
  // ======================

  /**
   * Get user data with intelligent caching
   * @param {string} uid 
   * @returns {Promise<object>}
   */
  async getUserData(uid) {
    try {
      // Check cache first
      const cached = this._getFromCache(COLLECTIONS.USERS, uid);
      if (cached) return cached;

      const userDoc = await this.getDocument(COLLECTIONS.USERS, uid, false);
      
      // Update cache with TTL
      this._setCache(COLLECTIONS.USERS, uid, userDoc, CACHE_CONFIG.USER_PROFILE_TTL);
      
      logEvent('user_data_fetched', { uid });
      return userDoc;
    } catch (error) {
      if (error.message === DB_ERRORS.NOT_FOUND) {
        // Create minimal user profile if not exists
        await this.setDocument(COLLECTIONS.USERS, uid, {
          createdAt: serverTimestamp(),
          lastUpdated: serverTimestamp()
        }, false);
        return {};
      }
      throw error;
    }
  },

  /**
   * Update user profile data with cache invalidation
   * @param {string} uid 
   * @param {object} data 
   */
  async updateUserData(uid, data) {
    try {
      await this.updateDocument(COLLECTIONS.USERS, uid, {
        ...data,
        lastUpdated: serverTimestamp()
      });
      
      // Clear cache to force fresh load
      this._clearCache(COLLECTIONS.USERS, uid);
      
      logEvent('user_data_updated', { uid });
    } catch (error) {
      console.error('Update user error:', error);
      throw error;
    }
  },

  /**
   * Search posts by keyword with caching
   * @param {string} keyword 
   * @param {number} limit 
   * @returns {Promise<Array>}
   */
  async searchPosts(keyword, limit = 10) {
    try {
      const cacheKey = `posts_search_${keyword}`;
      const cached = this._getFromCache(COLLECTIONS.POSTS, cacheKey);
      if (cached) return cached;

      // Requires Firestore index
      const results = await this.queryDocuments(COLLECTIONS.POSTS, [
        ['keywords', 'array-contains', keyword.toLowerCase()],
        ['status', '==', 'published']
      ], limit);
      
      // Cache search results
      this._setCache(COLLECTIONS.POSTS, cacheKey, results, CACHE_CONFIG.POSTS_TTL);
      
      return results;
    } catch (error) {
      console.error('Search error:', error);
      throw error;
    }
  },

  /**
   * Get paginated posts with caching
   * @param {number} limit 
   * @param {DocumentSnapshot} lastDoc 
   * @returns {Promise<{posts: Array, lastDoc: DocumentSnapshot}>}
   */
  async getPaginatedPosts(limit = 10, lastDoc = null) {
    try {
      const cacheKey = `posts_page_${lastDoc?.id || 'first'}`;
      const cached = this._getFromCache(COLLECTIONS.POSTS, cacheKey);
      if (cached) return cached;

      const result = await this.queryDocuments(
        COLLECTIONS.POSTS,
        [['status', '==', 'published']],
        limit,
        lastDoc
      );
      
      // Cache paginated results
      this._setCache(COLLECTIONS.POSTS, cacheKey, result, CACHE_CONFIG.POSTS_TTL);
      
      return result;
    } catch (error) {
      console.error('Get posts error:', error);
      throw error;
    }
  },

  /**
   * Get app settings with fallback
   * @returns {Promise<object>}
   */
  async getAppSettings() {
    try {
      return await this.getDocument(COLLECTIONS.SETTINGS, 'global');
    } catch (error) {
      if (error.message === DB_ERRORS.NOT_FOUND) {
        // Return default settings if none exist
        return {
          maintenanceMode: false,
          featureFlags: {}
        };
      }
      throw error;
    }
  },

  // ======================
  // Cache Management
  // ======================

  _cache: new Map(),

  _getFromCache(collectionName, docId) {
    const key = `${collectionName}/${docId}`;
    const entry = this._cache.get(key);
    
    if (entry && entry.expires > Date.now()) {
      return entry.data;
    }
    
    if (entry) {
      this._cache.delete(key);
    }
    
    return null;
  },

  _setCache(collectionName, docId, data, ttl = null) {
    const key = `${collectionName}/${docId}`;
    this._cache.set(key, {
      data,
      expires: Date.now() + (ttl || CACHE_CONFIG.USER_PROFILE_TTL)
    });
  },

  _clearCache(collectionName, docId) {
    const key = `${collectionName}/${docId}`;
    this._cache.delete(key);
  },

  // ======================
  // Connection Monitoring
  // ======================

  /**
   * Check database connection status
   * @returns {Promise<boolean>}
   */
  async checkConnection() {
    try {
      // Simple read to test connection
      await dbGet(dbRef(realtimeDb, '.info/connected'));
      return true;
    } catch (error) {
      console.error('Connection check failed:', error);
      return false;
    }
  }
};

// Initialize realtime connection monitoring
const connectionRef = dbRef(realtimeDb, '.info/connected');
onValue(connectionRef, (snap) => {
  const isConnected = snap.val() === true;
  
  if (isConnected) {
    console.log('Realtime DB connected');
    logEvent('database_connected');
  } else {
    console.warn('Realtime DB disconnected');
    logEvent('database_disconnected');
    showToast('Connection lost. Working offline...', 'warning');
  }
});