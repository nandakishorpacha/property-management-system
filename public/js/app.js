/**
 * Property Management System (StaySpace) - Frontend Application Logic
 * Stack: HTML5, CSS3, JavaScript (ES6+), Node.js, MySQL
 * Covers 5 DBMS Modules: Users, Properties, Bookings, Reviews, Wishlist
 */

const app = {
  state: {
    user: null,
    token: null,
    properties: [],
    wishlistIds: new Set(),
    currentView: 'listings',
    dashboardTab: 'tab1',
    selectedProperty: null,
    authMode: 'login'
  },

  // ---------------------------------------------------------------------------
  // Initialization
  // ---------------------------------------------------------------------------
  async init() {
    this.initAuth();
    this.setupEventListeners();
    await this.loadProperties();
    if (this.state.token) {
      await this.loadWishlistIds();
    }
  },

  initAuth() {
    const savedToken = localStorage.getItem('pms_token');
    const savedUser = localStorage.getItem('pms_user');

    if (savedToken && savedUser) {
      try {
        this.state.token = savedToken;
        this.state.user = JSON.parse(savedUser);
      } catch (e) {
        this.logout();
      }
    }
    this.updateNavAuth();
  },

  setupEventListeners() {
    // Star rating picker in review modal
    const starPicker = document.getElementById('star-rating-picker');
    if (starPicker) {
      starPicker.addEventListener('click', (e) => {
        if (e.target.classList.contains('star-btn')) {
          const val = parseInt(e.target.getAttribute('data-val'), 10);
          this.setStarRating(val);
        }
      });
    }

    // Enter key triggers search in filter input
    const searchInput = document.getElementById('filter-search');
    if (searchInput) {
      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this.applyFilters();
      });
    }
  },

  // ---------------------------------------------------------------------------
  // API Request Wrapper
  // ---------------------------------------------------------------------------
  async api(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (this.state.token) {
      headers['Authorization'] = `Bearer ${this.state.token}`;
    }

    try {
      const response = await fetch(endpoint, { ...options, headers });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || `Request failed with status ${response.status}`);
      }

      return data;
    } catch (err) {
      console.error(`API Error [${endpoint}]:`, err);
      throw err;
    }
  },

  // ---------------------------------------------------------------------------
  // Navigation & Views
  // ---------------------------------------------------------------------------
  showView(viewName) {
    this.state.currentView = viewName;
    document.querySelectorAll('.app-view').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(el => el.classList.remove('active'));

    const targetView = document.getElementById(`view-${viewName}`);
    const heroSection = document.getElementById('hero-section');

    if (targetView) targetView.classList.add('active');

    if (viewName === 'listings') {
      document.getElementById('nav-listings-btn').classList.add('active');
      if (heroSection) heroSection.style.display = 'block';
      this.loadProperties();
    } else if (viewName === 'dashboard') {
      document.getElementById('nav-dashboard-btn').classList.add('active');
      if (heroSection) heroSection.style.display = 'none';
      this.renderDashboard();
    }
  },

  // ---------------------------------------------------------------------------
  // MODULE 1: User Authentication & Role Management
  // ---------------------------------------------------------------------------
  updateNavAuth() {
    const authContainer = document.getElementById('nav-auth-section');
    const ownerAddContainer = document.getElementById('owner-add-prop-container');
    const dashLabel = document.getElementById('nav-dashboard-label');

    if (this.state.user) {
      const u = this.state.user;
      dashLabel.textContent = u.role === 'admin' ? 'Admin Panel' : (u.role === 'owner' ? 'Owner Hub' : 'My Trips & Wishlist');

      authContainer.innerHTML = `
        <div class="user-profile-badge">
          <span class="role-tag ${u.role}">${u.role}</span>
          <span class="user-name-text">${this.escapeHtml(u.name)}</span>
          <button class="logout-icon-btn" onclick="app.logout()" title="Sign Out">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
          </button>
        </div>
      `;

      if (ownerAddContainer) {
        if (u.role === 'owner' || u.role === 'admin') {
          ownerAddContainer.innerHTML = `
            <button class="btn btn-primary btn-sm" onclick="app.openPropertyFormModal()">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              List New Property
            </button>
          `;
        } else {
          ownerAddContainer.innerHTML = '';
        }
      }
    } else {
      dashLabel.textContent = 'My Dashboard';
      authContainer.innerHTML = `
        <button class="btn btn-outline btn-sm" onclick="app.openAuthModal('login')">Sign In</button>
      `;
      if (ownerAddContainer) ownerAddContainer.innerHTML = '';
    }
  },

  openAuthModal(mode = 'login') {
    this.setAuthMode(mode);
    this.openModal('auth-modal');
  },

  setAuthMode(mode) {
    this.state.authMode = mode;
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const loginTab = document.getElementById('tab-btn-login');
    const regTab = document.getElementById('tab-btn-register');

    if (mode === 'login') {
      loginForm.style.display = 'block';
      registerForm.style.display = 'none';
      loginTab.classList.add('active');
      regTab.classList.remove('active');
    } else {
      loginForm.style.display = 'none';
      registerForm.style.display = 'block';
      loginTab.classList.remove('active');
      regTab.classList.add('active');
    }
  },

  fillLogin(email, password) {
    document.getElementById('login-email').value = email;
    document.getElementById('login-password').value = password;
  },

  async quickLogin(email, password) {
    try {
      const data = await this.api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });

      this.saveSession(data.user, data.token);
      this.showToast(`Logged in as ${data.user.name} (${data.user.role.toUpperCase()})`, 'success');
      this.closeModal('auth-modal');
      await this.loadWishlistIds();
      
      if (this.state.currentView === 'dashboard') {
        this.renderDashboard();
      } else {
        this.renderProperties();
      }
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  },

  async handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
      const data = await this.api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });

      this.saveSession(data.user, data.token);
      this.showToast(`Welcome back, ${data.user.name}!`, 'success');
      this.closeModal('auth-modal');
      await this.loadWishlistIds();

      if (this.state.currentView === 'dashboard') {
        this.renderDashboard();
      } else {
        this.renderProperties();
      }
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  },

  async handleRegister(e) {
    e.preventDefault();
    const name = document.getElementById('reg-name').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const phone = document.getElementById('reg-phone').value;
    const role = document.getElementById('reg-role').value;

    try {
      const data = await this.api('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password, phone, role })
      });

      this.saveSession(data.user, data.token);
      this.showToast('Account created successfully!', 'success');
      this.closeModal('auth-modal');
      await this.loadWishlistIds();
      this.renderProperties();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  },

  saveSession(user, token) {
    this.state.user = user;
    this.state.token = token;
    localStorage.setItem('pms_user', JSON.stringify(user));
    localStorage.setItem('pms_token', token);
    this.updateNavAuth();
  },

  logout() {
    this.state.user = null;
    this.state.token = null;
    this.state.wishlistIds.clear();
    localStorage.removeItem('pms_user');
    localStorage.removeItem('pms_token');
    this.updateNavAuth();
    this.showToast('You have signed out.', 'info');
    if (this.state.currentView === 'dashboard') {
      this.showView('listings');
    } else {
      this.renderProperties();
    }
  },

  // ---------------------------------------------------------------------------
  // MODULE 2: Property Listings, Search & Filtering
  // ---------------------------------------------------------------------------
  async loadProperties(params = {}) {
    const grid = document.getElementById('properties-grid');
    grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: #64748b;">Loading listings...</div>';

    const queryString = new URLSearchParams(params).toString();
    try {
      const properties = await this.api(`/api/properties?${queryString}`);
      this.state.properties = properties;
      this.renderProperties();
    } catch (err) {
      grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: #ef4444;">Failed to load properties: ${err.message}</div>`;
    }
  },

  applyFilters() {
    const search = document.getElementById('filter-search').value.trim();
    const location = document.getElementById('filter-location').value.trim();
    const type = document.getElementById('filter-type').value;
    const listing_mode = document.getElementById('filter-mode').value;
    const max_price = document.getElementById('filter-max-price').value;

    const params = {};
    if (search) params.search = search;
    if (location) params.location = location;
    if (type) params.type = type;
    if (listing_mode) params.listing_mode = listing_mode;
    if (max_price) params.max_price = max_price;

    this.loadProperties(params);
  },

  resetFilters() {
    document.getElementById('filter-search').value = '';
    document.getElementById('filter-location').value = '';
    document.getElementById('filter-type').value = '';
    document.getElementById('filter-mode').value = '';
    document.getElementById('filter-max-price').value = '';
    this.loadProperties();
  },

  renderProperties() {
    const grid = document.getElementById('properties-grid');
    const countLabel = document.getElementById('listings-count-label');
    const properties = this.state.properties;

    countLabel.textContent = `Showing ${properties.length} verified propert${properties.length === 1 ? 'y' : 'ies'}`;

    if (!properties || properties.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 4rem 1rem;">
          <h3 style="color: var(--secondary); margin-bottom: 0.5rem;">No properties found</h3>
          <p style="color: var(--text-muted); margin-bottom: 1rem;">Try adjusting your search criteria or resetting filters.</p>
          <button class="btn btn-outline btn-sm" onclick="app.resetFilters()">Clear Filters</button>
        </div>
      `;
      return;
    }

    grid.innerHTML = properties.map(p => {
      const isFav = this.state.wishlistIds.has(p.property_id);
      const formattedPrice = this.formatCurrency(p.price);
      const priceUnit = p.listing_mode === 'rent' ? '/ day' : ' total';

      return `
        <div class="property-card">
          <div class="card-image-wrap">
            <img class="card-img" src="${p.image_url || 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=800&q=80'}" alt="${this.escapeHtml(p.title)}" loading="lazy">
            <div class="card-badges">
              <span class="badge badge-${p.listing_mode}">${p.listing_mode === 'rent' ? 'For Rent' : 'For Sale'}</span>
              <span class="badge badge-unavailable">${p.type}</span>
            </div>
            <button class="card-wishlist-btn ${isFav ? 'active' : ''}" onclick="app.toggleWishlist(${p.property_id})" title="${isFav ? 'Remove from Wishlist' : 'Save to Wishlist'}">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="${isFav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2.2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
            </button>
          </div>

          <div class="card-content">
            <div class="card-price-row">
              <div class="card-price">${formattedPrice} <span class="card-period">${priceUnit}</span></div>
              <div class="card-rating">
                <span class="star-icon">★</span>
                <span>${p.average_rating > 0 ? p.average_rating : 'New'}</span>
                <span style="font-size:0.75rem; color:var(--text-light); font-weight:normal;">(${p.review_count})</span>
              </div>
            </div>

            <h3 class="card-title" title="${this.escapeHtml(p.title)}">${this.escapeHtml(p.title)}</h3>
            <div class="card-location">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
              <span>${this.escapeHtml(p.location)}</span>
            </div>
            <p class="card-desc">${this.escapeHtml(p.description)}</p>

            <div class="card-footer">
              <button class="btn btn-outline btn-sm btn-block" onclick="app.openPropertyModal(${p.property_id})">
                View Details
              </button>
              <button class="btn btn-primary btn-sm btn-block" onclick="app.openPropertyModal(${p.property_id}, true)">
                ${p.listing_mode === 'rent' ? 'Book Stay' : 'Inquire / Buy'}
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  },

  // ---------------------------------------------------------------------------
  // Property Detail Modal & Bookings
  // ---------------------------------------------------------------------------
  async openPropertyModal(propertyId, focusBooking = false) {
    const modalBody = document.getElementById('property-modal-body');
    modalBody.innerHTML = '<div style="text-align: center; padding: 3rem;">Loading property details...</div>';
    this.openModal('property-modal');

    try {
      const data = await this.api(`/api/properties/${propertyId}`);
      const p = data.property;
      const reviews = data.reviews || [];
      const bookedDates = data.booked_dates || [];
      this.state.selectedProperty = p;
      this.state.selectedPropertyBookedDates = bookedDates;

      const today = new Date();
      const minDateStr = today.toISOString().split('T')[0];

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const defaultStart = tomorrow.toISOString().split('T')[0];

      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 4);
      const defaultEnd = nextWeek.toISOString().split('T')[0];

      modalBody.innerHTML = `
        <img class="prop-modal-img" src="${p.image_url || 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=1200&q=80'}" alt="${this.escapeHtml(p.title)}">

        <div class="prop-detail-grid">
          <div class="prop-info-col">
            <div style="display:flex; gap:0.5rem; margin-bottom: 0.6rem;">
              <span class="badge badge-${p.listing_mode}">${p.listing_mode === 'rent' ? 'For Rent' : 'For Sale'}</span>
              <span class="badge badge-unavailable">${p.type}</span>
              <span class="badge badge-${p.status}">${p.status}</span>
            </div>

            <h2 style="font-size: 1.5rem; font-weight: 800; color: var(--secondary); margin-bottom: 0.35rem;">${this.escapeHtml(p.title)}</h2>
            <div style="display: flex; align-items: center; gap: 0.35rem; color: var(--text-muted); font-size: 0.9rem; margin-bottom: 1.25rem;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
              <span>${this.escapeHtml(p.location)}</span>
            </div>

            <h4 style="font-size: 0.95rem; font-weight: 700; margin-bottom: 0.4rem;">About this Property</h4>
            <p style="color: var(--text-muted); font-size: 0.92rem; line-height: 1.6; margin-bottom: 1.5rem;">${this.escapeHtml(p.description)}</p>

            <div style="background: var(--bg-main); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 1rem; margin-bottom: 1.5rem;">
              <div style="font-size: 0.78rem; text-transform: uppercase; font-weight: 700; color: var(--text-muted); margin-bottom: 0.3rem;">Listed by Verified Owner</div>
              <div style="font-size: 0.95rem; font-weight: 700; color: var(--secondary);">${this.escapeHtml(p.owner_name)}</div>
              <div style="font-size: 0.85rem; color: var(--text-muted);">${this.escapeHtml(p.owner_email)} &bull; ${this.escapeHtml(p.owner_phone || 'Verified on platform')}</div>
            </div>
          </div>

          <!-- Advanced Booking Box with Automated Availability -->
          <div class="prop-booking-col">
            <div class="prop-booking-box" id="booking-widget-box">
              <div style="font-size: 1.5rem; font-weight: 800; color: var(--secondary); margin-bottom: 0.2rem;">
                ${this.formatCurrency(p.price)} <span style="font-size: 0.82rem; font-weight: 500; color: var(--text-muted);">${p.listing_mode === 'rent' ? '/ day' : ' total'}</span>
              </div>
              <div style="display:flex; align-items:center; gap:0.25rem; font-size:0.85rem; margin-bottom: 1rem;">
                <span class="star-icon">★</span>
                <strong>${p.average_rating > 0 ? p.average_rating : 'New'}</strong>
                <span style="color: var(--text-muted);">(${p.review_count} verified reviews)</span>
              </div>

              ${p.status !== 'available' ? `
                <div style="padding: 1rem; background: #fee2e2; color: #b91c1c; border-radius: var(--radius-md); font-size: 0.9rem; text-align: center; font-weight: 600;">
                  This property is currently ${p.status}.
                </div>
              ` : `
                <!-- Automated Availability Panel -->
                <div class="avail-panel">
                  <div class="avail-header-row">
                    <span class="avail-status-pill ${bookedDates.length === 0 ? 'open' : 'partial'}">
                      ${bookedDates.length === 0 ? '🟢 100% Available' : '🟡 ' + bookedDates.length + ' Dates Reserved'}
                    </span>
                    <button type="button" class="auto-suggest-btn" onclick="app.autoSelectNextAvailableDates(${p.price}, '${p.listing_mode}')" title="Automatically find and pick next free dates">
                      ⚡ Find Next Free Dates
                    </button>
                  </div>
                  ${bookedDates.length > 0 ? `
                    <div style="font-size: 0.73rem; color: var(--text-muted); margin-top: 0.2rem;">Already booked periods:</div>
                    <div class="reserved-tags-container">
                      ${bookedDates.map(b => `<span class="reserved-pill">🔒 ${b.start_date} &rarr; ${b.end_date}</span>`).join('')}
                    </div>
                  ` : `
                    <div style="font-size: 0.74rem; color: var(--text-muted);">No upcoming reservations. Any date range is currently free!</div>
                  `}
                </div>

                <form id="booking-request-form" onsubmit="app.handleBookingSubmit(event, ${p.property_id}, ${p.price}, '${p.listing_mode}')">
                  <!-- Date Inputs -->
                  <div class="form-group">
                    <label>${p.listing_mode === 'rent' ? '📅 Check-in Date' : 'Preferred Visit Date'}</label>
                    <input type="date" id="book-start-date" required min="${minDateStr}" value="${defaultStart}" onchange="app.calcLiveBookingTotal(${p.price}, '${p.listing_mode}')">
                  </div>
                  <div class="form-group">
                    <label>${p.listing_mode === 'rent' ? '📅 Check-out Date' : 'Alternative Date'}</label>
                    <input type="date" id="book-end-date" required min="${minDateStr}" value="${defaultEnd}" onchange="app.calcLiveBookingTotal(${p.price}, '${p.listing_mode}')">
                  </div>

                  <!-- Time Slot Selectors -->
                  <div class="time-slots-row">
                    <div class="form-group" style="margin-bottom:0;">
                      <label style="font-size:0.75rem;">⏰ Check-in Time</label>
                      <select id="book-checkin-time" onchange="app.calcLiveBookingTotal(${p.price}, '${p.listing_mode}')">
                        <option value="10:00 AM">10:00 AM (Early)</option>
                        <option value="12:00 PM">12:00 PM (Noon)</option>
                        <option value="02:00 PM" selected>02:00 PM (Standard)</option>
                        <option value="04:00 PM">04:00 PM (Late)</option>
                      </select>
                    </div>
                    <div class="form-group" style="margin-bottom:0;">
                      <label style="font-size:0.75rem;">⏰ Check-out Time</label>
                      <select id="book-checkout-time" onchange="app.calcLiveBookingTotal(${p.price}, '${p.listing_mode}')">
                        <option value="10:00 AM">10:00 AM</option>
                        <option value="11:00 AM" selected>11:00 AM (Standard)</option>
                        <option value="12:00 PM">12:00 PM</option>
                        <option value="02:00 PM">02:00 PM (Late)</option>
                      </select>
                    </div>
                  </div>

                  <!-- Real-time Conflict & Live Pricing Feedback -->
                  <div id="booking-price-breakdown">
                    <!-- Updated by calcLiveBookingTotal -->
                  </div>

                  <button type="submit" id="booking-submit-btn" class="btn btn-primary btn-block">
                    ${p.listing_mode === 'rent' ? 'Confirm & Send Rental Request' : 'Schedule Purchase Visit'}
                  </button>
                  <p style="font-size: 0.72rem; color: var(--text-muted); text-align: center; margin-top: 0.5rem;">Automated conflict check active. Owner will receive instant notification.</p>
                </form>
              `}
            </div>
          </div>
        </div>

        <!-- MODULE 4: Verified Reviews Section -->
        <div class="reviews-section">
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom: 1rem;">
            <h3 style="font-size: 1.15rem; font-weight: 800; color: var(--secondary);">
              Verified Guest Reviews (${reviews.length})
            </h3>
            <div style="font-size: 0.9rem; font-weight: 700; color: var(--secondary);">
              Overall: <span class="star-icon">★</span> ${p.average_rating > 0 ? p.average_rating : 'No reviews yet'}
            </div>
          </div>

          ${reviews.length === 0 ? `
            <p style="color: var(--text-muted); font-size: 0.9rem;">No reviews yet for this listing. Verified guests can submit reviews after a completed booking.</p>
          ` : reviews.map(r => `
            <div class="review-card">
              <div class="review-author-row">
                <div class="review-author">${this.escapeHtml(r.reviewer_name)}</div>
                <div style="display:flex; align-items:center; gap:0.2rem; color:var(--accent); font-size: 0.85rem; font-weight: 700;">
                  ${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}
                  <span style="font-size:0.75rem; color:var(--text-light); margin-left: 0.4rem;">${this.formatDate(r.review_date)}</span>
                </div>
              </div>
              <p class="review-comment">${this.escapeHtml(r.comment)}</p>
            </div>
          `).join('')}
        </div>
      `;

      if (p.status === 'available') {
        this.calcLiveBookingTotal(p.price, p.listing_mode);
      }

      if (focusBooking) {
        setTimeout(() => {
          const widget = document.getElementById('booking-widget-box');
          if (widget) widget.scrollIntoView({ behavior: 'smooth' });
        }, 150);
      }
    } catch (err) {
      modalBody.innerHTML = `<div style="text-align: center; padding: 3rem; color: #ef4444;">${err.message}</div>`;
    }
  },

  calcLiveBookingTotal(price, mode) {
    const startInput = document.getElementById('book-start-date');
    const endInput = document.getElementById('book-end-date');
    const breakdown = document.getElementById('booking-price-breakdown');
    const submitBtn = document.getElementById('booking-submit-btn');
    const checkinTime = document.getElementById('book-checkin-time')?.value || '02:00 PM';
    const checkoutTime = document.getElementById('book-checkout-time')?.value || '11:00 AM';

    if (!startInput || !endInput || !breakdown) return;

    const startStr = startInput.value;
    const endStr = endInput.value;
    const start = new Date(startStr);
    const end = new Date(endStr);

    if (isNaN(start) || isNaN(end) || end <= start) {
      breakdown.innerHTML = '<div class="clash-feedback-box clash">❌ Check-out date must be after check-in date.</div>';
      if (submitBtn) submitBtn.disabled = true;
      return;
    }

    // Real-Time Conflict Detection against booked ranges
    const bookedDates = this.state.selectedPropertyBookedDates || [];
    let conflictFound = null;

    for (const b of bookedDates) {
      // Overlap formula: start < existing.end AND end > existing.start
      if (startStr < b.end_date && endStr > b.start_date) {
        conflictFound = b;
        break;
      }
    }

    if (conflictFound) {
      breakdown.innerHTML = `
        <div class="clash-feedback-box clash">
          <span>❌ Unavailable: Conflicts with existing booking (${conflictFound.start_date} to ${conflictFound.end_date})</span>
        </div>
      `;
      if (submitBtn) submitBtn.disabled = true;
      return;
    }

    // No conflict - calculate duration and total
    if (submitBtn) submitBtn.disabled = false;
    const diffDays = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));

    if (mode === 'rent') {
      const total = diffDays * Number(price);
      breakdown.innerHTML = `
        <div class="clash-feedback-box available">
          <span>✅ Selected Dates are 100% Available!</span>
        </div>
        <div style="background:var(--bg-main); border:1px solid var(--border); border-radius:var(--radius-sm); padding:0.6rem; margin-bottom:0.85rem; font-size:0.82rem;">
          <div style="display:flex; justify-content:space-between; margin-bottom: 0.2rem;">
            <span>${this.formatCurrency(price)} × ${diffDays} day${diffDays > 1 ? 's' : ''}</span>
            <span>${this.formatCurrency(total)}</span>
          </div>
          <div style="font-size:0.75rem; color:var(--text-muted); margin-bottom: 0.35rem;">
            Check-in: ${checkinTime} &bull; Check-out: ${checkoutTime}
          </div>
          <div style="display:flex; justify-content:space-between; font-weight:700; color:var(--secondary); border-top:1px solid var(--border); padding-top:0.3rem;">
            <span>Estimated Total Amount</span>
            <span>${this.formatCurrency(total)}</span>
          </div>
        </div>
      `;
    } else {
      breakdown.innerHTML = `
        <div class="clash-feedback-box available">
          <span>✅ Selected Date is Available for Viewing!</span>
        </div>
        <div style="background:var(--bg-main); border:1px solid var(--border); border-radius:var(--radius-sm); padding:0.6rem; margin-bottom:0.85rem; font-size:0.82rem;">
          <div style="display:flex; justify-content:space-between; font-weight:700; color:var(--secondary);">
            <span>Property Purchase Price</span>
            <span>${this.formatCurrency(price)}</span>
          </div>
          <div style="font-size:0.75rem; color:var(--text-muted); margin-top:0.25rem;">
            Appointment Time: ${checkinTime}
          </div>
        </div>
      `;
    }
  },

  autoSelectNextAvailableDates(price, mode) {
    const bookedDates = (this.state.selectedPropertyBookedDates || []).slice().sort((a, b) => a.start_date.localeCompare(b.start_date));
    let candidate = new Date();
    candidate.setDate(candidate.getDate() + 1);

    const isDateClashing = (startStr, endStr) => {
      for (const b of bookedDates) {
        if (startStr < b.end_date && endStr > b.start_date) return true;
      }
      return false;
    };

    // Find the first 4-day free window in the next 180 days
    for (let i = 0; i < 180; i++) {
      const s = new Date(candidate);
      s.setDate(candidate.getDate() + i);
      const e = new Date(s);
      e.setDate(s.getDate() + 3);

      const sStr = s.toISOString().split('T')[0];
      const eStr = e.toISOString().split('T')[0];

      if (!isDateClashing(sStr, eStr)) {
        const startInput = document.getElementById('book-start-date');
        const endInput = document.getElementById('book-end-date');
        if (startInput && endInput) {
          startInput.value = sStr;
          endInput.value = eStr;
          this.calcLiveBookingTotal(price, mode);
          this.showToast(`Auto-selected available window: ${sStr} to ${eStr}`, 'success');
        }
        return;
      }
    }
    this.showToast('Could not find open consecutive dates.', 'info');
  },

  async handleBookingSubmit(e, propertyId, price, mode) {
    e.preventDefault();
    if (!this.state.user) {
      this.showToast('Please sign in to book or inquire.', 'info');
      this.openAuthModal('login');
      return;
    }

    const start_date = document.getElementById('book-start-date').value;
    const end_date = document.getElementById('book-end-date').value;

    try {
      const res = await this.api('/api/bookings', {
        method: 'POST',
        body: JSON.stringify({ property_id: propertyId, start_date, end_date })
      });

      this.closeModal('property-modal');
      this.showToast('Booking request sent successfully to the owner!', 'success');
      this.showView('dashboard');
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  },

  // ---------------------------------------------------------------------------
  // MODULE 3 & 4 & 5: Dashboard (Role-Tailored)
  // ---------------------------------------------------------------------------
  async renderDashboard() {
    const container = document.getElementById('dashboard-content');
    if (!this.state.user) {
      container.innerHTML = `
        <div style="text-align: center; padding: 4rem 1rem;">
          <h2 style="font-size: 1.5rem; font-weight: 800; color: var(--secondary); margin-bottom: 0.5rem;">Access Your Dashboard</h2>
          <p style="color: var(--text-muted); margin-bottom: 1.5rem;">Please log in to view your bookings, saved wishlists, or manage your properties.</p>
          <div style="display:flex; gap: 0.5rem; justify-content: center;">
            <button class="btn btn-primary" onclick="app.openAuthModal('login')">Sign In</button>
          </div>
        </div>
      `;
      return;
    }

    const user = this.state.user;

    if (user.role === 'owner') {
      await this.renderOwnerDashboard(container);
    } else if (user.role === 'admin') {
      await this.renderAdminDashboard(container);
    } else {
      // Tenant or Buyer
      await this.renderTenantDashboard(container);
    }
  },

  // --- Tenant / Buyer Dashboard ---
  async renderTenantDashboard(container) {
    container.innerHTML = '<div style="text-align: center; padding: 3rem;">Loading your bookings and wishlist...</div>';

    try {
      const [bookings, wishlist] = await Promise.all([
        this.api('/api/bookings'),
        this.api('/api/wishlist')
      ]);

      if (!this.state.bookingsMap) this.state.bookingsMap = new Map();
      bookings.forEach(b => this.state.bookingsMap.set(b.booking_id, b));

      container.innerHTML = `
        <div class="dashboard-header">
          <div>
            <h2 class="section-title">Welcome, ${this.escapeHtml(this.state.user.name)}</h2>
            <p class="section-subtitle">Track your reservations, requests, and saved wishlist properties</p>
          </div>
          <span class="role-tag ${this.state.user.role}">${this.state.user.role}</span>
        </div>

        <div class="dashboard-tabs">
          <button class="dash-tab-btn ${this.state.dashboardTab === 'tab1' ? 'active' : ''}" onclick="app.switchDashTab('tab1')">
            My Bookings (${bookings.length})
          </button>
          <button class="dash-tab-btn ${this.state.dashboardTab === 'tab2' ? 'active' : ''}" onclick="app.switchDashTab('tab2')">
            My Wishlist (${wishlist.length})
          </button>
        </div>

        <!-- Tab 1: Bookings -->
        <div id="dash-tab1-content" style="display: ${this.state.dashboardTab === 'tab1' ? 'block' : 'none'};">
          ${bookings.length === 0 ? `
            <div style="text-align: center; padding: 3rem; color: var(--text-muted);">
              You haven't requested any property bookings yet.
              <div style="margin-top: 1rem;"><button class="btn btn-primary btn-sm" onclick="app.showView('listings')">Browse Available Properties</button></div>
            </div>
          ` : `
            <div class="table-responsive">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Booking ID</th>
                    <th>Property</th>
                    <th>Dates</th>
                    <th>Total Amount</th>
                    <th>Status</th>
                    <th>Payment</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  ${bookings.map(b => `
                    <tr>
                      <td><strong>#${b.booking_id}</strong></td>
                      <td>
                        <strong>${this.escapeHtml(b.property_title)}</strong>
                        <div style="font-size:0.75rem; color:var(--text-muted);">${this.escapeHtml(b.property_location)}</div>
                      </td>
                      <td>${b.start_date} &rarr; ${b.end_date}</td>
                      <td><strong>${this.formatCurrency(b.amount)}</strong></td>
                      <td><span class="badge badge-${b.status}">${b.status}</span></td>
                      <td><span class="badge badge-${b.payment_status}">${b.payment_status}</span></td>
                      <td>
                        <div style="display:flex; flex-direction:column; gap:0.35rem;">
                          ${(b.status === 'confirmed' || b.status === 'completed') ? `
                            <button class="btn btn-outline btn-sm" onclick="app.openReceiptModal(${b.booking_id})" title="Print Official Tax Invoice">
                              🖨️ Receipt
                            </button>
                          ` : ''}
                          ${b.status === 'completed' ? (
                            b.has_reviewed ? `
                              <span class="badge badge-completed">Reviewed (★ ${b.review_rating})</span>
                            ` : `
                              <button class="btn btn-primary btn-sm" onclick="app.openReviewModal(${b.booking_id}, '${this.escapeHtml(b.property_title)}')">
                                ★ Leave Review
                              </button>
                            `
                          ) : (b.status === 'pending' ? `
                            <button class="btn btn-outline btn-sm" style="color:var(--danger);" onclick="app.cancelBooking(${b.booking_id})">Cancel</button>
                          ` : '<span style="color:var(--text-light); font-size:0.8rem;">—</span>')}
                        </div>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `}
        </div>

        <!-- Tab 2: Wishlist -->
        <div id="dash-tab2-content" style="display: ${this.state.dashboardTab === 'tab2' ? 'block' : 'none'};">
          ${wishlist.length === 0 ? `
            <div style="text-align: center; padding: 3rem; color: var(--text-muted);">
              Your wishlist is currently empty. Click the heart icon on any property to save it here!
            </div>
          ` : `
            <div class="property-grid" style="margin-top: 1rem;">
              ${wishlist.map(w => `
                <div class="property-card">
                  <div class="card-image-wrap">
                    <img class="card-img" src="${w.image_url || 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=800&q=80'}" alt="${this.escapeHtml(w.title)}">
                    <div class="card-badges">
                      <span class="badge badge-${w.listing_mode}">${w.listing_mode}</span>
                    </div>
                  </div>
                  <div class="card-content">
                    <div class="card-price-row">
                      <div class="card-price">${this.formatCurrency(w.price)}</div>
                    </div>
                    <h3 class="card-title">${this.escapeHtml(w.title)}</h3>
                    <div class="card-location">${this.escapeHtml(w.location)}</div>
                    <div class="card-footer">
                      <button class="btn btn-primary btn-sm btn-block" onclick="app.openPropertyModal(${w.property_id})">View Details</button>
                      <button class="btn btn-outline btn-sm" style="color:var(--danger);" onclick="app.toggleWishlist(${w.property_id}, true)">Remove</button>
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>
          `}
        </div>
      `;
    } catch (err) {
      container.innerHTML = `<div style="color:#ef4444; padding:2rem; text-align:center;">Failed to load dashboard: ${err.message}</div>`;
    }
  },

  // --- Owner Dashboard ---
  async renderOwnerDashboard(container) {
    container.innerHTML = '<div style="text-align: center; padding: 3rem;">Loading owner listings and incoming requests...</div>';

    try {
      const [myProperties, incomingBookings] = await Promise.all([
        this.api('/api/properties/mine'),
        this.api('/api/bookings')
      ]);

      if (!this.state.bookingsMap) this.state.bookingsMap = new Map();
      incomingBookings.forEach(b => this.state.bookingsMap.set(b.booking_id, b));

      container.innerHTML = `
        <div class="dashboard-header">
          <div>
            <h2 class="section-title">Owner Management Hub</h2>
            <p class="section-subtitle">Manage your listings, review reservation inquiries, and track completed stays</p>
          </div>
          <button class="btn btn-primary" onclick="app.openPropertyFormModal()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            Add New Listing
          </button>
        </div>

        <div class="dashboard-tabs">
          <button class="dash-tab-btn ${this.state.dashboardTab === 'tab1' ? 'active' : ''}" onclick="app.switchDashTab('tab1')">
            Incoming Requests (${incomingBookings.length})
          </button>
          <button class="dash-tab-btn ${this.state.dashboardTab === 'tab2' ? 'active' : ''}" onclick="app.switchDashTab('tab2')">
            My Properties (${myProperties.length})
          </button>
        </div>

        <!-- Tab 1: Incoming Bookings -->
        <div id="dash-tab1-content" style="display: ${this.state.dashboardTab === 'tab1' ? 'block' : 'none'};">
          ${incomingBookings.length === 0 ? `
            <div style="text-align: center; padding: 3rem; color: var(--text-muted);">No booking requests received yet.</div>
          ` : `
            <div class="table-responsive">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Booking</th>
                    <th>Property</th>
                    <th>Guest Details</th>
                    <th>Dates</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Payment</th>
                    <th>Manage</th>
                  </tr>
                </thead>
                <tbody>
                  ${incomingBookings.map(b => `
                    <tr>
                      <td><strong>#${b.booking_id}</strong></td>
                      <td>
                        <strong>${this.escapeHtml(b.property_title)}</strong>
                        <div style="font-size:0.75rem; color:var(--text-muted);">${this.escapeHtml(b.property_location)}</div>
                      </td>
                      <td>
                        <div><strong>${this.escapeHtml(b.guest_name)}</strong></div>
                        <div style="font-size:0.75rem; color:var(--text-muted);">${this.escapeHtml(b.guest_email)}</div>
                        <div style="font-size:0.75rem; color:var(--text-muted);">${this.escapeHtml(b.guest_phone || '')}</div>
                      </td>
                      <td>${b.start_date} &rarr; ${b.end_date}</td>
                      <td><strong>${this.formatCurrency(b.amount)}</strong></td>
                      <td><span class="badge badge-${b.status}">${b.status}</span></td>
                      <td>
                        <span class="badge badge-${b.payment_status}">${b.payment_status}</span>
                        ${b.payment_status !== 'paid' ? `
                          <button class="btn btn-outline btn-sm" style="font-size:0.7rem; margin-top:0.25rem;" onclick="app.updateBookingPayment(${b.booking_id}, 'paid')">Mark Paid</button>
                        ` : ''}
                      </td>
                      <td>
                        <div style="display:flex; flex-direction:column; gap:0.3rem;">
                          <button class="btn btn-outline btn-sm" onclick="app.openReceiptModal(${b.booking_id})" title="View Official Tax Invoice">🖨️ Invoice</button>
                          ${b.status === 'pending' ? `
                            <button class="btn btn-success btn-sm" onclick="app.updateBookingStatus(${b.booking_id}, 'confirmed')">Accept</button>
                            <button class="btn btn-danger btn-sm" onclick="app.updateBookingStatus(${b.booking_id}, 'rejected')">Reject</button>
                          ` : (b.status === 'confirmed' ? `
                            <button class="btn btn-primary btn-sm" onclick="app.updateBookingStatus(${b.booking_id}, 'completed')">Mark Completed</button>
                          ` : `<span style="font-size:0.8rem; color:var(--text-light); text-transform:capitalize;">${b.status}</span>`)}
                        </div>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `}
        </div>

        <!-- Tab 2: My Properties -->
        <div id="dash-tab2-content" style="display: ${this.state.dashboardTab === 'tab2' ? 'block' : 'none'};">
          <div class="property-grid" style="margin-top: 1rem;">
            ${myProperties.map(p => `
              <div class="property-card">
                <div class="card-image-wrap">
                  <img class="card-img" src="${p.image_url || 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=800&q=80'}" alt="${this.escapeHtml(p.title)}">
                  <div class="card-badges">
                    <span class="badge badge-${p.listing_mode}">${p.listing_mode}</span>
                    <span class="badge badge-${p.status}">${p.status}</span>
                  </div>
                </div>
                <div class="card-content">
                  <div class="card-price-row">
                    <div class="card-price">${this.formatCurrency(p.price)}</div>
                    <div class="card-rating">
                      <span class="star-icon">★</span>
                      <span>${p.average_rating > 0 ? p.average_rating : 'New'}</span>
                    </div>
                  </div>
                  <h3 class="card-title">${this.escapeHtml(p.title)}</h3>
                  <div class="card-location">${this.escapeHtml(p.location)}</div>
                  <div class="card-footer">
                    <button class="btn btn-outline btn-sm btn-block" onclick="app.openEditPropertyModal(${JSON.stringify(p).replace(/"/g, '&quot;')})">Edit</button>
                    <button class="btn btn-outline btn-sm" style="color:var(--danger);" onclick="app.deleteProperty(${p.property_id})">Delete</button>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    } catch (err) {
      container.innerHTML = `<div style="color:#ef4444; padding:2rem; text-align:center;">Failed to load owner dashboard: ${err.message}</div>`;
    }
  },

  // --- Admin Dashboard ---
  async renderAdminDashboard(container) {
    container.innerHTML = '<div style="text-align: center; padding: 3rem;">Loading platform analytics & records...</div>';

    try {
      const [metrics, users, properties, bookings] = await Promise.all([
        this.api('/api/admin/metrics'),
        this.api('/api/admin/users'),
        this.api('/api/admin/properties'),
        this.api('/api/bookings')
      ]);

      container.innerHTML = `
        <div class="dashboard-header">
          <div>
            <h2 class="section-title">Platform Administration Overview</h2>
            <p class="section-subtitle">Real-time relational database oversight across all 5 modules</p>
          </div>
          <span class="role-tag admin">Administrator</span>
        </div>

        <div class="metrics-grid">
          <div class="metric-card">
            <span class="metric-label">Total Users</span>
            <span class="metric-value">${metrics.counts.users}</span>
          </div>
          <div class="metric-card">
            <span class="metric-label">Properties Listed</span>
            <span class="metric-value">${metrics.counts.properties}</span>
          </div>
          <div class="metric-card">
            <span class="metric-label">Total Bookings</span>
            <span class="metric-value">${metrics.counts.bookings}</span>
          </div>
          <div class="metric-card">
            <span class="metric-label">Verified Reviews</span>
            <span class="metric-value">${metrics.counts.reviews}</span>
          </div>
        </div>

        <div class="dashboard-tabs">
          <button class="dash-tab-btn ${this.state.dashboardTab === 'tab1' ? 'active' : ''}" onclick="app.switchDashTab('tab1')">
            Users (${users.length})
          </button>
          <button class="dash-tab-btn ${this.state.dashboardTab === 'tab2' ? 'active' : ''}" onclick="app.switchDashTab('tab2')">
            Properties (${properties.length})
          </button>
          <button class="dash-tab-btn ${this.state.dashboardTab === 'tab3' ? 'active' : ''}" onclick="app.switchDashTab('tab3')">
            Bookings (${bookings.length})
          </button>
        </div>

        <!-- Admin Tab 1: Users -->
        <div id="dash-tab1-content" style="display: ${this.state.dashboardTab === 'tab1' ? 'block' : 'none'};">
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Phone</th>
                  <th>Joined Date</th>
                </tr>
              </thead>
              <tbody>
                ${users.map(u => `
                  <tr>
                    <td>#${u.user_id}</td>
                    <td><strong>${this.escapeHtml(u.name)}</strong></td>
                    <td>${this.escapeHtml(u.email)}</td>
                    <td><span class="role-tag ${u.role}">${u.role}</span></td>
                    <td>${this.escapeHtml(u.phone || '—')}</td>
                    <td>${this.formatDate(u.created_at)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Admin Tab 2: Properties -->
        <div id="dash-tab2-content" style="display: ${this.state.dashboardTab === 'tab2' ? 'block' : 'none'};">
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Title</th>
                  <th>Owner</th>
                  <th>Location</th>
                  <th>Price</th>
                  <th>Mode / Type</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${properties.map(p => `
                  <tr>
                    <td>#${p.property_id}</td>
                    <td><strong>${this.escapeHtml(p.title)}</strong></td>
                    <td>${this.escapeHtml(p.owner_name)}</td>
                    <td>${this.escapeHtml(p.location)}</td>
                    <td>${this.formatCurrency(p.price)}</td>
                    <td><span class="badge badge-${p.listing_mode}">${p.listing_mode}</span> ${p.type}</td>
                    <td><span class="badge badge-${p.status}">${p.status}</span></td>
                    <td>
                      <button class="btn btn-outline btn-sm" style="color:var(--danger);" onclick="app.deleteProperty(${p.property_id})">Delete</button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Admin Tab 3: Bookings -->
        <div id="dash-tab3-content" style="display: ${this.state.dashboardTab === 'tab3' ? 'block' : 'none'};">
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Property</th>
                  <th>Guest</th>
                  <th>Dates</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Payment</th>
                </tr>
              </thead>
              <tbody>
                ${bookings.map(b => `
                  <tr>
                    <td>#${b.booking_id}</td>
                    <td><strong>${this.escapeHtml(b.property_title)}</strong></td>
                    <td>${this.escapeHtml(b.guest_name)}</td>
                    <td>${b.start_date} &rarr; ${b.end_date}</td>
                    <td>${this.formatCurrency(b.amount)}</td>
                    <td><span class="badge badge-${b.status}">${b.status}</span></td>
                    <td><span class="badge badge-${b.payment_status}">${b.payment_status}</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    } catch (err) {
      container.innerHTML = `<div style="color:#ef4444; padding:2rem; text-align:center;">Admin overview error: ${err.message}</div>`;
    }
  },

  switchDashTab(tabId) {
    this.state.dashboardTab = tabId;
    document.querySelectorAll('.dash-tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('[id^="dash-tab"]').forEach(el => el.style.display = 'none');

    const content = document.getElementById(`dash-${tabId}-content`);
    if (content) content.style.display = 'block';

    const activeBtn = event && event.target ? event.target : null;
    if (activeBtn) activeBtn.classList.add('active');
  },

  async updateBookingStatus(bookingId, status) {
    try {
      await this.api(`/api/bookings/${bookingId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status })
      });
      this.showToast(`Booking #${bookingId} marked as ${status}.`, 'success');
      this.renderDashboard();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  },

  async updateBookingPayment(bookingId, payment_status) {
    try {
      await this.api(`/api/bookings/${bookingId}`, {
        method: 'PATCH',
        body: JSON.stringify({ payment_status })
      });
      this.showToast(`Booking #${bookingId} payment marked as ${payment_status}.`, 'success');
      this.renderDashboard();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  },

  async cancelBooking(bookingId) {
    if (!confirm('Are you sure you want to cancel this booking request?')) return;
    try {
      await this.api(`/api/bookings/${bookingId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'cancelled' })
      });
      this.showToast('Booking request cancelled.', 'info');
      this.renderDashboard();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  },

  // ---------------------------------------------------------------------------
  // MODULE 4: Verified Reviews Modal
  // ---------------------------------------------------------------------------
  openReviewModal(bookingId, propertyTitle) {
    document.getElementById('rev-booking-id').value = bookingId;
    document.getElementById('rev-comment').value = '';
    this.setStarRating(5);
    this.openModal('review-modal');
  },

  setStarRating(val) {
    document.getElementById('rev-rating').value = val;
    const buttons = document.querySelectorAll('#star-rating-picker .star-btn');
    buttons.forEach((btn, idx) => {
      if (idx < val) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  },

  async handleSubmitReview(e) {
    e.preventDefault();
    const booking_id = document.getElementById('rev-booking-id').value;
    const rating = document.getElementById('rev-rating').value;
    const comment = document.getElementById('rev-comment').value;

    try {
      await this.api('/api/reviews', {
        method: 'POST',
        body: JSON.stringify({ booking_id, rating, comment })
      });

      this.closeModal('review-modal');
      this.showToast('Verified review published! Thank you.', 'success');
      this.renderDashboard();
      this.loadProperties();
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  },

  // ---------------------------------------------------------------------------
  // MODULE 3 EXTRA: Printable Booking Receipt & Invoice Generator
  // ---------------------------------------------------------------------------
  openReceiptModal(bookingId) {
    const b = this.state.bookingsMap?.get(bookingId);
    if (!b) {
      this.showToast('Booking details not found.', 'error');
      return;
    }

    const start = new Date(b.start_date);
    const end = new Date(b.end_date);
    const diffDays = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
    const invNumber = 'INV-2026-' + String(b.booking_id).padStart(4, '0');
    const issueDate = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    const isPaid = (b.payment_status === 'paid');

    const content = document.getElementById('receipt-printable-content');
    if (!content) return;

    content.innerHTML = `
      <div class="invoice-card">
        <div class="invoice-header-row">
          <div>
            <div class="invoice-brand-title">StaySpace Property Management</div>
            <div style="font-size:0.82rem; color:var(--text-muted);">Official Rental & Booking Tax Receipt</div>
            <div style="font-size:0.75rem; color:var(--text-light); margin-top:2px;">5-Module Relational DBMS Engine</div>
          </div>
          <div class="invoice-number-badge">
            <div class="invoice-no">${invNumber}</div>
            <div style="font-size:0.75rem; color:var(--text-muted);">Date: ${issueDate}</div>
          </div>
        </div>

        <div class="invoice-grid">
          <div class="invoice-box">
            <div class="invoice-box-title">Guest Details (Billed To)</div>
            <div style="font-weight:700; font-size:0.95rem; color:var(--secondary);">${this.escapeHtml(b.guest_name || this.state.user.name)}</div>
            <div style="color:var(--text-muted);">${this.escapeHtml(b.guest_email || this.state.user.email)}</div>
            <div style="color:var(--text-muted);">${this.escapeHtml(b.guest_phone || this.state.user.phone || '+91 Verified Mobile')}</div>
          </div>

          <div class="invoice-box">
            <div class="invoice-box-title">Property & Host Details</div>
            <div style="font-weight:700; font-size:0.95rem; color:var(--secondary);">${this.escapeHtml(b.property_title)}</div>
            <div style="color:var(--text-muted);">${this.escapeHtml(b.property_location)}</div>
            <div style="color:var(--text-muted);">Host: ${this.escapeHtml(b.owner_name || 'Verified Owner')} (${this.escapeHtml(b.owner_phone || '+91 98765 10101')})</div>
          </div>
        </div>

        <table class="invoice-table">
          <thead>
            <tr>
              <th>Description</th>
              <th>Check-In</th>
              <th>Check-Out</th>
              <th>Duration</th>
              <th style="text-align:right;">Total Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <strong>${b.listing_mode === 'rent' ? 'Property Rental Reservation' : 'Property Purchase Agreement Booking'}</strong><br>
                <span style="font-size:0.75rem; color:var(--text-muted);">${this.escapeHtml(b.property_title)} (${b.listing_mode.toUpperCase()})</span>
              </td>
              <td>${b.start_date}</td>
              <td>${b.end_date}</td>
              <td>${diffDays} day${diffDays > 1 ? 's' : ''}</td>
              <td style="text-align:right; font-weight:700;">${this.formatCurrency(b.amount)}</td>
            </tr>
          </tbody>
        </table>

        <div class="invoice-total-summary">
          <div class="invoice-total-box">
            <div class="invoice-total-line">
              <span>Subtotal</span>
              <span>${this.formatCurrency(b.amount)}</span>
            </div>
            <div class="invoice-total-line">
              <span>Service Fee / Tax (0%)</span>
              <span>₹0.00</span>
            </div>
            <div class="invoice-grand-total">
              <span>Grand Total</span>
              <span>${this.formatCurrency(b.amount)}</span>
            </div>
            <div style="text-align:center; margin-top:0.75rem;">
              <span class="invoice-stamp ${isPaid ? 'paid' : 'pending'}">
                ${isPaid ? '✔ PAYMENT COMPLETED' : '⏳ PAYMENT ' + b.payment_status.toUpperCase()}
              </span>
            </div>
          </div>
        </div>

        <div style="margin-top:1.5rem; font-size:0.72rem; color:var(--text-light); text-align:center; border-top:1px dashed var(--border); padding-top:0.8rem;">
          This is a computer-generated tax receipt from Property Management System. Verified database transaction ID: #${b.booking_id}.
        </div>
      </div>
    `;

    this.openModal('receipt-modal');
  },

  // ---------------------------------------------------------------------------
  // MODULE 5: Wishlist / Favorites

  // ---------------------------------------------------------------------------
  async loadWishlistIds() {
    try {
      const ids = await this.api('/api/wishlist/ids');
      this.state.wishlistIds = new Set(ids);
    } catch (err) {
      this.state.wishlistIds = new Set();
    }
  },

  async toggleWishlist(propertyId, refreshDashboard = false) {
    if (!this.state.user) {
      this.showToast('Sign in to save properties to your wishlist.', 'info');
      this.openAuthModal('login');
      return;
    }

    const isFav = this.state.wishlistIds.has(propertyId);
    try {
      if (isFav) {
        await this.api(`/api/wishlist/${propertyId}`, { method: 'DELETE' });
        this.state.wishlistIds.delete(propertyId);
        this.showToast('Removed from wishlist.', 'info');
      } else {
        await this.api(`/api/wishlist/${propertyId}`, { method: 'POST' });
        this.state.wishlistIds.add(propertyId);
        this.showToast('Added to your wishlist!', 'success');
      }

      if (refreshDashboard && this.state.currentView === 'dashboard') {
        this.renderDashboard();
      } else {
        this.renderProperties();
      }
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  },

  // ---------------------------------------------------------------------------
  // Property Add/Edit Modal (Owner / Admin)
  // ---------------------------------------------------------------------------
  openPropertyFormModal() {
    document.getElementById('property-form-title').textContent = 'List a New Property';
    document.getElementById('prop-form-id').value = '';
    document.getElementById('prop-title').value = '';
    document.getElementById('prop-desc').value = '';
    document.getElementById('prop-location').value = '';
    document.getElementById('prop-price').value = '';
    document.getElementById('prop-type').value = 'apartment';
    document.getElementById('prop-mode').value = 'rent';
    document.getElementById('prop-image').value = '';
    document.getElementById('prop-form-submit-btn').textContent = 'Publish Listing';
    this.openModal('property-form-modal');
  },

  openEditPropertyModal(prop) {
    document.getElementById('property-form-title').textContent = 'Edit Property Listing';
    document.getElementById('prop-form-id').value = prop.property_id;
    document.getElementById('prop-title').value = prop.title;
    document.getElementById('prop-desc').value = prop.description;
    document.getElementById('prop-location').value = prop.location;
    document.getElementById('prop-price').value = prop.price;
    document.getElementById('prop-type').value = prop.type;
    document.getElementById('prop-mode').value = prop.listing_mode;
    document.getElementById('prop-image').value = prop.image_url || '';
    document.getElementById('prop-form-submit-btn').textContent = 'Update Listing';
    this.openModal('property-form-modal');
  },

  async handleSaveProperty(e) {
    e.preventDefault();
    const id = document.getElementById('prop-form-id').value;
    const title = document.getElementById('prop-title').value;
    const description = document.getElementById('prop-desc').value;
    const location = document.getElementById('prop-location').value;
    const price = document.getElementById('prop-price').value;
    const type = document.getElementById('prop-type').value;
    const listing_mode = document.getElementById('prop-mode').value;
    const image_url = document.getElementById('prop-image').value;

    const payload = { title, description, location, price, type, listing_mode, image_url };

    try {
      if (id) {
        await this.api(`/api/properties/${id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload)
        });
        this.showToast('Property updated successfully!', 'success');
      } else {
        await this.api('/api/properties', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        this.showToast('New property listing published!', 'success');
      }

      this.closeModal('property-form-modal');
      this.loadProperties();
      if (this.state.currentView === 'dashboard') {
        this.renderDashboard();
      }
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  },

  async deleteProperty(propertyId) {
    if (!confirm('Are you sure you want to delete this property? This will also remove associated bookings.')) return;
    try {
      await this.api(`/api/properties/${propertyId}`, { method: 'DELETE' });
      this.showToast('Property deleted.', 'info');
      this.loadProperties();
      if (this.state.currentView === 'dashboard') {
        this.renderDashboard();
      }
    } catch (err) {
      this.showToast(err.message, 'error');
    }
  },

  // ---------------------------------------------------------------------------
  // Modal & Toast Helpers
  // ---------------------------------------------------------------------------
  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('active');
  },

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active');
  },

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
      <span>${this.escapeHtml(message)}</span>
    `;

    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  },

  // ---------------------------------------------------------------------------
  // Formatters & Utilities
  // ---------------------------------------------------------------------------
  formatCurrency(amount) {
    const num = Number(amount);
    if (isNaN(num)) return '₹0';
    return '₹' + num.toLocaleString('en-IN');
  },

  formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return isNaN(d) ? dateStr : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  },

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
};

// Initialize App on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  app.init();
});
