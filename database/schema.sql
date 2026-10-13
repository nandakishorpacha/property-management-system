-- ==========================================================
-- PROPERTY MANAGEMENT SYSTEM (5-Module Relational DBMS)
-- Database Schema Definition
-- Modules:
--   1. Users (Auth, Roles: Owner, Tenant, Buyer, Admin)
--   2. Properties (Listings, Search & Filter, Ownership)
--   3. Bookings (Rental & Purchase Requests, Availability)
--   4. Reviews & Ratings (Verified Post-Booking Feedback)
--   5. Wishlist / Favorites (Personal Saved Properties)
-- ==========================================================

CREATE DATABASE IF NOT EXISTS property_management
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE property_management;

-- ----------------------------------------------------------
-- MODULE 1: USERS
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  user_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  role ENUM('owner', 'tenant', 'buyer', 'admin') NOT NULL DEFAULT 'tenant',
  password VARCHAR(255) NOT NULL,
  phone VARCHAR(25),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ----------------------------------------------------------
-- MODULE 2: PROPERTIES
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS properties (
  property_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  owner_id INT UNSIGNED NOT NULL,
  title VARCHAR(180) NOT NULL,
  description TEXT NOT NULL,
  location VARCHAR(180) NOT NULL,
  price DECIMAL(12,2) NOT NULL,
  type ENUM('apartment', 'house', 'villa', 'commercial', 'land') NOT NULL,
  listing_mode ENUM('rent', 'sale') NOT NULL DEFAULT 'rent',
  status ENUM('available', 'unavailable', 'sold') NOT NULL DEFAULT 'available',
  image_url VARCHAR(500),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_properties_owner FOREIGN KEY (owner_id) REFERENCES users(user_id) ON DELETE CASCADE,
  INDEX idx_properties_search (location, type, status, price)
) ENGINE=InnoDB;

-- ----------------------------------------------------------
-- MODULE 3: BOOKINGS
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS bookings (
  booking_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  property_id INT UNSIGNED NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status ENUM('pending', 'confirmed', 'rejected', 'completed', 'cancelled') NOT NULL DEFAULT 'pending',
  amount DECIMAL(12,2) NOT NULL,
  payment_status ENUM('pending', 'paid', 'refunded') NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_booking_dates CHECK (end_date > start_date),
  CONSTRAINT fk_bookings_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  CONSTRAINT fk_bookings_property FOREIGN KEY (property_id) REFERENCES properties(property_id) ON DELETE CASCADE,
  INDEX idx_bookings_property_dates (property_id, start_date, end_date)
) ENGINE=InnoDB;

-- ----------------------------------------------------------
-- MODULE 4: REVIEWS & RATINGS
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS reviews (
  review_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  property_id INT UNSIGNED NOT NULL,
  booking_id INT UNSIGNED NOT NULL UNIQUE,
  rating TINYINT UNSIGNED NOT NULL,
  comment TEXT NOT NULL,
  review_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_review_rating CHECK (rating BETWEEN 1 AND 5),
  CONSTRAINT fk_reviews_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  CONSTRAINT fk_reviews_property FOREIGN KEY (property_id) REFERENCES properties(property_id) ON DELETE CASCADE,
  CONSTRAINT fk_reviews_booking FOREIGN KEY (booking_id) REFERENCES bookings(booking_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ----------------------------------------------------------
-- MODULE 5: WISHLIST / FAVORITES
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS wishlist (
  wishlist_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  property_id INT UNSIGNED NOT NULL,
  added_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_wishlist_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  CONSTRAINT fk_wishlist_property FOREIGN KEY (property_id) REFERENCES properties(property_id) ON DELETE CASCADE,
  CONSTRAINT uq_wishlist_user_property UNIQUE (user_id, property_id)
) ENGINE=InnoDB;
