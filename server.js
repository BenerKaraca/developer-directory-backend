const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { pool, createDatabaseIfNotExists, initializePool, initializeDatabase, testConnection } = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Trust proxy for Render deployment
app.set('trust proxy', 1);

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Initialize database on startup
let dbInitialized = false;
const startServer = async () => {
  try {
    // First, create database if it doesn't exist
    console.log('Checking database...');
    await createDatabaseIfNotExists();
    
    // Initialize connection pool
    initializePool();
    
    // Test connection
    const connected = await testConnection();
    if (!connected) {
      console.error('Failed to connect to database. Server will not start.');
      process.exit(1);
    }

    // Initialize tables
    console.log('Initializing database tables...');
    await initializeDatabase();
    dbInitialized = true;

    app.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Error starting server:', error);
    process.exit(1);
  }
};

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, message: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ success: false, message: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Check if user is student
const isStudent = (req, res, next) => {
  if (req.user.role !== 'student') {
    return res.status(403).json({ success: false, message: 'Access denied. Student role required.' });
  }
  next();
};

// Check if user is company
const isCompany = (req, res, next) => {
  if (req.user.role !== 'company') {
    return res.status(403).json({ success: false, message: 'Access denied. Company role required.' });
  }
  next();
};

// Check if user is admin
const isAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Access denied. Admin role required.' });
  }
  next();
};

// Rate limiting: Check if company can view developer (max 10 per day)
const checkContactLimit = async (req, res, next) => {
  // Only apply limit to companies
  if (req.user.role !== 'company') {
    return next();
  }

  try {
    const today = new Date().toISOString().split('T')[0];
    const [contacts] = await pool.execute(
      'SELECT COUNT(*) as count FROM contacts WHERE userId = ? AND date = ?',
      [req.user.userId, today]
    );

    if (contacts[0].count >= 10) {
      return res.status(429).json({
        success: false,
        message: 'Günlük görüntüleme limitinize ulaştınız. Yarın tekrar deneyebilirsiniz.'
      });
    }

    next();
  } catch (error) {
    console.error('Error checking contact limit:', error);
    return res.status(500).json({
      success: false,
      message: 'Görüntüleme limiti kontrol edilirken hata oluştu'
    });
  }
};

// ==================== AUTHENTICATION ROUTES ====================

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name, role } = req.body;

    if (!email || !password || !name || !role) {
      return res.status(400).json({
        success: false,
        message: 'Tüm alanlar zorunludur'
      });
    }

    if (!['student', 'company', 'admin'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Geçersiz rol. student, company veya admin olmalıdır.'
      });
    }

    // Check if user already exists
    const [existingUsers] = await pool.execute(
      'SELECT userId FROM users WHERE email = ?',
      [email.trim().toLowerCase()]
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Bu email adresi zaten kullanılıyor'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = Date.now().toString();

    // Insert user
    await pool.execute(
      'INSERT INTO users (userId, email, password, name, role) VALUES (?, ?, ?, ?, ?)',
      [userId, email.trim().toLowerCase(), hashedPassword, name.trim(), role]
    );

    // Generate token
    const token = jwt.sign(
      { userId, email: email.trim().toLowerCase(), role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      success: true,
      message: 'Kayıt başarılı',
      token,
      user: {
        userId,
        email: email.trim().toLowerCase(),
        name: name.trim(),
        role
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      success: false,
      message: 'Kayıt sırasında bir hata oluştu'
    });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email ve şifre gereklidir'
      });
    }

    // Find user
    const [users] = await pool.execute(
      'SELECT userId, email, password, name, role FROM users WHERE email = ?',
      [email.trim().toLowerCase()]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Geçersiz email veya şifre'
      });
    }

    const user = users[0];

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({
        success: false,
        message: 'Geçersiz email veya şifre'
      });
    }

    // Generate token
    const token = jwt.sign(
      { userId: user.userId, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: 'Giriş başarılı',
      token,
      user: {
        userId: user.userId,
        email: user.email,
        name: user.name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Giriş sırasında bir hata oluştu'
    });
  }
});

// Get current user
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const [users] = await pool.execute(
      'SELECT userId, email, name, role FROM users WHERE userId = ?',
      [req.user.userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Kullanıcı bulunamadı'
      });
    }

    res.json({
      success: true,
      user: users[0]
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Kullanıcı bilgileri alınırken hata oluştu'
    });
  }
});

// ==================== DEVELOPER ROUTES ====================

// Get all developers (public - company can see without login, but contact info hidden)
app.get('/api/developers', async (req, res) => {
  try {
    const [developers] = await pool.execute(
      'SELECT * FROM developers ORDER BY createdAt DESC'
    );

    const token = req.headers['authorization']?.split(' ')[1];
    let filteredDevelopers = developers;

    // If not authenticated, hide contact info
    if (!token) {
      filteredDevelopers = developers.map(dev => ({
        ...dev,
        email: undefined,
        github: undefined,
        linkedin: undefined
      }));
    } else {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        // Only students and admins can see contact info
        // Companies (even if logged in) cannot see contact info without contacting
        if (decoded.role === 'company') {
          filteredDevelopers = developers.map(dev => ({
            ...dev,
            email: undefined,
            github: undefined,
            linkedin: undefined
          }));
        }
        // Admin and student can see all info
      } catch (err) {
        // Invalid token, hide contact info
        filteredDevelopers = developers.map(dev => ({
          ...dev,
          email: undefined,
          github: undefined,
          linkedin: undefined
        }));
      }
    }

    res.json({ success: true, data: filteredDevelopers });
  } catch (error) {
    console.error('Error fetching developers:', error);
    res.status(500).json({ success: false, message: 'Geliştiriciler getirilirken hata oluştu' });
  }
});

// Get single developer (public - company can see without login, but contact info hidden)
app.get('/api/developers/:id', async (req, res) => {
  try {
    const [developers] = await pool.execute(
      'SELECT * FROM developers WHERE id = ?',
      [req.params.id]
    );

    if (developers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Geliştirici bulunamadı'
      });
    }

    const developer = developers[0];
    const token = req.headers['authorization']?.split(' ')[1];
    let responseDeveloper = { ...developer };

    // If not authenticated, hide contact info
    if (!token) {
      responseDeveloper = {
        ...developer,
        email: undefined,
        github: undefined,
        linkedin: undefined
      };
    } else {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        // Only students and admins can see contact info
        // Companies cannot see contact info without contacting
        if (decoded.role === 'company') {
          responseDeveloper = {
            ...developer,
            email: undefined,
            github: undefined,
            linkedin: undefined
          };
        }
        // Admin and student can see all info
      } catch (err) {
        responseDeveloper = {
          ...developer,
          email: undefined,
          github: undefined,
          linkedin: undefined
        };
      }
    }

    res.json({ success: true, data: responseDeveloper });
  } catch (error) {
    console.error('Error fetching developer:', error);
    res.status(500).json({ success: false, message: 'Geliştirici getirilirken hata oluştu' });
  }
});

// Create developer profile (only students)
app.post('/api/developers', authenticateToken, isStudent, async (req, res) => {
  try {
    const { firstName, lastName, workType, field, github, linkedin, email } = req.body;

    // Validation
    if (!firstName || !lastName || !workType || !field || !email) {
      return res.status(400).json({
        success: false,
        message: 'Ad, soyad, çalışma şekli, alan ve email zorunludur'
      });
    }

    const validWorkTypes = ['remote', 'onsite', 'hybrid'];
    if (!validWorkTypes.includes(workType)) {
      return res.status(400).json({
        success: false,
        message: 'Çalışma şekli remote, onsite veya hybrid olmalıdır'
      });
    }

    const validFields = ['web', 'mobil', 'yz', 'backend', 'frontend', 'fullstack'];
    if (!validFields.includes(field)) {
      return res.status(400).json({
        success: false,
        message: 'Alan geçerli bir değer olmalıdır (web, mobil, yz, backend, frontend, fullstack)'
      });
    }

    // Check if user already has a profile
    const [existingProfiles] = await pool.execute(
      'SELECT id FROM developers WHERE userId = ?',
      [req.user.userId]
    );

    if (existingProfiles.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Zaten bir profil oluşturmuşsunuz. Profilinizi güncelleyebilirsiniz.'
      });
    }

    const id = Date.now().toString();

    // Insert developer
    await pool.execute(
      'INSERT INTO developers (id, userId, firstName, lastName, workType, field, github, linkedin, email) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, req.user.userId, firstName.trim(), lastName.trim(), workType, field, github ? github.trim() : null, linkedin ? linkedin.trim() : null, email.trim().toLowerCase()]
    );

    // Get created developer
    const [newDevelopers] = await pool.execute(
      'SELECT * FROM developers WHERE id = ?',
      [id]
    );

    res.status(201).json({
      success: true,
      message: 'Profil başarıyla oluşturuldu',
      data: newDevelopers[0]
    });
  } catch (error) {
    console.error('Error creating developer:', error);
    res.status(500).json({
      success: false,
      message: 'Profil oluşturulurken hata oluştu'
    });
  }
});

// Update developer profile (only students, own profile)
app.put('/api/developers/:id', authenticateToken, isStudent, async (req, res) => {
  try {
    // Check if developer exists and belongs to user
    const [developers] = await pool.execute(
      'SELECT * FROM developers WHERE id = ?',
      [req.params.id]
    );

    if (developers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Geliştirici bulunamadı'
      });
    }

    if (developers[0].userId !== req.user.userId) {
      return res.status(403).json({
        success: false,
        message: 'Sadece kendi profilinizi güncelleyebilirsiniz'
      });
    }

    const { firstName, lastName, workType, field, github, linkedin, email } = req.body;

    if (workType) {
      const validWorkTypes = ['remote', 'onsite', 'hybrid'];
      if (!validWorkTypes.includes(workType)) {
        return res.status(400).json({
          success: false,
          message: 'Çalışma şekli remote, onsite veya hybrid olmalıdır'
        });
      }
    }

    if (field) {
      const validFields = ['web', 'mobil', 'yz', 'backend', 'frontend', 'fullstack'];
      if (!validFields.includes(field)) {
        return res.status(400).json({
          success: false,
          message: 'Alan geçerli bir değer olmalıdır'
        });
      }
    }

    // Build update query dynamically
    const updates = [];
    const values = [];

    if (firstName) {
      updates.push('firstName = ?');
      values.push(firstName.trim());
    }
    if (lastName) {
      updates.push('lastName = ?');
      values.push(lastName.trim());
    }
    if (workType) {
      updates.push('workType = ?');
      values.push(workType);
    }
    if (field) {
      updates.push('field = ?');
      values.push(field);
    }
    if (github !== undefined) {
      updates.push('github = ?');
      values.push(github ? github.trim() : null);
    }
    if (linkedin !== undefined) {
      updates.push('linkedin = ?');
      values.push(linkedin ? linkedin.trim() : null);
    }
    if (email) {
      updates.push('email = ?');
      values.push(email.trim().toLowerCase());
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Güncellenecek alan belirtilmedi'
      });
    }

    values.push(req.params.id);

    await pool.execute(
      `UPDATE developers SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    // Get updated developer
    const [updatedDevelopers] = await pool.execute(
      'SELECT * FROM developers WHERE id = ?',
      [req.params.id]
    );

    res.json({
      success: true,
      message: 'Profil başarıyla güncellendi',
      data: updatedDevelopers[0]
    });
  } catch (error) {
    console.error('Error updating developer:', error);
    res.status(500).json({
      success: false,
      message: 'Profil güncellenirken hata oluştu'
    });
  }
});

// ==================== CONTACT ROUTES ====================

// View a developer profile (companies only, with rate limit)
app.post('/api/developers/:id/contact', authenticateToken, async (req, res) => {
  try {
    // Get developer
    const [developers] = await pool.execute(
      'SELECT * FROM developers WHERE id = ?',
      [req.params.id]
    );

    if (developers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Geliştirici bulunamadı'
      });
    }

    const developer = developers[0];

    // Can't view your own profile through this endpoint
    if (developer.userId === req.user.userId) {
      return res.status(400).json({
        success: false,
        message: 'Kendi profilinizi görüntüleyemezsiniz'
      });
    }

    // Students cannot view other students' profiles
    if (req.user.role === 'student') {
      return res.status(403).json({
        success: false,
        message: 'Öğrenciler birbirlerinin profillerini görüntüleyemez'
      });
    }

    const today = new Date().toISOString().split('T')[0];

    // Check if already viewed today (for companies)
    const [existingContacts] = await pool.execute(
      'SELECT id FROM contacts WHERE userId = ? AND developerId = ? AND date = ?',
      [req.user.userId, req.params.id, today]
    );

    const alreadyViewed = existingContacts.length > 0;

    // Rate limiting for companies (10 per day) - only for new views
    if (req.user.role === 'company' && !alreadyViewed) {
      // Check contact limit for companies (only count unique developers viewed today)
      const [uniqueContactsToday] = await pool.execute(
        'SELECT COUNT(DISTINCT developerId) as count FROM contacts WHERE userId = ? AND date = ?',
        [req.user.userId, today]
      );

      if (uniqueContactsToday[0].count >= 10) {
        return res.status(429).json({
          success: false,
          message: 'Günlük görüntüleme limitinize ulaştınız. Yarın tekrar deneyebilirsiniz.'
        });
      }

      // Create contact record only for new views
      const contactId = Date.now().toString();
      await pool.execute(
        'INSERT INTO contacts (id, userId, developerId, date) VALUES (?, ?, ?, ?)',
        [contactId, req.user.userId, req.params.id, today]
      );
    }

    // Only companies can view profiles (students are blocked above)
    
    // Get remaining contacts (only for companies)
    let remainingContacts = null;
    if (req.user.role === 'company') {
      const [uniqueContacts] = await pool.execute(
        'SELECT COUNT(DISTINCT developerId) as count FROM contacts WHERE userId = ? AND date = ?',
        [req.user.userId, today]
      );
      remainingContacts = 10 - uniqueContacts[0].count;
    }

    res.json({
      success: true,
      message: 'Profil başarıyla görüntülendi',
      developer: developer, // Return full developer profile
      remainingContacts: remainingContacts
    });
  } catch (error) {
    console.error('Error contacting developer:', error);
    res.status(500).json({
      success: false,
      message: 'İletişim kurulurken hata oluştu'
    });
  }
});

// Get contact stats for current user (companies only)
app.get('/api/contacts/stats', authenticateToken, isCompany, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    // Count unique developers viewed today (not total contact records)
    const [contacts] = await pool.execute(
      'SELECT COUNT(DISTINCT developerId) as count FROM contacts WHERE userId = ? AND date = ?',
      [req.user.userId, today]
    );

    res.json({
      success: true,
      stats: {
        contactsToday: contacts[0].count,
        remainingContacts: Math.max(0, 10 - contacts[0].count),
        limit: 10
      }
    });
  } catch (error) {
    console.error('Error fetching contact stats:', error);
    res.status(500).json({
      success: false,
      message: 'İstatistikler getirilirken hata oluştu'
    });
  }
});

// ==================== ADMIN ROUTES ====================

// Get all users (admin only)
app.get('/api/admin/users', authenticateToken, isAdmin, async (req, res) => {
  try {
    const [users] = await pool.execute(
      'SELECT userId, email, name, role, createdAt FROM users ORDER BY createdAt DESC'
    );

    res.json({
      success: true,
      data: users
    });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      message: 'Kullanıcılar getirilirken hata oluştu'
    });
  }
});

// Get all developers with full info (admin only)
app.get('/api/admin/developers', authenticateToken, isAdmin, async (req, res) => {
  try {
    const [developers] = await pool.execute(
      'SELECT * FROM developers ORDER BY createdAt DESC'
    );

    res.json({
      success: true,
      data: developers
    });
  } catch (error) {
    console.error('Error fetching developers:', error);
    res.status(500).json({
      success: false,
      message: 'Geliştiriciler getirilirken hata oluştu'
    });
  }
});

// Get all contacts (admin only)
app.get('/api/admin/contacts', authenticateToken, isAdmin, async (req, res) => {
  try {
    const [contacts] = await pool.execute(
      `SELECT c.*, u.name as userName, u.email as userEmail, 
       d.firstName, d.lastName, d.email as developerEmail
       FROM contacts c
       LEFT JOIN users u ON c.userId = u.userId
       LEFT JOIN developers d ON c.developerId = d.id
       ORDER BY c.createdAt DESC`
    );

    res.json({
      success: true,
      data: contacts
    });
  } catch (error) {
    console.error('Error fetching contacts:', error);
    res.status(500).json({
      success: false,
      message: 'İletişimler getirilirken hata oluştu'
    });
  }
});

// Get statistics (admin only)
app.get('/api/admin/stats', authenticateToken, isAdmin, async (req, res) => {
  try {
    const [userStats] = await pool.execute(
      'SELECT role, COUNT(*) as count FROM users GROUP BY role'
    );
    
    const [developerStats] = await pool.execute(
      'SELECT field, COUNT(*) as count FROM developers GROUP BY field'
    );

    const [workTypeStats] = await pool.execute(
      'SELECT workType, COUNT(*) as count FROM developers GROUP BY workType'
    );

    const [totalContacts] = await pool.execute(
      'SELECT COUNT(*) as count FROM contacts'
    );

    const [todayContacts] = await pool.execute(
      'SELECT COUNT(*) as count FROM contacts WHERE date = ?',
      [new Date().toISOString().split('T')[0]]
    );

    res.json({
      success: true,
      data: {
        users: userStats,
        developers: {
          byField: developerStats,
          byWorkType: workTypeStats,
          total: developerStats.reduce((sum, stat) => sum + stat.count, 0)
        },
        contacts: {
          total: totalContacts[0].count,
          today: todayContacts[0].count
        }
      }
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({
      success: false,
      message: 'İstatistikler getirilirken hata oluştu'
    });
  }
});

// Delete user (admin only)
app.delete('/api/admin/users/:userId', authenticateToken, isAdmin, async (req, res) => {
  try {
    const [users] = await pool.execute(
      'SELECT userId FROM users WHERE userId = ?',
      [req.params.userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Kullanıcı bulunamadı'
      });
    }

    await pool.execute('DELETE FROM users WHERE userId = ?', [req.params.userId]);

    res.json({
      success: true,
      message: 'Kullanıcı başarıyla silindi'
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({
      success: false,
      message: 'Kullanıcı silinirken hata oluştu'
    });
  }
});

// Delete developer (admin only)
app.delete('/api/admin/developers/:id', authenticateToken, isAdmin, async (req, res) => {
  try {
    const [developers] = await pool.execute(
      'SELECT id FROM developers WHERE id = ?',
      [req.params.id]
    );

    if (developers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Geliştirici bulunamadı'
      });
    }

    await pool.execute('DELETE FROM developers WHERE id = ?', [req.params.id]);

    res.json({
      success: true,
      message: 'Geliştirici başarıyla silindi'
    });
  } catch (error) {
    console.error('Error deleting developer:', error);
    res.status(500).json({
      success: false,
      message: 'Geliştirici silinirken hata oluştu'
    });
  }
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Developer Directory API',
    version: '2.0.0',
    database: 'MySQL',
    endpoints: {
      'POST /api/auth/register': 'Register new user',
      'POST /api/auth/login': 'Login',
      'GET /api/auth/me': 'Get current user',
      'GET /api/developers': 'Get all developers (public)',
      'GET /api/developers/:id': 'Get developer by id (public)',
      'POST /api/developers': 'Create developer profile (student only)',
      'PUT /api/developers/:id': 'Update developer profile (student only)',
      'POST /api/developers/:id/contact': 'Contact developer (student/company)',
      'GET /api/contacts/stats': 'Get contact stats (student only)',
      'GET /api/admin/users': 'Get all users (admin only)',
      'GET /api/admin/developers': 'Get all developers (admin only)',
      'GET /api/admin/contacts': 'Get all contacts (admin only)',
      'GET /api/admin/stats': 'Get statistics (admin only)',
      'DELETE /api/admin/users/:userId': 'Delete user (admin only)',
      'DELETE /api/admin/developers/:id': 'Delete developer (admin only)'
    }
  });
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const connected = await testConnection();
    res.json({
      status: connected ? 'OK' : 'ERROR',
      message: connected ? 'Server is running' : 'Database connection failed',
      database: 'MySQL'
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      message: 'Health check failed',
      error: error.message
    });
  }
});

// Start server
startServer();
