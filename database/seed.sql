-- ==========================================================
-- PROPERTY MANAGEMENT SYSTEM - Sample Seed Data
-- ==========================================================

USE property_management;

-- Clear previous data in correct foreign key order
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE wishlist;
TRUNCATE TABLE reviews;
TRUNCATE TABLE bookings;
TRUNCATE TABLE properties;
TRUNCATE TABLE users;
SET FOREIGN_KEY_CHECKS = 1;

-- Seed Users
-- Passwords:
-- ananya.owner@homekey.demo  -> Owner@123
-- rahul.owner@homekey.demo   -> Owner@123
-- meera.tenant@homekey.demo  -> Tenant@123
-- arjun.buyer@homekey.demo   -> Buyer@123
-- admin@homekey.demo         -> Admin@123
INSERT INTO users (user_id, name, email, role, password, phone) VALUES
(1, 'Ananya Iyer', 'ananya.owner@homekey.demo', 'owner', '$2a$12$hcK1h6umI85rDcFdvuzT0uvq5acMe618LO1JdQ1PIpVIm5CHmzkYi', '+91 98765 10101'),
(2, 'Rahul Menon', 'rahul.owner@homekey.demo', 'owner', '$2a$12$hcK1h6umI85rDcFdvuzT0uvq5acMe618LO1JdQ1PIpVIm5CHmzkYi', '+91 98765 20202'),
(3, 'Meera Nair', 'meera.tenant@homekey.demo', 'tenant', '$2a$12$KfgCow8.bGRqZrKK.vD6Kenp5a.o5y./DPYHrOR20XdnWCOoYAz2y', '+91 98765 30303'),
(4, 'Arjun Das', 'arjun.buyer@homekey.demo', 'buyer', '$2a$12$QmNeW1AOAXaA8cM/cilA0efTsv0C3SLGaZX8Lu20Xmmx2bTe15n5C', '+91 98765 40404'),
(5, 'Platform Admin', 'admin@homekey.demo', 'admin', '$2a$12$ZT554IT0ROfADk6Kig7mPu.9CeQG4XWHSyHic3/qHQGdxlXeaBl/W', '+91 98765 50505');

-- Seed Properties
INSERT INTO properties (property_id, owner_id, title, description, location, price, type, listing_mode, status, image_url) VALUES
(1, 1, 'Sunlit 2BHK near Indiranagar Metro', 'A furnished two-bedroom apartment with a wide balcony, dedicated workstation, covered parking, and 24/7 security. Just a 5-minute walk to Indiranagar Metro Station.', 'Indiranagar, Bengaluru', 3200.00, 'apartment', 'rent', 'available', 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80'),
(2, 1, 'Contemporary Luxury Villa in Whitefield', 'A lavish four-bedroom gated-community villa with private lawn, home theater room, modular Italian kitchen, and clubhouse access.', 'Whitefield, Bengaluru', 18500000.00, 'villa', 'sale', 'available', 'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=1200&q=80'),
(3, 2, 'Scenic Sea View Apartment at Vyttila', 'A bright three-bedroom waterfront apartment overlooking the backwaters, equipped with gym, infinity swimming pool, and dedicated EV charging bay.', 'Vyttila, Kochi', 2800.00, 'apartment', 'rent', 'available', 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80'),
(4, 2, 'Heritage Courtyard House', 'A classic restored three-bedroom Kerala-style house featuring carved teak woodwork, traditional nadumuttam courtyard, and lush tropical gardens.', 'Fort Kochi, Kochi', 14500000.00, 'house', 'sale', 'available', 'https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?auto=format&fit=crop&w=1200&q=80'),
(5, 1, 'Modern Studio for Professionals', 'A compact furnished studio apartment with ultra high-speed fiber internet, smart TV, housekeeping services, and power backup.', 'HSR Layout, Bengaluru', 1800.00, 'apartment', 'rent', 'available', 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80'),
(6, 2, 'Prime Commercial Space on MG Road', 'High-visibility ground floor retail/commercial showroom with 40-foot glass facade, high pedestrian footfall, and dedicated basement parking.', 'MG Road, Kochi', 8500.00, 'commercial', 'rent', 'available', 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=80');

-- Seed Bookings
INSERT INTO bookings (booking_id, user_id, property_id, start_date, end_date, status, amount, payment_status) VALUES
(1, 3, 1, '2026-05-01', '2026-05-04', 'completed', 9600.00, 'paid'),
(2, 4, 3, '2026-10-10', '2026-10-15', 'confirmed', 14000.00, 'paid'),
(3, 3, 5, '2026-11-01', '2026-11-08', 'pending', 12600.00, 'pending'),
(4, 4, 2, '2026-02-10', '2026-02-11', 'completed', 18500000.00, 'paid');

-- Seed Reviews (Only for completed bookings!)
INSERT INTO reviews (review_id, user_id, property_id, booking_id, rating, comment) VALUES
(1, 3, 1, 1, 5, 'Immaculate apartment, accurate photos, and wonderfully close to the metro station. The owner Ananya was polite and very accommodating.'),
(2, 4, 2, 4, 4, 'Magnificent architecture and serene neighborhood. The property inspection and agreement handover were very professionally handled.');

-- Seed Wishlist
INSERT INTO wishlist (user_id, property_id) VALUES
(3, 3), (3, 5), (4, 1), (4, 4);

-- Ensure AUTO_INCREMENT starts past seeded values
ALTER TABLE users AUTO_INCREMENT = 6;
ALTER TABLE properties AUTO_INCREMENT = 7;
ALTER TABLE bookings AUTO_INCREMENT = 5;
ALTER TABLE reviews AUTO_INCREMENT = 3;
