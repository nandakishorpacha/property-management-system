import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;

/**
 * =========================================================================
 * DBConnection.java - Database Connection Helper (JDBC)
 * =========================================================================
 * 
 * EXPLANATION FOR TEACHER / EXAMINER:
 * -----------------------------------
 * This class establishes the bridge between our Java application and the
 * MySQL Database Management System using JDBC (Java Database Connectivity).
 * 
 * Key Concepts:
 * 1. JDBC URL: "jdbc:mysql://localhost:3306/property_management"
 *    - jdbc: protocol used by Java to identify database connection.
 *    - mysql: the database vendor/driver name.
 *    - localhost: database is running on the local computer.
 *    - 3306: default port on which MySQL server listens for connections.
 *    - property_management: the name of our relational database.
 * 
 * 2. Class.forName("com.mysql.cj.jdbc.Driver"):
 *    - Dynamically loads the MySQL JDBC driver class into Java Virtual Machine (JVM).
 * 
 * 3. DriverManager.getConnection(url, user, password):
 *    - Connects using credentials (user="root", password="mysql").
 *    - Returns an active java.sql.Connection object used to execute SQL queries.
 */
public class DBConnection {

    // Database connection parameters
    private static final String DB_HOST = "localhost";
    private static final int    DB_PORT = 3306;
    private static final String DB_NAME = "property_management";
    private static final String DB_USER = "root";
    private static final String DB_PASS = "mysql"; // default password on this system

    // JDBC Connection URL
    private static final String JDBC_URL = "jdbc:mysql://" + DB_HOST + ":" + DB_PORT + "/" + DB_NAME
            + "?useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC&characterEncoding=UTF-8";

    /**
     * Obtains an active connection to the MySQL database.
     * @return Connection object ready for executing SQL queries
     * @throws SQLException if connection credentials or database is unreachable
     */
    public static Connection getConnection() throws SQLException {
        try {
            // Step 1: Register and load MySQL JDBC Driver
            Class.forName("com.mysql.cj.jdbc.Driver");
        } catch (ClassNotFoundException e) {
            System.err.println("[DB Error] MySQL JDBC Driver not found in classpath! Check lib/mysql-connector-j.jar");
            throw new SQLException(e);
        }

        // Step 2: Establish connection via DriverManager
        return DriverManager.getConnection(JDBC_URL, DB_USER, DB_PASS);
    }
}
