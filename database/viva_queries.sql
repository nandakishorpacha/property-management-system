-- =========================================================================
-- PROPERTY MANAGEMENT SYSTEM - DBMS VIVA QUERIES CHEAT SHEET
-- =========================================================================
-- Use these queries when your teacher/examiner asks you to run specific SQL
-- queries in MySQL Workbench or terminal during your viva evaluation.
-- =========================================================================

USE property_management;

-- -------------------------------------------------------------------------
-- 1. MULTI-TABLE JOIN (3 Tables)
-- Question: "Show tenant name, property title, and owner name for all bookings."
-- -------------------------------------------------------------------------
SELECT 
    b.booking_id,
    tenant.name AS tenant_name,
    p.title AS property_title,
    owner.name AS property_owner,
    b.start_date,
    b.end_date,
    b.status AS booking_status,
    b.amount
FROM bookings b
JOIN users tenant ON tenant.user_id = b.user_id
JOIN properties p ON p.property_id = b.property_id
JOIN users owner ON owner.user_id = p.owner_id
ORDER BY b.booking_id ASC;


-- -------------------------------------------------------------------------
-- 2. GROUP BY WITH HAVING CLAUSE
-- Question: "Find properties with an average rating of 4.0 or higher."
-- -------------------------------------------------------------------------
SELECT 
    p.property_id,
    p.title,
    p.location,
    ROUND(AVG(r.rating), 2) AS avg_rating,
    COUNT(r.review_id) AS total_reviews
FROM properties p
JOIN reviews r ON r.property_id = p.property_id
GROUP BY p.property_id, p.title, p.location
HAVING AVG(r.rating) >= 4.0;


-- -------------------------------------------------------------------------
-- 3. NESTED SUBQUERY (NOT EXISTS / NOT IN)
-- Question: "Find all registered users who have NEVER made any booking."
-- -------------------------------------------------------------------------
SELECT user_id, name, email, role 
FROM users 
WHERE user_id NOT IN (
    SELECT DISTINCT user_id FROM bookings
);


-- -------------------------------------------------------------------------
-- 4. AGGREGATE FUNCTIONS (SUM, COUNT, MIN, MAX, AVG)
-- Question: "Calculate the total revenue generated from paid bookings."
-- -------------------------------------------------------------------------
SELECT 
    COUNT(*) AS total_paid_bookings,
    SUM(amount) AS total_platform_revenue,
    AVG(amount) AS average_booking_value,
    MIN(amount) AS lowest_booking_amount,
    MAX(amount) AS highest_booking_amount
FROM bookings 
WHERE payment_status = 'paid';


-- -------------------------------------------------------------------------
-- 5. DATE FUNCTION (DATEDIFF)
-- Question: "Calculate the duration in days for each rental booking."
-- -------------------------------------------------------------------------
SELECT 
    booking_id,
    property_id,
    start_date,
    end_date,
    DATEDIFF(end_date, start_date) AS total_days_stayed,
    amount
FROM bookings
ORDER BY total_days_stayed DESC;


-- -------------------------------------------------------------------------
-- 6. CORRELATED SUBQUERY
-- Question: "Find properties priced higher than the average price in their city."
-- -------------------------------------------------------------------------
SELECT p1.property_id, p1.title, p1.location, p1.price 
FROM properties p1
WHERE p1.price > (
    SELECT AVG(p2.price) 
    FROM properties p2 
    WHERE p2.location = p1.location
);


-- -------------------------------------------------------------------------
-- 7. LEFT OUTER JOIN
-- Question: "Display all properties and their reviews (even if review count is 0)."
-- -------------------------------------------------------------------------
SELECT 
    p.property_id,
    p.title,
    COALESCE(r.rating, 'No Rating') AS rating,
    COALESCE(r.comment, 'No Review Yet') AS feedback
FROM properties p
LEFT JOIN reviews r ON r.property_id = p.property_id;


-- -------------------------------------------------------------------------
-- 8. SET OPERATOR (UNION)
-- Question: "List all distinct cities where we have properties or registered users."
-- -------------------------------------------------------------------------
SELECT DISTINCT location AS city_or_locality, 'From Properties Table' AS source 
FROM properties
UNION
SELECT DISTINCT 'Indiranagar, Bengaluru' AS city_or_locality, 'From User Address' AS source;


-- -------------------------------------------------------------------------
-- 9. TRANSACTION INTEGRITY (COMMIT & ROLLBACK)
-- Question: "Demonstrate an ACID transaction when creating a booking."
-- -------------------------------------------------------------------------
START TRANSACTION;

-- Attempt an insert
INSERT INTO bookings (user_id, property_id, start_date, end_date, amount, status, payment_status)
VALUES (3, 1, '2026-12-25', '2026-12-28', 9600.00, 'pending', 'pending');

-- If everything is fine, commit changes:
COMMIT;

-- (If an error had occurred, we would execute: ROLLBACK;)


-- -------------------------------------------------------------------------
-- 10. INDEX INSPECTION & QUERY PERFORMANCE
-- Question: "Show the indexes created on the properties table."
-- -------------------------------------------------------------------------
SHOW INDEX FROM properties;
