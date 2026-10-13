# Property Management System (PMS)

A unified relational DBMS web platform to **List, Discover, Rent, and Buy Properties**. Designed as a 5-module relational database system for **Anandakrishna, Aravind B, Nandakishor P, Kiran Dev, and S Anuranjan**.

---

## 🛠️ Tech Stack

- **Frontend**: HTML5, CSS3 (Modern Responsive Design System), JavaScript (ES6+ Vanilla, Fetch API)
- **Backend**: Node.js, Express.js REST API
- **Database**: MySQL 8.0 (Normalized up to 3NF with Foreign Key Constraints & Indexes)
- **Authentication**: JSON Web Tokens (JWT) & Bcrypt password hashing

---

## 🏛️ The 5 DBMS Modules

1. **Module 1 — Users**:
   - Registration, login, session tokens, profile details.
   - Role-based access control for **Owner**, **Tenant**, **Buyer**, and **Admin**.

2. **Module 2 — Properties**:
   - Add, edit, status tracking (`available`, `unavailable`, `sold`).
   - Multi-criteria search and filter by location, price range, property type (Apartment, Villa, House, Commercial, Land), and purpose (Rent vs Sale).

3. **Module 3 — Bookings**:
   - Booking / rental inquiries with start and end dates.
   - Date conflict prevention (prevents overlapping confirmed bookings).
   - Automated price calculation based on daily rent or purchase price.
   - Owner confirmation lifecycle (`pending` &rarr; `confirmed` &rarr; `completed` / `rejected`).
   - Payment status tracking (`pending`, `paid`, `refunded`).

4. **Module 4 — Reviews & Ratings**:
   - 1 to 5 star ratings and written feedback.
   - **Key Relational Invariant**: Strictly tied to a verified **completed booking** (`booking_id UNIQUE`), preventing duplicate or fake reviews.
   - Computes live average ratings for listings.

5. **Module 5 — Wishlist / Favorites**:
   - Many-to-many relationship between Users and Properties (`uq_wishlist_user_property`).
   - One-click heart toggle to save and manage favorite properties.

6. **Admin Panel**:
   - Platform oversight: real-time metrics across all 5 tables (total users, properties, bookings, reviews).
   - Master data table views with administrative controls.

---

## 🚀 Quick Start Guide

### 1. Database Setup (MySQL)
Ensure your local MySQL service is running. If the `property_management` database is not yet created, execute:

```powershell
# Using MySQL CLI or MySQL Workbench:
mysql -u root -p < database/schema.sql
mysql -u root -p < database/seed.sql
```

### 2. Configure Environment
A `.env` file is already pre-configured with default local MySQL credentials:
```ini
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=mysql
DB_NAME=property_management
JWT_SECRET=super_secret_jwt_key_stay_space_2026
```

### 3. Install Dependencies & Launch

In PowerShell:
```powershell
cd C:\Users\nandu_cxi9\.gemini\antigravity\scratch\property-management-system
npm.cmd install
npm.cmd start
```

Open your browser at: **[http://localhost:3000](http://localhost:3000)**

---

## 👥 Demo Evaluation Accounts

You can switch between any of these accounts with **1 click** using the **"⚡ Demo Accounts"** button in the navigation bar, or log in manually:

| Role | Name | Email | Password | What to Test |
| :--- | :--- | :--- | :--- | :--- |
| **Owner** | Ananya Iyer | `ananya.owner@homekey.demo` | `Owner@123` | Add new property, accept/reject booking requests, mark stay completed. |
| **Owner** | Rahul Menon | `rahul.owner@homekey.demo` | `Owner@123` | Manage listings in Kochi, confirm bookings, update payment state. |
| **Tenant** | Meera Nair | `meera.tenant@homekey.demo` | `Tenant@123` | Search listings, save to wishlist, request rental booking, leave verified review. |
| **Buyer** | Arjun Das | `arjun.buyer@homekey.demo` | `Buyer@123` | Browse luxury villas for sale, request purchase inspection visit. |
| **Admin** | Platform Admin | `admin@homekey.demo` | `Admin@123` | View platform-wide metrics, oversee all users, properties, and bookings. |

---

## 📂 Project Structure

```text
property-management-system/
├── database/
│   ├── schema.sql         # 5-module relational DDL with keys and constraints
│   └── seed.sql           # Realistic seed dataset (Bengaluru & Kochi listings)
├── public/
│   ├── index.html         # Responsive semantic HTML5 frontend
│   ├── css/
│   │   └── style.css      # Polished, modern CSS3 styling
│   └── js/
│       └── app.js         # Vanilla JavaScript client logic & API handlers
├── .env                   # Local configuration
├── .env.example           # Example configuration
├── package.json           # Node.js dependencies and scripts
├── server.js              # Express REST API server & static file host
└── README.md              # Project documentation
```
