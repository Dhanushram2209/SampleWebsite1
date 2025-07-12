require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const sql = require('mssql');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const twilio = require('twilio');
const AccessToken = twilio.jwt.AccessToken;
const VideoGrant = AccessToken.VideoGrant;

const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID || 'AC5cb66cf0a4209d0d22414fa973a59ad5';
const twilioApiKey = process.env.TWILIO_API_KEY || '26716487a7705ba09b4ecb735e1f9277';
const twilioApiSecret = process.env.TWILIO_API_SECRET || 'MnkYCUA1ysNzrjJo9T6FidGvgDBhpeX8PKHwmRu5Lc3xOSQ7tWfEbl40VIa2Zq';

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Database configuration
const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  options: {
    encrypt: true, // For Azure
    trustServerCertificate: true, // For local dev
    enableArithAbort: true
  }
};

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Database initialization function
async function initializeDatabase() {
  try {
    const pool = await sql.connect(dbConfig);

        // First check if Users table exists
    const tableCheck = await pool.request()
      .query("SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Users'");
    
    console.log(`Users table exists: ${tableCheck.recordset.length > 0}`);
    
    if (tableCheck.recordset.length === 0) {
      console.log('Creating tables...');
      // Rest of your table creation code
    } else {
      console.log('Tables already exist, skipping creation');
    }
    
    // Check if tables exist and create them if not
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'Users')
      BEGIN
        CREATE TABLE Users (
          UserID INT PRIMARY KEY IDENTITY(1,1),
          Email NVARCHAR(100) UNIQUE NOT NULL,
          Password NVARCHAR(255) NOT NULL,
          FirstName NVARCHAR(50) NOT NULL,
          LastName NVARCHAR(50) NOT NULL,
          Role NVARCHAR(20) NOT NULL CHECK (Role IN ('patient', 'doctor')),
          CreatedAt DATETIME DEFAULT GETDATE(),
          LastLogin DATETIME NULL
        );
        
        CREATE TABLE PatientDetails (
          PatientID INT PRIMARY KEY IDENTITY(1,1),
          UserID INT FOREIGN KEY REFERENCES Users(UserID),
          DateOfBirth DATE,
          Gender NVARCHAR(10),
          PhoneNumber NVARCHAR(20),
          Address NVARCHAR(255),
          EmergencyContact NVARCHAR(100),
          EmergencyPhone NVARCHAR(20)
        );
        
        CREATE TABLE DoctorDetails (
          DoctorID INT PRIMARY KEY IDENTITY(1,1),
          UserID INT FOREIGN KEY REFERENCES Users(UserID),
          Specialization NVARCHAR(100),
          LicenseNumber NVARCHAR(50),
          PhoneNumber NVARCHAR(20),
          HospitalAffiliation NVARCHAR(100)
        );

        CREATE TABLE PatientHealthData (
          RecordID INT PRIMARY KEY IDENTITY(1,1),
          PatientID INT FOREIGN KEY REFERENCES PatientDetails(PatientID),
          BloodPressure NVARCHAR(20),
          HeartRate INT,
          BloodSugar INT,
          OxygenLevel INT,
          Notes NVARCHAR(500),
          RecordedAt DATETIME DEFAULT GETDATE()
        );

        CREATE TABLE PatientRiskScores (
          ScoreID INT PRIMARY KEY IDENTITY(1,1),
          PatientID INT FOREIGN KEY REFERENCES PatientDetails(PatientID),
          RiskScore INT,
          CalculatedAt DATETIME DEFAULT GETDATE()
        );

        CREATE TABLE PatientAlerts (
          AlertID INT PRIMARY KEY IDENTITY(1,1),
          PatientID INT FOREIGN KEY REFERENCES PatientDetails(PatientID),
          Message NVARCHAR(500),
          Severity NVARCHAR(20) CHECK (Severity IN ('Low', 'Medium', 'High')),
          Timestamp DATETIME DEFAULT GETDATE(),
          IsRead BIT DEFAULT 0
        );

        CREATE TABLE PatientMedications (
          MedicationID INT PRIMARY KEY IDENTITY(1,1),
          PatientID INT FOREIGN KEY REFERENCES PatientDetails(PatientID),
          Name NVARCHAR(100),
          Dosage NVARCHAR(50),
          Frequency NVARCHAR(50),
          NextDose DATETIME,
          Status NVARCHAR(20) DEFAULT 'Pending'
        );

        CREATE TABLE PatientAppointments (
          AppointmentID INT PRIMARY KEY IDENTITY(1,1),
          PatientID INT FOREIGN KEY REFERENCES PatientDetails(PatientID),
          DoctorID INT FOREIGN KEY REFERENCES DoctorDetails(DoctorID),
          DateTime DATETIME,
          Type NVARCHAR(50),
          Status NVARCHAR(20) DEFAULT 'Scheduled',
          Notes NVARCHAR(500)
        );

        CREATE TABLE TelemedicineRequests (
          RequestID INT PRIMARY KEY IDENTITY(1,1),
          PatientID INT FOREIGN KEY REFERENCES PatientDetails(PatientID),
          DoctorID INT FOREIGN KEY REFERENCES DoctorDetails(DoctorID),
          RequestedAt DATETIME DEFAULT GETDATE(),
          PreferredDateTime DATETIME,
          Reason NVARCHAR(500),
          Symptoms NVARCHAR(500),
          Status NVARCHAR(20) DEFAULT 'Pending'
        );

        CREATE TABLE PatientPoints (
          PointID INT PRIMARY KEY IDENTITY(1,1),
          PatientID INT FOREIGN KEY REFERENCES PatientDetails(PatientID),
          Points INT,
          Reason NVARCHAR(200),
          AwardedAt DATETIME DEFAULT GETDATE()
        );
        
        PRINT 'Tables created successfully';
      END
    `);
    
    console.log('Database tables verified');
    return pool;
  } catch (err) {
    console.error('Database initialization error:', err);
    throw err;
  }
}

// Initialize database connection
let dbPool;
initializeDatabase()
  .then(pool => {
    dbPool = pool;
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
    const userCheck = await dbPool.request()
      .input('email', sql.NVarChar, email)
      .query('SELECT * FROM Users WHERE Email = @email');

    if (userCheck.recordset.length > 0) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user
    const result = await dbPool.request()
      .input('email', sql.NVarChar, email)
      .input('password', sql.NVarChar, hashedPassword)
      .input('firstName', sql.NVarChar, firstName)
      .input('lastName', sql.NVarChar, lastName)
      .input('role', sql.NVarChar, role)
      .query('INSERT INTO Users (Email, Password, FirstName, LastName, Role) OUTPUT INSERTED.UserID VALUES (@email, @password, @firstName, @lastName, @role)');

    const userId = result.recordset[0].UserID;

    // Insert role-specific details
    if (role === 'patient') {
      await dbPool.request()
        .input('userId', sql.Int, userId)
        .input('dateOfBirth', sql.Date, details.dateOfBirth)
        .input('gender', sql.NVarChar, details.gender)
        .input('phoneNumber', sql.NVarChar, details.phoneNumber)
        .input('address', sql.NVarChar, details.address)
        .input('emergencyContact', sql.NVarChar, details.emergencyContact)
        .input('emergencyPhone', sql.NVarChar, details.emergencyPhone)
        .query('INSERT INTO PatientDetails (UserID, DateOfBirth, Gender, PhoneNumber, Address, EmergencyContact, EmergencyPhone) VALUES (@userId, @dateOfBirth, @gender, @phoneNumber, @address, @emergencyContact, @emergencyPhone)');
    } else if (role === 'doctor') {
      await dbPool.request()
        .input('userId', sql.Int, userId)
        .input('specialization', sql.NVarChar, details.specialization)
        .input('licenseNumber', sql.NVarChar, details.licenseNumber)
        .input('phoneNumber', sql.NVarChar, details.phoneNumber)
        .input('hospitalAffiliation', sql.NVarChar, details.hospitalAffiliation)
        .query('INSERT INTO DoctorDetails (UserID, Specialization, LicenseNumber, PhoneNumber, HospitalAffiliation) VALUES (@userId, @specialization, @licenseNumber, @phoneNumber, @hospitalAffiliation)');
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
    const result = await dbPool.request()
      .input('email', sql.NVarChar, email)
      .query('SELECT * FROM Users WHERE Email = @email');

    if (result.recordset.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const user = result.recordset[0];
    const isMatch = await bcrypt.compare(password, user.Password);

    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Update last login
    await dbPool.request()
      .input('userId', sql.Int, user.UserID)
      .query('UPDATE Users SET LastLogin = GETDATE() WHERE UserID = @userId');

    // Create token
    const token = jwt.sign(
      { userId: user.UserID, email: user.Email, role: user.Role },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({ 
      token, 
      user: { 
        email: user.Email, 
        firstName: user.FirstName, 
        lastName: user.LastName, 
        role: user.Role 
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
    const result = await dbPool.request()
      .input('userId', sql.Int, req.user.userId)
      .query(`
        SELECT * FROM PatientHealthData 
        WHERE PatientID = (SELECT PatientID FROM PatientDetails WHERE UserID = @userId)
        ORDER BY RecordedAt DESC
      `);
    
    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching health data:', error);
    res.status(500).json({ message: 'Failed to fetch health data' });
  }
});

app.post('/api/patient/health-data', authenticateToken, async (req, res) => {
  if (req.user.role !== 'patient') return res.sendStatus(403);
  
  try {
    const { bloodPressure, heartRate, bloodSugar, oxygenLevel, notes } = req.body;
    
    await dbPool.request()
      .input('patientId', sql.Int, 
        (await dbPool.request()
          .input('userId', sql.Int, req.user.userId)
          .query('SELECT PatientID FROM PatientDetails WHERE UserID = @userId')
        ).recordset[0].PatientID
      )
      .input('bloodPressure', sql.NVarChar, bloodPressure)
      .input('heartRate', sql.Int, heartRate)
      .input('bloodSugar', sql.Int, bloodSugar)
      .input('oxygenLevel', sql.Int, oxygenLevel)
      .input('notes', sql.NVarChar, notes || null)
      .query(`
        INSERT INTO PatientHealthData 
        (PatientID, BloodPressure, HeartRate, BloodSugar, OxygenLevel, Notes, RecordedAt)
        VALUES (@patientId, @bloodPressure, @heartRate, @bloodSugar, @oxygenLevel, @notes, GETDATE())
      `);
    
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
    const result = await dbPool.request()
      .input('userId', sql.Int, req.user.userId)
      .query(`
        SELECT TOP 1 RiskScore FROM PatientRiskScores 
        WHERE PatientID = (SELECT PatientID FROM PatientDetails WHERE UserID = @userId)
        ORDER BY CalculatedAt DESC
      `);
    
    res.json({ score: result.recordset.length > 0 ? result.recordset[0].RiskScore : 0 });
  } catch (error) {
    console.error('Error fetching risk score:', error);
    res.status(500).json({ message: 'Failed to fetch risk score' });
  }
});

// Add this endpoint before the error handling middleware
app.get('/api/patient/vitals', authenticateToken, async (req, res) => {
  if (req.user.role !== 'patient') return res.sendStatus(403);
  
  try {
    const result = await dbPool.request()
      .input('userId', sql.Int, req.user.userId)
      .query(`
        SELECT TOP 1 
          BloodPressure as bloodPressure,
          HeartRate as heartRate,
          BloodSugar as bloodSugar,
          OxygenLevel as oxygenLevel
        FROM PatientHealthData 
        WHERE PatientID = (SELECT PatientID FROM PatientDetails WHERE UserID = @userId)
        ORDER BY RecordedAt DESC
      `);
    
    if (result.recordset.length > 0) {
      res.json(result.recordset[0]);
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
    const healthData = await dbPool.request()
      .input('userId', sql.Int, userId)
      .query(`
        SELECT TOP 10 * FROM PatientHealthData 
        WHERE PatientID = (SELECT PatientID FROM PatientDetails WHERE UserID = @userId)
        ORDER BY RecordedAt DESC
      `);
    
    if (healthData.recordset.length === 0) return;
    
    // Simple risk calculation (replace with actual ML model in production)
    const latestData = healthData.recordset[0];
    let riskScore = 0;
    
    // Blood pressure risk
    const [systolic, diastolic] = latestData.BloodPressure.split('/').map(Number);
    if (systolic > 140 || diastolic > 90) riskScore += 30;
    else if (systolic > 130 || diastolic > 85) riskScore += 15;
    
    // Heart rate risk
    if (latestData.HeartRate > 100 || latestData.HeartRate < 60) riskScore += 20;
    else if (latestData.HeartRate > 90 || latestData.HeartRate < 65) riskScore += 10;
    
    // Blood sugar risk
    if (latestData.BloodSugar > 140) riskScore += 25;
    else if (latestData.BloodSugar > 120) riskScore += 12;
    
    // Oxygen level risk
    if (latestData.OxygenLevel < 92) riskScore += 25;
    else if (latestData.OxygenLevel < 95) riskScore += 10;
    
    // Cap at 100
    riskScore = Math.min(100, riskScore);
    
    // Save risk score
    await dbPool.request()
      .input('patientId', sql.Int, 
        (await dbPool.request()
          .input('userId', sql.Int, userId)
          .query('SELECT PatientID FROM PatientDetails WHERE UserID = @userId')
        ).recordset[0].PatientID
      )
      .input('riskScore', sql.Int, riskScore)
      .query(`
        INSERT INTO PatientRiskScores (PatientID, RiskScore, CalculatedAt)
        VALUES (@patientId, @riskScore, GETDATE())
      `);
    
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
    await dbPool.request()
      .input('patientId', sql.Int, 
        (await dbPool.request()
          .input('userId', sql.Int, userId)
          .query('SELECT PatientID FROM PatientDetails WHERE UserID = @userId')
        ).recordset[0].PatientID
      )
      .input('message', sql.NVarChar, message)
      .input('severity', sql.NVarChar, severity)
      .query(`
        INSERT INTO PatientAlerts (PatientID, Message, Severity, Timestamp, IsRead)
        VALUES (@patientId, @message, @severity, GETDATE(), 0)
      `);
  } catch (error) {
    console.error('Error generating alert:', error);
  }
}

// Protected route example
app.get('/api/protected', authenticateToken, (req, res) => {
  res.json({ message: 'This is a protected route', user: req.user });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', database: dbPool ? 'Connected' : 'Disconnected' });
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
  if (dbPool) {
    await dbPool.close();
    console.log('Database connection closed');
  }
  process.exit(0);
});
// Add these endpoints to your server.js file

// Get patient medications
app.get('/api/patient/medications', authenticateToken, async (req, res) => {
  if (req.user.role !== 'patient') return res.sendStatus(403);
  
  try {
    const result = await dbPool.request()
      .input('userId', sql.Int, req.user.userId)
      .query(`
        SELECT * FROM PatientMedications 
        WHERE PatientID = (SELECT PatientID FROM PatientDetails WHERE UserID = @userId)
        ORDER BY NextDose ASC
      `);
    
    res.json(result.recordset);
  } catch (error) {
    console.error('Error fetching medications:', error);
    res.status(500).json({ message: 'Failed to fetch medications' });
  }
});

// Get patient alerts
app.get('/api/patient/alerts', authenticateToken, async (req, res) => {
  if (req.user.role !== 'patient') return res.sendStatus(403);
  
  try {
    const result = await dbPool.request()
      .input('userId', sql.Int, req.user.userId)
      .query(`
        SELECT * FROM PatientAlerts 
        WHERE PatientID = (SELECT PatientID FROM PatientDetails WHERE UserID = @userId)
        ORDER BY Timestamp DESC
      `);
    
    res.json(result.recordset);
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
    const result = await dbPool.request()
      .input('userId', sql.Int, req.user.userId)
      .query(`
        SELECT SUM(Points) as points FROM PatientPoints
        WHERE PatientID = (SELECT PatientID FROM PatientDetails WHERE UserID = @userId)
      `);
    
    res.json({ points: result.recordset[0].points || 0 });
  } catch (error) {
    console.error('Error fetching points:', error);
    res.status(500).json({ message: 'Failed to fetch points' });
  }
});

// Get all doctors
app.get('/api/doctors', authenticateToken, async (req, res) => {
  try {
    const result = await dbPool.request()
      .query(`
        SELECT 
          dd.DoctorID as id, 
          u.FirstName + ' ' + u.LastName as name, 
          dd.Specialization as specialization,
          dd.HospitalAffiliation as hospital,
          dd.PhoneNumber as phone,
          u.Email as email
        FROM DoctorDetails dd
        JOIN Users u ON dd.UserID = u.UserID
      `);
    
    res.json(result.recordset);
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
    
    await dbPool.request()
      .input('patientId', sql.Int, 
        (await dbPool.request()
          .input('userId', sql.Int, req.user.userId)
          .query('SELECT PatientID FROM PatientDetails WHERE UserID = @userId')
        ).recordset[0].PatientID
      )
      .input('doctorId', sql.Int, doctorId)
      .input('preferredDateTime', sql.DateTime, preferredDateTime)
      .input('reason', sql.NVarChar, reason)
      .input('symptoms', sql.NVarChar, symptoms || null)
      .query(`
        INSERT INTO TelemedicineRequests 
        (PatientID, DoctorID, PreferredDateTime, Reason, Symptoms)
        VALUES (@patientId, @doctorId, @preferredDateTime, @reason, @symptoms)
      `);
    
    // Award points for engagement
    await dbPool.request()
      .input('patientId', sql.Int, 
        (await dbPool.request()
          .input('userId', sql.Int, req.user.userId)
          .query('SELECT PatientID FROM PatientDetails WHERE UserID = @userId')
        ).recordset[0].PatientID
      )
      .input('points', sql.Int, 10)
      .input('reason', sql.NVarChar, 'Telemedicine request submission')
      .query(`
        INSERT INTO PatientPoints 
        (PatientID, Points, Reason)
        VALUES (@patientId, @points, @reason)
      `);
    
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
    await dbPool.request()
      .input('medicationId', sql.Int, req.params.id)
      .input('patientId', sql.Int, 
        (await dbPool.request()
          .input('userId', sql.Int, req.user.userId)
          .query('SELECT PatientID FROM PatientDetails WHERE UserID = @userId')
        ).recordset[0].PatientID
      )
      .query(`
        UPDATE PatientMedications 
        SET Status = 'Taken' 
        WHERE MedicationID = @medicationId AND PatientID = @patientId
      `);
    
    // Award points for medication adherence
    await dbPool.request()
      .input('patientId', sql.Int, 
        (await dbPool.request()
          .input('userId', sql.Int, req.user.userId)
          .query('SELECT PatientID FROM PatientDetails WHERE UserID = @userId')
        ).recordset[0].PatientID
      )
      .input('points', sql.Int, 5)
      .input('reason', sql.NVarChar, 'Medication adherence')
      .query(`
        INSERT INTO PatientPoints 
        (PatientID, Points, Reason)
        VALUES (@patientId, @points, @reason)
      `);
    
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
    await dbPool.request()
      .input('alertId', sql.Int, req.params.id)
      .input('patientId', sql.Int, 
        (await dbPool.request()
          .input('userId', sql.Int, req.user.userId)
          .query('SELECT PatientID FROM PatientDetails WHERE UserID = @userId')
        ).recordset[0].PatientID
      )
      .query(`
        UPDATE PatientAlerts 
        SET IsRead = 1 
        WHERE AlertID = @alertId AND PatientID = @patientId
      `);
    
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
    // Get basic user info
    const userResult = await dbPool.request()
      .input('userId', sql.Int, req.user.userId)
      .query('SELECT FirstName, LastName, Email, Role FROM Users WHERE UserID = @userId');
    
    if (userResult.recordset.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const user = userResult.recordset[0];
    
    // Get patient details
    const patientResult = await dbPool.request()
      .input('userId', sql.Int, req.user.userId)
      .query(`
        SELECT DateOfBirth, Gender, PhoneNumber, Address, EmergencyContact, EmergencyPhone 
        FROM PatientDetails 
        WHERE UserID = @userId
      `);
    
    // Combine the data
    const profileData = {
      firstName: user.FirstName,
      lastName: user.LastName,
      email: user.Email,
      role: user.Role,
      dateOfBirth: patientResult.recordset[0]?.DateOfBirth,
      gender: patientResult.recordset[0]?.Gender,
      phoneNumber: patientResult.recordset[0]?.PhoneNumber,
      address: patientResult.recordset[0]?.Address,
      emergencyContact: patientResult.recordset[0]?.EmergencyContact,
      emergencyPhone: patientResult.recordset[0]?.EmergencyPhone
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
    // Get basic user info
    const userResult = await dbPool.request()
      .input('userId', sql.Int, req.user.userId)
      .query('SELECT FirstName, LastName, Email, Role FROM Users WHERE UserID = @userId');
    
    if (userResult.recordset.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const user = userResult.recordset[0];
    
    // Get doctor details
    const doctorResult = await dbPool.request()
      .input('userId', sql.Int, req.user.userId)
      .query(`
        SELECT Specialization, LicenseNumber, PhoneNumber, HospitalAffiliation 
        FROM DoctorDetails 
        WHERE UserID = @userId
      `);
    
    // Combine the data
    const profileData = {
      firstName: user.FirstName,
      lastName: user.LastName,
      email: user.Email,
      role: user.Role,
      specialization: doctorResult.recordset[0]?.Specialization,
      licenseNumber: doctorResult.recordset[0]?.LicenseNumber,
      phoneNumber: doctorResult.recordset[0]?.PhoneNumber,
      hospitalAffiliation: doctorResult.recordset[0]?.HospitalAffiliation
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
      // Forward to patient profile endpoint
      req.url = '/api/patient/profile';
      return app.handle(req, res);
    } else if (req.user.role === 'doctor') {
      // Forward to doctor profile endpoint
      req.url = '/api/doctor/profile';
      return app.handle(req, res);
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
    const result = await dbPool.request().query(`
      SELECT 
        p.PatientID as id,
        u.FirstName + ' ' + u.LastName as name,
        pd.DateOfBirth as dob,
        pd.Gender as gender,
        pd.PhoneNumber as phone,
        u.Email as email,
        (SELECT TOP 1 RiskScore FROM PatientRiskScores 
         WHERE PatientID = p.PatientID 
         ORDER BY CalculatedAt DESC) as riskScore,
        (SELECT COUNT(*) FROM PatientAlerts 
         WHERE PatientID = p.PatientID AND IsRead = 0) as unreadAlerts,
        (SELECT COUNT(*) FROM PatientMedications 
         WHERE PatientID = p.PatientID AND Status = 'Pending') as pendingMeds
      FROM PatientDetails p
      JOIN Users u ON p.UserID = u.UserID
      LEFT JOIN PatientDetails pd ON p.PatientID = pd.PatientID
      ORDER BY u.LastName, u.FirstName
    `);

    // Process the data to add status information
    const patients = result.recordset.map(patient => {
      let status = 'Normal';
      if (patient.riskScore > 70) status = 'Critical';
      else if (patient.riskScore > 40) status = 'Warning';

      return {
        ...patient,
        status,
        lastReading: patient.riskScore ? `Risk: ${patient.riskScore}` : 'No data',
        lastChecked: 'Today', // You can modify this to show actual last check date
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
    
    // Get basic patient info
    const patientResult = await dbPool.request()
      .input('patientId', sql.Int, patientId)
      .query(`
        SELECT 
          u.FirstName, u.LastName, u.Email,
          pd.DateOfBirth, pd.Gender, pd.PhoneNumber, 
          pd.Address, pd.EmergencyContact, pd.EmergencyPhone
        FROM PatientDetails pd
        JOIN Users u ON pd.UserID = u.UserID
        WHERE pd.PatientID = @patientId
      `);
    
    if (patientResult.recordset.length === 0) {
      return res.status(404).json({ message: 'Patient not found' });
    }
    
    const patient = patientResult.recordset[0];
    
    // Get health data
    const healthData = await dbPool.request()
      .input('patientId', sql.Int, patientId)
      .query(`
        SELECT TOP 10 * FROM PatientHealthData
        WHERE PatientID = @patientId
        ORDER BY RecordedAt DESC
      `);
    
    // Get medications
    const medications = await dbPool.request()
      .input('patientId', sql.Int, patientId)
      .query(`
        SELECT * FROM PatientMedications
        WHERE PatientID = @patientId
        ORDER BY NextDose ASC
      `);
    
    // Get risk scores
    const riskScores = await dbPool.request()
      .input('patientId', sql.Int, patientId)
      .query(`
        SELECT TOP 5 * FROM PatientRiskScores
        WHERE PatientID = @patientId
        ORDER BY CalculatedAt DESC
      `);
    
    res.json({
      profile: {
        name: `${patient.FirstName} ${patient.LastName}`,
        email: patient.Email,
        dob: patient.DateOfBirth,
        gender: patient.Gender,
        phone: patient.PhoneNumber,
        address: patient.Address,
        emergencyContact: patient.EmergencyContact,
        emergencyPhone: patient.EmergencyPhone
      },
      healthData: healthData.recordset,
      medications: medications.recordset,
      riskScores: riskScores.recordset
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
    const result = await dbPool.request()
      .input('userId', sql.Int, req.user.userId)
      .query(`
        SELECT a.*, 
               d.FirstName + ' ' + d.LastName as DoctorName,
               dd.Specialization as DoctorSpecialization
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

// Create new appointment
app.post('/api/patient/appointments', authenticateToken, async (req, res) => {
  if (req.user.role !== 'patient') return res.sendStatus(403);
  
  try {
    const { doctorId, dateTime, type, notes } = req.body;
    
    const result = await dbPool.request()
      .input('patientId', sql.Int, 
        (await dbPool.request()
          .input('userId', sql.Int, req.user.userId)
          .query('SELECT PatientID FROM PatientDetails WHERE UserID = @userId')
        ).recordset[0].PatientID
      )
      .input('doctorId', sql.Int, doctorId)
      .input('dateTime', sql.DateTime, dateTime)
      .input('type', sql.NVarChar, type)
      .input('notes', sql.NVarChar, notes || null)
      .query(`
        INSERT INTO PatientAppointments 
        (PatientID, DoctorID, DateTime, Type, Notes, Status)
        VALUES (@patientId, @doctorId, @dateTime, @type, @notes, 'Scheduled')
      `);
    
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
    
    // Calculate next dose time (default to now + 1 day)
    const nextDose = new Date();
    nextDose.setDate(nextDose.getDate() + 1);
    
    await dbPool.request()
      .input('patientId', sql.Int, patientId)
      .input('name', sql.NVarChar, name)
      .input('dosage', sql.NVarChar, dosage)
      .input('frequency', sql.NVarChar, frequency)
      .input('nextDose', sql.DateTime, nextDose)
      .input('notes', sql.NVarChar, notes || null)
      .query(`
        INSERT INTO PatientMedications 
        (PatientID, Name, Dosage, Frequency, NextDose, Notes, Status)
        VALUES (@patientId, @name, @dosage, @frequency, @nextDose, @notes, 'Pending')
      `);
    
    // Mark appointment as completed
    await dbPool.request()
      .input('patientId', sql.Int, patientId)
      .input('doctorId', sql.Int, 
        (await dbPool.request()
          .input('userId', sql.Int, req.user.userId)
          .query('SELECT DoctorID FROM DoctorDetails WHERE UserID = @userId')
        ).recordset[0].DoctorID
      )
      .query(`
        UPDATE PatientAppointments 
        SET Status = 'Completed' 
        WHERE PatientID = @patientId AND DoctorID = @doctorId
        AND Status = 'Scheduled'
      `);
    
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
    // In a real app, you would call your ML model here
    // This is a simplified mock response
    
    // Get patient's recent health data
    const healthData = await dbPool.request()
      .input('userId', sql.Int, req.user.userId)
      .query(`
        SELECT TOP 30 * FROM PatientHealthData 
        WHERE PatientID = (SELECT PatientID FROM PatientDetails WHERE UserID = @userId)
        ORDER BY RecordedAt DESC
      `);
    
    if (healthData.recordset.length === 0) {
      return res.json(null);
    }
    
    // Mock prediction - in reality you would use a trained model
    const mockPredictions = generateMockPredictions(healthData.recordset);
    
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
  // This would be replaced with actual model predictions
  const predictions = [];
  const metrics = ['bloodPressure', 'heartRate', 'bloodSugar', 'oxygenLevel', 'riskScore'];
  const today = new Date();
  
  metrics.forEach(metric => {
    for (let i = 0; i < 30; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      
      // Base value on last actual reading
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
      
      // Add some variation
      const variation = (Math.random() * 0.2 - 0.1) * baseValue;
      let value = baseValue + variation;
      
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
    
    // Create access token
    const token = new AccessToken(
      twilioAccountSid,
      twilioApiKey,
      twilioApiSecret,
      { identity }
    );

    // Grant video access
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
    const { id } = req.params;
    
    // Update appointment status
    await dbPool.request()
      .input('appointmentId', sql.Int, id)
      .query(`
        UPDATE PatientAppointments 
        SET Status = 'In Progress' 
        WHERE AppointmentID = @appointmentId
      `);
    
    res.json({ message: 'Appointment call started' });
  } catch (error) {
    console.error('Error starting call:', error);
    res.status(500).json({ message: 'Failed to start call' });
  }
});