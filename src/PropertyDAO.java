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
 * PropertyDAO.java - Data Access Object for Module 2: Properties & Listings
 * =========================================================================
 * 
 * EXPLANATION FOR TEACHER / EXAMINER:
 * -----------------------------------
 * This class handles database operations on the `properties` table:
 * - Table name: properties
 * - Primary Key: property_id
 * - Foreign Key: owner_id REFERENCES users(user_id) ON DELETE CASCADE
 * - Relationships: 1 Owner has N Properties (1:N)
 * 
 * Key SQL concepts used:
 * 1. INNER JOIN: Combines properties with users table to get owner's name.
 * 2. LEFT JOIN: Joins with reviews table so properties without reviews still appear.
 * 3. AGGREGATE FUNCTIONS:
 *    - AVG(r.rating): computes average rating stars for the property.
 *    - COUNT(DISTINCT r.review_id): counts total reviews submitted.
 * 4. GROUP BY: Groups rows by p.property_id to compute aggregate values.
 * 5. LIKE operator: Enables fuzzy search on title, location, or description.
 */
public class PropertyDAO {

    /**
     * Search and filter properties with multi-criteria SQL query.
     */
    public static List<Map<String, Object>> searchProperties(String search, String location, String type, String mode, Double maxPrice) throws SQLException {
        StringBuilder sql = new StringBuilder();
        sql.append("SELECT p.*, u.name AS owner_name, u.phone AS owner_phone, u.email AS owner_email, ");
        sql.append("ROUND(COALESCE(AVG(r.rating), 0), 1) AS average_rating, ");
        sql.append("COUNT(DISTINCT r.review_id) AS review_count ");
        sql.append("FROM properties p ");
        sql.append("JOIN users u ON u.user_id = p.owner_id ");
        sql.append("LEFT JOIN reviews r ON r.property_id = p.property_id ");
        sql.append("WHERE p.status = 'available' ");

        List<Object> params = new ArrayList<>();

        if (search != null && !search.trim().isEmpty()) {
            sql.append("AND (p.title LIKE ? OR p.description LIKE ? OR p.location LIKE ?) ");
            String wild = "%" + search.trim() + "%";
            params.add(wild);
            params.add(wild);
            params.add(wild);
        }

        if (location != null && !location.trim().isEmpty()) {
            sql.append("AND p.location LIKE ? ");
            params.add("%" + location.trim() + "%");
        }

        if (type != null && !type.trim().isEmpty()) {
            sql.append("AND p.type = ? ");
            params.add(type.trim());
        }

        if (mode != null && !mode.trim().isEmpty()) {
            sql.append("AND p.listing_mode = ? ");
            params.add(mode.trim());
        }

        if (maxPrice != null && maxPrice > 0) {
            sql.append("AND p.price <= ? ");
            params.add(maxPrice);
        }

        sql.append("GROUP BY p.property_id ORDER BY p.created_at DESC");

        List<Map<String, Object>> list = new ArrayList<>();

        try (Connection conn = DBConnection.getConnection();
             PreparedStatement pstmt = conn.prepareStatement(sql.toString())) {

            // Bind all parameters sequentially
            for (int i = 0; i < params.size(); i++) {
                pstmt.setObject(i + 1, params.get(i));
            }

            try (ResultSet rs = pstmt.executeQuery()) {
                while (rs.next()) {
                    list.add(mapPropertyRow(rs));
                }
            }
        }
        return list;
    }

    /**
     * Retrieves single property by property_id.
     */
    public static Map<String, Object> getPropertyById(int propertyId) throws SQLException {
        String sql = "SELECT p.*, u.name AS owner_name, u.email AS owner_email, u.phone AS owner_phone, "
                + "ROUND(COALESCE(AVG(r.rating), 0), 1) AS average_rating, "
                + "COUNT(DISTINCT r.review_id) AS review_count "
                + "FROM properties p "
                + "JOIN users u ON u.user_id = p.owner_id "
                + "LEFT JOIN reviews r ON r.property_id = p.property_id "
                + "WHERE p.property_id = ? "
                + "GROUP BY p.property_id";

        try (Connection conn = DBConnection.getConnection();
             PreparedStatement pstmt = conn.prepareStatement(sql)) {

            pstmt.setInt(1, propertyId);
            try (ResultSet rs = pstmt.executeQuery()) {
                if (rs.next()) {
                    return mapPropertyRow(rs);
                }
            }
        }
        return null;
    }

    /**
     * Retrieves all properties listed by a specific owner.
     */
    public static List<Map<String, Object>> getPropertiesByOwner(int ownerId) throws SQLException {
        String sql = "SELECT p.*, "
                + "ROUND(COALESCE(AVG(r.rating), 0), 1) AS average_rating, "
                + "COUNT(DISTINCT r.review_id) AS review_count "
                + "FROM properties p "
                + "LEFT JOIN reviews r ON r.property_id = p.property_id "
                + "WHERE p.owner_id = ? "
                + "GROUP BY p.property_id "
                + "ORDER BY p.created_at DESC";

        List<Map<String, Object>> list = new ArrayList<>();

        try (Connection conn = DBConnection.getConnection();
             PreparedStatement pstmt = conn.prepareStatement(sql)) {

            pstmt.setInt(1, ownerId);
            try (ResultSet rs = pstmt.executeQuery()) {
                while (rs.next()) {
                    list.add(mapPropertyRow(rs));
                }
            }
        }
        return list;
    }

    /**
     * Adds a new property listing (Owner / Admin action).
     */
    public static int addProperty(int ownerId, String title, String description, String location, double price, String type, String mode, String imageUrl) throws SQLException {
        String sql = "INSERT INTO properties (owner_id, title, description, location, price, type, listing_mode, status, image_url) "
                + "VALUES (?, ?, ?, ?, ?, ?, ?, 'available', ?)";

        try (Connection conn = DBConnection.getConnection();
             PreparedStatement pstmt = conn.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {

            pstmt.setInt(1, ownerId);
            pstmt.setString(2, title.trim());
            pstmt.setString(3, description.trim());
            pstmt.setString(4, location.trim());
            pstmt.setDouble(5, price);
            pstmt.setString(6, type);
            pstmt.setString(7, mode);
            pstmt.setString(8, imageUrl != null && !imageUrl.isEmpty() ? imageUrl.trim() : "https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=800&q=80");

            pstmt.executeUpdate();
            try (ResultSet generated = pstmt.getGeneratedKeys()) {
                if (generated.next()) {
                    return generated.getInt(1);
                }
            }
        }
        return -1;
    }

    /**
     * Updates an existing property listing.
     */
    public static boolean updateProperty(int propertyId, int ownerId, String title, String description, String location, double price, String type, String mode, String status, String imageUrl, boolean isAdmin) throws SQLException {
        String sql = isAdmin 
            ? "UPDATE properties SET title=?, description=?, location=?, price=?, type=?, listing_mode=?, status=?, image_url=? WHERE property_id=?"
            : "UPDATE properties SET title=?, description=?, location=?, price=?, type=?, listing_mode=?, status=?, image_url=? WHERE property_id=? AND owner_id=?";

        try (Connection conn = DBConnection.getConnection();
             PreparedStatement pstmt = conn.prepareStatement(sql)) {

            pstmt.setString(1, title);
            pstmt.setString(2, description);
            pstmt.setString(3, location);
            pstmt.setDouble(4, price);
            pstmt.setString(5, type);
            pstmt.setString(6, mode);
            pstmt.setString(7, status != null ? status : "available");
            pstmt.setString(8, imageUrl);
            pstmt.setInt(9, propertyId);

            if (!isAdmin) {
                pstmt.setInt(10, ownerId);
            }

            return pstmt.executeUpdate() > 0;
        }
    }

    /**
     * Deletes a property listing.
     */
    public static boolean deleteProperty(int propertyId, int ownerId, boolean isAdmin) throws SQLException {
        String sql = isAdmin
            ? "DELETE FROM properties WHERE property_id = ?"
            : "DELETE FROM properties WHERE property_id = ? AND owner_id = ?";

        try (Connection conn = DBConnection.getConnection();
             PreparedStatement pstmt = conn.prepareStatement(sql)) {

            pstmt.setInt(1, propertyId);
            if (!isAdmin) pstmt.setInt(2, ownerId);
            return pstmt.executeUpdate() > 0;
        }
    }

    private static Map<String, Object> mapPropertyRow(ResultSet rs) throws SQLException {
        Map<String, Object> map = new HashMap<>();
        map.put("property_id", rs.getInt("property_id"));
        map.put("owner_id", rs.getInt("owner_id"));
        map.put("title", rs.getString("title"));
        map.put("description", rs.getString("description"));
        map.put("location", rs.getString("location"));
        map.put("price", rs.getDouble("price"));
        map.put("type", rs.getString("type"));
        map.put("listing_mode", rs.getString("listing_mode"));
        map.put("status", rs.getString("status"));
        map.put("image_url", rs.getString("image_url"));
        try { map.put("owner_name", rs.getString("owner_name")); } catch (Exception ignored) {}
        try { map.put("owner_email", rs.getString("owner_email")); } catch (Exception ignored) {}
        try { map.put("owner_phone", rs.getString("owner_phone")); } catch (Exception ignored) {}
        try { map.put("average_rating", rs.getDouble("average_rating")); } catch (Exception ignored) {}
        try { map.put("review_count", rs.getInt("review_count")); } catch (Exception ignored) {}
        return map;
    }
}
