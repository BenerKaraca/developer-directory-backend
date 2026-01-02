const mysql = require('mysql2/promise');

// Database configuration (without database name for initial connection)
const dbConfigWithoutDB = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'bener',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

const DB_NAME = process.env.DB_NAME || 'ogrencisistemi';

// Database configuration (with database name)
const dbConfig = {
  ...dbConfigWithoutDB,
  database: DB_NAME
};

// Create connection pool
let pool;

// Create database if it doesn't exist
const createDatabaseIfNotExists = async () => {
  try {
    const connection = await mysql.createConnection(dbConfigWithoutDB);
    await connection.execute(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\``);
    console.log(`Database '${DB_NAME}' checked/created successfully`);
    await connection.end();
    return true;
  } catch (error) {
    console.error('Error creating database:', error);
    throw error;
  }
};

// Initialize connection pool
const initializePool = () => {
  pool = mysql.createPool(dbConfig);
  return pool;
};

// Initialize database tables
const initializeDatabase = async () => {
  try {
    // Ensure pool is initialized
    if (!pool) {
      initializePool();
    }
    
    // Create users table
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS users (
        userId VARCHAR(255) PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        role ENUM('student', 'company', 'admin') NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_email (email),
        INDEX idx_role (role)
      )
    `);

    // Create developers table
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS developers (
        id VARCHAR(255) PRIMARY KEY,
        userId VARCHAR(255) UNIQUE NOT NULL,
        firstName VARCHAR(255) NOT NULL,
        lastName VARCHAR(255) NOT NULL,
        workType ENUM('remote', 'onsite', 'hybrid') NOT NULL,
        field ENUM('web', 'mobil', 'yz', 'backend', 'frontend', 'fullstack') NOT NULL,
        github VARCHAR(500),
        linkedin VARCHAR(500),
        email VARCHAR(255) NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users(userId) ON DELETE CASCADE,
        INDEX idx_userId (userId),
        INDEX idx_workType (workType),
        INDEX idx_field (field)
      )
    `);

    // Create contacts table
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS contacts (
        id VARCHAR(255) PRIMARY KEY,
        userId VARCHAR(255) NOT NULL,
        developerId VARCHAR(255) NOT NULL,
        date DATE NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (userId) REFERENCES users(userId) ON DELETE CASCADE,
        FOREIGN KEY (developerId) REFERENCES developers(id) ON DELETE CASCADE,
        INDEX idx_userId_date (userId, date),
        INDEX idx_developerId (developerId),
        UNIQUE KEY unique_contact (userId, developerId, date)
      )
    `);

    console.log('Database tables initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
};

// Test connection
const testConnection = async () => {
  try {
    // Ensure pool is initialized
    if (!pool) {
      initializePool();
    }
    
    const connection = await pool.getConnection();
    console.log('MySQL database connected successfully');
    connection.release();
    return true;
  } catch (error) {
    console.error('Error connecting to database:', error);
    return false;
  }
};

module.exports = {
  get pool() {
    if (!pool) {
      pool = initializePool();
    }
    return pool;
  },
  createDatabaseIfNotExists,
  initializePool,
  initializeDatabase,
  testConnection
};

