import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * =========================================================================
 * WishlistDAO.java - Data Access Object for Module 5: Wishlist / Favorites
 * =========================================================================
 * 
 * EXPLANATION FOR TEACHER / EXAMINER:
 * -----------------------------------
 * This class handles database operations on the `wishlist` table:
 * - Table name: wishlist
 * - Primary Key: wishlist_id
 * - Foreign Keys:
 *     1. user_id REFERENCES users(user_id) ON DELETE CASCADE
 *     2. property_id REFERENCES properties(property_id) ON DELETE CASCADE
 * - Unique Constraint: UNIQUE (user_id, property_id)
 * 
 * Relational Concept:
 * - Represents a Many-to-Many (M:N) relationship between Users and Properties.
 * - One user can favorite many properties.
 * - One property can be favorited by many users.
 * - The wishlist table is an Associative / Junction Table.
 */
public class WishlistDAO {

    /**
     * Retrieves all properties saved in user's wishlist.
     */
    public static List<Map<String, Object>> getUserWishlist(int userId) throws SQLException {
        String sql = "SELECT w.wishlist_id, w.added_date, p.*, u.name AS owner_name, "
                + "ROUND(COALESCE(AVG(r.rating), 0), 1) AS average_rating, "
                + "COUNT(DISTINCT r.review_id) AS review_count "
                + "FROM wishlist w "
                + "JOIN properties p ON p.property_id = w.property_id "
                + "JOIN users u ON u.user_id = p.owner_id "
                + "LEFT JOIN reviews r ON r.property_id = p.property_id "
                + "WHERE w.user_id = ? "
                + "GROUP BY w.wishlist_id, p.property_id "
                + "ORDER BY w.added_date DESC";

        List<Map<String, Object>> list = new ArrayList<>();

        try (Connection conn = DBConnection.getConnection();
             PreparedStatement pstmt = conn.prepareStatement(sql)) {

            pstmt.setInt(1, userId);
            try (ResultSet rs = pstmt.executeQuery()) {
                while (rs.next()) {
                    Map<String, Object> map = new HashMap<>();
                    map.put("wishlist_id", rs.getInt("wishlist_id"));
                    map.put("property_id", rs.getInt("property_id"));
                    map.put("title", rs.getString("title"));
                    map.put("location", rs.getString("location"));
                    map.put("price", rs.getDouble("price"));
                    map.put("type", rs.getString("type"));
                    map.put("listing_mode", rs.getString("listing_mode"));
                    map.put("status", rs.getString("status"));
                    map.put("image_url", rs.getString("image_url"));
                    map.put("owner_name", rs.getString("owner_name"));
                    map.put("average_rating", rs.getDouble("average_rating"));
                    map.put("review_count", rs.getInt("review_count"));
                    list.add(map);
                }
            }
        }
        return list;
    }

    /**
     * Retrieves list of property IDs saved by user (for quick heart icons).
     */
    public static List<Integer> getUserWishlistIds(int userId) throws SQLException {
        String sql = "SELECT property_id FROM wishlist WHERE user_id = ?";
        List<Integer> ids = new ArrayList<>();

        try (Connection conn = DBConnection.getConnection();
             PreparedStatement pstmt = conn.prepareStatement(sql)) {

            pstmt.setInt(1, userId);
            try (ResultSet rs = pstmt.executeQuery()) {
                while (rs.next()) {
                    ids.add(rs.getInt("property_id"));
                }
            }
        }
        return ids;
    }

    /**
     * Adds property to user's wishlist (INSERT IGNORE prevents duplicate error).
     */
    public static boolean addToWishlist(int userId, int propertyId) throws SQLException {
        String sql = "INSERT IGNORE INTO wishlist (user_id, property_id) VALUES (?, ?)";

        try (Connection conn = DBConnection.getConnection();
             PreparedStatement pstmt = conn.prepareStatement(sql)) {

            pstmt.setInt(1, userId);
            pstmt.setInt(2, propertyId);
            return pstmt.executeUpdate() > 0;
        }
    }

    /**
     * Removes property from user's wishlist.
     */
    public static boolean removeFromWishlist(int userId, int propertyId) throws SQLException {
        String sql = "DELETE FROM wishlist WHERE user_id = ? AND property_id = ?";

        try (Connection conn = DBConnection.getConnection();
             PreparedStatement pstmt = conn.prepareStatement(sql)) {

            pstmt.setInt(1, userId);
            pstmt.setInt(2, propertyId);
            return pstmt.executeUpdate() > 0;
        }
    }
}
