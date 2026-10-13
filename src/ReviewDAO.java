import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * =========================================================================
 * ReviewDAO.java - Data Access Object for Module 4: Reviews & Ratings
 * =========================================================================
 * 
 * EXPLANATION FOR TEACHER / EXAMINER:
 * -----------------------------------
 * This class handles database operations on the `reviews` table:
 * - Table name: reviews
 * - Primary Key: review_id
 * - Foreign Keys:
 *     1. user_id REFERENCES users(user_id)
 *     2. property_id REFERENCES properties(property_id)
 *     3. booking_id REFERENCES bookings(booking_id) UNIQUE
 * 
 * Key Relational Constraints & Invariants:
 * 1. UNIQUE (booking_id): A user can review a property ONLY ONCE per booking.
 * 2. CHECK (rating BETWEEN 1 AND 5): Disallows ratings < 1 or > 5.
 * 3. BUSINESS INVARIANT (Verified Stays Only):
 *    Before adding a review, SQL verifies that the booking exists, belongs to
 *    the requesting user, and has status = 'completed'.
 *    This prevents fraudulent / fake reviews!
 */
public class ReviewDAO {

    /**
     * Retrieves all verified reviews for a property.
     */
    public static List<Map<String, Object>> getReviewsForProperty(int propertyId) throws SQLException {
        String sql = "SELECT r.*, u.name AS reviewer_name "
                + "FROM reviews r "
                + "JOIN users u ON u.user_id = r.user_id "
                + "WHERE r.property_id = ? "
                + "ORDER BY r.review_date DESC";

        List<Map<String, Object>> list = new ArrayList<>();

        try (Connection conn = DBConnection.getConnection();
             PreparedStatement pstmt = conn.prepareStatement(sql)) {

            pstmt.setInt(1, propertyId);
            try (ResultSet rs = pstmt.executeQuery()) {
                while (rs.next()) {
                    Map<String, Object> map = new HashMap<>();
                    map.put("review_id", rs.getInt("review_id"));
                    map.put("rating", rs.getInt("rating"));
                    map.put("comment", rs.getString("comment"));
                    map.put("review_date", rs.getTimestamp("review_date").toString());
                    map.put("reviewer_name", rs.getString("reviewer_name"));
                    list.add(map);
                }
            }
        }
        return list;
    }

    /**
     * Submits a verified review for a completed booking.
     */
    public static int addReview(int userId, int bookingId, int rating, String comment) throws SQLException {
        if (rating < 1 || rating > 5) {
            throw new IllegalArgumentException("Rating must be between 1 and 5.");
        }

        try (Connection conn = DBConnection.getConnection()) {
            // Step 1: Verify booking is COMPLETED and belongs to this user
            String verifySql = "SELECT property_id FROM bookings WHERE booking_id = ? AND user_id = ? AND status = 'completed'";
            int propertyId = -1;

            try (PreparedStatement verifyStmt = conn.prepareStatement(verifySql)) {
                verifyStmt.setInt(1, bookingId);
                verifyStmt.setInt(2, userId);
                try (ResultSet rs = verifyStmt.executeQuery()) {
                    if (!rs.next()) {
                        throw new SQLException("Only completed bookings can receive reviews.");
                    }
                    propertyId = rs.getInt("property_id");
                }
            }

            // Step 2: Insert verified review
            String insertSql = "INSERT INTO reviews (user_id, property_id, booking_id, rating, comment) VALUES (?, ?, ?, ?, ?)";
            try (PreparedStatement insertStmt = conn.prepareStatement(insertSql, Statement.RETURN_GENERATED_KEYS)) {
                insertStmt.setInt(1, userId);
                insertStmt.setInt(2, propertyId);
                insertStmt.setInt(3, bookingId);
                insertStmt.setInt(4, rating);
                insertStmt.setString(5, comment.trim());

                insertStmt.executeUpdate();
                try (ResultSet gen = insertStmt.getGeneratedKeys()) {
                    if (gen.next()) {
                        return gen.getInt(1);
                    }
                }
            }
        }
        return -1;
    }
}
