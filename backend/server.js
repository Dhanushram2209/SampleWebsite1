require('dotenv').config();
const { Pool } = require('pg');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const twilio = require('twilio');
const AccessToken = twilio.jwt.AccessToken;
const VideoGrant = AccessToken.VideoGrant;

const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID || 'AC5cb66cf0a4209d0d22414fa973a59ad5';
const twilioApiKey = process.env.TWILIO_API_KEY || '26716487a7705ba09b4ecb735e1f9277';
const twilioApiSecret = process.env.TWILIO_API_SECRET || 'MnkYCUA1ysNzrjJo9T6FidGvgDBhpeX8PKHwmRu5Lc3xOSQ7tWfEbl40VIa2Zq';

const app = express();
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    'https://chronic-disease-frontend.onrender.com'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(bodyParser.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Required for Render's PostgreSQL
  }
});

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Database initialization function
async function initializeDatabase() {
  try {
    const client = await pool.connect();
    
    // Check if tables exist
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'users'
      )
    `);
    
    console.log(`Users table exists: ${tableCheck.rows[0].exists}`);
    
    if (!tableCheck.rows[0].exists) {
      console.log('Creating tables...');
      
      await client.query(`
        CREATE TABLE users (
          user_id SERIAL PRIMARY KEY,
          email VARCHAR(100) UNIQUE NOT NULL,
          password VARCHAR(255) NOT NULL,
          first_name VARCHAR(50) NOT NULL,
          last_name VARCHAR(50) NOT NULL,
          role VARCHAR(20) NOT NULL CHECK (role IN ('patient', 'doctor')),
          created_at TIMESTAMP DEFAULT NOW(),
          last_login TIMESTAMP NULL
        );
        
        CREATE TABLE patient_details (
          patient_id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(user_id),
          date_of_birth DATE,
          gender VARCHAR(10),
          phone_number VARCHAR(20),
          address VARCHAR(255),
          emergency_contact VARCHAR(100),
          emergency_phone VARCHAR(20)
        );
        
        CREATE TABLE doctor_details (
          doctor_id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(user_id),
          specialization VARCHAR(100),
          license_number VARCHAR(50),
          phone_number VARCHAR(20),
          hospital_affiliation VARCHAR(100)
        );

        CREATE TABLE patient_health_data (
          record_id SERIAL PRIMARY KEY,
          patient_id INTEGER REFERENCES patient_details(patient_id),
          blood_pressure VARCHAR(20),
          heart_rate INTEGER,
          blood_sugar INTEGER,
          oxygen_level INTEGER,
          notes VARCHAR(500),
          recorded_at TIMESTAMP DEFAULT NOW()
        );

        CREATE TABLE patient_risk_scores (
          score_id SERIAL PRIMARY KEY,
          patient_id INTEGER REFERENCES patient_details(patient_id),
          risk_score INTEGER,
          calculated_at TIMESTAMP DEFAULT NOW()
        );

        CREATE TABLE patient_alerts (
          alert_id SERIAL PRIMARY KEY,
          patient_id INTEGER REFERENCES patient_details(patient_id),
          message VARCHAR(500),
          severity VARCHAR(20) CHECK (severity IN ('Low', 'Medium', 'High')),
          timestamp TIMESTAMP DEFAULT NOW(),
          is_read BOOLEAN DEFAULT FALSE
        );

        CREATE TABLE patient_medications (
          medication_id SERIAL PRIMARY KEY,
          patient_id INTEGER REFERENCES patient_details(patient_id),
          name VARCHAR(100),
          dosage VARCHAR(50),
          frequency VARCHAR(50),
          next_dose TIMESTAMP,
          status VARCHAR(20) DEFAULT 'Pending'
        );

        CREATE TABLE patient_appointments (
          appointment_id SERIAL PRIMARY KEY,
          patient_id INTEGER REFERENCES patient_details(patient_id),
          doctor_id INTEGER REFERENCES doctor_details(doctor_id),
          date_time TIMESTAMP,
          type VARCHAR(50),
          status VARCHAR(20) DEFAULT 'Scheduled',
          notes VARCHAR(500)
        );

        CREATE TABLE telemedicine_requests (
          request_id SERIAL PRIMARY KEY,
          patient_id INTEGER REFERENCES patient_details(patient_id),
          doctor_id INTEGER REFERENCES doctor_details(doctor_id),
          requested_at TIMESTAMP DEFAULT NOW(),
          preferred_date_time TIMESTAMP,
          reason VARCHAR(500),
          symptoms VARCHAR(500),
          status VARCHAR(20) DEFAULT 'Pending'
        );

        CREATE TABLE patient_points (
          point_id SERIAL PRIMARY KEY,
          patient_id INTEGER REFERENCES patient_details(patient_id),
          points INTEGER,
          reason VARCHAR(200),
          awarded_at TIMESTAMP DEFAULT NOW()
        );
      `);
      
      console.log('Tables created successfully');
    } else {
      console.log('Tables already exist, skipping creation');
    }
    
    client.release();
    return pool;
  } catch (err) {
    console.error('Database initialization error:', err);
    throw err;
  }
}

// Initialize database connection
initializeDatabase()
  .then(() => {
    console.log('Database connection established');
  })
  .catch(err => {
    console.error('Database connection failed:', err);
    process.exit(1);
  });

// Middleware to authenticate token
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

// Register endpoint
app.post('/api/register', async (req, res) => {
  const { email, password, firstName, lastName, role, ...details } = req.body;

  try {
    // Check if user already exists
    const userCheck = await pool.query(
      'SELECT * FROM users WHERE email = $1', 
      [email]
    );

    if (userCheck.rows.length > 0) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user
    const result = await pool.query(
      `INSERT INTO users (email, password, first_name, last_name, role) 
       VALUES ($1, $2, $3, $4, $5) RETURNING user_id`,
      [email, hashedPassword, firstName, lastName, role]
    );

    const userId = result.rows[0].user_id;

    // Insert role-specific details
    if (role === 'patient') {
      await pool.query(
        `INSERT INTO patient_details 
         (user_id, date_of_birth, gender, phone_number, address, emergency_contact, emergency_phone) 
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [userId, details.dateOfBirth, details.gender, details.phoneNumber, 
         details.address, details.emergencyContact, details.emergencyPhone]
      );
    } else if (role === 'doctor') {
      await pool.query(
        `INSERT INTO doctor_details 
         (user_id, specialization, license_number, phone_number, hospital_affiliation) 
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, details.specialization, details.licenseNumber, 
         details.phoneNumber, details.hospitalAffiliation]
      );
    }

    res.status(201).json({ message: 'User registered successfully' });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Registration failed', error: error.message });
  }
});

// Login endpoint
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Update last login
    await pool.query(
      'UPDATE users SET last_login = NOW() WHERE user_id = $1',
      [user.user_id]
    );

    // Create token
    const token = jwt.sign(
      { userId: user.user_id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({ 
      token, 
      user: { 
        email: user.email, 
        firstName: user.first_name, 
        lastName: user.last_name, 
        role: user.role 
      } 
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Login failed', error: error.message });
  }
});

// Patient Data Endpoints
app.get('/api/patient/health-data', authenticateToken, async (req, res) => {
  if (req.user.role !== 'patient') return res.sendStatus(403);
  
  try {
    const result = await pool.query(
      `SELECT * FROM patient_health_data 
       WHERE patient_id = (
         SELECT patient_id FROM patient_details WHERE user_id = $1
       )
       ORDER BY recorded_at DESC`,
      [req.user.userId]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching health data:', error);
    res.status(500).json({ message: 'Failed to fetch health data' });
  }
});

app.post('/api/patient/health-data', authenticateToken, async (req, res) => {
  if (req.user.role !== 'patient') return res.sendStatus(403);
  
  try {
    const { bloodPressure, heartRate, bloodSugar, oxygenLevel, notes } = req.body;
    
    const patientId = (await pool.query(
      'SELECT patient_id FROM patient_details WHERE user_id = $1',
      [req.user.userId]
    )).rows[0].patient_id;

    await pool.query(
      `INSERT INTO patient_health_data 
       (patient_id, blood_pressure, heart_rate, blood_sugar, oxygen_level, notes) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [patientId, bloodPressure, heartRate, bloodSugar, oxygenLevel, notes || null]
    );
    
    // Trigger AI analysis
    await analyzePatientData(req.user.userId);
    
    res.status(201).json({ message: 'Health data recorded successfully' });
  } catch (error) {
    console.error('Error recording health data:', error);
    res.status(500).json({ message: 'Failed to record health data' });
  }
});

app.get('/api/patient/risk-score', authenticateToken, async (req, res) => {
  if (req.user.role !== 'patient') return res.sendStatus(403);
  
  try {
    const result = await pool.query(
      `SELECT risk_score FROM patient_risk_scores 
       WHERE patient_id = (
         SELECT patient_id FROM patient_details WHERE user_id = $1
       )
       ORDER BY calculated_at DESC
       LIMIT 1`,
      [req.user.userId]
    );
    
    res.json({ score: result.rows.length > 0 ? result.rows[0].risk_score : 0 });
  } catch (error) {
    console.error('Error fetching risk score:', error);
    res.status(500).json({ message: 'Failed to fetch risk score' });
  }
});

// Add this endpoint before the error handling middleware
app.get('/api/patient/vitals', authenticateToken, async (req, res) => {
  if (req.user.role !== 'patient') return res.sendStatus(403);
  
  try {
    const result = await pool.query(
      `SELECT 
        blood_pressure as "bloodPressure",
        heart_rate as "heartRate",
        blood_sugar as "bloodSugar",
        oxygen_level as "oxygenLevel"
       FROM patient_health_data 
       WHERE patient_id = (
         SELECT patient_id FROM patient_details WHERE user_id = $1
       )
       ORDER BY recorded_at DESC
       LIMIT 1`,
      [req.user.userId]
    );
    
    if (result.rows.length > 0) {
      res.json(result.rows[0]);
    } else {
      res.json(null);
    }
  } catch (error) {
    console.error('Error fetching vitals:', error);
    res.status(500).json({ message: 'Failed to fetch vitals' });
  }
});

// AI Analysis Function
async function analyzePatientData(userId) {
  try {
    // Get patient's recent health data
    const healthData = await pool.query(
      `SELECT * FROM patient_health_data 
       WHERE patient_id = (
         SELECT patient_id FROM patient_details WHERE user_id = $1
       )
       ORDER BY recorded_at DESC
       LIMIT 10`,
      [userId]
    );
    
    if (healthData.rows.length === 0) return;
    
    // Simple risk calculation
    const latestData = healthData.rows[0];
    let riskScore = 0;
    
    // Blood pressure risk
    const [systolic, diastolic] = latestData.blood_pressure.split('/').map(Number);
    if (systolic > 140 || diastolic > 90) riskScore += 30;
    else if (systolic > 130 || diastolic > 85) riskScore += 15;
    
    // Heart rate risk
    if (latestData.heart_rate > 100 || latestData.heart_rate < 60) riskScore += 20;
    else if (latestData.heart_rate > 90 || latestData.heart_rate < 65) riskScore += 10;
    
    // Blood sugar risk
    if (latestData.blood_sugar > 140) riskScore += 25;
    else if (latestData.blood_sugar > 120) riskScore += 12;
    
    // Oxygen level risk
    if (latestData.oxygen_level < 92) riskScore += 25;
    else if (latestData.oxygen_level < 95) riskScore += 10;
    
    // Cap at 100
    riskScore = Math.min(100, riskScore);
    
    // Save risk score
    const patientId = (await pool.query(
      'SELECT patient_id FROM patient_details WHERE user_id = $1',
      [userId]
    )).rows[0].patient_id;

    await pool.query(
      `INSERT INTO patient_risk_scores (patient_id, risk_score) 
       VALUES ($1, $2)`,
      [patientId, riskScore]
    );
    
    // Generate alerts if needed
    if (riskScore > 70) {
      await generateAlert(userId, 'High risk detected. Please consult your doctor immediately.', 'High');
    } else if (riskScore > 40) {
      await generateAlert(userId, 'Moderate risk detected. Monitor your condition closely.', 'Medium');
    }
    
  } catch (error) {
    console.error('AI analysis error:', error);
  }
}

async function generateAlert(userId, message, severity) {
  try {
    const patientId = (await pool.query(
      'SELECT patient_id FROM patient_details WHERE user_id = $1',
      [userId]
    )).rows[0].patient_id;

    await pool.query(
      `INSERT INTO patient_alerts (patient_id, message, severity) 
       VALUES ($1, $2, $3)`,
      [patientId, message, severity]
    );
  } catch (error) {
    console.error('Error generating alert:', error);
  }
}

// Protected route example
app.get('/api/protected', authenticateToken, (req, res) => {
  res.json({ message: 'This is a protected route', user: req.user });
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    // Simple query to verify DB connection
    await pool.query('SELECT 1');
    res.json({ status: 'OK', database: 'Connected' });
  } catch (err) {
    res.json({ status: 'OK', database: 'Disconnected' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something broke!', error: err.message });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Handle graceful shutdown
process.on('SIGINT', async () => {
  await pool.end();
  console.log('Database connection closed');
  process.exit(0);
});

// Add these endpoints to your server.js file

// Get patient medications
app.get('/api/patient/medications', authenticateToken, async (req, res) => {
  if (req.user.role !== 'patient') return res.sendStatus(403);
  
  try {
    const result = await pool.query(
      `SELECT * FROM patient_medications 
       WHERE patient_id = (
         SELECT patient_id FROM patient_details WHERE user_id = $1
       )
       ORDER BY next_dose ASC`,
      [req.user.userId]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching medications:', error);
    res.status(500).json({ message: 'Failed to fetch medications' });
  }
});

// Get patient alerts
app.get('/api/patient/alerts', authenticateToken, async (req, res) => {
  if (req.user.role !== 'patient') return res.sendStatus(403);
  
  try {
    const result = await pool.query(
      `SELECT * FROM patient_alerts 
       WHERE patient_id = (
         SELECT patient_id FROM patient_details WHERE user_id = $1
       )
       ORDER BY timestamp DESC`,
      [req.user.userId]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({ message: 'Failed to fetch alerts' });
  }
});

// Get patient appointments
app.get('/api/patient/appointments', authenticateToken, async (req, res) => {
  if (req.user.role !== 'patient') return res.sendStatus(403);
  
  try {
    const result = await dbPool.request()
      .input('userId', sql.Int, req.user.userId)
      .query(`
        SELECT a.*, d.FirstName + ' ' + d.LastName as DoctorName 
        FROM PatientAppointments a
        JOIN DoctorDetails dd ON a.DoctorID = dd.DoctorID
        JOIN Users d ON dd.UserID = d.UserID
        WHERE a.PatientID = (SELECT PatientID FROM PatientDetails WHERE UserID = @userId)
        ORDER BY a.DateTime DESC
      `);
    
    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching appointments:', error);
    res.status(500).json({ message: 'Failed to fetch appointments' });
  }
});

// Get patient points
app.get('/api/patient/points', authenticateToken, async (req, res) => {
  if (req.user.role !== 'patient') return res.sendStatus(403);
  
  try {
    const result = await pool.query(
      `SELECT COALESCE(SUM(points), 0) as points FROM patient_points
       WHERE patient_id = (
         SELECT patient_id FROM patient_details WHERE user_id = $1
       )`,
      [req.user.userId]
    );
    
    res.json({ points: result.rows[0].points });
  } catch (error) {
    console.error('Error fetching points:', error);
    res.status(500).json({ message: 'Failed to fetch points' });
  }
});

// Get all doctors
app.get('/api/doctors', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        dd.doctor_id as id, 
        u.first_name || ' ' || u.last_name as name, 
        dd.specialization,
        dd.hospital_affiliation as hospital,
        dd.phone_number as phone,
        u.email
       FROM doctor_details dd
       JOIN users u ON dd.user_id = u.user_id`
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching doctors:', error);
    res.status(500).json({ message: 'Failed to fetch doctors' });
  }
});

// Submit telemedicine request
app.post('/api/telemedicine/request', authenticateToken, async (req, res) => {
  if (req.user.role !== 'patient') return res.sendStatus(403);
  
  try {
    const { doctorId, preferredDateTime, reason, symptoms } = req.body;
    
    const patientId = (await pool.query(
      'SELECT patient_id FROM patient_details WHERE user_id = $1',
      [req.user.userId]
    )).rows[0].patient_id;

    await pool.query(
      `INSERT INTO telemedicine_requests 
       (patient_id, doctor_id, preferred_date_time, reason, symptoms) 
       VALUES ($1, $2, $3, $4, $5)`,
      [patientId, doctorId, preferredDateTime, reason, symptoms || null]
    );
    
    await pool.query(
      `INSERT INTO patient_points 
       (patient_id, points, reason) 
       VALUES ($1, $2, $3)`,
      [patientId, 10, 'Telemedicine request submission']
    );
    
    res.status(201).json({ message: 'Telemedicine request submitted successfully' });
  } catch (error) {
    console.error('Error submitting telemedicine request:', error);
    res.status(500).json({ message: 'Failed to submit telemedicine request' });
  }
});

// Mark medication as taken
app.post('/api/patient/medications/:id/taken', authenticateToken, async (req, res) => {
  if (req.user.role !== 'patient') return res.sendStatus(403);
  
  try {
    const patientId = (await pool.query(
      'SELECT patient_id FROM patient_details WHERE user_id = $1',
      [req.user.userId]
    )).rows[0].patient_id;

    await pool.query(
      `UPDATE patient_medications 
       SET status = 'Taken' 
       WHERE medication_id = $1 AND patient_id = $2`,
      [req.params.id, patientId]
    );
    
    await pool.query(
      `INSERT INTO patient_points 
       (patient_id, points, reason) 
       VALUES ($1, $2, $3)`,
      [patientId, 5, 'Medication adherence']
    );
    
    res.json({ message: 'Medication marked as taken' });
  } catch (error) {
    console.error('Error updating medication:', error);
    res.status(500).json({ message: 'Failed to update medication' });
  }
});

// Mark alert as read
app.post('/api/patient/alerts/:id/read', authenticateToken, async (req, res) => {
  if (req.user.role !== 'patient') return res.sendStatus(403);
  
  try {
    const patientId = (await pool.query(
      'SELECT patient_id FROM patient_details WHERE user_id = $1',
      [req.user.userId]
    )).rows[0].patient_id;

    await pool.query(
      `UPDATE patient_alerts 
       SET is_read = TRUE 
       WHERE alert_id = $1 AND patient_id = $2`,
      [req.params.id, patientId]
    );
    
    res.json({ message: 'Alert marked as read' });
  } catch (error) {
    console.error('Error updating alert:', error);
    res.status(500).json({ message: 'Failed to update alert' });
  }
});


// Get patient profile
app.get('/api/patient/profile', authenticateToken, async (req, res) => {
  if (req.user.role !== 'patient') return res.sendStatus(403);
  
  try {
    const userResult = await pool.query(
      'SELECT first_name, last_name, email, role FROM users WHERE user_id = $1',
      [req.user.userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const user = userResult.rows[0];
    const patientResult = await pool.query(
      `SELECT date_of_birth, gender, phone_number, address, emergency_contact, emergency_phone 
       FROM patient_details 
       WHERE user_id = $1`,
      [req.user.userId]
    );
    
    const profileData = {
      firstName: user.first_name,
      lastName: user.last_name,
      email: user.email,
      role: user.role,
      ...patientResult.rows[0]
    };
    
    res.json(profileData);
  } catch (error) {
    console.error('Error fetching patient profile:', error);
    res.status(500).json({ message: 'Failed to fetch patient profile' });
  }
});

// Get doctor profile
app.get('/api/doctor/profile', authenticateToken, async (req, res) => {
  if (req.user.role !== 'doctor') return res.sendStatus(403);
  
  try {
    const userResult = await pool.query(
      'SELECT first_name, last_name, email, role FROM users WHERE user_id = $1',
      [req.user.userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const user = userResult.rows[0];
    const doctorResult = await pool.query(
      `SELECT specialization, license_number, phone_number, hospital_affiliation 
       FROM doctor_details 
       WHERE user_id = $1`,
      [req.user.userId]
    );
    
    const profileData = {
      firstName: user.first_name,
      lastName: user.last_name,
      email: user.email,
      role: user.role,
      ...doctorResult.rows[0]
    };
    
    res.json(profileData);
  } catch (error) {
    console.error('Error fetching doctor profile:', error);
    res.status(500).json({ message: 'Failed to fetch doctor profile' });
  }
});

// Generic profile endpoint that routes based on role
app.get('/api/profile', authenticateToken, async (req, res) => {
  try {
    if (req.user.role === 'patient') {
      const result = await pool.query(
        `SELECT u.first_name, u.last_name, u.email, u.role,
                pd.date_of_birth, pd.gender, pd.phone_number, pd.address,
                pd.emergency_contact, pd.emergency_phone
         FROM users u
         JOIN patient_details pd ON u.user_id = pd.user_id
         WHERE u.user_id = $1`,
        [req.user.userId]
      );
      res.json(result.rows[0]);
    } else if (req.user.role === 'doctor') {
      const result = await pool.query(
        `SELECT u.first_name, u.last_name, u.email, u.role,
                dd.specialization, dd.license_number, dd.phone_number, dd.hospital_affiliation
         FROM users u
         JOIN doctor_details dd ON u.user_id = dd.user_id
         WHERE u.user_id = $1`,
        [req.user.userId]
      );
      res.json(result.rows[0]);
    } else {
      return res.status(403).json({ message: 'Unknown role' });
    }
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ message: 'Failed to fetch profile' });
  }
});

// Get all patients for doctors
app.get('/api/doctor/patients', authenticateToken, async (req, res) => {
  if (req.user.role !== 'doctor') return res.sendStatus(403);
  
  try {
    const result = await pool.query(
      `SELECT 
        p.patient_id as id,
        u.first_name || ' ' || u.last_name as name,
        pd.date_of_birth as dob,
        pd.gender,
        pd.phone_number as phone,
        u.email,
        (SELECT risk_score FROM patient_risk_scores 
         WHERE patient_id = p.patient_id 
         ORDER BY calculated_at DESC LIMIT 1) as "riskScore",
        (SELECT COUNT(*) FROM patient_alerts 
         WHERE patient_id = p.patient_id AND is_read = FALSE) as "unreadAlerts",
        (SELECT COUNT(*) FROM patient_medications 
         WHERE patient_id = p.patient_id AND status = 'Pending') as "pendingMeds"
       FROM patient_details p
       JOIN users u ON p.user_id = u.user_id
       ORDER BY u.last_name, u.first_name`
    );

    const patients = result.rows.map(patient => {
      let status = 'Normal';
      if (patient.riskScore > 70) status = 'Critical';
      else if (patient.riskScore > 40) status = 'Warning';

      return {
        ...patient,
        status,
        lastReading: patient.riskScore ? `Risk: ${patient.riskScore}` : 'No data',
        pendingActions: patient.pendingMeds + patient.unreadAlerts
      };
    });

    res.json({ patients });
  } catch (error) {
    console.error('Error fetching patients:', error);
    res.status(500).json({ message: 'Failed to fetch patients' });
  }
});


// Get detailed patient info for doctors
app.get('/api/doctor/patient/:id', authenticateToken, async (req, res) => {
  if (req.user.role !== 'doctor') return res.sendStatus(403);
  
  try {
    const patientId = req.params.id;
    const patientResult = await pool.query(
      `SELECT 
        u.first_name, u.last_name, u.email,
        pd.date_of_birth, pd.gender, pd.phone_number, 
        pd.address, pd.emergency_contact, pd.emergency_phone
       FROM patient_details pd
       JOIN users u ON pd.user_id = u.user_id
       WHERE pd.patient_id = $1`,
      [patientId]
    );
    
    if (patientResult.rows.length === 0) {
      return res.status(404).json({ message: 'Patient not found' });
    }
    
    const [healthData, medications, riskScores] = await Promise.all([
      pool.query(
        `SELECT * FROM patient_health_data
         WHERE patient_id = $1
         ORDER BY recorded_at DESC
         LIMIT 10`,
        [patientId]
      ),
      pool.query(
        `SELECT * FROM patient_medications
         WHERE patient_id = $1
         ORDER BY next_dose ASC`,
        [patientId]
      ),
      pool.query(
        `SELECT * FROM patient_risk_scores
         WHERE patient_id = $1
         ORDER BY calculated_at DESC
         LIMIT 5`,
        [patientId]
      )
    ]);
    
    res.json({
      profile: {
        name: `${patientResult.rows[0].first_name} ${patientResult.rows[0].last_name}`,
        email: patientResult.rows[0].email,
        ...patientResult.rows[0]
      },
      healthData: healthData.rows,
      medications: medications.rows,
      riskScores: riskScores.rows
    });
  } catch (error) {
    console.error('Error fetching patient details:', error);
    res.status(500).json({ message: 'Failed to fetch patient details' });
  }
});


// Get doctor's appointments
app.get('/api/doctor/appointments', authenticateToken, async (req, res) => {
  if (req.user.role !== 'doctor') return res.sendStatus(403);
  
  try {
    const doctorId = (await pool.query(
      'SELECT doctor_id FROM doctor_details WHERE user_id = $1',
      [req.user.userId]
    )).rows[0].doctor_id;

    const result = await pool.query(
      `SELECT 
        a.appointment_id as "appointmentId",
        p.patient_id as "patientId",
        u.first_name || ' ' || u.last_name as "patientName",
        a.date_time as "dateTime",
        a.type,
        a.status,
        a.notes
       FROM patient_appointments a
       JOIN patient_details p ON a.patient_id = p.patient_id
       JOIN users u ON p.user_id = u.user_id
       WHERE a.doctor_id = $1
       ORDER BY a.date_time DESC`,
      [doctorId]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching doctor appointments:', error);
    res.status(500).json({ message: 'Failed to fetch appointments' });
  }
});

// Get doctor's alerts
app.get('/api/doctor/alerts', authenticateToken, async (req, res) => {
  if (req.user.role !== 'doctor') return res.sendStatus(403);
  
  try {
    const doctorId = (await dbPool.request()
      .input('userId', sql.Int, req.user.userId)
      .query('SELECT DoctorID FROM DoctorDetails WHERE UserID = @userId')
    ).recordset[0].DoctorID;

    let query = `
      SELECT 
        a.AlertID as alertId,
        p.PatientID as patientId,
        u.FirstName + ' ' + u.LastName as patientName,
        a.Message as message,
        a.Severity as severity,
        a.Timestamp as timestamp,
        a.IsRead as isRead
      FROM PatientAlerts a
      JOIN PatientDetails p ON a.PatientID = p.PatientID
      JOIN Users u ON p.UserID = u.UserID
      WHERE p.PatientID IN (
        SELECT PatientID FROM PatientAppointments WHERE DoctorID = @doctorId
      )
    `;

    if (req.query.unread) {
      query += ' AND a.IsRead = 0';
    }

    query += ' ORDER BY a.Timestamp DESC';

    if (req.query.limit) {
      query += ` OFFSET 0 ROWS FETCH NEXT ${parseInt(req.query.limit)} ROWS ONLY`;
    }

    const result = await dbPool.request()
      .input('doctorId', sql.Int, doctorId)
      .query(query);
    
    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching doctor alerts:', error);
    res.status(500).json({ message: 'Failed to fetch alerts' });
  }
});

// Mark alert as read
app.post('/api/doctor/alerts/:id/read', authenticateToken, async (req, res) => {
  if (req.user.role !== 'doctor') return res.sendStatus(403);
  
  try {
    await dbPool.request()
      .input('alertId', sql.Int, req.params.id)
      .query(`
        UPDATE PatientAlerts 
        SET IsRead = 1 
        WHERE AlertID = @alertId
      `);
    
    res.json({ message: 'Alert marked as read' });
  } catch (error) {
    console.error('Error updating alert:', error);
    res.status(500).json({ message: 'Failed to update alert' });
  }
});


// Get patient appointments
app.get('/api/patient/appointments', authenticateToken, async (req, res) => {
  if (req.user.role !== 'patient') return res.sendStatus(403);
  
  try {
    const result = await pool.query(
      `SELECT a.*, 
              d.first_name || ' ' || d.last_name as "doctorName",
              dd.specialization as "doctorSpecialization"
       FROM patient_appointments a
       JOIN doctor_details dd ON a.doctor_id = dd.doctor_id
       JOIN users d ON dd.user_id = d.user_id
       WHERE a.patient_id = (
         SELECT patient_id FROM patient_details WHERE user_id = $1
       )
       ORDER BY a.date_time DESC`,
      [req.user.userId]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching appointments:', error);
    res.status(500).json({ message: 'Failed to fetch appointments' });
  }
});

// Create new appointment
app.post('/api/patient/appointments', authenticateToken, async (req, res) => {
  if (req.user.role !== 'patient') return res.sendStatus(403);
  
  try {
    const { doctorId, dateTime, type, notes } = req.body;
    
    const patientId = (await pool.query(
      'SELECT patient_id FROM patient_details WHERE user_id = $1',
      [req.user.userId]
    )).rows[0].patient_id;

    await pool.query(
      `INSERT INTO patient_appointments 
       (patient_id, doctor_id, date_time, type, notes, status) 
       VALUES ($1, $2, $3, $4, $5, 'Scheduled')`,
      [patientId, doctorId, dateTime, type, notes || null]
    );
    
    res.status(201).json({ message: 'Appointment created successfully' });
  } catch (error) {
    console.error('Error creating appointment:', error);
    res.status(500).json({ message: 'Failed to create appointment' });
  }
});

// Update appointment status
app.put('/api/appointments/:id/status', authenticateToken, async (req, res) => {
  try {
    const { status } = req.body;
    
    await dbPool.request()
      .input('appointmentId', sql.Int, req.params.id)
      .input('status', sql.NVarChar, status)
      .query(`
        UPDATE PatientAppointments 
        SET Status = @status 
        WHERE AppointmentID = @appointmentId
      `);
    
    res.json({ message: 'Appointment status updated' });
  } catch (error) {
    console.error('Error updating appointment:', error);
    res.status(500).json({ message: 'Failed to update appointment' });
  }
});

// Get doctor's appointments
app.get('/api/doctor/appointments', authenticateToken, async (req, res) => {
  if (req.user.role !== 'doctor') return res.sendStatus(403);
  
  try {
    const doctorId = (await dbPool.request()
      .input('userId', sql.Int, req.user.userId)
      .query('SELECT DoctorID FROM DoctorDetails WHERE UserID = @userId')
    ).recordset[0].DoctorID;

    const result = await dbPool.request()
      .input('doctorId', sql.Int, doctorId)
      .query(`
        SELECT 
          a.AppointmentID as appointmentId,
          p.PatientID as patientId,
          u.FirstName + ' ' + u.LastName as patientName,
          a.DateTime as dateTime,
          a.Type as type,
          a.Status as status,
          a.Notes as notes
        FROM PatientAppointments a
        JOIN PatientDetails p ON a.PatientID = p.PatientID
        JOIN Users u ON p.UserID = u.UserID
        WHERE a.DoctorID = @doctorId
        ORDER BY a.DateTime DESC
      `);
    
    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching doctor appointments:', error);
    res.status(500).json({ message: 'Failed to fetch appointments' });
  }
});

// Add this endpoint
app.post('/api/doctor/prescribe-medication', authenticateToken, async (req, res) => {
  if (req.user.role !== 'doctor') return res.sendStatus(403);
  
  try {
    const { patientId, name, dosage, frequency, notes } = req.body;
    const nextDose = new Date();
    nextDose.setDate(nextDose.getDate() + 1);
    
    await pool.query(
      `INSERT INTO patient_medications 
       (patient_id, name, dosage, frequency, next_dose, notes, status) 
       VALUES ($1, $2, $3, $4, $5, $6, 'Pending')`,
      [patientId, name, dosage, frequency, nextDose, notes || null]
    );
    
    const doctorId = (await pool.query(
      'SELECT doctor_id FROM doctor_details WHERE user_id = $1',
      [req.user.userId]
    )).rows[0].doctor_id;

    await pool.query(
      `UPDATE patient_appointments 
       SET status = 'Completed' 
       WHERE patient_id = $1 AND doctor_id = $2
       AND status = 'Scheduled'`,
      [patientId, doctorId]
    );
    
    res.status(201).json({ message: 'Medication prescribed successfully' });
  } catch (error) {
    console.error('Error prescribing medication:', error);
    res.status(500).json({ message: 'Failed to prescribe medication' });
  }
});


// AI Prediction Endpoint
app.get('/api/patient/ai-predictions', authenticateToken, async (req, res) => {
  if (req.user.role !== 'patient') return res.sendStatus(403);
  
  try {
    const healthData = await pool.query(
      `SELECT * FROM patient_health_data 
       WHERE patient_id = (
         SELECT patient_id FROM patient_details WHERE user_id = $1
       )
       ORDER BY recorded_at DESC
       LIMIT 30`,
      [req.user.userId]
    );
    
    if (healthData.rows.length === 0) {
      return res.json(null);
    }
    
    const mockPredictions = generateMockPredictions(healthData.rows);
    res.json(mockPredictions);
  } catch (error) {
    console.error('AI prediction error:', error);
    res.status(500).json({ message: 'Failed to generate predictions' });
  }
});

// AI Recommendations Endpoint
app.get('/api/patient/ai-recommendations', authenticateToken, async (req, res) => {
  if (req.user.role !== 'patient') return res.sendStatus(403);
  
  try {
    // Get patient's recent health data and risk score
    const [healthData, riskScore] = await Promise.all([
      dbPool.request()
        .input('userId', sql.Int, req.user.userId)
        .query(`
          SELECT TOP 10 * FROM PatientHealthData 
          WHERE PatientID = (SELECT PatientID FROM PatientDetails WHERE UserID = @userId)
          ORDER BY RecordedAt DESC
        `),
      dbPool.request()
        .input('userId', sql.Int, req.user.userId)
        .query(`
          SELECT TOP 1 RiskScore FROM PatientRiskScores 
          WHERE PatientID = (SELECT PatientID FROM PatientDetails WHERE UserID = @userId)
          ORDER BY CalculatedAt DESC
        `)
    ]);
    
    // Generate mock recommendations based on data
    const recommendations = generateMockRecommendations(
      healthData.recordset, 
      riskScore.recordset[0]?.RiskScore || 0
    );
    
    res.json(recommendations);
  } catch (error) {
    console.error('AI recommendations error:', error);
    res.status(500).json({ message: 'Failed to generate recommendations' });
  }
});

// AI Simulation Endpoint
app.post('/api/patient/ai-simulate', authenticateToken, async (req, res) => {
  if (req.user.role !== 'patient') return res.sendStatus(403);
  
  try {
    const { days, includeExercise, includeDiet, includeMedication } = req.body;
    
    // Get patient's recent health data
    const healthData = await dbPool.request()
      .input('userId', sql.Int, req.user.userId)
      .query(`
        SELECT TOP 30 * FROM PatientHealthData 
        WHERE PatientID = (SELECT PatientID FROM PatientDetails WHERE UserID = @userId)
        ORDER BY RecordedAt DESC
      `);
    
    if (healthData.recordset.length === 0) {
      return res.status(400).json({ message: 'Not enough health data for simulation' });
    }
    
    // Generate mock simulation results based on parameters
    const simulationResults = generateMockSimulation(
      healthData.recordset,
      days,
      includeExercise,
      includeDiet,
      includeMedication
    );
    
    res.json(simulationResults);
  } catch (error) {
    console.error('AI simulation error:', error);
    res.status(500).json({ message: 'Failed to run simulation' });
  }
});

// AI Assistant Endpoint
app.post('/api/patient/ai-assistant', authenticateToken, async (req, res) => {
  if (req.user.role !== 'patient') return res.sendStatus(403);
  
  try {
    const { message, healthData, medications, vitals, riskScore } = req.body;
    
    // In a real app, you would integrate with an NLP service or LLM
    // This is a simplified mock response
    
    const response = generateMockAssistantResponse(
      message, 
      healthData, 
      medications, 
      vitals, 
      riskScore
    );
    
    res.json(response);
  } catch (error) {
    console.error('AI assistant error:', error);
    res.status(500).json({ message: 'Failed to process your request' });
  }
});

// Helper functions for mock data generation
function generateMockPredictions(healthData) {
  const predictions = [];
  const metrics = ['bloodPressure', 'heartRate', 'bloodSugar', 'oxygenLevel', 'riskScore'];
  const today = new Date();
  
  metrics.forEach(metric => {
    for (let i = 0; i < 30; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      
      let baseValue = 0;
      if (healthData[0]) {
        switch (metric) {
          case 'bloodPressure':
            baseValue = healthData[0].blood_pressure;
            break;
          case 'heartRate':
            baseValue = healthData[0].heart_rate;
            break;
          case 'bloodSugar':
            baseValue = healthData[0].blood_sugar;
            break;
          case 'oxygenLevel':
            baseValue = healthData[0].oxygen_level;
            break;
          case 'riskScore':
            baseValue = healthData[0].risk_score || 50;
            break;
        }
      }
      
      const variation = (Math.random() * 0.2 - 0.1) * baseValue;
      let value = baseValue + variation;
      
      if (metric === 'bloodPressure') {
        const [systolic, diastolic] = value.split('/').map(Number);
        value = `${Math.max(80, Math.min(180, systolic))}/${Math.max(50, Math.min(120, diastolic))}`;
      } else if (metric === 'heartRate') {
        value = Math.max(50, Math.min(150, value));
      } else if (metric === 'bloodSugar') {
        value = Math.max(70, Math.min(300, value));
      } else if (metric === 'oxygenLevel') {
        value = Math.max(85, Math.min(100, value));
      } else if (metric === 'riskScore') {
        value = Math.max(0, Math.min(100, value));
      }
      
      predictions.push({
        date: date.toISOString().split('T')[0],
        metric,
        value
      });
    }
  });
  
  return predictions;
}

function generateMockRecommendations(healthData, riskScore) {
  const recommendations = [];
  
  // Generate recommendations based on risk score and health data
  if (riskScore > 70) {
    recommendations.push({
      category: 'Critical Alert',
      recommendation: 'Your risk score is high. Please consult with your doctor immediately.',
      priority: 'high',
      expectedImpact: 30
    });
  } else if (riskScore > 40) {
    recommendations.push({
      category: 'Warning',
      recommendation: 'Your risk score is elevated. Consider scheduling a check-up.',
      priority: 'high',
      expectedImpact: 20
    });
  }
  
  // Analyze blood pressure
  if (healthData.length > 0) {
    const latest = healthData[0];
    const [systolic, diastolic] = latest.BloodPressure.split('/').map(Number);
    
    if (systolic > 140 || diastolic > 90) {
      recommendations.push({
        category: 'Blood Pressure',
        recommendation: 'Your blood pressure is high. Reduce sodium intake and increase physical activity.',
        priority: systolic > 160 || diastolic > 100 ? 'high' : 'medium',
        expectedImpact: 15
      });
    }
  }
  
  // Add general health recommendations
  recommendations.push(
    {
      category: 'Exercise',
      recommendation: 'Aim for at least 30 minutes of moderate exercise 5 days a week.',
      priority: 'medium',
      expectedImpact: 10
    },
    {
      category: 'Nutrition',
      recommendation: 'Increase your intake of fruits and vegetables to at least 5 servings per day.',
      priority: 'medium',
      expectedImpact: 8
    },
    {
      category: 'Sleep',
      recommendation: 'Maintain a consistent sleep schedule with 7-9 hours of sleep per night.',
      priority: 'medium',
      expectedImpact: 12
    }
  );
  
  return recommendations;
}

function generateMockSimulation(healthData, days, includeExercise, includeDiet, includeMedication) {
  // Similar to generateMockPredictions but takes simulation parameters into account
  const predictions = [];
  const metrics = ['bloodPressure', 'heartRate', 'bloodSugar', 'oxygenLevel', 'riskScore'];
  const today = new Date();
  
  metrics.forEach(metric => {
    for (let i = 0; i < days; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      
      let baseValue = 0;
      if (healthData[0]) {
        switch (metric) {
          case 'bloodPressure':
            baseValue = healthData[0].BloodPressure;
            break;
          case 'heartRate':
            baseValue = healthData[0].HeartRate;
            break;
          case 'bloodSugar':
            baseValue = healthData[0].BloodSugar;
            break;
          case 'oxygenLevel':
            baseValue = healthData[0].OxygenLevel;
            break;
          case 'riskScore':
            baseValue = healthData[0].RiskScore || 50;
            break;
        }
      }
      
      // Apply simulation parameters
      let improvementFactor = 1;
      if (includeExercise) improvementFactor *= 0.98;
      if (includeDiet) improvementFactor *= 0.95;
      if (includeMedication) improvementFactor *= 0.9;
      
      // Add some variation with improvement trend
      const variation = (Math.random() * 0.1 - 0.05) * baseValue;
      let value = baseValue * Math.pow(improvementFactor, i) + variation;
      
      // Ensure values stay in reasonable ranges
      if (metric === 'bloodPressure') {
        const [systolic, diastolic] = value.split('/').map(Number);
        value = `${Math.max(80, Math.min(180, systolic))}/${Math.max(50, Math.min(120, diastolic))}`;
      } else if (metric === 'heartRate') {
        value = Math.max(50, Math.min(150, value));
      } else if (metric === 'bloodSugar') {
        value = Math.max(70, Math.min(300, value));
      } else if (metric === 'oxygenLevel') {
        value = Math.max(85, Math.min(100, value));
      } else if (metric === 'riskScore') {
        value = Math.max(0, Math.min(100, value));
      }
      
      predictions.push({
        date: date.toISOString().split('T')[0],
        metric,
        value
      });
    }
  });
  
  return predictions;
}

function generateMockAssistantResponse(message, healthData, medications, vitals, riskScore) {
  // Simple keyword-based response - in reality you'd use NLP
  const lowerMessage = message.toLowerCase();
  
  if (lowerMessage.includes('blood pressure') || lowerMessage.includes('bp')) {
    return {
      response: `Your recent blood pressure reading is ${vitals?.bloodPressure || 'unknown'}. ` +
        `Normal blood pressure is below 120/80. If your reading is consistently above this, ` +
        `consider lifestyle changes or consult your doctor.`,
      sources: ['CDC Blood Pressure Guidelines']
    };
  } else if (lowerMessage.includes('heart rate') || lowerMessage.includes('pulse')) {
    return {
      response: `Your recent heart rate is ${vitals?.heartRate || 'unknown'} bpm. ` +
        `A normal resting heart rate for adults is between 60-100 bpm. ` +
        `Regular exercise can help lower your resting heart rate over time.`,
      sources: ['American Heart Association']
    };
  } else if (lowerMessage.includes('risk score')) {
    return {
      response: `Your current health risk score is ${riskScore || 'unknown'} out of 100. ` +
        `Scores above 70 indicate high risk, 40-70 moderate risk, and below 40 low risk. ` +
        `This score is based on your health metrics and trends.`,
      sources: ['Internal Risk Model']
    };
  } else if (lowerMessage.includes('medication') && medications?.length > 0) {
    const medList = medications.map(m => `${m.Name} (${m.Dosage})`).join(', ');
    return {
      response: `You have ${medications.length} active medications: ${medList}. ` +
        `Always take medications as prescribed and consult your doctor before making changes.`,
      sources: ['Your Medication Records']
    };
  } else if (lowerMessage.includes('trend') || lowerMessage.includes('progress')) {
    return {
      response: `Based on your recent health data, your metrics are ${riskScore > 70 ? 'concerning' : riskScore > 40 ? 'moderate' : 'stable'}. ` +
        `The most significant factor is your ${riskScore > 70 ? 'elevated risk score' : riskScore > 40 ? 'moderate risk score' : 'healthy readings'}. ` +
        `Continue monitoring your health and follow your care plan.`,
      sources: ['Your Health Data Trends']
    };
  } else {
    return {
      response: `I'm your health assistant. I can help explain your health metrics, medications, ` +
        `and provide general health information. For specific medical advice, please consult your doctor. ` +
        `Try asking about your blood pressure, heart rate, or medications.`,
      sources: ['Health Assistant Knowledge Base']
    };
  }
}

// Add to your server.js
const OpenAI = require('openai');

// Initialize OpenAI with your secret key
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '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'
});

// AI Assistant Endpoint
app.post('/api/ai/assistant', authenticateToken, async (req, res) => {
  try {
    const { prompt, max_tokens = 500, temperature = 0.7 } = req.body;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a knowledgeable and empathetic medical AI assistant. " +
            "Provide clear, accurate health information based on the patient's data. " +
            "Be concise but thorough. Always remind patients to consult their doctor " +
            "for medical advice. Format responses for easy reading with line breaks when needed."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens,
      temperature,
    });

    const answer = completion.choices[0]?.message?.content || 
      "I couldn't generate a response. Please try again.";

    res.json({ answer });
  } catch (error) {
    console.error('OpenAI API error:', error);
    res.status(500).json({ 
      answer: "I'm experiencing technical difficulties. Please try again later or contact support."
    });
  }
});

// Generate Twilio access token for video calls
app.post('/api/video/token', authenticateToken, async (req, res) => {
  try {
    const { identity, room } = req.body;
    const token = new AccessToken(
      twilioAccountSid,
      twilioApiKey,
      twilioApiSecret,
      { identity }
    );

    const videoGrant = new VideoGrant({ room });
    token.addGrant(videoGrant);

    res.json({ token: token.toJwt() });
  } catch (error) {
    console.error('Error generating video token:', error);
    res.status(500).json({ message: 'Failed to generate video token' });
  }
});

// Start video call (updates appointment status)
app.post('/api/appointments/:id/start-call', authenticateToken, async (req, res) => {
  try {
    await pool.query(
      `UPDATE patient_appointments 
       SET status = 'In Progress' 
       WHERE appointment_id = $1`,
      [req.params.id]
    );
    
    res.json({ message: 'Appointment call started' });
  } catch (error) {
    console.error('Error starting call:', error);
    res.status(500).json({ message: 'Failed to start call' });
  }
});