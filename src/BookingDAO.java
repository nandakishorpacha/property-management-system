import java.sql.Connection;
import java.sql.Date;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * =========================================================================
 * BookingDAO.java - Data Access Object for Module 3: Bookings & Rentals
 * =========================================================================
 * 
 * EXPLANATION FOR TEACHER / EXAMINER:
 * -----------------------------------
 * This class handles database operations on the `bookings` table:
 * - Table name: bookings
 * - Primary Key: booking_id
 * - Foreign Keys:
 *     1. user_id REFERENCES users(user_id) ON DELETE CASCADE
 *     2. property_id REFERENCES properties(property_id) ON DELETE CASCADE
 * 
 * Key Relational Constraints & Invariants:
 * 1. Date Validation Constraint: CHECK (end_date > start_date)
 * 2. Overlap Conflict Detection:
 *    A property cannot be double-booked for the same dates!
 *    Query: SELECT booking_id FROM bookings
 *           WHERE property_id = ? AND status = 'confirmed'
 *           AND start_date < ? AND end_date > ?
 * 3. Lifecycle state machine: 'pending' -> 'confirmed' -> 'completed' (or 'rejected'/'cancelled')
 * 4. Payment tracking: 'pending' -> 'paid'
 */
public class BookingDAO {

    /**
     * Creates a new booking request after validating dates and checking for conflicts.
     */
    public static Map<String, Object> createBooking(int userId, int propertyId, String startDateStr, String endDateStr) throws SQLException {
        Date startDate = Date.valueOf(startDateStr);
        Date endDate = Date.valueOf(endDateStr);

        if (!endDate.after(startDate)) {
            throw new IllegalArgumentException("Check-out date must be after check-in date.");
        }

        try (Connection conn = DBConnection.getConnection()) {
            // Step 1: Fetch property details to verify availability & calculate price
            String propSql = "SELECT price, listing_mode, status FROM properties WHERE property_id = ?";
            double price = 0;
            String listingMode = "rent";

            try (PreparedStatement propStmt = conn.prepareStatement(propSql)) {
                propStmt.setInt(1, propertyId);
                try (ResultSet propRs = propStmt.executeQuery()) {
                    if (!propRs.next()) {
                        throw new SQLException("Property not found.");
                    }
                    if (!"available".equalsIgnoreCase(propRs.getString("status"))) {
                        throw new SQLException("This property is currently " + propRs.getString("status") + ".");
                    }
                    price = propRs.getDouble("price");
                    listingMode = propRs.getString("listing_mode");
                }
            }

            // Step 2: Date Conflict Check (Prevent double booking)
            String clashSql = "SELECT booking_id FROM bookings WHERE property_id = ? AND status = 'confirmed' AND start_date < ? AND end_date > ?";
            try (PreparedStatement clashStmt = conn.prepareStatement(clashSql)) {
                clashStmt.setInt(1, propertyId);
                clashStmt.setDate(2, endDate);
                clashStmt.setDate(3, startDate);
                try (ResultSet clashRs = clashStmt.executeQuery()) {
                    if (clashRs.next()) {
                        throw new SQLException("Selected dates conflict with an existing confirmed booking.");
                    }
                }
            }

            // Step 3: Calculate total amount
            long days = ChronoUnit.DAYS.between(startDate.toLocalDate(), endDate.toLocalDate());
            if (days <= 0) days = 1;

            double totalAmount = "rent".equalsIgnoreCase(listingMode) ? (price * days) : price;

            // Step 4: Insert booking record
            String insertSql = "INSERT INTO bookings (user_id, property_id, start_date, end_date, amount, status, payment_status) "
                    + "VALUES (?, ?, ?, ?, ?, 'pending', 'pending')";

            try (PreparedStatement insertStmt = conn.prepareStatement(insertSql, Statement.RETURN_GENERATED_KEYS)) {
                insertStmt.setInt(1, userId);
                insertStmt.setInt(2, propertyId);
                insertStmt.setDate(3, startDate);
                insertStmt.setDate(4, endDate);
                insertStmt.setDouble(5, totalAmount);

                insertStmt.executeUpdate();
                try (ResultSet gen = insertStmt.getGeneratedKeys()) {
                    if (gen.next()) {
                        int bookingId = gen.getInt(1);
                        Map<String, Object> res = new HashMap<>();
                        res.put("booking_id", bookingId);
                        res.put("amount", totalAmount);
                        res.put("days", days);
                        return res;
                    }
                }
            }
        }
        return null;
    }

    /**
     * Retrieves bookings tailored by user role.
     * - Owner: see incoming requests for their properties.
     * - Tenant/Buyer: see their own requested bookings.
     * - Admin: see all bookings across platform.
     */
    public static List<Map<String, Object>> getBookings(int userId, String role) throws SQLException {
        StringBuilder sql = new StringBuilder();
        if ("owner".equalsIgnoreCase(role)) {
            sql.append("SELECT b.*, p.title AS property_title, p.image_url AS property_image, p.location AS property_location, p.listing_mode, ")
               .append("u.name AS guest_name, u.email AS guest_email, u.phone AS guest_phone ")
               .append("FROM bookings b ")
               .append("JOIN properties p ON p.property_id = b.property_id ")
               .append("JOIN users u ON u.user_id = b.user_id ")
               .append("WHERE p.owner_id = ? ")
               .append("ORDER BY b.created_at DESC");
        } else if ("admin".equalsIgnoreCase(role)) {
            sql.append("SELECT b.*, p.title AS property_title, p.location AS property_location, ")
               .append("u.name AS guest_name, u.email AS guest_email, owner.name AS owner_name ")
               .append("FROM bookings b ")
               .append("JOIN properties p ON p.property_id = b.property_id ")
               .append("JOIN users u ON u.user_id = b.user_id ")
               .append("JOIN users owner ON owner.user_id = p.owner_id ")
               .append("ORDER BY b.created_at DESC");
        } else {
            // Tenant / Buyer: includes check if user has already reviewed this booking
            sql.append("SELECT b.*, p.title AS property_title, p.image_url AS property_image, p.location AS property_location, p.listing_mode, ")
               .append("owner.name AS owner_name, owner.phone AS owner_phone, ")
               .append("(r.review_id IS NOT NULL) AS has_reviewed, r.rating AS review_rating ")
               .append("FROM bookings b ")
               .append("JOIN properties p ON p.property_id = b.property_id ")
               .append("JOIN users owner ON owner.user_id = p.owner_id ")
               .append("LEFT JOIN reviews r ON r.booking_id = b.booking_id ")
               .append("WHERE b.user_id = ? ")
               .append("ORDER BY b.created_at DESC");
        }

        List<Map<String, Object>> list = new ArrayList<>();

        try (Connection conn = DBConnection.getConnection();
             PreparedStatement pstmt = conn.prepareStatement(sql.toString())) {

            if (!"admin".equalsIgnoreCase(role)) {
                pstmt.setInt(1, userId);
            }

            try (ResultSet rs = pstmt.executeQuery()) {
                while (rs.next()) {
                    Map<String, Object> map = new HashMap<>();
                    map.put("booking_id", rs.getInt("booking_id"));
                    map.put("user_id", rs.getInt("user_id"));
                    map.put("property_id", rs.getInt("property_id"));
                    map.put("start_date", rs.getDate("start_date").toString());
                    map.put("end_date", rs.getDate("end_date").toString());
                    map.put("status", rs.getString("status"));
                    map.put("amount", rs.getDouble("amount"));
                    map.put("payment_status", rs.getString("payment_status"));
                    try { map.put("property_title", rs.getString("property_title")); } catch (Exception ignored) {}
                    try { map.put("property_location", rs.getString("property_location")); } catch (Exception ignored) {}
                    try { map.put("property_image", rs.getString("property_image")); } catch (Exception ignored) {}
                    try { map.put("guest_name", rs.getString("guest_name")); } catch (Exception ignored) {}
                    try { map.put("guest_email", rs.getString("guest_email")); } catch (Exception ignored) {}
                    try { map.put("owner_name", rs.getString("owner_name")); } catch (Exception ignored) {}
                    try { map.put("has_reviewed", rs.getBoolean("has_reviewed")); } catch (Exception ignored) {}
                    try { map.put("review_rating", rs.getInt("review_rating")); } catch (Exception ignored) {}
                    list.add(map);
                }
            }
        }
        return list;
    }

    /**
     * Updates booking status (confirm, reject, complete, cancel) or payment status.
     */
    public static boolean updateBookingStatus(int bookingId, String status, String paymentStatus) throws SQLException {
        StringBuilder sql = new StringBuilder("UPDATE bookings SET ");
        List<Object> params = new ArrayList<>();

        if (status != null && !status.isEmpty()) {
            sql.append("status = ? ");
            params.add(status);
        }
        if (paymentStatus != null && !paymentStatus.isEmpty()) {
            if (!params.isEmpty()) sql.append(", ");
            sql.append("payment_status = ? ");
            params.add(paymentStatus);
        }

        sql.append("WHERE booking_id = ?");
        params.add(bookingId);

        try (Connection conn = DBConnection.getConnection();
             PreparedStatement pstmt = conn.prepareStatement(sql.toString())) {

            for (int i = 0; i < params.size(); i++) {
                pstmt.setObject(i + 1, params.get(i));
            }
            return pstmt.executeUpdate() > 0;
        }
    }

    /**
     * Retrieves all active/upcoming confirmed or completed booking dates for a property.
     * This powers the automated availability calendar on the renter UI.
     * Query: SELECT booking_id, start_date, end_date, status 
     *        FROM bookings 
     *        WHERE property_id = ? AND status IN ('confirmed', 'completed')
     *        ORDER BY start_date ASC
     */
    public static List<Map<String, Object>> getPropertyBookedDates(int propertyId) throws SQLException {
        String sql = "SELECT booking_id, start_date, end_date, status "
                + "FROM bookings "
                + "WHERE property_id = ? AND status IN ('confirmed', 'completed') "
                + "ORDER BY start_date ASC";

        List<Map<String, Object>> list = new ArrayList<>();
        try (Connection conn = DBConnection.getConnection();
             PreparedStatement pstmt = conn.prepareStatement(sql)) {

            pstmt.setInt(1, propertyId);
            try (ResultSet rs = pstmt.executeQuery()) {
                while (rs.next()) {
                    Map<String, Object> map = new HashMap<>();
                    map.put("booking_id", rs.getInt("booking_id"));
                    map.put("start_date", rs.getDate("start_date").toString());
                    map.put("end_date", rs.getDate("end_date").toString());
                    map.put("status", rs.getString("status"));
                    list.add(map);
                }
            }
        }
        return list;
    }
}

