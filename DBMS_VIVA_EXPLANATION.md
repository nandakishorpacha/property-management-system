# Property Management System — DBMS Project & Viva Guide
### Comprehensive Explanation for Students & Teachers
**Team**: Anandakrishna, Aravind B, Nandakishor P, Kiran Dev, S Anuranjan  
**Stack**: HTML5, CSS3, JavaScript (Frontend) | Java 17 + JDBC (Backend) | MySQL 8.0 (Database)

---

## 1. High-Level Architecture (How It Works)

```text
+-------------------------------------------------------------+
|                     BROWSER FRONTEND                        |
|       (HTML5 Layout + CSS3 Styles + Vanilla JavaScript)      |
|    - User browses properties, requests bookings, leaves     |
|      reviews, and toggles wishlist.                         |
+-------------------------------------------------------------+
                              ↕ HTTP (JSON / REST API)
+-------------------------------------------------------------+
|                      JAVA 17 BACKEND                        |
|                (Server.java on port 8080)                   |
|    - Handles incoming HTTP requests (GET, POST, PATCH, etc.)|
|    - Calls Data Access Objects (UserDAO, PropertyDAO, etc.) |
+-------------------------------------------------------------+
                              ↕ Java Database Connectivity (JDBC)
+-------------------------------------------------------------+
|                 JDBC DRIVER & CONNECTION                    |
|      (com.mysql.cj.jdbc.Driver via DriverManager)           |
|    - Translates Java method calls into standard SQL commands|
|    - Sends PreparedStatement to MySQL Server                |
+-------------------------------------------------------------+
                              ↕ SQL Queries (Port 3306)
+-------------------------------------------------------------+
|                     RELATIONAL DATABASE                     |
|                   (MySQL 8.0 Server)                        |
|    - Executes queries on 5 normalized relational tables:    |
|      users, properties, bookings, reviews, wishlist.        |
+-------------------------------------------------------------+
```

### Complete Request Lifecycle Step-by-Step
1. **User Action**: A tenant clicks **"Book Stay"** on a property in the browser.
2. **JavaScript Fetch**: `app.js` captures `property_id`, `start_date`, `end_date`, and sends an HTTP POST request to `http://localhost:8080/api/bookings`.
3. **Java Server Routing**: `Server.java` receives the HTTP request, parses JSON parameters, and calls `BookingDAO.createBooking(...)`.
4. **JDBC SQL Execution**:
   - `DBConnection.getConnection()` opens a connection to MySQL.
   - `BookingDAO` prepares a SQL statement using `PreparedStatement`.
   - MySQL verifies that dates do not conflict with an already confirmed booking.
   - MySQL inserts the row into the `bookings` table.
5. **Response Sent Back**: Java receives the auto-generated `booking_id` from MySQL, formats a JSON response, and sends it to the browser.
6. **UI Update**: `app.js` displays a success toast and redirects the user to their dashboard.

---

## 2. Relational Database Design (The 5 Modules)

Our relational database `property_management` contains **5 interconnected tables** normalized up to **Third Normal Form (3NF)**:

### Table 1: `users` (Module 1 — Users & Authentication)
* **`user_id`**: INT UNSIGNED, AUTO_INCREMENT, **PRIMARY KEY** (Unique identifier for each user).
* **`name`**: VARCHAR(100), NOT NULL (Full name of user).
* **`email`**: VARCHAR(150), NOT NULL, **UNIQUE** (Prevents duplicate accounts).
* **`role`**: ENUM('owner', 'tenant', 'buyer', 'admin') (Enforces Role-Based Access Control).
* **`password`**: VARCHAR(255), NOT NULL.
* **`phone`**: VARCHAR(25).
* **`created_at`**: TIMESTAMP DEFAULT CURRENT_TIMESTAMP.

### Table 2: `properties` (Module 2 — Properties & Listings)
* **`property_id`**: INT UNSIGNED, AUTO_INCREMENT, **PRIMARY KEY**.
* **`owner_id`**: INT UNSIGNED, **FOREIGN KEY** REFERENCES `users(user_id)` ON DELETE CASCADE.
  * *Relationship*: **1:N (One owner has many properties)**.
* **`title`**: VARCHAR(180) (Listing title).
* **`description`**: TEXT (Property details).
* **`location`**: VARCHAR(180) (City/Locality, e.g., Indiranagar, Bengaluru).
* **`price`**: DECIMAL(12,2) (Daily rent or total purchase price).
* **`type`**: ENUM('apartment', 'house', 'villa', 'commercial', 'land').
* **`listing_mode`**: ENUM('rent', 'sale').
* **`status`**: ENUM('available', 'unavailable', 'sold').
* **`image_url`**: VARCHAR(500).

### Table 3: `bookings` (Module 3 — Bookings & Rentals)
* **`booking_id`**: INT UNSIGNED, AUTO_INCREMENT, **PRIMARY KEY**.
* **`user_id`**: INT UNSIGNED, **FOREIGN KEY** REFERENCES `users(user_id)` ON DELETE CASCADE.
  * *Relationship*: **1:N (One user can make many bookings)**.
* **`property_id`**: INT UNSIGNED, **FOREIGN KEY** REFERENCES `properties(property_id)` ON DELETE CASCADE.
  * *Relationship*: **1:N (One property can have many bookings over time)**.
* **`start_date`**, **`end_date`**: DATE NOT NULL.
  * *Constraint*: `CHECK (end_date > start_date)` (Check-out must be after check-in).
* **`status`**: ENUM('pending', 'confirmed', 'rejected', 'completed', 'cancelled').
* **`amount`**: DECIMAL(12,2) (Calculated as `daily_price * total_days` or purchase price).
* **`payment_status`**: ENUM('pending', 'paid', 'refunded').

### Table 4: `reviews` (Module 4 — Reviews & Ratings)
* **`review_id`**: INT UNSIGNED, AUTO_INCREMENT, **PRIMARY KEY**.
* **`user_id`**: INT UNSIGNED, **FOREIGN KEY** REFERENCES `users(user_id)`.
* **`property_id`**: INT UNSIGNED, **FOREIGN KEY** REFERENCES `properties(property_id)`.
* **`booking_id`**: INT UNSIGNED, **FOREIGN KEY** REFERENCES `bookings(booking_id)` **UNIQUE**.
  * *Key Invariant*: **1:1 relationship with booking** (`UNIQUE booking_id`). A tenant can only leave **ONE review per completed booking**, completely eliminating fake reviews!
* **`rating`**: TINYINT UNSIGNED `CHECK (rating BETWEEN 1 AND 5)`.
* **`comment`**: TEXT.

### Table 5: `wishlist` (Module 5 — Wishlist / Favorites)
* **`wishlist_id`**: INT UNSIGNED, AUTO_INCREMENT, **PRIMARY KEY**.
* **`user_id`**: INT UNSIGNED, **FOREIGN KEY** REFERENCES `users(user_id)`.
* **`property_id`**: INT UNSIGNED, **FOREIGN KEY** REFERENCES `properties(property_id)`.
* **`UNIQUE (user_id, property_id)`**: Composite unique constraint ensuring a user cannot save the same property multiple times.
* *Relationship*: **Many-to-Many (M:N)** associative junction table between Users and Properties.

---

## 3. Explaining JDBC Connection Code (`DBConnection.java`)

```java
public class DBConnection {
    private static final String JDBC_URL = 
        "jdbc:mysql://localhost:3306/property_management"
        + "?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC&characterEncoding=UTF-8";
    
    private static final String DB_USER = "root";
    private static final String DB_PASS = "mysql";

    public static Connection getConnection() throws SQLException {
        // Line 1: Load Driver Class into Memory
        Class.forName("com.mysql.cj.jdbc.Driver");

        // Line 2: Request connection from DriverManager
        return DriverManager.getConnection(JDBC_URL, DB_USER, DB_PASS);
    }
}
```

### Line-by-Line Breakdown:
1. `Class.forName("com.mysql.cj.jdbc.Driver")`:
   - Tells the Java Virtual Machine (JVM) to find and load the MySQL JDBC driver class from `lib/mysql-connector-j.jar`.
   - This registers MySQL's driver with Java's `DriverManager`.
2. `DriverManager.getConnection(url, user, password)`:
   - Takes the connection string, username (`root`), and password (`mysql`).
   - Opens a TCP socket on port `3306` to MySQL Server.
   - Performs handshake and authentication.
   - Returns a `java.sql.Connection` object, which is our live pipe to execute SQL queries.
3. **URL Parameters Explained**:
   - `jdbc:mysql://`: The JDBC sub-protocol.
   - `localhost:3306`: Hostname and port.
   - `/property_management`: Target database.
   - `useSSL=false`: Disables SSL certificate verification for local development.
   - `serverTimezone=UTC`: Synchronizes Java and MySQL time zones to avoid date discrepancies.

---

## 4. Line-by-Line Explanation of Every SQL Query in the Project

### Query 1: User Login (`UserDAO.java`)
```sql
SELECT user_id, name, email, role, phone, password 
FROM users 
WHERE email = ?;
```
* **Explanation**: Looks up the user row matching the entered email. The `?` placeholder is replaced by `pstmt.setString(1, email)` to prevent SQL Injection.
* **Result**: If a record is found, Java verifies the password and returns user profile details and role.

---

### Query 2: User Registration (`UserDAO.java`)
```sql
INSERT INTO users (name, email, password, phone, role) 
VALUES (?, ?, ?, ?, ?);
```
* **Explanation**: Adds a new record to the `users` table.
* **Primary Key handling**: `Statement.RETURN_GENERATED_KEYS` is passed to retrieve the auto-generated `user_id`.

---

### Query 3: Multi-Table Property Search & Aggregates (`PropertyDAO.java`)
```sql
SELECT p.*, u.name AS owner_name, u.phone AS owner_phone, u.email AS owner_email,
       ROUND(COALESCE(AVG(r.rating), 0), 1) AS average_rating,
       COUNT(DISTINCT r.review_id) AS review_count
FROM properties p
JOIN users u ON u.user_id = p.owner_id
LEFT JOIN reviews r ON r.property_id = p.property_id
WHERE p.status = 'available'
  AND (p.title LIKE ? OR p.description LIKE ? OR p.location LIKE ?)
  AND p.location LIKE ?
  AND p.type = ?
  AND p.listing_mode = ?
  AND p.price <= ?
GROUP BY p.property_id
ORDER BY p.created_at DESC;
```
* **Line-by-Line Explanation**:
  * `JOIN users u ON u.user_id = p.owner_id`: **INNER JOIN** connecting each property with its owner in `users`.
  * `LEFT JOIN reviews r ON r.property_id = p.property_id`: **LEFT OUTER JOIN** so that newly listed properties with zero reviews still appear in search results.
  * `AVG(r.rating)` & `COUNT(DISTINCT r.review_id)`: **Aggregate functions** that compute the average star rating and review count per property.
  * `COALESCE(AVG(r.rating), 0)`: If a property has no reviews, `AVG` returns `NULL`. `COALESCE` converts `NULL` to `0`.
  * `ROUND(..., 1)`: Formats the average rating to 1 decimal place (e.g. 4.8).
  * `WHERE p.status = 'available'`: Disallows rented or sold properties from search.
  * `LIKE ?`: Performs substring/fuzzy matching for search keywords (e.g., `%Indiranagar%`).
  * `GROUP BY p.property_id`: Groups rows by property primary key so aggregates can be calculated.
  * `ORDER BY p.created_at DESC`: Shows newest properties first.

---

### Query 4: Date Clash / Overlapping Booking Prevention (`BookingDAO.java`)
```sql
SELECT booking_id 
FROM bookings 
WHERE property_id = ? 
  AND status = 'confirmed' 
  AND start_date < ? 
  AND end_date > ?;
```
* **Why this is critical for DBMS Viva**:
  * Prevents double-booking!
  * If an existing confirmed booking starts before the requested check-out date (`start_date < requested_end_date`) AND ends after the requested check-in date (`end_date > requested_start_date`), the dates overlap.
  * If this query returns any row, Java throws an exception: *"Selected dates conflict with an existing confirmed booking."*

---

### Query 4B: Automated Availability Detection (`BookingDAO.java`)
```sql
SELECT booking_id, start_date, end_date, status 
FROM bookings 
WHERE property_id = ? 
  AND status IN ('confirmed', 'completed')
ORDER BY start_date ASC;
```
* **Why this makes your project stand out to your teacher**:
  * Automatically pulls all reserved windows from the relational database.
  * The frontend displays these dates as badges (e.g. `🔒 2026-10-10 → 2026-10-15`).
  * As the renter picks dates, the UI runs a live clash test: `start < existing.end AND end > existing.start`.
  * If there is an overlap, it highlights the conflict in red and disables the submit button!
  * If there is no overlap, it displays a green `✅ Selected Dates are 100% Available!` badge with exact pricing and check-in / check-out time slots.
  * Includes a **"⚡ Find Next Free Dates"** button that automatically searches and selects the earliest open 4-day block.


---

### Query 5: Create Booking Record (`BookingDAO.java`)
```sql
INSERT INTO bookings (user_id, property_id, start_date, end_date, amount, status, payment_status)
VALUES (?, ?, ?, ?, ?, 'pending', 'pending');
```
* **Explanation**: Inserts a booking with initial status `'pending'` and payment status `'pending'`. The total amount is computed in Java as `daily_price * number_of_days`.

---

### Query 6: Verified Review Submission (`ReviewDAO.java`)
```sql
-- Step 1: Verification check
SELECT property_id 
FROM bookings 
WHERE booking_id = ? AND user_id = ? AND status = 'completed';

-- Step 2: Insert review
INSERT INTO reviews (user_id, property_id, booking_id, rating, comment)
VALUES (?, ?, ?, ?, ?);
```
* **Explanation**:
  * Step 1 checks the business rule: only a user whose booking is marked **`completed`** is permitted to review.
  * Step 2 inserts the review. Since `booking_id` has a **UNIQUE constraint** in the table definition, any attempt to review twice on the same booking will be rejected by MySQL (`ER_DUP_ENTRY`).

---

### Query 7: Wishlist Junction Table (`WishlistDAO.java`)
```sql
-- Add to Wishlist:
INSERT IGNORE INTO wishlist (user_id, property_id) VALUES (?, ?);

-- Remove from Wishlist:
DELETE FROM wishlist WHERE user_id = ? AND property_id = ?;

-- View User Wishlist with Property Details:
SELECT w.wishlist_id, p.*, u.name AS owner_name
FROM wishlist w
JOIN properties p ON p.property_id = w.property_id
JOIN users u ON u.user_id = p.owner_id
WHERE w.user_id = ?
ORDER BY w.added_date DESC;
```
* **Explanation**:
  * `INSERT IGNORE`: If the property is already in the wishlist, MySQL silently ignores the duplicate rather than throwing a crash error.
  * The `SELECT` query uses a **JOIN** between `wishlist`, `properties`, and `users` to display all saved properties for that user.

---

### Query 8: Platform Metrics Aggregate (`AdminDAO.java`)
```sql
SELECT COUNT(*) AS total FROM users;
SELECT COUNT(*) AS total FROM properties;
SELECT COUNT(*) AS total FROM bookings;
SELECT COUNT(*) AS total FROM reviews;
SELECT COUNT(*) AS total FROM wishlist;
```
* **Explanation**: Aggregation queries returning live record counts for the administrative oversight panel.

---

## 5. PreparedStatement vs. Statement (Key Viva Topic)

| Feature | `Statement` | `PreparedStatement` (Used in Our Project) |
| :--- | :--- | :--- |
| **Compilation** | Compiled every time it executes | Pre-compiled once by MySQL database server |
| **Performance** | Slower for repetitive queries | Faster due to pre-compilation |
| **SQL Injection** | **Vulnerable!** Concatenating strings allows hackers to manipulate SQL | **Immune to SQL Injection!** Input values are safely escaped and treated strictly as literal data |
| **Syntax** | String concatenation: `"WHERE id=" + id` | Placeholders: `"WHERE id = ?"` and `pstmt.setInt(1, id)` |

---

## 6. Top 10 Viva Questions & Ready-to-Answer Responses

#### Q1: What is the purpose of JDBC in this project?
> **Answer**: *"JDBC (Java Database Connectivity) is an API provided by Java that enables our Java backend to communicate with relational database engines like MySQL. It provides standard classes like `DriverManager`, `Connection`, `PreparedStatement`, and `ResultSet` to send SQL queries and retrieve results."*

#### Q2: How did you prevent SQL Injection?
> **Answer**: *"We strictly used `PreparedStatement` with parameterized placeholders (`?`) instead of concatenating strings. The database driver treats parameter values strictly as data values, never as executable SQL commands."*

#### Q3: What is the difference between `executeQuery()` and `executeUpdate()`?
> **Answer**: 
> - *`executeQuery()` is used for `SELECT` queries. It returns a `ResultSet` object containing rows of data.*
> - *`executeUpdate()` is used for DDL/DML statements like `INSERT`, `UPDATE`, and `DELETE`. It returns an integer representing the number of rows affected in the database.*

#### Q4: What is the normalization level of your database?
> **Answer**: *"Our database is normalized up to **Third Normal Form (3NF)**:
> 1. **1NF**: All columns contain atomic (indivisible) values and each row has a primary key.
> 2. **2NF**: It is in 1NF and all non-key attributes are fully functionally dependent on the primary key (no partial dependencies).
> 3. **3NF**: It is in 2NF and there are no transitive dependencies (non-key columns do not depend on other non-key columns)."*

#### Q5: What relationships exist between your tables?
> **Answer**:
> - *`users` to `properties`: **1 to Many (1:N)** — One owner can list many properties.*
> - *`users` to `bookings`: **1 to Many (1:N)** — One tenant can make many bookings.*
> - *`properties` to `bookings`: **1 to Many (1:N)** — One property can have multiple bookings across different dates.*
> - *`users` to `properties` (via `wishlist`): **Many to Many (M:N)** — Users can save multiple properties, and properties can be saved by multiple users.*
> - *`bookings` to `reviews`: **1 to 1 (1:0..1)** — A completed booking can receive at most one review (`UNIQUE booking_id`).*

#### Q6: How do you prevent overlapping bookings for the same property?
> **Answer**: *"Before creating a booking, we execute a validation query checking if any existing confirmed booking satisfies: `start_date < requested_end_date AND end_date > requested_start_date`. If a row matches, the system rejects the booking."*

#### Q7: How does your frontend communicate with the Java backend?
> **Answer**: *"The frontend uses modern JavaScript's `fetch()` API to make asynchronous HTTP REST calls (GET, POST, PATCH, DELETE) to our Java HTTP server on port 8080. Data is exchanged in standard JSON format."*

#### Q8: What does `ON DELETE CASCADE` do on foreign keys?
> **Answer**: *"If a parent record (such as an owner in `users`) is deleted, MySQL automatically deletes all associated child records (such as their listings in `properties` and bookings) to maintain referential integrity without leaving orphaned records."*

#### Q9: What is the role of `ResultSet.next()`?
> **Answer**: *"A `ResultSet` cursor initially points before the first row of data. Calling `rs.next()` moves the cursor to the next row. It returns `true` if a row exists, and `false` when there are no more rows."*

#### Q10: How do you enforce that only real customers can write a review?
> **Answer**: *"In `ReviewDAO.java`, before running `INSERT INTO reviews`, we run a check query: `SELECT property_id FROM bookings WHERE booking_id = ? AND user_id = ? AND status = 'completed'`. If the booking is not completed or does not belong to that user, the review is blocked. Furthermore, `booking_id` is marked `UNIQUE` so duplicate reviews cannot be created."*
