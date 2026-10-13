# Property Management System (PMS) — ER Model & Project Report Documentation
**Project Title**: Property Management System (A Unified 5-Module Relational DBMS)  
**Authors**: Anandakrishna, Aravind B, Nandakishor P, Kiran Dev, S Anuranjan  
**Stack**: HTML5, CSS3, JavaScript | Java 17 (JDBC) | MySQL 8.0  

---

## 1. Entity-Relationship (ER) Diagram

```mermaid
erDiagram
    USERS ||--o{ PROPERTIES : "owns / lists (1:N)"
    USERS ||--o{ BOOKINGS : "makes (1:N)"
    PROPERTIES ||--o{ BOOKINGS : "has (1:N)"
    BOOKINGS ||--o| REVIEWS : "validates (1:0..1)"
    USERS ||--o{ REVIEWS : "writes (1:N)"
    PROPERTIES ||--o{ REVIEWS : "receives (1:N)"
    USERS ||--o{ WISHLIST : "saves (1:N)"
    PROPERTIES ||--o{ WISHLIST : "saved in (1:N)"

    USERS {
        int user_id PK
        string name
        string email UK
        enum role
        string password
        string phone
        timestamp created_at
    }

    PROPERTIES {
        int property_id PK
        int owner_id FK
        string title
        text description
        string location
        decimal price
        enum type
        enum listing_mode
        enum status
        string image_url
        timestamp created_at
        timestamp updated_at
    }

    BOOKINGS {
        int booking_id PK
        int user_id FK
        int property_id FK
        date start_date
        date end_date
        decimal amount
        enum status
        enum payment_status
        timestamp created_at
    }

    REVIEWS {
        int review_id PK
        int user_id FK
        int property_id FK
        int booking_id FK_UK
        int rating
        text comment
        timestamp review_date
    }

    WISHLIST {
        int wishlist_id PK
        int user_id FK
        int property_id FK
        timestamp added_date
    }
```

---

## 2. Relational Schema Representation (Underlined Primary Keys, Denoted Foreign Keys)

* **USERS** (<ins>user_id</ins>, name, email, role, password, phone, created_at)
* **PROPERTIES** (<ins>property_id</ins>, *owner_id*, title, description, location, price, type, listing_mode, status, image_url, created_at, updated_at)  
  *Foreign Key*: `owner_id` &rarr; `USERS(user_id)`
* **BOOKINGS** (<ins>booking_id</ins>, *user_id*, *property_id*, start_date, end_date, amount, status, payment_status, created_at)  
  *Foreign Keys*: `user_id` &rarr; `USERS(user_id)`, `property_id` &rarr; `PROPERTIES(property_id)`
* **REVIEWS** (<ins>review_id</ins>, *user_id*, *property_id*, *booking_id*, rating, comment, review_date)  
  *Foreign Keys*: `user_id` &rarr; `USERS(user_id)`, `property_id` &rarr; `PROPERTIES(property_id)`, `booking_id` &rarr; `BOOKINGS(booking_id)` [UNIQUE]
* **WISHLIST** (<ins>wishlist_id</ins>, *user_id*, *property_id*, added_date)  
  *Foreign Keys*: `user_id` &rarr; `USERS(user_id)`, `property_id` &rarr; `PROPERTIES(property_id)`  
  *Composite Unique Key*: (`user_id`, `property_id`)

---

## 3. Normalization Proof (Up to 3NF)

### First Normal Form (1NF)
* Every column contains **atomic (indivisible) values**.
* There are no repeating groups or multivalued columns (e.g., telephone numbers or multiple images are stored appropriately or in singular atomic fields).
* A unique **Primary Key** is established for each relation.

### Second Normal Form (2NF)
* The schema is in **1NF**.
* All non-key attributes are **fully functionally dependent** on the primary key.
* There are no partial dependencies (especially in the `WISHLIST` junction table where the surrogate key `wishlist_id` is the primary key and non-key attributes depend on the entire key).

### Third Normal Form (3NF)
* The schema is in **2NF**.
* There are **no transitive dependencies** ($X \rightarrow Y$ and $Y \rightarrow Z$ where $Z$ is non-prime).
* For example, the `PROPERTIES` table stores `owner_id`, but does NOT store `owner_name` or `owner_phone`; instead, owner information is retrieved via relational JOINs with `USERS`.

---

## 4. Referential Integrity & Constraints Summary

| Table | Constraint Type | Column(s) | Details / Rule |
| :--- | :--- | :--- | :--- |
| `users` | `UNIQUE` | `email` | Disallows duplicate registrations with the same email. |
| `users` | `ENUM` | `role` | Restricted strictly to `'owner'`, `'tenant'`, `'buyer'`, or `'admin'`. |
| `properties` | `FOREIGN KEY` | `owner_id` | References `users(user_id)` with `ON DELETE CASCADE`. |
| `bookings` | `CHECK` | `end_date > start_date` | Disallows negative or zero-duration booking intervals. |
| `bookings` | `FOREIGN KEY` | `user_id`, `property_id` | References `users(user_id)` and `properties(property_id)` with `ON DELETE CASCADE`. |
| `reviews` | `CHECK` | `rating BETWEEN 1 AND 5` | Constrains rating to valid integer scale from 1 to 5. |
| `reviews` | `UNIQUE` | `booking_id` | Ensures **1:1** mapping with completed booking (prevents fake/duplicate reviews). |
| `wishlist` | `UNIQUE` | `user_id, property_id` | Prevents saving the same property more than once per user. |

---

## 5. Advanced DBMS Additions (Views & Triggers)

1. **SQL View (`vw_property_performance`)**:
   - Computes aggregated business metrics (`total_revenue_generated`, `total_bookings_count`, `average_rating`, `total_reviews_received`).
   - Located in: [`database/advanced_dbms.sql`](file:///C:/Users/nandu_cxi9/.gemini/antigravity/scratch/property-management-system/database/advanced_dbms.sql)
2. **SQL Trigger (`trg_booking_status_audit`)**:
   - Automatically records state transitions into `booking_audit_log` whenever a booking is modified.
3. **Stored Procedure (`sp_search_properties_by_budget`)**:
   - Takes input parameters (`p_locality`, `p_budget`) and returns matched properties sorted by price.
