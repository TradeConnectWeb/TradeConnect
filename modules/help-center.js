// help-center.js
export class HelpCenter {
  /**
   * Help Center main class
   * @class
   * @param {Object} dbService - Database service interface
   * @param {Object} [config={}] - Configuration options
   * @param {boolean} [config.enableFeedback=true] - Enable article feedback system
   * @param {boolean} [config.enableSearch=true] - Enable search functionality
   * @param {boolean} [config.enableHistory=true] - Enable browser history integration
   * @param {boolean} [config.lazyLoadImages=true] - Enable lazy loading for images
   */
  constructor(dbService, config = {}) {
    this.dbService = dbService;
    this.config = {
      enableFeedback: true,
      enableSearch: true,
      enableHistory: true,
      lazyLoadImages: true,
      ...config
    };

    // State constants
    this.states = {
      LOADING: 'loading',
      READY: 'ready',
      ERROR: 'error',
      VIEWING_CATEGORY: 'viewing_category',
      VIEWING_ARTICLE: 'viewing_article',
      SEARCHING: 'searching'
    };

    // Current state
    this.state = {
      current: this.states.LOADING,
      data: { categories: [], articles: [] },
      viewedArticles: new Set(),
      feedbackSubmissions: new Set(),
      searchTerm: '',
      currentCategoryId: null,
      currentArticleId: null,
      error: null
    };

    // DOM references
    this.dom = {
      container: null,
      categoriesContainer: null,
      articlesContainer: null,
      articleDetailContainer: null,
      searchInput: null
    };

    // Bind methods
    this.init = this.init.bind(this);
    this.handleSearch = this.debounce(this.handleSearch.bind(this), 300);
  }

  /**
   * Initialize the Help Center
   * @async
   * @param {string} [containerSelector='#helpCenter'] - CSS selector for the container
   * @throws {Error} If container element is not found
   */
  async init(containerSelector = '#helpCenter') {
    try {
      this.setupDOMReferences(containerSelector);
      await this.loadData();
      this.setupUI();
      this.setupEventListeners();
      if (this.config.enableHistory) this.setupHistory();
      this.render();
    } catch (error) {
      console.error('Help Center initialization failed:', error);
      this.showError('Failed to initialize Help Center');
    }
  }

  setupDOMReferences(containerSelector) {
    this.dom.container = document.querySelector(containerSelector);
    if (!this.dom.container) throw new Error('Help Center container not found');
    
    this.dom.categoriesContainer = this.dom.container.querySelector('#helpCategories');
    this.dom.articlesContainer = this.dom.container.querySelector('#helpArticles');
    this.dom.articleDetailContainer = this.dom.container.querySelector('#articleDetail');
    this.dom.searchInput = this.dom.container.querySelector('#helpSearch');
  }

  async loadData() {
    try {
      this.transitionState(this.states.LOADING);
      this.showLoading();
      
      const [categories, articles] = await Promise.all([
        this.dbService.getHelpCategories(),
        this.dbService.getHelpArticles()
      ]);
      
      this.transitionState(this.states.READY, {
        data: {
          categories: categories || [],
          articles: articles || []
        }
      });
    } catch (error) {
      console.error('Error loading Help Center data:', error);
      this.transitionState(this.states.ERROR, { error });
      throw error;
    } finally {
      this.hideLoading();
    }
  }

  transitionState(newState, data = {}) {
    this.state.current = newState;
    
    if (data.data) this.state.data = data.data;
    if (data.error) this.state.error = data.error;
    if (data.searchTerm !== undefined) this.state.searchTerm = data.searchTerm;
    if (data.currentCategoryId !== undefined) this.state.currentCategoryId = data.currentCategoryId;
    if (data.currentArticleId !== undefined) this.state.currentArticleId = data.currentArticleId;
    
    if (data.articleId) this.state.viewedArticles.add(data.articleId);
    if (data.feedback) this.state.feedbackSubmissions.add(data.feedback.articleId);
  }

  getCurrentViewData() {
    switch (this.state.current) {
      case this.states.VIEWING_CATEGORY:
        return {
          articles: this.state.data.articles.filter(a => a.category === this.state.currentCategoryId),
          category: this.state.data.categories.find(c => c.id === this.state.currentCategoryId)
        };
      case this.states.VIEWING_ARTICLE:
        return {
          article: this.state.data.articles.find(a => a.id === this.state.currentArticleId),
          relatedArticles: this.state.data.articles
            .filter(a => a.category === this.state.currentArticle?.category && a.id !== this.state.currentArticleId)
            .slice(0, 3)
        };
      case this.states.SEARCHING:
        return {
          articles: this.searchArticles(this.state.searchTerm)
        };
      default:
        return { categories: this.state.data.categories };
    }
  }

  render() {
    switch (this.state.current) {
      case this.states.LOADING:
        this.renderLoading();
        break;
      case this.states.READY:
        this.renderCategories();
        break;
      case this.states.VIEWING_CATEGORY:
        this.renderArticles();
        break;
      case this.states.VIEWING_ARTICLE:
        this.renderArticleDetail();
        break;
      case this.states.SEARCHING:
        this.renderArticles();
        break;
      case this.states.ERROR:
        this.renderError();
        break;
    }
  }

  renderCategories() {
    if (!this.dom.categoriesContainer) return;
    
    this.clearContainer(this.dom.categoriesContainer);
    this.dom.articlesContainer.style.display = 'none';
    this.dom.articleDetailContainer.style.display = 'none';
    this.dom.categoriesContainer.style.display = 'flex';
    
    const fragment = document.createDocumentFragment();
    
    this.state.data.categories.forEach(category => {
      const card = this.createCategoryCard(category);
      fragment.appendChild(card);
    });
    
    this.dom.categoriesContainer.appendChild(fragment);
  }

  createCategoryCard(category) {
    const card = document.createElement('div');
    card.className = 'category-card';
    card.dataset.categoryId = category.id;
    
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.setAttribute('aria-label', `View ${category.title} articles`);
    
    card.innerHTML = `
      <div class="category-icon">
        ${category.icon ? 
          `<img src="${category.icon}" alt="" loading="${this.config.lazyLoadImages ? 'lazy' : 'eager'}">` : 
          ''}
      </div>
      <h3>${this.sanitizeHTML(category.title)}</h3>
      <p>${this.sanitizeHTML(category.description || '')}</p>
    `;
    
    card.addEventListener('click', () => this.navigateTo('category', category.id));
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        this.navigateTo('category', category.id);
      }
    });
    
    return card;
  }

  renderArticles() {
    if (!this.dom.articlesContainer) return;
    
    this.clearContainer(this.dom.articlesContainer);
    this.dom.categoriesContainer.style.display = 'none';
    this.dom.articleDetailContainer.style.display = 'none';
    this.dom.articlesContainer.style.display = 'block';
    
    const viewData = this.getCurrentViewData();
    const fragment = document.createDocumentFragment();
    
    if (this.state.current === this.states.SEARCHING) {
      const header = document.createElement('div');
      header.className = 'search-results-header';
      header.innerHTML = `
        <h3>Search results for "${this.sanitizeHTML(this.state.searchTerm)}"</h3>
        <p>${viewData.articles.length} article${viewData.articles.length !== 1 ? 's' : ''} found</p>
      `;
      fragment.appendChild(header);
    } else if (this.state.current === this.states.VIEWING_CATEGORY) {
      const header = document.createElement('div');
      header.className = 'category-header';
      header.innerHTML = `
        <h3>${this.sanitizeHTML(viewData.category.title)}</h3>
        <p>${this.sanitizeHTML(viewData.category.description || '')}</p>
      `;
      fragment.appendChild(header);
    }
    
    if (viewData.articles.length === 0) {
      const noResults = document.createElement('div');
      noResults.className = 'no-results';
      noResults.innerHTML = `
        <p>No articles found${this.state.searchTerm ? ` for "${this.sanitizeHTML(this.state.searchTerm)}"` : ''}</p>
        <button class="btn-back">Back to categories</button>
      `;
      noResults.querySelector('.btn-back').addEventListener('click', () => this.navigateTo('categories'));
      fragment.appendChild(noResults);
    } else {
      const articlesContainer = document.createElement('div');
      articlesContainer.className = 'article-cards';
      
      viewData.articles.forEach(article => {
        const card = this.createArticleCard(article);
        articlesContainer.appendChild(card);
      });
      
      fragment.appendChild(articlesContainer);
    }
    
    this.dom.articlesContainer.appendChild(fragment);
  }

  createArticleCard(article) {
    const card = document.createElement('div');
    card.className = 'article-card';
    card.dataset.articleId = article.id;
    
    card.setAttribute('role', 'article');
    card.setAttribute('aria-labelledby', `article-title-${article.id}`);
    
    card.innerHTML = `
      <h4 id="article-title-${article.id}">${this.sanitizeHTML(article.title)}</h4>
      <div class="article-meta">
        <span class="article-category">${this.getCategoryName(article.category)}</span>
        <span class="article-date">${this.formatDate(article.updatedAt)}</span>
      </div>
      <p>${this.sanitizeHTML(this.truncateText(article.content, 100))}</p>
    `;
    
    card.addEventListener('click', () => this.navigateTo('article', article.id));
    
    return card;
  }

  /**
   * Render article detail view with performance tracking
   * @async
   */
  async renderArticleDetail() {
    const start = performance.now();
    
    if (!this.dom.articleDetailContainer) return;
    
    this.dom.articleDetailContainer.innerHTML = '<div class="loading-spinner">Loading article...</div>';
    this.dom.categoriesContainer.style.display = 'none';
    this.dom.articlesContainer.style.display = 'none';
    this.dom.articleDetailContainer.style.display = 'block';
    
    const viewData = this.getCurrentViewData();
    
    try {
      await this.trackArticleView(this.state.currentArticleId);
      
      const articleHTML = `
        <div class="article-header">
          <button class="back-button" aria-label="Back to articles">
            <svg viewBox="0 0 24 24" width="24" height="24">
              <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
            </svg>
          </button>
          <div class="article-meta">
            <span class="article-category">${this.sanitizeHTML(this.getCategoryName(viewData.article.category))}</span>
            <span class="article-date">${this.formatDate(viewData.article.updatedAt)}</span>
            ${viewData.article.views ? `<span class="article-views">${viewData.article.views} view${viewData.article.views !== 1 ? 's' : ''}</span>` : ''}
          </div>
          <h2>${this.sanitizeHTML(viewData.article.title)}</h2>
        </div>
        
        <div class="article-content" id="articleContent">
          ${this.sanitizeHTML(viewData.article.content)}
        </div>
        
        ${this.config.enableFeedback ? this.renderFeedbackSection() : ''}
        ${viewData.relatedArticles.length > 0 ? this.renderRelatedArticles(viewData.relatedArticles) : ''}
      `;
      
      this.dom.articleDetailContainer.innerHTML = articleHTML;
      this.setupArticleDetailEvents();
      this.generateTableOfContents();
    } catch (error) {
      console.error('Error rendering article detail:', error);
      this.dom.articleDetailContainer.innerHTML = `
        <div class="error-message">
          <p>Failed to load article</p>
          <button class="btn-back">Back to articles</button>
        </div>
      `;
      this.dom.articleDetailContainer.querySelector('.btn-back').addEventListener('click', () => 
        this.navigateTo(this.state.currentCategoryId ? 'category' : 'categories', this.state.currentCategoryId)
      );
    } finally {
      const duration = performance.now() - start;
      this.trackPerformance('articleRender', {
        articleId: this.state.currentArticleId,
        duration,
        state: this.state.current
      });
    }
  }

  renderFeedbackSection() {
    return `
      <div class="article-feedback">
        <p>Was this article helpful?</p>
        <div class="feedback-buttons">
          <button class="feedback-btn" data-helpful="yes" aria-label="Yes, this article was helpful">
            <svg viewBox="0 0 24 24" width="24" height="24">
              <path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-1.91l-.01-.01L23 10z"/>
            </svg>
            <span>Yes</span>
          </button>
          <button class="feedback-btn" data-helpful="no" aria-label="No, this article was not helpful">
            <svg viewBox="0 0 24 24" width="24" height="24">
              <path d="M15 3H6c-.83 0-1.54.5-1.84 1.22l-3.02 7.05c-.09.23-.14.47-.14.73v1.91l.01.01L1 14c0 1.1.9 2 2 2h6.31l-.95 4.57-.03.32c0 .41.17.79.44 1.06L9.83 23l6.58-6.59c.36-.36.58-.86.58-1.41V5c0-1.1-.9-2-2-2zm4 0v12h4V3h-4z"/>
            </svg>
            <span>No</span>
          </button>
        </div>
      </div>
    `;
  }

  renderRelatedArticles(relatedArticles) {
    return `
      <div class="related-articles">
        <h3>Related articles</h3>
        <div class="related-articles-list">
          ${relatedArticles.map(article => `
            <div class="related-article" data-article-id="${article.id}">
              <h4>${this.sanitizeHTML(article.title)}</h4>
              <p>${this.sanitizeHTML(this.truncateText(article.content, 60))}</p>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  setupArticleDetailEvents() {
    // Feedback buttons
    if (this.config.enableFeedback) {
      const feedbackButtons = this.dom.articleDetailContainer.querySelectorAll('.feedback-btn');
      feedbackButtons.forEach(btn => {
        btn.addEventListener('click', async () => {
          const isHelpful = btn.dataset.helpful === 'yes';
          await this.handleFeedback(this.state.currentArticleId, isHelpful);
        });
      });
    }
    
    // Related articles
    const relatedArticles = this.dom.articleDetailContainer.querySelectorAll('.related-article');
    relatedArticles.forEach(article => {
      article.addEventListener('click', () => {
        const relatedArticleId = article.dataset.articleId;
        this.navigateTo('article', relatedArticleId);
      });
    });
  }

  generateTableOfContents() {
    const contentElement = this.dom.articleDetailContainer.querySelector('#articleContent');
    if (!contentElement) return;
    
    const headings = contentElement.querySelectorAll('h2, h3');
    if (headings.length < 3) return;
    
    const tocContainer = document.createElement('div');
    tocContainer.className = 'article-toc';
    
    const tocTitle = document.createElement('div');
    tocTitle.className = 'toc-title';
    tocTitle.textContent = 'Table of Contents';
    tocContainer.appendChild(tocTitle);
    
    const tocList = document.createElement('ul');
    tocList.className = 'toc-list';
    
    headings.forEach((heading, index) => {
      if (!heading.id) heading.id = `section-${index}`;
      
      const tocItem = document.createElement('li');
      tocItem.className = `toc-item toc-level-${heading.tagName.toLowerCase()}`;
      
      const tocLink = document.createElement('a');
      tocLink.href = `#${heading.id}`;
      tocLink.textContent = heading.textContent;
      tocLink.addEventListener('click', (e) => {
        e.preventDefault();
        heading.scrollIntoView({ behavior: 'smooth' });
      });
      
      tocItem.appendChild(tocLink);
      tocList.appendChild(tocItem);
    });
    
    tocContainer.appendChild(tocList);
    contentElement.insertBefore(tocContainer, contentElement.firstChild);
  }

  setupUI() {
    if (!this.dom.categoriesContainer || !this.dom.articlesContainer || !this.dom.articleDetailContainer) {
      console.warn('Help Center DOM structure is incomplete. Some features may not work properly.');
    }
    
    if (this.config.enableSearch && this.dom.searchInput) {
      this.dom.searchInput.style.display = 'block';
    } else if (this.dom.searchInput) {
      this.dom.searchInput.style.display = 'none';
    }
  }

  setupEventListeners() {
    if (this.config.enableSearch && this.dom.searchInput) {
      this.dom.searchInput.addEventListener('input', this.handleSearch);
    }
    
    const backButton = this.dom.articleDetailContainer?.querySelector('.back-button');
    if (backButton) {
      backButton.addEventListener('click', () => this.navigateTo('categories'));
    }
  }

  setupHistory() {
    window.addEventListener('popstate', (event) => {
      if (event.state?.helpCenterState) {
        this.restoreState(event.state.helpCenterState);
      }
    });
  }

  saveState() {
    if (!this.config.enableHistory) return;
    
    const state = {
      view: this.state.current,
      categoryId: this.state.currentCategoryId,
      articleId: this.state.currentArticleId,
      searchTerm: this.state.searchTerm
    };
    
    history.pushState({ helpCenterState: state }, '', '');
  }

  restoreState(state) {
    if (!state) return;
    
    this.state.searchTerm = state.searchTerm || '';
    
    if (state.view === this.states.VIEWING_CATEGORY && state.categoryId) {
      this.navigateTo('category', state.categoryId);
    } else if (state.view === this.states.VIEWING_ARTICLE && state.articleId) {
      this.navigateTo('article', state.articleId);
    } else {
      this.navigateTo('categories');
    }
  }

  /**
   * Navigate to a specific view
   * @param {string} view - View to navigate to ('categories', 'category', 'article')
   * @param {string} [id] - ID of the category or article
   */
  navigateTo(view, id = null) {
    switch (view) {
      case 'categories':
        this.transitionState(this.states.READY, {
          currentCategoryId: null,
          currentArticleId: null
        });
        break;
      case 'category':
        this.transitionState(this.states.VIEWING_CATEGORY, {
          currentCategoryId: id,
          currentArticleId: null
        });
        break;
      case 'article':
        this.transitionState(this.states.VIEWING_ARTICLE, {
          currentArticleId: id,
          articleId: id
        });
        break;
    }
    
    this.saveState();
    this.render();
  }

  handleSearch(event) {
    this.state.searchTerm = event.target.value.trim();
    
    if (this.state.searchTerm) {
      this.transitionState(this.states.SEARCHING);
    } else {
      if (this.state.currentCategoryId) {
        this.transitionState(this.states.VIEWING_CATEGORY);
      } else {
        this.transitionState(this.states.READY);
      }
    }
    
    this.render();
  }

  searchArticles(term) {
    const normalizedTerm = term.toLowerCase().trim();
    
    return this.state.data.articles.filter(article => {
      const titleMatch = article.title.toLowerCase().includes(normalizedTerm);
      const contentMatch = article.content.toLowerCase().includes(normalizedTerm);
      const categoryMatch = this.getCategoryName(article.category).toLowerCase().includes(normalizedTerm);
      const tagMatch = article.tags?.some(tag => tag.toLowerCase().includes(normalizedTerm)) || false;
      
      return titleMatch || contentMatch || categoryMatch || tagMatch;
    });
  }

  /**
   * Handle article feedback submission
   * @async
   * @param {string} articleId - ID of the article
   * @param {boolean} isHelpful - Whether the article was helpful
   */
  async handleFeedback(articleId, isHelpful) {
    if (this.state.feedbackSubmissions.has(articleId)) {
      this.showToast('You have already submitted feedback for this article', 'warning');
      return;
    }
    
    try {
      const feedbackButtons = this.dom.articleDetailContainer.querySelectorAll('.feedback-btn');
      feedbackButtons.forEach(btn => btn.disabled = true);
      
      await this.dbService.submitArticleFeedback(articleId, isHelpful);
      
      feedbackButtons.forEach(btn => {
        if (btn.dataset.helpful === (isHelpful ? 'yes' : 'no')) {
          btn.classList.add('active');
        }
      });
      
      this.transitionState(this.state.current, {
        feedback: { articleId }
      });
      
      this.showToast('Thank you for your feedback!');
    } catch (error) {
      console.error('Error submitting feedback:', error);
      const feedbackButtons = this.dom.articleDetailContainer.querySelectorAll('.feedback-btn');
      feedbackButtons.forEach(btn => btn.disabled = false);
      this.showToast('Failed to submit feedback. Please try again.', 'error');
    }
  }

  async trackArticleView(articleId) {
    try {
      await this.dbService.incrementArticleViews(articleId);
      const article = this.state.data.articles.find(a => a.id === articleId);
      if (article) article.views = (article.views || 0) + 1;
    } catch (error) {
      console.error('Error tracking article view:', error);
    }
  }

  trackPerformance(eventName, data) {
    if (window.analytics) {
      window.analytics.track(eventName, data);
    } else {
      console.debug(`[Performance] ${eventName}`, data);
    }
  }

  getCategoryName(categoryId) {
    const category = this.state.data.categories.find(c => c.id === categoryId);
    return category ? this.sanitizeHTML(category.title) : 'Uncategorized';
  }

  clearContainer(container) {
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
  }

  sanitizeHTML(html) {
    if (!html) return '';
    const temp = document.createElement('div');
    temp.textContent = html;
    return temp.innerHTML;
  }

  truncateText(text, maxLength) {
    return text.length <= maxLength ? text : text.substring(0, maxLength) + '...';
  }

  formatDate(dateString) {
    if (!dateString) return '';
    try {
      const options = { year: 'numeric', month: 'short', day: 'numeric' };
      return new Date(dateString).toLocaleDateString(undefined, options);
    } catch (e) {
      return dateString;
    }
  }

  showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  showLoading() {
    // Implement loading indicator if needed
  }

  hideLoading() {
    // Hide loading indicator if needed
  }

  showError(message) {
    if (this.dom.container) {
      this.dom.container.innerHTML = `
        <div class="help-center-error">
          <p>${message}</p>
          <button class="btn-retry">Retry</button>
        </div>
      `;
      
      const retryButton = this.dom.container.querySelector('.btn-retry');
      if (retryButton) retryButton.addEventListener('click', this.init);
    }
  }

  renderLoading() {
    if (this.dom.container) {
      this.dom.container.innerHTML = '<div class="loading-spinner">Loading Help Center...</div>';
    }
  }

  renderError() {
    if (this.dom.container) {
      this.dom.container.innerHTML = `
        <div class="help-center-error">
          <p>${this.state.error?.message || 'An error occurred'}</p>
          <button class="btn-retry">Retry</button>
        </div>
      `;
      this.dom.container.querySelector('.btn-retry').addEventListener('click', this.init);
    }
  }

  debounce(func, wait) {
    let timeout;
    return function(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }
}