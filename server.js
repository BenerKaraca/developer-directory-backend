const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;
const DATA_FILE = path.join(__dirname, 'data', 'developers.json');

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Ensure data directory exists
const dataDir = path.dirname(DATA_FILE);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize data file if it doesn't exist
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2));
}

// Helper function to read developers from file
const readDevelopers = () => {
  try {
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading developers:', error);
    return [];
  }
};

// Helper function to write developers to file
const writeDevelopers = (developers) => {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(developers, null, 2));
    return true;
  } catch (error) {
    console.error('Error writing developers:', error);
    return false;
  }
};

// GET /developers - Return list of all developers
app.get('/developers', (req, res) => {
  try {
    const developers = readDevelopers();
    res.json({ success: true, data: developers });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching developers' });
  }
});

// POST /developers - Save a new developer
app.post('/developers', (req, res) => {
  try {
    const { name, role, techStack, experience } = req.body;

    // Validation
    if (!name || !role || !techStack || experience === undefined) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    if (typeof experience !== 'number' || experience < 0) {
      return res.status(400).json({
        success: false,
        message: 'Experience must be a non-negative number'
      });
    }

    const validRoles = ['Frontend', 'Backend', 'Full-Stack'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Role must be one of: Frontend, Backend, Full-Stack'
      });
    }

    const developers = readDevelopers();
    const newDeveloper = {
      id: Date.now().toString(),
      name: name.trim(),
      role,
      techStack: typeof techStack === 'string' ? techStack.split(',').map(tech => tech.trim()).filter(tech => tech) : techStack,
      experience: Number(experience),
      createdAt: new Date().toISOString()
    };

    developers.push(newDeveloper);
    
    if (writeDevelopers(developers)) {
      res.status(201).json({
        success: true,
        message: 'Developer added successfully',
        data: newDeveloper
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Error saving developer'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error processing request'
    });
  }
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Developer Directory API',
    endpoints: {
      'GET /developers': 'Get all developers',
      'POST /developers': 'Add a new developer',
      'GET /health': 'Health check'
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

