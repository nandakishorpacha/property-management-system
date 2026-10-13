-- =========================================================================
-- ADVANCED DBMS FEATURES: VIEWS, TRIGGERS & STORED PROCEDURES
-- Database: property_management
-- Designed for: College DBMS Project Viva & Evaluation
-- =========================================================================

USE property_management;

-- -------------------------------------------------------------------------
-- FEATURE 1: SQL VIEW (Virtual Table for Executive Reporting)
-- -------------------------------------------------------------------------
-- EXPLANATION FOR TEACHER:
-- A VIEW is a virtual table based on the result-set of a SQL statement.
-- Why use it?
-- 1. Security: Hides sensitive user data (like passwords).
-- 2. Performance & Simplicity: Encapsulates complex multi-table JOINs,
--    so developers can simply run: SELECT * FROM vw_property_performance;
-- -------------------------------------------------------------------------

DROP VIEW IF EXISTS vw_property_performance;

CREATE VIEW vw_property_performance AS
SELECT 
    p.property_id,
    p.title AS property_title,
    p.location,
    p.price AS listing_price,
    p.type AS property_type,
    p.listing_mode,
    u.name AS owner_name,
    u.email AS owner_email,
    COUNT(DISTINCT b.booking_id) AS total_bookings_count,
    COALESCE(SUM(CASE WHEN b.payment_status = 'paid' THEN b.amount ELSE 0 END), 0) AS total_revenue_generated,
    ROUND(COALESCE(AVG(r.rating), 0), 1) AS average_rating,
    COUNT(DISTINCT r.review_id) AS total_reviews_received
FROM properties p
JOIN users u ON u.user_id = p.owner_id
LEFT JOIN bookings b ON b.property_id = p.property_id
LEFT JOIN reviews r ON r.property_id = p.property_id
GROUP BY p.property_id, u.user_id;

-- How to demonstrate to teacher:
-- SELECT * FROM vw_property_performance WHERE average_rating >= 4.0;


-- -------------------------------------------------------------------------
-- FEATURE 2: SQL TRIGGER (Automated Database Audit Logging)
-- -------------------------------------------------------------------------
-- EXPLANATION FOR TEACHER:
-- A TRIGGER is a stored program that is automatically executed (fired)
-- when an event (INSERT, UPDATE, DELETE) occurs on a specific table.
-- Here, whenever a booking's status is changed to 'confirmed' or 'completed',
-- this trigger automatically writes a log entry into `booking_audit_log`.
-- -------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS booking_audit_log (
    log_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    booking_id INT UNSIGNED NOT NULL,
    old_status VARCHAR(20),
    new_status VARCHAR(20),
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    action_note VARCHAR(255)
) ENGINE=InnoDB;

DROP TRIGGER IF EXISTS trg_booking_status_audit;

DELIMITER //
CREATE TRIGGER trg_booking_status_audit
AFTER UPDATE ON bookings
FOR EACH ROW
BEGIN
    -- Check if status was modified
    IF OLD.status <> NEW.status THEN
        INSERT INTO booking_audit_log (booking_id, old_status, new_status, action_note)
        VALUES (
            NEW.booking_id, 
            OLD.status, 
            NEW.status, 
            CONCAT('Status updated from ', OLD.status, ' to ', NEW.status)
        );
    END IF;
END //
DELIMITER ;

-- How to demonstrate to teacher:
-- UPDATE bookings SET status = 'confirmed' WHERE booking_id = 3;
-- SELECT * FROM booking_audit_log;


-- -------------------------------------------------------------------------
-- FEATURE 3: STORED PROCEDURE (Pre-compiled Server Logic)
-- -------------------------------------------------------------------------
-- EXPLANATION FOR TEACHER:
-- A STORED PROCEDURE is a pre-compiled set of SQL statements saved in the
-- database server. It accepts input parameters (IN) and executes on the server,
-- reducing network traffic between Java and MySQL.
-- -------------------------------------------------------------------------

DROP PROCEDURE IF EXISTS sp_search_properties_by_budget;

DELIMITER //
CREATE PROCEDURE sp_search_properties_by_budget(
    IN p_locality VARCHAR(100),
    IN p_budget DECIMAL(12,2)
)
BEGIN
    SELECT 
        p.property_id,
        p.title,
        p.location,
        p.price,
        p.type,
        p.listing_mode,
        u.name AS owner_name,
        u.phone AS owner_contact
    FROM properties p
    JOIN users u ON u.user_id = p.owner_id
    WHERE p.status = 'available'
      AND p.location LIKE CONCAT('%', p_locality, '%')
      AND p.price <= p_budget
    ORDER BY p.price ASC;
END //
DELIMITER ;

-- How to demonstrate to teacher:
-- CALL sp_search_properties_by_budget('Bengaluru', 5000.00);
