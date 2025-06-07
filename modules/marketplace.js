// config.js - Environment and error configuration
export const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID || import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID || import.meta.env.VITE_FIREBASE_APP_ID
};

export const ERROR_CODES = {
  LOCATION_FAILED: 1001,
  AUTH_REQUIRED: 1002,
  INVALID_INPUT: 1003,
  DB_ERROR: 1004,
  NETWORK_ERROR: 1005,
  STORAGE_ERROR: 1006
};

// strings.js - Localization
export const strings = {
  en: {
    noListings: "No listings found in your area",
    contactSeller: "Contact Seller",
    missingFields: "Missing required fields",
    postSuccess: "Listing created successfully!",
    postError: "Failed to create post",
    locationConfirm: "Please confirm you're in Barangay Bulihan, Silang, Cavite to access this marketplace.",
    offlineWarning: "You're offline. Changes will sync when you reconnect",
    onlineInfo: "Reconnected. Syncing data...",
    invalidCategory: "Invalid category selected",
    invalidPrice: "Price must be a valid number",
    invalidContact: "Valid contact information required"
  },
  tl: {
    noListings: "Walang listings sa inyong lugar",
    contactSeller: "Kontakin ang Nagbebenta",
    missingFields: "Kulang sa mga kinakailangang impormasyon",
    postSuccess: "Matagumpay na naipaskil!",
    postError: "Hindi naipaskil",
    locationConfirm: "Mangyaring kumpirmahin na nasa Barangay Bulihan, Silang, Cavite ka para ma-access ang marketplace na ito.",
    offlineWarning: "Wala kang internet. I-sesync ang mga pagbabago kapag nakakonekta ka na",
    onlineInfo: "Nakakonekta na. Sine-sync ang data...",
    invalidCategory: "Hindi wastong kategorya",
    invalidPrice: "Dapat na numero ang presyo",
    invalidContact: "Kailangan ng wastong impormasyon ng contact"
  }
};

// marketplace.js - Core marketplace functionality
/**
 * Main marketplace class for Bulihan community
 * @class
 */
class BulihanMarketplace {
  /**
   * Initialize marketplace instance
   * @param {Object} services - Required services
   * @param {Object} services.db - Database service
   * @param {Object} services.auth - Authentication service
   * @param {Object} services.storage - Storage service
   */
  constructor({ db, auth, storage }) {
    if (!db || !auth || !storage) {
      throw new Error("Missing required dependencies", { code: ERROR_CODES.DB_ERROR });
    }
    
    this.db = db;
    this.auth = auth;
    this.storage = storage;
    this.categories = ["Farming", "Household", "Food", "Services"];
    this.location = "Bulihan, Silang, Cavite";
    this.MEETUP_LOCATIONS = [
      "Bulihan Barangay Hall",
      "Silang Public Market",
      "Bulihan Elementary School",
      "Bulihan Basketball Court"
    ];
    this.currentLanguage = 'en';
    this.pendingActions = []; // For offline queue
  }

  /**
   * Add a new listing to the marketplace
   * @param {Object} listingData - Listing details
   * @param {string} listingData.title - Item title
   * @param {number|string} listingData.price - Item price
   * @param {File|null} listingData.image - Optional image file
   * @param {string} listingData.category - Item category
   * @param {string} listingData.contact - Contact information
   * @param {string} [listingData.description] - Optional description
   * @param {string} [listingData.meetupLocation] - Optional meetup location
   * @returns {Promise<string>} ID of created listing
   * @throws {Error} If validation fails
   */
  async addListing({ title, price, image, category, contact, description, meetupLocation }) {
    const startTime = performance.now();
    
    try {
      // Validate required fields
      if (typeof title !== 'string' || title.trim().length === 0) {
        throw new Error(strings[this.currentLanguage].missingFields, { code: ERROR_CODES.INVALID_INPUT });
      }
      
      if (isNaN(parseFloat(price))) {
        throw new Error(strings[this.currentLanguage].invalidPrice, { code: ERROR_CODES.INVALID_INPUT });
      }
      
      if (typeof category !== 'string' || !this.categories.includes(category)) {
        throw new Error(strings[this.currentLanguage].invalidCategory, { code: ERROR_CODES.INVALID_INPUT });
      }
      
      if (typeof contact !== 'string' || contact.trim().length === 0) {
        throw new Error(strings[this.currentLanguage].invalidContact, { code: ERROR_CODES.INVALID_INPUT });
      }

      // Prepare sanitized data
      const sanitizedData = {
        title: this.sanitizeInput(title),
        price: parseFloat(price),
        category: this.sanitizeInput(category),
        contact: this.sanitizeInput(contact),
        description: description ? this.sanitizeInput(description) : null,
        meetupLocation: meetupLocation || null,
        location: this.location,
        postedAt: new Date().toISOString(),
        userId: this.auth.currentUser?.uid || 'anonymous'
      };

      // Handle image upload if provided
      if (image) {
        if (!(image instanceof File || image instanceof Blob)) {
          throw new Error("Invalid image file", { code: ERROR_CODES.INVALID_INPUT });
        }
        try {
          sanitizedData.imageUrl = await this.storage.upload(image);
        } catch (error) {
          console.error("Image upload failed:", error);
          throw new Error("Failed to upload image", { code: ERROR_CODES.STORAGE_ERROR });
        }
      }

      // Save to database
      const result = await this.db.add(sanitizedData);
      
      const duration = performance.now() - startTime;
      console.log(`addListing completed in ${duration.toFixed(2)}ms`);
      
      return result;
    } catch (error) {
      if (!navigator.onLine) {
        // Queue for offline sync
        this.pendingActions.push({
          type: 'addListing',
          data: { title, price, image, category, contact, description, meetupLocation },
          timestamp: new Date().toISOString()
        });
        console.log("Action queued for offline sync");
        return "queued";
      }
      throw error;
    }
  }

  /**
   * Get marketplace listings with optional filtering
   * @param {string} [category="all"] - Category to filter by
   * @param {number} [limit=20] - Maximum number of listings to return
   * @returns {Promise<Array>} Array of listings
   */
  async getListings(category = "all", limit = 20) {
    const startTime = performance.now();
    
    if (typeof limit !== 'number' || limit <= 0) {
      limit = 20;
    }
    
    try {
      let listings = await this.db.getListings(limit);
      
      if (category !== "all") {
        if (!this.categories.includes(category)) {
          throw new Error(strings[this.currentLanguage].invalidCategory, { code: ERROR_CODES.INVALID_INPUT });
        }
        listings = listings.filter(item => item.category === category);
      }
      
      const duration = performance.now() - startTime;
      console.log(`getListings(${category}) completed in ${duration.toFixed(2)}ms`);
      
      return listings;
    } catch (error) {
      console.error("Failed to get listings:", error);
      if (!navigator.onLine && this.pendingActions.length > 0) {
        // Return cached/offline data if available
        return this.getOfflineListings(category);
      }
      throw error;
    }
  }

  /**
   * Sanitize user input to prevent XSS
   * @param {string} input - User input to sanitize
   * @returns {string} Sanitized input
   */
  sanitizeInput(input) {
    if (typeof input !== 'string') return input;
    return input
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  /**
   * Set current language for UI strings
   * @param {string} lang - Language code ('en' or 'tl')
   */
  setLanguage(lang) {
    if (['en', 'tl'].includes(lang)) {
      this.currentLanguage = lang;
    }
  }

  /**
   * Process pending actions when coming back online
   */
  async syncPendingActions() {
    if (this.pendingActions.length === 0 || !navigator.onLine) return;
    
    console.log(`Syncing ${this.pendingActions.length} pending actions`);
    
    const successes = [];
    const failures = [];
    
    for (const action of this.pendingActions) {
      try {
        if (action.type === 'addListing') {
          await this.addListing(action.data);
          successes.push(action);
        }
      } catch (error) {
        console.error("Failed to sync action:", action, error);
        failures.push(action);
      }
    }
    
    // Update pending actions (keep only failures)
    this.pendingActions = failures;
    
    if (successes.length > 0) {
      showToast(strings[this.currentLanguage].onlineInfo, "success");
    }
  }

  // ... other helper methods ...
}

// location.js - Location verification
class LocationVerifier {
  static BULIHAN_BOUNDS = {
    minLat: 14.20,
    maxLat: 14.25,
    minLng: 120.95,
    maxLng: 121.00
  };

  /**
   * Verify user is in Bulihan area
   * @returns {Promise<boolean>} True if verified
   */
  static async verifyBulihanLocation() {
    try {
      const position = await this.getCurrentPosition();
      const inBounds = this.checkBulihanBounds(position.coords);
      
      if (!inBounds) {
        showToast("This marketplace is only for Bulihan residents", "error");
        return false;
      }
      return true;
    } catch (error) {
      console.warn("Location error:", error);
      return this.fallbackVerification();
    }
  }

  static getCurrentPosition() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation not supported"));
      }
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      });
    });
  }

  static checkBulihanBounds(coords) {
    return (
      coords.latitude > this.BULIHAN_BOUNDS.minLat &&
      coords.latitude < this.BULIHAN_BOUNDS.maxLat &&
      coords.longitude > this.BULIHAN_BOUNDS.minLng &&
      coords.longitude < this.BULIHAN_BOUNDS.maxLng
    );
  }

  static fallbackVerification() {
    return confirm(strings.en.locationConfirm);
  }
}

// testing.js - Test framework
class MarketplaceTester {
  static async runAllTests(marketplace) {
    const testResults = {
      passed: 0,
      failed: 0,
      details: []
    };

    // Run all test groups
    await this.runTestGroup('Location Verification', () => this.testLocationVerification(), testResults);
    await this.runTestGroup('Contact Methods', () => this.testContactMethods(), testResults);
    await this.runTestGroup('Offline Mode', () => this.testOfflineMode(marketplace), testResults);
    await this.runTestGroup('Input Validation', () => this.testInputValidation(marketplace), testResults);

    console.log(`\nTest Summary: ${testResults.passed} passed, ${testResults.failed} failed`);
    return testResults;
  }

  static async runTestGroup(name, testFn, results) {
    console.group(`Running test group: ${name}`);
    try {
      await testFn();
      results.passed++;
      results.details.push({ name, status: 'passed' });
      console.log(`${name}: PASSED`);
    } catch (error) {
      results.failed++;
      results.details.push({ name, status: 'failed', error: error.message });
      console.error(`${name}: FAILED - ${error.message}`);
    }
    console.groupEnd();
  }

  static async testLocationVerification() {
    const isVerified = await LocationVerifier.verifyBulihanLocation();
    if (!isVerified) {
      throw new Error("Location verification failed");
    }
  }

  static testContactMethods() {
    const testNumbers = [
      "+639123456789",
      "09123456789",
      "9123456789"
    ];
    
    testNumbers.forEach(number => {
      try {
        ContactHandler.setupContactFallback(number);
      } catch (error) {
        throw new Error(`Contact method failed for ${number}`);
      }
    });
  }

  static async testOfflineMode(marketplace) {
    // Mock offline state
    const originalOnline = navigator.onLine;
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    
    try {
      // Test offline listing
      const result = await marketplace.addListing({
        title: "Test Offline Listing",
        price: "100",
        category: "Household",
        contact: "09123456789"
      });
      
      if (result !== "queued") {
        throw new Error("Offline queue not working");
      }
      
      // Test getting listings while offline
      await marketplace.getListings();
    } finally {
      // Restore original online state
      Object.defineProperty(navigator, 'onLine', { value: originalOnline });
      
      // Process queued actions
      await marketplace.syncPendingActions();
    }
  }

  static async testInputValidation(marketplace) {
    const invalidInputs = [
      { title: "", price: "100", category: "Household", contact: "09123456789" },
      { title: "Test", price: "invalid", category: "Household", contact: "09123456789" },
      { title: "Test", price: "100", category: "Invalid", contact: "09123456789" },
      { title: "Test", price: "100", category: "Household", contact: "" }
    ];
    
    for (const input of invalidInputs) {
      try {
        await marketplace.addListing(input);
        throw new Error(`Invalid input passed validation: ${JSON.stringify(input)}`);
      } catch (error) {
        // Expected to throw error
        if (!error.message.includes("Invalid") && !error.message.includes("Missing")) {
          throw new Error(`Unexpected error for input validation: ${error.message}`);
        }
      }
    }
  }
}

// app.js - Main application initialization
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Initialize Firebase
    const app = initializeApp(firebaseConfig);
    const auth = getAuth(app);
    const db = getFirestore(app);
    const storage = getStorage(app);

    // Initialize marketplace
    const marketplace = new BulihanMarketplace({ db, auth, storage });

    // Run tests in development
    if (process.env.NODE_ENV === 'development') {
      await MarketplaceTester.runAllTests(marketplace);
    }

    // Verify location
    const isVerified = await LocationVerifier.verifyBulihanLocation();
    if (!isVerified) {
      window.location.href = 'unauthorized.html';
      return;
    }

    // Setup UI components
    MarketplaceUI.setupMeetupLocationSelect();
    OfflineManager.init();

    // Load initial listings
    const listings = await marketplace.getListings();
    MarketplaceUI.renderListings(listings);

    // Setup form submission
    document.getElementById('createForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const formData = {
        title: document.getElementById('title').value,
        price: document.getElementById('price').value,
        category: document.getElementById('category').value,
        contact: document.getElementById('contact').value,
        description: document.getElementById('description').value,
        meetupLocation: document.getElementById('meetupLocation').value,
        image: document.getElementById('image').files[0]
      };

      try {
        const result = await marketplace.addListing(formData);
        
        if (result === "queued") {
          showToast("Listing will be posted when online", "info");
        } else {
          showToast(strings[marketplace.currentLanguage].postSuccess, "success");
        }
        
        // Refresh listings
        const updatedListings = await marketplace.getListings();
        MarketplaceUI.renderListings(updatedListings);
        
        // Reset form
        e.target.reset();
      } catch (error) {
        console.error('Error creating listing:', error);
        showToast(`Error: ${error.message}`, "error");
      }
    });

    // Setup language toggle
    document.getElementById('languageToggle').addEventListener('click', () => {
      const newLang = marketplace.currentLanguage === 'en' ? 'tl' : 'en';
      marketplace.setLanguage(newLang);
      location.reload(); // Refresh to apply language changes
    });

  } catch (error) {
    console.error("Initialization error:", error);
    showToast("Failed to initialize app. Please try again later.", "error");
  }
});