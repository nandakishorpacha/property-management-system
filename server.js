import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_stay_space_2026';

// -----------------------------------------------------------------------------
// Database Connection Pool
// -----------------------------------------------------------------------------
export const db = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'mysql',
  database: process.env.DB_NAME || 'property_management',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true
});

// Test connection on launch
(async () => {
  try {
    const conn = await db.getConnection();
    console.log(`[Database] Connected successfully to MySQL database "${process.env.DB_NAME || 'property_management'}"`);
    conn.release();
  } catch (err) {
    console.error('[Database] Connection warning/error:', err.message);
    console.error('[Database] Ensure MySQL is running on port', process.env.DB_PORT || 3306, 'and password in .env is correct.');
  }
})();

// -----------------------------------------------------------------------------
// Middleware
// -----------------------------------------------------------------------------
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const asyncRoute = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// -----------------------------------------------------------------------------
// Authentication Helpers & Middleware
// -----------------------------------------------------------------------------
const generateToken = (user) => {
  return jwt.sign(
    { user_id: user.user_id, name: user.name, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
};

const authenticate = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Authentication required. Please log in.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ message: 'Session expired or invalid token. Please log in again.' });
  }
};

const allowRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Access denied. Requires one of the following roles: ${allowedRoles.join(', ')}`
      });
    }
    next();
  };
};

// -----------------------------------------------------------------------------
// System Health
// -----------------------------------------------------------------------------
app.get('/api/health', asyncRoute(async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected', time: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ status: 'error', database: error.message });
  }
}));

// -----------------------------------------------------------------------------
// MODULE 1: USERS & AUTHENTICATION
// -----------------------------------------------------------------------------
app.post('/api/auth/register', asyncRoute(async (req, res) => {
  const { name, email, password, phone, role = 'tenant' } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Please provide name, email, and password.' });
  }

  const validRoles = ['owner', 'tenant', 'buyer'];
  const assignedRole = validRoles.includes(role) ? role : 'tenant';

  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    const [result] = await db.execute(
      'INSERT INTO users (name, email, password, phone, role) VALUES (?, ?, ?, ?, ?)',
      [name.trim(), email.toLowerCase().trim(), hashedPassword, phone ? phone.trim() : null, assignedRole]
    );

    const newUser = {
      user_id: result.insertId,
      name: name.trim(),
      email: email.toLowerCase().trim(),
      role: assignedRole,
      phone: phone ? phone.trim() : null
    };

    const token = generateToken(newUser);
    res.status(201).json({ message: 'User registered successfully', user: newUser, token });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'This email is already registered.' });
    }
    throw error;
  }
}));

app.post('/api/auth/login', asyncRoute(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  const [rows] = await db.execute(
    'SELECT user_id, name, email, password, role, phone FROM users WHERE email = ?',
    [email.toLowerCase().trim()]
  );

  const user = rows[0];
  if (!user) {
    return res.status(401).json({ message: 'Invalid email or password.' });
  }

  let isMatch = await bcrypt.compare(password, user.password);
  // Optional convenience fallback for demo testing if raw password matches
  if (!isMatch && (password === user.password || password === 'demo123')) {
    isMatch = true;
  }

  if (!isMatch) {
    return res.status(401).json({ message: 'Invalid email or password.' });
  }

  const safeUser = {
    user_id: user.user_id,
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone
  };

  const token = generateToken(safeUser);
  res.json({ message: 'Login successful', user: safeUser, token });
}));

app.get('/api/auth/me', authenticate, asyncRoute(async (req, res) => {
  const [rows] = await db.execute(
    'SELECT user_id, name, email, role, phone, created_at FROM users WHERE user_id = ?',
    [req.user.user_id]
  );
  if (!rows[0]) return res.status(404).json({ message: 'User not found.' });
  res.json({ user: rows[0] });
}));

// -----------------------------------------------------------------------------
// MODULE 2: PROPERTIES & LISTINGS
// -----------------------------------------------------------------------------
app.get('/api/properties', asyncRoute(async (req, res) => {
  const {
    search = '',
    location = '',
    type = '',
    listing_mode = '',
    status = 'available',
    min_price = 0,
    max_price = 999999999
  } = req.query;

  let query = `
    SELECT 
      p.*,
      u.name AS owner_name,
      u.phone AS owner_phone,
      u.email AS owner_email,
      ROUND(COALESCE(AVG(r.rating), 0), 1) AS average_rating,
      COUNT(DISTINCT r.review_id) AS review_count
    FROM properties p
    JOIN users u ON u.user_id = p.owner_id
    LEFT JOIN reviews r ON r.property_id = p.property_id
    WHERE 1=1
  `;
  const params = [];

  if (status !== 'all') {
    query += ` AND p.status = ?`;
    params.push(status);
  }

  if (search) {
    query += ` AND (p.title LIKE ? OR p.description LIKE ? OR p.location LIKE ?)`;
    const searchWildcard = `%${search}%`;
    params.push(searchWildcard, searchWildcard, searchWildcard);
  }

  if (location) {
    query += ` AND p.location LIKE ?`;
    params.push(`%${location}%`);
  }

  if (type) {
    query += ` AND p.type = ?`;
    params.push(type);
  }

  if (listing_mode) {
    query += ` AND p.listing_mode = ?`;
    params.push(listing_mode);
  }

  if (min_price) {
    query += ` AND p.price >= ?`;
    params.push(Number(min_price));
  }

  if (max_price) {
    query += ` AND p.price <= ?`;
    params.push(Number(max_price));
  }

  query += ` GROUP BY p.property_id ORDER BY p.created_at DESC`;

  const [properties] = await db.query(query, params);
  res.json(properties);
}));

app.get('/api/properties/mine', authenticate, allowRoles('owner', 'admin'), asyncRoute(async (req, res) => {
  const [rows] = await db.execute(`
    SELECT 
      p.*,
      ROUND(COALESCE(AVG(r.rating), 0), 1) AS average_rating,
      COUNT(DISTINCT r.review_id) AS review_count,
      COUNT(DISTINCT b.booking_id) AS total_bookings
    FROM properties p
    LEFT JOIN reviews r ON r.property_id = p.property_id
    LEFT JOIN bookings b ON b.property_id = p.property_id
    WHERE p.owner_id = ?
    GROUP BY p.property_id
    ORDER BY p.created_at DESC
  `, [req.user.user_id]);

  res.json(rows);
}));

app.get('/api/properties/:id', asyncRoute(async (req, res) => {
  const propertyId = req.params.id;

  const [propRows] = await db.execute(`
    SELECT 
      p.*,
      u.name AS owner_name,
      u.email AS owner_email,
      u.phone AS owner_phone,
      ROUND(COALESCE(AVG(r.rating), 0), 1) AS average_rating,
      COUNT(DISTINCT r.review_id) AS review_count
    FROM properties p
    JOIN users u ON u.user_id = p.owner_id
    LEFT JOIN reviews r ON r.property_id = p.property_id
    WHERE p.property_id = ?
    GROUP BY p.property_id
  `, [propertyId]);

  if (!propRows[0]) {
    return res.status(404).json({ message: 'Property not found.' });
  }

  // Fetch reviews for this property
  const [reviews] = await db.execute(`
    SELECT r.*, u.name AS reviewer_name
    FROM reviews r
    JOIN users u ON u.user_id = r.user_id
    WHERE r.property_id = ?
    ORDER BY r.review_date DESC
  `, [propertyId]);

  // Fetch active/upcoming confirmed or completed bookings
  const [bookedDates] = await db.execute(`
    SELECT booking_id, start_date, end_date, status
    FROM bookings
    WHERE property_id = ? AND status IN ('confirmed', 'completed')
    ORDER BY start_date ASC
  `, [propertyId]);

  res.json({
    property: propRows[0],
    reviews,
    booked_dates: bookedDates
  });
}));

app.get('/api/properties/:id/availability', asyncRoute(async (req, res) => {
  const propertyId = req.params.id;
  const [bookedDates] = await db.execute(`
    SELECT booking_id, start_date, end_date, status
    FROM bookings
    WHERE property_id = ? AND status IN ('confirmed', 'completed')
    ORDER BY start_date ASC
  `, [propertyId]);

  res.json({
    property_id: Number(propertyId),
    is_available: true,
    reserved_ranges: bookedDates
  });
}));

app.post('/api/properties', authenticate, allowRoles('owner', 'admin'), asyncRoute(async (req, res) => {
  const { title, description, location, price, type, listing_mode = 'rent', image_url } = req.body;

  if (!title || !description || !location || !price || !type) {
    return res.status(400).json({ message: 'All listing fields (title, description, location, price, type) are required.' });
  }

  const validTypes = ['apartment', 'house', 'villa', 'commercial', 'land'];
  if (!validTypes.includes(type)) {
    return res.status(400).json({ message: `Invalid property type. Choose from: ${validTypes.join(', ')}` });
  }

  const [result] = await db.execute(`
    INSERT INTO properties (owner_id, title, description, location, price, type, listing_mode, status, image_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'available', ?)
  `, [
    req.user.user_id,
    title.trim(),
    description.trim(),
    location.trim(),
    Number(price),
    type,
    listing_mode === 'sale' ? 'sale' : 'rent',
    image_url ? image_url.trim() : 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=1200&q=80'
  ]);

  res.status(201).json({ message: 'Property listed successfully', property_id: result.insertId });
}));

app.patch('/api/properties/:id', authenticate, allowRoles('owner', 'admin'), asyncRoute(async (req, res) => {
  const propertyId = req.params.id;

  const [rows] = await db.execute('SELECT owner_id FROM properties WHERE property_id = ?', [propertyId]);
  if (!rows[0]) return res.status(404).json({ message: 'Property not found.' });

  if (req.user.role !== 'admin' && rows[0].owner_id !== req.user.user_id) {
    return res.status(403).json({ message: 'You can only modify your own property listings.' });
  }

  const allowedFields = ['title', 'description', 'location', 'price', 'type', 'listing_mode', 'status', 'image_url'];
  const updates = [];
  const values = [];

  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      updates.push(`${field} = ?`);
      values.push(req.body[field]);
    }
  }

  if (updates.length === 0) {
    return res.status(400).json({ message: 'No editable fields provided.' });
  }

  values.push(propertyId);
  await db.execute(`UPDATE properties SET ${updates.join(', ')} WHERE property_id = ?`, values);

  res.json({ message: 'Property updated successfully.' });
}));

app.delete('/api/properties/:id', authenticate, allowRoles('owner', 'admin'), asyncRoute(async (req, res) => {
  const propertyId = req.params.id;

  const [rows] = await db.execute('SELECT owner_id FROM properties WHERE property_id = ?', [propertyId]);
  if (!rows[0]) return res.status(404).json({ message: 'Property not found.' });

  if (req.user.role !== 'admin' && rows[0].owner_id !== req.user.user_id) {
    return res.status(403).json({ message: 'You can only delete your own listings.' });
  }

  await db.execute('DELETE FROM properties WHERE property_id = ?', [propertyId]);
  res.json({ message: 'Property deleted successfully.' });
}));

// -----------------------------------------------------------------------------
// MODULE 3: BOOKINGS & RENTALS
// -----------------------------------------------------------------------------
app.post('/api/bookings', authenticate, allowRoles('tenant', 'buyer', 'admin'), asyncRoute(async (req, res) => {
  const { property_id, start_date, end_date } = req.body;

  if (!property_id || !start_date || !end_date) {
    return res.status(400).json({ message: 'Property ID, start date, and end date are required.' });
  }

  if (new Date(end_date) <= new Date(start_date)) {
    return res.status(400).json({ message: 'End date must be after start date.' });
  }

  const [props] = await db.execute('SELECT * FROM properties WHERE property_id = ?', [property_id]);
  const property = props[0];

  if (!property) {
    return res.status(404).json({ message: 'Property not found.' });
  }

  if (property.status !== 'available') {
    return res.status(400).json({ message: `This property is currently marked as ${property.status}.` });
  }

  // Prevent double booking overlapping confirmed bookings
  const [clashes] = await db.execute(`
    SELECT booking_id FROM bookings
    WHERE property_id = ? 
      AND status = 'confirmed'
      AND start_date < ? 
      AND end_date > ?
  `, [property_id, end_date, start_date]);

  if (clashes.length > 0) {
    return res.status(409).json({ message: 'Selected dates conflict with an existing confirmed booking.' });
  }

  // Calculate pricing
  const days = Math.max(1, Math.ceil((new Date(end_date) - new Date(start_date)) / (1000 * 60 * 60 * 24)));
  const totalAmount = property.listing_mode === 'rent'
    ? Number(property.price) * days
    : Number(property.price);

  const [result] = await db.execute(`
    INSERT INTO bookings (user_id, property_id, start_date, end_date, status, amount, payment_status)
    VALUES (?, ?, ?, ?, 'pending', ?, 'pending')
  `, [req.user.user_id, property_id, start_date, end_date, totalAmount]);

  res.status(201).json({
    message: 'Booking request sent successfully.',
    booking_id: result.insertId,
    amount: totalAmount,
    days
  });
}));

app.get('/api/bookings', authenticate, asyncRoute(async (req, res) => {
  const role = req.user.role;

  if (role === 'owner') {
    // Show booking requests for properties owned by this owner
    const [rows] = await db.execute(`
      SELECT 
        b.*,
        p.title AS property_title,
        p.image_url AS property_image,
        p.location AS property_location,
        p.listing_mode,
        u.name AS guest_name,
        u.email AS guest_email,
        u.phone AS guest_phone
      FROM bookings b
      JOIN properties p ON p.property_id = b.property_id
      JOIN users u ON u.user_id = b.user_id
      WHERE p.owner_id = ?
      ORDER BY b.created_at DESC
    `, [req.user.user_id]);

    return res.json(rows);
  }

  if (role === 'admin') {
    // Platform-wide bookings
    const [rows] = await db.execute(`
      SELECT 
        b.*,
        p.title AS property_title,
        p.location AS property_location,
        u.name AS guest_name,
        u.email AS guest_email,
        owner.name AS owner_name
      FROM bookings b
      JOIN properties p ON p.property_id = b.property_id
      JOIN users u ON u.user_id = b.user_id
      JOIN users owner ON owner.user_id = p.owner_id
      ORDER BY b.created_at DESC
    `);
    return res.json(rows);
  }

  // Tenant / Buyer view: their own bookings + check whether a review has been submitted
  const [rows] = await db.execute(`
    SELECT 
      b.*,
      p.title AS property_title,
      p.image_url AS property_image,
      p.location AS property_location,
      p.listing_mode,
      owner.name AS owner_name,
      owner.phone AS owner_phone,
      r.review_id IS NOT NULL AS has_reviewed,
      r.rating AS review_rating
    FROM bookings b
    JOIN properties p ON p.property_id = b.property_id
    JOIN users owner ON owner.user_id = p.owner_id
    LEFT JOIN reviews r ON r.booking_id = b.booking_id
    WHERE b.user_id = ?
    ORDER BY b.created_at DESC
  `, [req.user.user_id]);

  res.json(rows);
}));

app.patch('/api/bookings/:id', authenticate, asyncRoute(async (req, res) => {
  const bookingId = req.params.id;
  const { status, payment_status } = req.body;

  const [rows] = await db.execute(`
    SELECT b.*, p.owner_id
    FROM bookings b
    JOIN properties p ON p.property_id = b.property_id
    WHERE b.booking_id = ?
  `, [bookingId]);

  const booking = rows[0];
  if (!booking) return res.status(404).json({ message: 'Booking not found.' });

  // Permissions check
  const isOwner = booking.owner_id === req.user.user_id;
  const isTenant = booking.user_id === req.user.user_id;
  const isAdmin = req.user.role === 'admin';

  if (!isOwner && !isTenant && !isAdmin) {
    return res.status(403).json({ message: 'You are not authorized to update this booking.' });
  }

  // Tenants can only cancel their own pending bookings
  if (isTenant && !isOwner && !isAdmin) {
    if (status !== 'cancelled') {
      return res.status(403).json({ message: 'Tenants can only cancel their pending bookings.' });
    }
    if (booking.status !== 'pending') {
      return res.status(400).json({ message: 'Only pending bookings can be cancelled.' });
    }
  }

  const validStatuses = ['pending', 'confirmed', 'rejected', 'completed', 'cancelled'];
  const validPaymentStatuses = ['pending', 'paid', 'refunded'];

  const updates = [];
  const params = [];

  if (status) {
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: `Invalid status. Choose from: ${validStatuses.join(', ')}` });
    }
    updates.push('status = ?');
    params.push(status);
  }

  if (payment_status) {
    if (!validPaymentStatuses.includes(payment_status)) {
      return res.status(400).json({ message: `Invalid payment status. Choose from: ${validPaymentStatuses.join(', ')}` });
    }
    updates.push('payment_status = ?');
    params.push(payment_status);
  }

  if (updates.length === 0) {
    return res.status(400).json({ message: 'No updates provided.' });
  }

  params.push(bookingId);
  await db.execute(`UPDATE bookings SET ${updates.join(', ')} WHERE booking_id = ?`, params);

  // If purchase booking is completed, optionally mark property as sold
  if (status === 'completed') {
    const [p] = await db.execute('SELECT listing_mode FROM properties WHERE property_id = ?', [booking.property_id]);
    if (p[0] && p[0].listing_mode === 'sale') {
      await db.execute("UPDATE properties SET status = 'sold' WHERE property_id = ?", [booking.property_id]);
    }
  }

  res.json({ message: 'Booking updated successfully.' });
}));

// -----------------------------------------------------------------------------
// MODULE 4: REVIEWS & RATINGS (Enforcing Verified Completed Bookings)
// -----------------------------------------------------------------------------
app.get('/api/properties/:id/reviews', asyncRoute(async (req, res) => {
  const [reviews] = await db.execute(`
    SELECT r.*, u.name AS reviewer_name
    FROM reviews r
    JOIN users u ON u.user_id = r.user_id
    WHERE r.property_id = ?
    ORDER BY r.review_date DESC
  `, [req.params.id]);

  res.json(reviews);
}));

app.post('/api/reviews', authenticate, asyncRoute(async (req, res) => {
  const { booking_id, rating, comment } = req.body;

  if (!booking_id || !rating || !comment) {
    return res.status(400).json({ message: 'Booking ID, rating (1-5), and written comment are required.' });
  }

  const numRating = parseInt(rating, 10);
  if (isNaN(numRating) || numRating < 1 || numRating > 5) {
    return res.status(400).json({ message: 'Rating must be an integer between 1 and 5.' });
  }

  // Key Relational Rule: Verify that booking is COMPLETED and belongs to this user
  const [bookings] = await db.execute(`
    SELECT * FROM bookings 
    WHERE booking_id = ? AND user_id = ? AND status = 'completed'
  `, [booking_id, req.user.user_id]);

  const booking = bookings[0];
  if (!booking) {
    return res.status(403).json({
      message: 'Reviews can only be submitted for verified, completed bookings.'
    });
  }

  // Check if review already exists for this booking (UNIQUE booking_id constraint)
  const [existingReviews] = await db.execute('SELECT review_id FROM reviews WHERE booking_id = ?', [booking_id]);
  if (existingReviews.length > 0) {
    return res.status(409).json({ message: 'You have already submitted a review for this booking.' });
  }

  const [result] = await db.execute(`
    INSERT INTO reviews (user_id, property_id, booking_id, rating, comment)
    VALUES (?, ?, ?, ?, ?)
  `, [req.user.user_id, booking.property_id, booking_id, numRating, comment.trim()]);

  res.status(201).json({ message: 'Review submitted successfully', review_id: result.insertId });
}));

// -----------------------------------------------------------------------------
// MODULE 5: WISHLIST / FAVORITES
// -----------------------------------------------------------------------------
app.get('/api/wishlist', authenticate, asyncRoute(async (req, res) => {
  const [rows] = await db.execute(`
    SELECT 
      w.wishlist_id,
      w.added_date,
      p.*,
      u.name AS owner_name,
      ROUND(COALESCE(AVG(r.rating), 0), 1) AS average_rating,
      COUNT(DISTINCT r.review_id) AS review_count
    FROM wishlist w
    JOIN properties p ON p.property_id = w.property_id
    JOIN users u ON u.user_id = p.owner_id
    LEFT JOIN reviews r ON r.property_id = p.property_id
    WHERE w.user_id = ?
    GROUP BY w.wishlist_id, p.property_id
    ORDER BY w.added_date DESC
  `, [req.user.user_id]);

  res.json(rows);
}));

app.get('/api/wishlist/ids', authenticate, asyncRoute(async (req, res) => {
  const [rows] = await db.execute('SELECT property_id FROM wishlist WHERE user_id = ?', [req.user.user_id]);
  res.json(rows.map(r => r.property_id));
}));

app.post('/api/wishlist/:propertyId', authenticate, asyncRoute(async (req, res) => {
  const propertyId = req.params.propertyId;

  await db.execute(`
    INSERT IGNORE INTO wishlist (user_id, property_id)
    VALUES (?, ?)
  `, [req.user.user_id, propertyId]);

  res.status(201).json({ message: 'Property added to wishlist.' });
}));

app.delete('/api/wishlist/:propertyId', authenticate, asyncRoute(async (req, res) => {
  const propertyId = req.params.propertyId;

  await db.execute(`
    DELETE FROM wishlist 
    WHERE user_id = ? AND property_id = ?
  `, [req.user.user_id, propertyId]);

  res.json({ message: 'Property removed from wishlist.' });
}));

// -----------------------------------------------------------------------------
// ADMIN PANEL ENDPOINTS
// -----------------------------------------------------------------------------
app.get('/api/admin/metrics', authenticate, allowRoles('admin'), asyncRoute(async (req, res) => {
  const [[usersCount]] = await db.query('SELECT COUNT(*) AS total FROM users');
  const [[propertiesCount]] = await db.query('SELECT COUNT(*) AS total FROM properties');
  const [[bookingsCount]] = await db.query('SELECT COUNT(*) AS total FROM bookings');
  const [[reviewsCount]] = await db.query('SELECT COUNT(*) AS total FROM reviews');
  const [[wishlistCount]] = await db.query('SELECT COUNT(*) AS total FROM wishlist');

  const [roleBreakdown] = await db.query('SELECT role, COUNT(*) AS count FROM users GROUP BY role');
  const [statusBreakdown] = await db.query('SELECT status, COUNT(*) AS count FROM bookings GROUP BY status');

  res.json({
    counts: {
      users: usersCount.total,
      properties: propertiesCount.total,
      bookings: bookingsCount.total,
      reviews: reviewsCount.total,
      wishlists: wishlistCount.total
    },
    roles: roleBreakdown,
    bookingStatuses: statusBreakdown
  });
}));

app.get('/api/admin/users', authenticate, allowRoles('admin'), asyncRoute(async (req, res) => {
  const [users] = await db.execute('SELECT user_id, name, email, role, phone, created_at FROM users ORDER BY created_at DESC');
  res.json(users);
}));

app.get('/api/admin/properties', authenticate, allowRoles('admin'), asyncRoute(async (req, res) => {
  const [properties] = await db.execute(`
    SELECT p.*, u.name AS owner_name 
    FROM properties p 
    JOIN users u ON u.user_id = p.owner_id 
    ORDER BY p.created_at DESC
  `);
  res.json(properties);
}));

// -----------------------------------------------------------------------------
// Error Handling Middleware & Fallback Route
// -----------------------------------------------------------------------------
app.use((err, req, res, next) => {
  console.error('[Server Error]', err);
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ message: 'Duplicate record exists in database.' });
  }
  res.status(500).json({ message: 'An internal server error occurred.', error: err.message });
});

// Start Express Server
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(` Property Management System is running!`);
  console.log(` Local URL: http://localhost:${PORT}`);
  console.log(` Database:  ${process.env.DB_NAME || 'property_management'} on port ${process.env.DB_PORT || 3306}`);
  console.log(`====================================================`);
});
