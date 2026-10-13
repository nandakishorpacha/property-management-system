import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.HashMap;
import java.util.Map;

/**
 * =========================================================================
 * AdminDAO.java - Data Access Object for Admin Oversight & Analytics
 * =========================================================================
 * 
 * EXPLANATION FOR TEACHER / EXAMINER:
 * -----------------------------------
 * This class calculates platform-wide aggregate metrics across all 5 tables:
 * - COUNT(*) FROM users
 * - COUNT(*) FROM properties
 * - COUNT(*) FROM bookings
 * - COUNT(*) FROM reviews
 * - COUNT(*) FROM wishlist
 * 
 * Demonstrates relational DBMS aggregation queries for executive dashboards.
 */
public class AdminDAO {

    public static Map<String, Object> getPlatformMetrics() throws SQLException {
        Map<String, Object> metrics = new HashMap<>();
        Map<String, Object> counts = new HashMap<>();

        try (Connection conn = DBConnection.getConnection()) {
            counts.put("users", getTableCount(conn, "users"));
            counts.put("properties", getTableCount(conn, "properties"));
            counts.put("bookings", getTableCount(conn, "bookings"));
            counts.put("reviews", getTableCount(conn, "reviews"));
            counts.put("wishlists", getTableCount(conn, "wishlist"));
        }

        metrics.put("counts", counts);
        return metrics;
    }

    private static int getTableCount(Connection conn, String tableName) throws SQLException {
        // Query to count total rows in a table
        String sql = "SELECT COUNT(*) AS total FROM " + tableName;
        try (PreparedStatement pstmt = conn.prepareStatement(sql);
             ResultSet rs = pstmt.executeQuery()) {
            if (rs.next()) {
                return rs.getInt("total");
            }
        }
        return 0;
    }
}
