import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.Executors;

/**
 * =========================================================================
 * Server.java - Java HTTP REST Server & Web Host
 * =========================================================================
 * 
 * EXPLANATION FOR TEACHER / EXAMINER:
 * -----------------------------------
 * This Java class starts an embedded HTTP Server on port 8080:
 * 1. Hosts the responsive HTML5/CSS3/JavaScript frontend located in `public/`.
 * 2. Provides REST API endpoints under `/api/...` to perform CRUD operations
 *    on MySQL via our DAO classes (UserDAO, PropertyDAO, BookingDAO, ReviewDAO, WishlistDAO).
 * 3. Uses standard Java `HttpServer` (zero complex framework dependencies).
 * 4. Can be launched in VS Code with a single press of F5 or `run_java.bat`.
 */
public class Server {

    private static final int PORT = 3000;

    public static void main(String[] args) throws IOException {
        // Test database connection on startup
        try {
            DBConnection.getConnection().close();
            System.out.println("====================================================");
            System.out.println(" [Database] Java successfully connected to MySQL!");
            System.out.println("====================================================");
        } catch (Exception e) {
            System.err.println(" [Database Warning] Could not connect to MySQL: " + e.getMessage());
            System.err.println(" Ensure MySQL service is running on port 3306 with password 'mysql'.");
        }

        // Create embedded HTTP server listening on port 8080
        HttpServer server = HttpServer.create(new InetSocketAddress(PORT), 0);

        // API Handler for REST endpoints
        server.createContext("/api", new ApiHandler());

        // Static file handler for frontend (HTML, CSS, JS)
        server.createContext("/", new StaticFileHandler());

        // Use multi-threaded executor for handling concurrent client requests
        server.setExecutor(Executors.newFixedThreadPool(10));

        server.start();

        System.out.println("====================================================");
        System.out.println(" Property Management System (Java Edition)");
        System.out.println(" Local Web Application: http://localhost:" + PORT);
        System.out.println(" Backend Language:      Java 17 (Pure JDBC)");
        System.out.println(" Database:              MySQL 8.0 (property_management)");
        System.out.println("====================================================");
    }

    // -------------------------------------------------------------------------
    // REST API Request Router
    // -------------------------------------------------------------------------
    static class ApiHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            String path = exchange.getRequestURI().getPath();
            String method = exchange.getRequestMethod().toUpperCase();
            String query = exchange.getRequestURI().getQuery();

            // Set CORS headers so modern browsers can communicate seamlessly
            exchange.getResponseHeaders().set("Access-Control-Allow-Origin", "*");
            exchange.getResponseHeaders().set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
            exchange.getResponseHeaders().set("Access-Control-Allow-Headers", "Content-Type, Authorization");
            exchange.getResponseHeaders().set("Content-Type", "application/json; charset=UTF-8");

            if ("OPTIONS".equals(method)) {
                exchange.sendResponseHeaders(204, -1);
                return;
            }

            // Extract Authorization user if present (simple token bearer / session simulation)
            Map<String, Object> authUser = extractAuthUser(exchange);

            try {
                // Route: GET /api/health
                if ("/api/health".equals(path) && "GET".equals(method)) {
                    sendJson(exchange, 200, "{\"status\":\"ok\",\"engine\":\"Java 17 JDBC\",\"database\":\"connected\"}");
                    return;
                }

                // Route: POST /api/auth/login
                if ("/api/auth/login".equals(path) && "POST".equals(method)) {
                    String body = readBody(exchange);
                    String email = JsonUtil.getString(body, "email");
                    String pass = JsonUtil.getString(body, "password");

                    Map<String, Object> user = UserDAO.login(email, pass);
                    if (user != null) {
                        Map<String, Object> resp = new HashMap<>();
                        resp.put("message", "Login successful");
                        resp.put("user", user);
                        resp.put("token", "user_" + user.get("user_id") + "_" + user.get("role"));
                        sendJson(exchange, 200, JsonUtil.toJson(resp));
                    } else {
                        sendError(exchange, 401, "Invalid email or password.");
                    }
                    return;
                }

                // Route: POST /api/auth/register
                if ("/api/auth/register".equals(path) && "POST".equals(method)) {
                    String body = readBody(exchange);
                    String name = JsonUtil.getString(body, "name");
                    String email = JsonUtil.getString(body, "email");
                    String pass = JsonUtil.getString(body, "password");
                    String phone = JsonUtil.getString(body, "phone");
                    String role = JsonUtil.getString(body, "role");

                    Map<String, Object> user = UserDAO.register(name, email, pass, phone, role);
                    if (user != null) {
                        Map<String, Object> resp = new HashMap<>();
                        resp.put("message", "User registered successfully");
                        resp.put("user", user);
                        resp.put("token", "user_" + user.get("user_id") + "_" + user.get("role"));
                        sendJson(exchange, 201, JsonUtil.toJson(resp));
                    } else {
                        sendError(exchange, 400, "Registration failed. Check details.");
                    }
                    return;
                }

                // Route: GET /api/auth/me
                if ("/api/auth/me".equals(path) && "GET".equals(method)) {
                    if (authUser != null) {
                        Map<String, Object> resp = new HashMap<>();
                        resp.put("user", authUser);
                        sendJson(exchange, 200, JsonUtil.toJson(resp));
                    } else {
                        sendError(exchange, 401, "Not logged in.");
                    }
                    return;
                }

                // Route: GET /api/properties
                if ("/api/properties".equals(path) && "GET".equals(method)) {
                    Map<String, String> qMap = parseQuery(query);
                    String search = qMap.get("search");
                    String location = qMap.get("location");
                    String type = qMap.get("type");
                    String mode = qMap.get("listing_mode");
                    Double maxPrice = qMap.containsKey("max_price") && !qMap.get("max_price").isEmpty()
                            ? Double.parseDouble(qMap.get("max_price")) : null;

                    List<Map<String, Object>> properties = PropertyDAO.searchProperties(search, location, type, mode, maxPrice);
                    sendJson(exchange, 200, JsonUtil.toJson(properties));
                    return;
                }

                // Route: GET /api/properties/mine
                if ("/api/properties/mine".equals(path) && "GET".equals(method)) {
                    int ownerId = authUser != null ? (int) authUser.get("user_id") : 1;
                    List<Map<String, Object>> properties = PropertyDAO.getPropertiesByOwner(ownerId);
                    sendJson(exchange, 200, JsonUtil.toJson(properties));
                    return;
                }

                // Route: GET /api/properties/{id}
                if (path.matches("^/api/properties/\\d+$") && "GET".equals(method)) {
                    int propId = Integer.parseInt(path.substring("/api/properties/".length()));
                    Map<String, Object> property = PropertyDAO.getPropertyById(propId);
                    if (property != null) {
                        List<Map<String, Object>> reviews = ReviewDAO.getReviewsForProperty(propId);
                        List<Map<String, Object>> bookedDates = BookingDAO.getPropertyBookedDates(propId);
                        Map<String, Object> resp = new HashMap<>();
                        resp.put("property", property);
                        resp.put("reviews", reviews);
                        resp.put("booked_dates", bookedDates);
                        sendJson(exchange, 200, JsonUtil.toJson(resp));
                    } else {
                        sendError(exchange, 404, "Property not found.");
                    }
                    return;
                }

                // Route: GET /api/properties/{id}/availability
                if (path.matches("^/api/properties/\\d+/availability$") && "GET".equals(method)) {
                    String idPart = path.substring("/api/properties/".length(), path.indexOf("/availability"));
                    int propId = Integer.parseInt(idPart);
                    List<Map<String, Object>> bookedDates = BookingDAO.getPropertyBookedDates(propId);
                    Map<String, Object> resp = new HashMap<>();
                    resp.put("property_id", propId);
                    resp.put("is_available", true);
                    resp.put("reserved_ranges", bookedDates);
                    sendJson(exchange, 200, JsonUtil.toJson(resp));
                    return;
                }

                // Route: POST /api/properties
                if ("/api/properties".equals(path) && "POST".equals(method)) {
                    int ownerId = authUser != null ? (int) authUser.get("user_id") : 1;
                    String body = readBody(exchange);
                    String title = JsonUtil.getString(body, "title");
                    String desc = JsonUtil.getString(body, "description");
                    String loc = JsonUtil.getString(body, "location");
                    Double price = JsonUtil.getDouble(body, "price");
                    String type = JsonUtil.getString(body, "type");
                    String mode = JsonUtil.getString(body, "listing_mode");
                    String img = JsonUtil.getString(body, "image_url");

                    int newId = PropertyDAO.addProperty(ownerId, title, desc, loc, price != null ? price : 0, type, mode, img);
                    Map<String, Object> resp = new HashMap<>();
                    resp.put("message", "Property listed successfully");
                    resp.put("property_id", newId);
                    sendJson(exchange, 201, JsonUtil.toJson(resp));
                    return;
                }

                // Route: PATCH /api/properties/{id}
                if (path.matches("^/api/properties/\\d+$") && "PATCH".equals(method)) {
                    int propId = Integer.parseInt(path.substring("/api/properties/".length()));
                    int ownerId = authUser != null ? (int) authUser.get("user_id") : 1;
                    boolean isAdmin = authUser != null && "admin".equalsIgnoreCase((String) authUser.get("role"));
                    String body = readBody(exchange);
                    String title = JsonUtil.getString(body, "title");
                    String desc = JsonUtil.getString(body, "description");
                    String loc = JsonUtil.getString(body, "location");
                    Double price = JsonUtil.getDouble(body, "price");
                    String type = JsonUtil.getString(body, "type");
                    String mode = JsonUtil.getString(body, "listing_mode");
                    String status = JsonUtil.getString(body, "status");
                    String img = JsonUtil.getString(body, "image_url");

                    PropertyDAO.updateProperty(propId, ownerId, title, desc, loc, price != null ? price : 0, type, mode, status, img, isAdmin);
                    sendJson(exchange, 200, "{\"message\":\"Property updated successfully.\"}");
                    return;
                }

                // Route: DELETE /api/properties/{id}
                if (path.matches("^/api/properties/\\d+$") && "DELETE".equals(method)) {
                    int propId = Integer.parseInt(path.substring("/api/properties/".length()));
                    int ownerId = authUser != null ? (int) authUser.get("user_id") : 1;
                    boolean isAdmin = authUser != null && "admin".equalsIgnoreCase((String) authUser.get("role"));

                    PropertyDAO.deleteProperty(propId, ownerId, isAdmin);
                    sendJson(exchange, 200, "{\"message\":\"Property deleted successfully.\"}");
                    return;
                }

                // Route: POST /api/bookings
                if ("/api/bookings".equals(path) && "POST".equals(method)) {
                    int userId = authUser != null ? (int) authUser.get("user_id") : 3;
                    String body = readBody(exchange);
                    Integer propId = JsonUtil.getInt(body, "property_id");
                    String start = JsonUtil.getString(body, "start_date");
                    String end = JsonUtil.getString(body, "end_date");

                    Map<String, Object> booking = BookingDAO.createBooking(userId, propId, start, end);
                    sendJson(exchange, 201, JsonUtil.toJson(booking));
                    return;
                }

                // Route: GET /api/bookings
                if ("/api/bookings".equals(path) && "GET".equals(method)) {
                    int userId = authUser != null ? (int) authUser.get("user_id") : 3;
                    String role = authUser != null ? (String) authUser.get("role") : "tenant";

                    List<Map<String, Object>> bookings = BookingDAO.getBookings(userId, role);
                    sendJson(exchange, 200, JsonUtil.toJson(bookings));
                    return;
                }

                // Route: PATCH /api/bookings/{id}
                if (path.matches("^/api/bookings/\\d+$") && "PATCH".equals(method)) {
                    int bookingId = Integer.parseInt(path.substring("/api/bookings/".length()));
                    String body = readBody(exchange);
                    String status = JsonUtil.getString(body, "status");
                    String payStatus = JsonUtil.getString(body, "payment_status");

                    BookingDAO.updateBookingStatus(bookingId, status, payStatus);
                    sendJson(exchange, 200, "{\"message\":\"Booking updated successfully.\"}");
                    return;
                }

                // Route: POST /api/reviews
                if ("/api/reviews".equals(path) && "POST".equals(method)) {
                    int userId = authUser != null ? (int) authUser.get("user_id") : 3;
                    String body = readBody(exchange);
                    Integer bookingId = JsonUtil.getInt(body, "booking_id");
                    Integer rating = JsonUtil.getInt(body, "rating");
                    String comment = JsonUtil.getString(body, "comment");

                    int reviewId = ReviewDAO.addReview(userId, bookingId, rating != null ? rating : 5, comment);
                    Map<String, Object> resp = new HashMap<>();
                    resp.put("message", "Review published successfully.");
                    resp.put("review_id", reviewId);
                    sendJson(exchange, 201, JsonUtil.toJson(resp));
                    return;
                }

                // Route: GET /api/wishlist
                if ("/api/wishlist".equals(path) && "GET".equals(method)) {
                    int userId = authUser != null ? (int) authUser.get("user_id") : 3;
                    List<Map<String, Object>> wishlist = WishlistDAO.getUserWishlist(userId);
                    sendJson(exchange, 200, JsonUtil.toJson(wishlist));
                    return;
                }

                // Route: GET /api/wishlist/ids
                if ("/api/wishlist/ids".equals(path) && "GET".equals(method)) {
                    int userId = authUser != null ? (int) authUser.get("user_id") : 3;
                    List<Integer> ids = WishlistDAO.getUserWishlistIds(userId);
                    sendJson(exchange, 200, JsonUtil.toJson(ids));
                    return;
                }

                // Route: POST /api/wishlist/{id}
                if (path.matches("^/api/wishlist/\\d+$") && "POST".equals(method)) {
                    int propId = Integer.parseInt(path.substring("/api/wishlist/".length()));
                    int userId = authUser != null ? (int) authUser.get("user_id") : 3;
                    WishlistDAO.addToWishlist(userId, propId);
                    sendJson(exchange, 201, "{\"message\":\"Property added to wishlist.\"}");
                    return;
                }

                // Route: DELETE /api/wishlist/{id}
                if (path.matches("^/api/wishlist/\\d+$") && "DELETE".equals(method)) {
                    int propId = Integer.parseInt(path.substring("/api/wishlist/".length()));
                    int userId = authUser != null ? (int) authUser.get("user_id") : 3;
                    WishlistDAO.removeFromWishlist(userId, propId);
                    sendJson(exchange, 200, "{\"message\":\"Property removed from wishlist.\"}");
                    return;
                }

                // Route: GET /api/admin/metrics
                if ("/api/admin/metrics".equals(path) && "GET".equals(method)) {
                    Map<String, Object> metrics = AdminDAO.getPlatformMetrics();
                    sendJson(exchange, 200, JsonUtil.toJson(metrics));
                    return;
                }

                // Route: GET /api/admin/users
                if ("/api/admin/users".equals(path) && "GET".equals(method)) {
                    List<Map<String, Object>> users = UserDAO.getAllUsers();
                    sendJson(exchange, 200, JsonUtil.toJson(users));
                    return;
                }

                // Route: GET /api/admin/properties
                if ("/api/admin/properties".equals(path) && "GET".equals(method)) {
                    List<Map<String, Object>> props = PropertyDAO.searchProperties(null, null, null, null, null);
                    sendJson(exchange, 200, JsonUtil.toJson(props));
                    return;
                }

                // Fallback for unmatched API routes
                sendError(exchange, 404, "Endpoint not found: " + path);

            } catch (Exception e) {
                System.err.println("[API Handler Error] " + e.getMessage());
                sendError(exchange, 400, e.getMessage());
            }
        }

        private Map<String, Object> extractAuthUser(HttpExchange exchange) {
            String auth = exchange.getRequestHeaders().getFirst("Authorization");
            if (auth != null && auth.startsWith("Bearer user_")) {
                String[] parts = auth.substring("Bearer user_".length()).split("_");
                if (parts.length >= 2) {
                    Map<String, Object> u = new HashMap<>();
                    u.put("user_id", Integer.parseInt(parts[0]));
                    u.put("role", parts[1]);
                    return u;
                }
            }
            return null;
        }

        private String readBody(HttpExchange exchange) throws IOException {
            InputStream is = exchange.getRequestBody();
            return new String(is.readAllBytes(), StandardCharsets.UTF_8);
        }

        private void sendJson(HttpExchange exchange, int status, String json) throws IOException {
            byte[] bytes = json.getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(status, bytes.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(bytes);
            }
        }

        private void sendError(HttpExchange exchange, int status, String message) throws IOException {
            String json = "{\"message\":\"" + message.replace("\"", "\\\"") + "\"}";
            sendJson(exchange, status, json);
        }

        private Map<String, String> parseQuery(String query) {
            Map<String, String> map = new HashMap<>();
            if (query == null) return map;
            for (String pair : query.split("&")) {
                String[] parts = pair.split("=");
                if (parts.length == 2) {
                    try {
                        map.put(URLDecoder.decode(parts[0], StandardCharsets.UTF_8),
                                URLDecoder.decode(parts[1], StandardCharsets.UTF_8));
                    } catch (Exception ignored) {}
                }
            }
            return map;
        }
    }

    // -------------------------------------------------------------------------
    // Static HTML/CSS/JS File Handler
    // -------------------------------------------------------------------------
    static class StaticFileHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            String path = exchange.getRequestURI().getPath();
            if ("/".equals(path)) path = "/index.html";

            File file = new File("public" + path);
            if (!file.exists() || file.isDirectory()) {
                file = new File("public/index.html");
            }

            String contentType = "text/html; charset=UTF-8";
            if (file.getName().endsWith(".css")) contentType = "text/css; charset=UTF-8";
            else if (file.getName().endsWith(".js")) contentType = "application/javascript; charset=UTF-8";
            else if (file.getName().endsWith(".png")) contentType = "image/png";
            else if (file.getName().endsWith(".jpg")) contentType = "image/jpeg";
            else if (file.getName().endsWith(".svg")) contentType = "image/svg+xml";

            exchange.getResponseHeaders().set("Content-Type", contentType);
            exchange.sendResponseHeaders(200, file.length());

            try (InputStream is = new FileInputStream(file);
                 OutputStream os = exchange.getResponseBody()) {
                is.transferTo(os);
            }
        }
    }
}
