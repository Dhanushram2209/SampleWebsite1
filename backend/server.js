require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const { Pool } = require("pg");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const twilio = require("twilio");
const AccessToken = twilio.jwt.AccessToken;
const VideoGrant = AccessToken.VideoGrant;

const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID || "AC5cb66cf0a4209d0d22414fa973a59ad5";
const twilioApiKey = process.env.TWILIO_API_KEY || "26716487a7705ba09b4ecb735e1f9277";
const twilioApiSecret = process.env.TWILIO_API_SECRET || "MnkYCUA1ysNzrjJo9T6FidGvgDBhpeX8PKHwmRu5Lc3xOSQ7tWfEbl40VIa2Zq";

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Database configuration
const dbConfig = {
  connectionString: process.env.DATABASE_URL || 
    "postgresql://chronic_admin:qYxBTV6xdzy0MV9oDMhBnfykQegl1nnT@dpg-d1ododqdbo4c73avbhr0-a.oregon-postgres.render.com/chronic_disease_db",
  ssl: {
    rejectUnauthorized: false  // Required for Render PostgreSQL
  }
};

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

// Create the connection pool
const pool = new Pool(dbConfig);

// Database initialization function
async function initializeDatabase() {
  try {
    // Test the connection
    await pool.query('SELECT NOW()');
    console.log('Database connection established');
    
    // First check if Users table exists
    const tableCheck = await pool.query(
      "SELECT * FROM information_schema.tables WHERE table_name = 'users'"
    );

    console.log(`Users table exists: ${tableCheck.rows.length > 0}`);

    if (tableCheck.rows.length === 0) {
      console.log("Creating tables...");
      await createTables();
    } else {
      console.log("Tables already exist, skipping creation");
    }

    console.log("Database tables verified");
    return pool;
  } catch (err) {
    console.error("Database initialization error:", err);
    
    // More detailed error logging
    if (err.code === 'ENOTFOUND') {
      console.error('DNS lookup failed - check your database hostname');
    } else if (err.code === 'ECONNREFUSED') {
      console.error('Connection refused - check if database is running and accessible');
    } else if (err.code === '28P01') {
      console.error('Authentication failed - check username/password');
    }
    
    throw err;
  }
}

// Initialize database connection
let dbPool;
initializeDatabase()
  .then((pool) => {
    dbPool = pool;
    console.log("Database connection successfully established");
  })
  .catch((err) => {
    console.error("Database connection failed:", err);
    process.exit(1); // Exit with error code
  });

async function createTables() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS Users (
        UserID SERIAL PRIMARY KEY,
        Email VARCHAR(100) UNIQUE NOT NULL,
        Password VARCHAR(255) NOT NULL,
        FirstName VARCHAR(50) NOT NULL,
        LastName VARCHAR(50) NOT NULL,
        Role VARCHAR(20) NOT NULL CHECK (Role IN ('patient', 'doctor')),
        CreatedAt TIMESTAMP DEFAULT NOW(),
        LastLogin TIMESTAMP NULL
      );

      CREATE TABLE IF NOT EXISTS PatientDetails (
        PatientID SERIAL PRIMARY KEY,
        UserID INT REFERENCES Users(UserID),
        DateOfBirth DATE,
        Gender VARCHAR(10),
        PhoneNumber VARCHAR(20),
        Address VARCHAR(255),
        EmergencyContact VARCHAR(100),
        EmergencyPhone VARCHAR(20)
      );

      CREATE TABLE IF NOT EXISTS DoctorDetails (
        DoctorID SERIAL PRIMARY KEY,
        UserID INT REFERENCES Users(UserID),
        Specialization VARCHAR(100),
        LicenseNumber VARCHAR(50),
        PhoneNumber VARCHAR(20),
        HospitalAffiliation VARCHAR(100)
      );

      CREATE TABLE IF NOT EXISTS PatientHealthData (
        RecordID SERIAL PRIMARY KEY,
        PatientID INT REFERENCES PatientDetails(PatientID),
        BloodPressure VARCHAR(20),
        HeartRate INT,
        BloodSugar INT,
        OxygenLevel INT,
        Notes VARCHAR(500),
        RecordedAt TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS PatientRiskScores (
        ScoreID SERIAL PRIMARY KEY,
        PatientID INT REFERENCES PatientDetails(PatientID),
        RiskScore INT,
        CalculatedAt TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS PatientAlerts (
        AlertID SERIAL PRIMARY KEY,
        PatientID INT REFERENCES PatientDetails(PatientID),
        Message VARCHAR(500),
        Severity VARCHAR(20) CHECK (Severity IN ('Low', 'Medium', 'High')),
        Timestamp TIMESTAMP DEFAULT NOW(),
        IsRead BOOLEAN DEFAULT FALSE
      );

      CREATE TABLE IF NOT EXISTS PatientMedications (
        MedicationID SERIAL PRIMARY KEY,
        PatientID INT REFERENCES PatientDetails(PatientID),
        Name VARCHAR(100) NOT NULL,
        Dosage VARCHAR(50) NOT NULL,
        Frequency VARCHAR(50) NOT NULL,
        NextDose TIMESTAMP NOT NULL,
        Instructions VARCHAR(500),
        PrescribedBy VARCHAR(100) NOT NULL,
        Status VARCHAR(20) DEFAULT 'Pending',
        CreatedAt TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS PatientAppointments (
        AppointmentID SERIAL PRIMARY KEY,
        PatientID INT REFERENCES PatientDetails(PatientID),
        DoctorID INT REFERENCES DoctorDetails(DoctorID),
        DateTime TIMESTAMP,
        Type VARCHAR(50),
        Status VARCHAR(20) DEFAULT 'Scheduled',
        Notes VARCHAR(500)
      );

      CREATE TABLE IF NOT EXISTS TelemedicineRequests (
        RequestID SERIAL PRIMARY KEY,
        PatientID INT REFERENCES PatientDetails(PatientID),
        DoctorID INT REFERENCES DoctorDetails(DoctorID),
        RequestedAt TIMESTAMP DEFAULT NOW(),
        PreferredDateTime TIMESTAMP,
        Reason VARCHAR(500),
        Symptoms VARCHAR(500),
        Status VARCHAR(20) DEFAULT 'Pending'
      );

      CREATE TABLE IF NOT EXISTS PatientPoints (
        PointID SERIAL PRIMARY KEY,
        PatientID INT REFERENCES PatientDetails(PatientID),
        Points INT,
        Reason VARCHAR(200),
        AwardedAt TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log("Tables created successfully");
  } catch (err) {
    console.error("Error creating tables:", err);
    throw err;
  }
}

// Middleware to authenticate token
function authenticateToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

// Register endpoint
app.post("/api/register", async (req, res) => {
  const { email, password, firstName, lastName, role, ...details } = req.body;

  try {
    // Check if user already exists
    const userCheck = await dbPool.query(
      "SELECT * FROM Users WHERE Email = $1",
      [email]
    );

    if (userCheck.rows.length > 0) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user
    const result = await dbPool.query(
      `INSERT INTO Users (Email, Password, FirstName, LastName, Role) 
       VALUES ($1, $2, $3, $4, $5) RETURNING UserID`,
      [email, hashedPassword, firstName, lastName, role]
    );

    const userId = result.rows[0].userid;

    // Insert role-specific details
    if (role === "patient") {
      await dbPool.query(
        `INSERT INTO PatientDetails 
         (UserID, DateOfBirth, Gender, PhoneNumber, Address, EmergencyContact, EmergencyPhone) 
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          userId,
          details.dateOfBirth,
          details.gender,
          details.phoneNumber,
          details.address,
          details.emergencyContact,
          details.emergencyPhone
        ]
      );
    } else if (role === "doctor") {
      await dbPool.query(
        `INSERT INTO DoctorDetails 
         (UserID, Specialization, LicenseNumber, PhoneNumber, HospitalAffiliation) 
         VALUES ($1, $2, $3, $4, $5)`,
        [
          userId,
          details.specialization,
          details.licenseNumber,
          details.phoneNumber,
          details.hospitalAffiliation
        ]
      );
    }

    res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({ message: "Registration failed", error: error.message });
  }
});

// Login endpoint
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const result = await dbPool.query(
      "SELECT * FROM Users WHERE Email = $1",
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const user = result.rows[0];
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Update last login
    await dbPool.query(
      "UPDATE Users SET LastLogin = NOW() WHERE UserID = $1",
      [user.userid]
    );

    // Create token
    const token = jwt.sign(
      { userId: user.userid, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.json({
      token,
      user: {
        email: user.email,
        firstName: user.firstname,
        lastName: user.lastname,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: "Login failed", error: error.message });
  }
});

// Patient Data Endpoints
app.get("/api/patient/health-data", authenticateToken, async (req, res) => {
  if (req.user.role !== "patient") return res.sendStatus(403);

  try {
    const result = await dbPool.query(
      `SELECT * FROM PatientHealthData 
       WHERE PatientID = (SELECT PatientID FROM PatientDetails WHERE UserID = $1)
       ORDER BY RecordedAt DESC`,
      [req.user.userId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching health data:", error);
    res.status(500).json({ message: "Failed to fetch health data" });
  }
});

app.post("/api/patient/health-data", authenticateToken, async (req, res) => {
  if (req.user.role !== "patient") return res.sendStatus(403);

  try {
    const { bloodPressure, heartRate, bloodSugar, oxygenLevel, notes } = req.body;

    const patientResult = await dbPool.query(
      "SELECT PatientID FROM PatientDetails WHERE UserID = $1",
      [req.user.userId]
    );
    const patientId = patientResult.rows[0].patientid;

    await dbPool.query(
      `INSERT INTO PatientHealthData 
       (PatientID, BloodPressure, HeartRate, BloodSugar, OxygenLevel, Notes, RecordedAt)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [patientId, bloodPressure, heartRate, bloodSugar, oxygenLevel, notes || null]
    );

    // Trigger AI analysis
    await analyzePatientData(req.user.userId);

    res.status(201).json({ message: "Health data recorded successfully" });
  } catch (error) {
    console.error("Error recording health data:", error);
    res.status(500).json({ message: "Failed to record health data" });
  }
});

app.get("/api/patient/risk-score", authenticateToken, async (req, res) => {
  if (req.user.role !== "patient") return res.sendStatus(403);

  try {
    const result = await dbPool.query(
      `SELECT RiskScore FROM PatientRiskScores 
       WHERE PatientID = (SELECT PatientID FROM PatientDetails WHERE UserID = $1)
       ORDER BY CalculatedAt DESC
       LIMIT 1`,
      [req.user.userId]
    );

    res.json({
      score: result.rows.length > 0 ? result.rows[0].riskscore : 0,
    });
  } catch (error) {
    console.error("Error fetching risk score:", error);
    res.status(500).json({ message: "Failed to fetch risk score" });
  }
});

app.get("/api/patient/vitals", authenticateToken, async (req, res) => {
  if (req.user.role !== "patient") return res.sendStatus(403);

  try {
    const result = await dbPool.query(
      `SELECT 
        BloodPressure as bloodPressure,
        HeartRate as heartRate,
        BloodSugar as bloodSugar,
        OxygenLevel as oxygenLevel
      FROM PatientHealthData 
      WHERE PatientID = (SELECT PatientID FROM PatientDetails WHERE UserID = $1)
      ORDER BY RecordedAt DESC
      LIMIT 1`,
      [req.user.userId]
    );

    if (result.rows.length > 0) {
      res.json(result.rows[0]);
    } else {
      res.json(null);
    }
  } catch (error) {
    console.error("Error fetching vitals:", error);
    res.status(500).json({ message: "Failed to fetch vitals" });
  }
});

// AI Analysis Function
async function analyzePatientData(userId) {
  try {
    // Get patient's recent health data
    const healthData = await dbPool.query(
      `SELECT * FROM PatientHealthData 
       WHERE PatientID = (SELECT PatientID FROM PatientDetails WHERE UserID = $1)
       ORDER BY RecordedAt DESC
       LIMIT 10`,
      [userId]
    );

    if (healthData.rows.length === 0) return;

    // Simple risk calculation (replace with actual ML model in production)
    const latestData = healthData.rows[0];
    let riskScore = 0;

    // Blood pressure risk
    const [systolic, diastolic] = latestData.bloodpressure.split("/").map(Number);
    if (systolic > 140 || diastolic > 90) riskScore += 30;
    else if (systolic > 130 || diastolic > 85) riskScore += 15;

    // Heart rate risk
    if (latestData.heartrate > 100 || latestData.heartrate < 60) riskScore += 20;
    else if (latestData.heartrate > 90 || latestData.heartrate < 65) riskScore += 10;

    // Blood sugar risk
    if (latestData.bloodsugar > 140) riskScore += 25;
    else if (latestData.bloodsugar > 120) riskScore += 12;

    // Oxygen level risk
    if (latestData.oxygenlevel < 92) riskScore += 25;
    else if (latestData.oxygenlevel < 95) riskScore += 10;

    // Cap at 100
    riskScore = Math.min(100, riskScore);

    // Get patient ID
    const patientResult = await dbPool.query(
      "SELECT PatientID FROM PatientDetails WHERE UserID = $1",
      [userId]
    );
    const patientId = patientResult.rows[0].patientid;

    // Save risk score
    await dbPool.query(
      `INSERT INTO PatientRiskScores (PatientID, RiskScore, CalculatedAt)
       VALUES ($1, $2, NOW())`,
      [patientId, riskScore]
    );

    // Generate alerts if needed
    if (riskScore > 70) {
      await generateAlert(
        userId,
        "High risk detected. Please consult your doctor immediately.",
        "High"
      );
    } else if (riskScore > 40) {
      await generateAlert(
        userId,
        "Moderate risk detected. Monitor your condition closely.",
        "Medium"
      );
    }
  } catch (error) {
    console.error("AI analysis error:", error);
  }
}

async function generateAlert(userId, message, severity) {
  try {
    const patientResult = await dbPool.query(
      "SELECT PatientID FROM PatientDetails WHERE UserID = $1",
      [userId]
    );
    const patientId = patientResult.rows[0].patientid;

    await dbPool.query(
      `INSERT INTO PatientAlerts (PatientID, Message, Severity, Timestamp, IsRead)
       VALUES ($1, $2, $3, NOW(), FALSE)`,
      [patientId, message, severity]
    );
  } catch (error) {
    console.error("Error generating alert:", error);
  }
}

// Protected route example
app.get("/api/protected", authenticateToken, (req, res) => {
  res.json({ message: "This is a protected route", user: req.user });
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "OK", database: dbPool ? "Connected" : "Disconnected" });
});

// Get patient medications
app.get("/api/patient/medications", authenticateToken, async (req, res) => {
  if (req.user.role !== "patient") return res.sendStatus(403);

  try {
    const result = await dbPool.query(
      `SELECT * FROM PatientMedications 
       WHERE PatientID = (SELECT PatientID FROM PatientDetails WHERE UserID = $1)
       ORDER BY NextDose ASC`,
      [req.user.userId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching medications:", error);
    res.status(500).json({ message: "Failed to fetch medications" });
  }
});

// Get patient alerts
app.get("/api/patient/alerts", authenticateToken, async (req, res) => {
  if (req.user.role !== "patient") return res.sendStatus(403);

  try {
    const result = await dbPool.query(
      `SELECT * FROM PatientAlerts 
       WHERE PatientID = (SELECT PatientID FROM PatientDetails WHERE UserID = $1)
       ORDER BY Timestamp DESC`,
      [req.user.userId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching alerts:", error);
    res.status(500).json({ message: "Failed to fetch alerts" });
  }
});

// Get patient appointments
app.get("/api/patient/appointments", authenticateToken, async (req, res) => {
  if (req.user.role !== "patient") return res.sendStatus(403);

  try {
    const result = await dbPool.query(
      `SELECT a.*, 
              d.FirstName || ' ' || d.LastName as DoctorName,
              dd.Specialization as DoctorSpecialization
       FROM PatientAppointments a
       JOIN DoctorDetails dd ON a.DoctorID = dd.DoctorID
       JOIN Users d ON dd.UserID = d.UserID
       WHERE a.PatientID = (SELECT PatientID FROM PatientDetails WHERE UserID = $1)
       ORDER BY a.DateTime DESC`,
      [req.user.userId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching appointments:", error);
    res.status(500).json({ message: "Failed to fetch appointments" });
  }
});

// Get patient points
app.get("/api/patient/points", authenticateToken, async (req, res) => {
  if (req.user.role !== "patient") return res.sendStatus(403);

  try {
    const result = await dbPool.query(
      `SELECT SUM(Points) as points FROM PatientPoints
       WHERE PatientID = (SELECT PatientID FROM PatientDetails WHERE UserID = $1)`,
      [req.user.userId]
    );

    res.json({ points: result.rows[0].points || 0 });
  } catch (error) {
    console.error("Error fetching points:", error);
    res.status(500).json({ message: "Failed to fetch points" });
  }
});

// Get all doctors
app.get("/api/doctors", authenticateToken, async (req, res) => {
  try {
    const result = await dbPool.query(`
      SELECT 
        dd.DoctorID as id, 
        u.FirstName || ' ' || u.LastName as name, 
        dd.Specialization as specialization,
        dd.HospitalAffiliation as hospital,
        dd.PhoneNumber as phone,
        u.Email as email
      FROM DoctorDetails dd
      JOIN Users u ON dd.UserID = u.UserID
    `);

    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching doctors:", error);
    res.status(500).json({ message: "Failed to fetch doctors" });
  }
});

// Submit telemedicine request
app.post("/api/telemedicine/request", authenticateToken, async (req, res) => {
  if (req.user.role !== "patient") return res.sendStatus(403);

  try {
    const { doctorId, preferredDateTime, reason, symptoms } = req.body;

    const patientResult = await dbPool.query(
      "SELECT PatientID FROM PatientDetails WHERE UserID = $1",
      [req.user.userId]
    );
    const patientId = patientResult.rows[0].patientid;

    await dbPool.query(
      `INSERT INTO TelemedicineRequests 
       (PatientID, DoctorID, PreferredDateTime, Reason, Symptoms)
       VALUES ($1, $2, $3, $4, $5)`,
      [patientId, doctorId, preferredDateTime, reason, symptoms || null]
    );

    // Award points for engagement
    await dbPool.query(
      `INSERT INTO PatientPoints 
       (PatientID, Points, Reason)
       VALUES ($1, $2, $3)`,
      [patientId, 10, "Telemedicine request submission"]
    );

    res.status(201).json({ message: "Telemedicine request submitted successfully" });
  } catch (error) {
    console.error("Error submitting telemedicine request:", error);
    res.status(500).json({ message: "Failed to submit telemedicine request" });
  }
});

// Mark medication as taken
app.post("/api/patient/medications/:id/taken", authenticateToken, async (req, res) => {
  if (req.user.role !== "patient") return res.sendStatus(403);

  try {
    const patientResult = await dbPool.query(
      "SELECT PatientID FROM PatientDetails WHERE UserID = $1",
      [req.user.userId]
    );
    const patientId = patientResult.rows[0].patientid;

    await dbPool.query(
      `UPDATE PatientMedications 
       SET Status = 'Taken' 
       WHERE MedicationID = $1 AND PatientID = $2`,
      [req.params.id, patientId]
    );

    // Award points for medication adherence
    await dbPool.query(
      `INSERT INTO PatientPoints 
       (PatientID, Points, Reason)
       VALUES ($1, $2, $3)`,
      [patientId, 5, "Medication adherence"]
    );

    res.json({ message: "Medication marked as taken" });
  } catch (error) {
    console.error("Error updating medication:", error);
    res.status(500).json({ message: "Failed to update medication" });
  }
});

// Mark alert as read
app.post("/api/patient/alerts/:id/read", authenticateToken, async (req, res) => {
  if (req.user.role !== "patient") return res.sendStatus(403);

  try {
    const patientResult = await dbPool.query(
      "SELECT PatientID FROM PatientDetails WHERE UserID = $1",
      [req.user.userId]
    );
    const patientId = patientResult.rows[0].patientid;

    await dbPool.query(
      `UPDATE PatientAlerts 
       SET IsRead = TRUE 
       WHERE AlertID = $1 AND PatientID = $2`,
      [req.params.id, patientId]
    );

    res.json({ message: "Alert marked as read" });
  } catch (error) {
    console.error("Error updating alert:", error);
    res.status(500).json({ message: "Failed to update alert" });
  }
});

// Get patient profile
app.get("/api/patient/profile", authenticateToken, async (req, res) => {
  if (req.user.role !== "patient") return res.sendStatus(403);

  try {
    // Get basic user info
    const userResult = await dbPool.query(
      "SELECT FirstName, LastName, Email, Role FROM Users WHERE UserID = $1",
      [req.user.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = userResult.rows[0];

    // Get patient details
    const patientResult = await dbPool.query(
      `SELECT DateOfBirth, Gender, PhoneNumber, Address, EmergencyContact, EmergencyPhone 
       FROM PatientDetails 
       WHERE UserID = $1`,
      [req.user.userId]
    );

    // Combine the data
    const profileData = {
      firstName: user.firstname,
      lastName: user.lastname,
      email: user.email,
      role: user.role,
      dateOfBirth: patientResult.rows[0]?.dateofbirth,
      gender: patientResult.rows[0]?.gender,
      phoneNumber: patientResult.rows[0]?.phonenumber,
      address: patientResult.rows[0]?.address,
      emergencyContact: patientResult.rows[0]?.emergencycontact,
      emergencyPhone: patientResult.rows[0]?.emergencyphone,
    };

    res.json(profileData);
  } catch (error) {
    console.error("Error fetching patient profile:", error);
    res.status(500).json({ message: "Failed to fetch patient profile" });
  }
});

// Get doctor profile
app.get("/api/doctor/profile", authenticateToken, async (req, res) => {
  if (req.user.role !== "doctor") return res.sendStatus(403);

  try {
    // Get basic user info
    const userResult = await dbPool.query(
      "SELECT FirstName, LastName, Email, Role FROM Users WHERE UserID = $1",
      [req.user.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = userResult.rows[0];

    // Get doctor details
    const doctorResult = await dbPool.query(
      `SELECT Specialization, LicenseNumber, PhoneNumber, HospitalAffiliation 
       FROM DoctorDetails 
       WHERE UserID = $1`,
      [req.user.userId]
    );

    // Combine the data
    const profileData = {
      firstName: user.firstname,
      lastName: user.lastname,
      email: user.email,
      role: user.role,
      specialization: doctorResult.rows[0]?.specialization,
      licenseNumber: doctorResult.rows[0]?.licensenumber,
      phoneNumber: doctorResult.rows[0]?.phonenumber,
      hospitalAffiliation: doctorResult.rows[0]?.hospitalaffiliation,
    };

    res.json(profileData);
  } catch (error) {
    console.error("Error fetching doctor profile:", error);
    res.status(500).json({ message: "Failed to fetch doctor profile" });
  }
});

// Generic profile endpoint that routes based on role
app.get("/api/profile", authenticateToken, async (req, res) => {
  try {
    if (req.user.role === "patient") {
      // Forward to patient profile endpoint
      req.url = "/api/patient/profile";
      return app.handle(req, res);
    } else if (req.user.role === "doctor") {
      // Forward to doctor profile endpoint
      req.url = "/api/doctor/profile";
      return app.handle(req, res);
    } else {
      return res.status(403).json({ message: "Unknown role" });
    }
  } catch (error) {
    console.error("Error fetching profile:", error);
    res.status(500).json({ message: "Failed to fetch profile" });
  }
});

// Get all patients for doctors
app.get("/api/doctor/patients", authenticateToken, async (req, res) => {
  if (req.user.role !== "doctor") return res.sendStatus(403);

  try {
    const result = await dbPool.query(`
      SELECT 
        p.PatientID as id,
        u.FirstName || ' ' || u.LastName as name,
        pd.DateOfBirth as dob,
        pd.Gender as gender,
        pd.PhoneNumber as phone,
        u.Email as email,
        (SELECT RiskScore FROM PatientRiskScores 
         WHERE PatientID = p.PatientID 
         ORDER BY CalculatedAt DESC
         LIMIT 1) as riskScore,
        (SELECT COUNT(*) FROM PatientAlerts 
         WHERE PatientID = p.PatientID AND IsRead = FALSE) as unreadAlerts,
        (SELECT COUNT(*) FROM PatientMedications 
         WHERE PatientID = p.PatientID AND Status = 'Pending') as pendingMeds
      FROM PatientDetails p
      JOIN Users u ON p.UserID = u.UserID
      LEFT JOIN PatientDetails pd ON p.PatientID = pd.PatientID
      ORDER BY u.LastName, u.FirstName
    `);

    // Process the data to add status information
    const patients = result.rows.map((patient) => {
      let status = "Normal";
      if (patient.riskscore > 70) status = "Critical";
      else if (patient.riskscore > 40) status = "Warning";

      return {
        ...patient,
        status,
        lastReading: patient.riskscore ? `Risk: ${patient.riskscore}` : "No data",
        lastChecked: "Today",
        pendingActions: patient.pendingmeds + patient.unreadalerts,
      };
    });

    res.json({ patients });
  } catch (error) {
    console.error("Error fetching patients:", error);
    res.status(500).json({ message: "Failed to fetch patients" });
  }
});

// Get detailed patient info for doctors
app.get("/api/doctor/patient/:id", authenticateToken, async (req, res) => {
  if (req.user.role !== "doctor") return res.sendStatus(403);

  try {
    const patientId = req.params.id;

    // Get basic patient info
    const patientResult = await dbPool.query(
      `SELECT 
        u.FirstName, u.LastName, u.Email,
        pd.DateOfBirth, pd.Gender, pd.PhoneNumber, 
        pd.Address, pd.EmergencyContact, pd.EmergencyPhone
      FROM PatientDetails pd
      JOIN Users u ON pd.UserID = u.UserID
      WHERE pd.PatientID = $1`,
      [patientId]
    );

    if (patientResult.rows.length === 0) {
      return res.status(404).json({ message: "Patient not found" });
    }

    const patient = patientResult.rows[0];

    // Get health data
    const healthData = await dbPool.query(
      `SELECT * FROM PatientHealthData
       WHERE PatientID = $1
       ORDER BY RecordedAt DESC
       LIMIT 10`,
      [patientId]
    );

    // Get medications
    const medications = await dbPool.query(
      `SELECT * FROM PatientMedications
       WHERE PatientID = $1
       ORDER BY NextDose ASC`,
      [patientId]
    );

    // Get risk scores
    const riskScores = await dbPool.query(
      `SELECT * FROM PatientRiskScores
       WHERE PatientID = $1
       ORDER BY CalculatedAt DESC
       LIMIT 5`,
      [patientId]
    );

    res.json({
      profile: {
        name: `${patient.firstname} ${patient.lastname}`,
        email: patient.email,
        dob: patient.dateofbirth,
        gender: patient.gender,
        phone: patient.phonenumber,
        address: patient.address,
        emergencyContact: patient.emergencycontact,
        emergencyPhone: patient.emergencyphone,
      },
      healthData: healthData.rows,
      medications: medications.rows,
      riskScores: riskScores.rows,
    });
  } catch (error) {
    console.error("Error fetching patient details:", error);
    res.status(500).json({ message: "Failed to fetch patient details" });
  }
});

// Get doctor's appointments
app.get("/api/doctor/appointments", authenticateToken, async (req, res) => {
  if (req.user.role !== "doctor") return res.sendStatus(403);

  try {
    const doctorResult = await dbPool.query(
      "SELECT DoctorID FROM DoctorDetails WHERE UserID = $1",
      [req.user.userId]
    );
    const doctorId = doctorResult.rows[0].doctorid;

    const result = await dbPool.query(
      `SELECT 
        a.AppointmentID as appointmentId,
        p.PatientID as patientId,
        u.FirstName || ' ' || u.LastName as patientName,
        a.DateTime as dateTime,
        a.Type as type,
        a.Status as status,
        a.Notes as notes
      FROM PatientAppointments a
      JOIN PatientDetails p ON a.PatientID = p.PatientID
      JOIN Users u ON p.UserID = u.UserID
      WHERE a.DoctorID = $1
      ORDER BY a.DateTime DESC`,
      [doctorId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching doctor appointments:", error);
    res.status(500).json({ message: "Failed to fetch appointments" });
  }
});

// Get doctor's alerts
app.get("/api/doctor/alerts", authenticateToken, async (req, res) => {
  if (req.user.role !== "doctor") return res.sendStatus(403);

  try {
    const doctorResult = await dbPool.query(
      "SELECT DoctorID FROM DoctorDetails WHERE UserID = $1",
      [req.user.userId]
    );
    const doctorId = doctorResult.rows[0].doctorid;

    let query = `
      SELECT 
        a.AlertID as alertId,
        p.PatientID as patientId,
        u.FirstName || ' ' || u.LastName as patientName,
        a.Message as message,
        a.Severity as severity,
        a.Timestamp as timestamp,
        a.IsRead as isRead
      FROM PatientAlerts a
      JOIN PatientDetails p ON a.PatientID = p.PatientID
      JOIN Users u ON p.UserID = u.UserID
      WHERE p.PatientID IN (
        SELECT PatientID FROM PatientAppointments WHERE DoctorID = $1
      )
    `;

    const params = [doctorId];

    if (req.query.unread) {
      query += " AND a.IsRead = FALSE";
    }

    query += " ORDER BY a.Timestamp DESC";

    if (req.query.limit) {
      query += ` LIMIT ${parseInt(req.query.limit)}`;
    }

    const result = await dbPool.query(query, params);

    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching doctor alerts:", error);
    res.status(500).json({ message: "Failed to fetch alerts" });
  }
});

// Mark alert as read
app.post("/api/doctor/alerts/:id/read", authenticateToken, async (req, res) => {
  if (req.user.role !== "doctor") return res.sendStatus(403);

  try {
    await dbPool.query(
      `UPDATE PatientAlerts 
       SET IsRead = TRUE 
       WHERE AlertID = $1`,
      [req.params.id]
    );

    res.json({ message: "Alert marked as read" });
  } catch (error) {
    console.error("Error updating alert:", error);
    res.status(500).json({ message: "Failed to update alert" });
  }
});

// Create new appointment
app.post("/api/patient/appointments", authenticateToken, async (req, res) => {
  if (req.user.role !== "patient") return res.sendStatus(403);

  try {
    const { doctorId, dateTime, type, notes } = req.body;

    const patientResult = await dbPool.query(
      "SELECT PatientID FROM PatientDetails WHERE UserID = $1",
      [req.user.userId]
    );
    const patientId = patientResult.rows[0].patientid;

    await dbPool.query(
      `INSERT INTO PatientAppointments 
       (PatientID, DoctorID, DateTime, Type, Notes, Status)
       VALUES ($1, $2, $3, $4, $5, 'Scheduled')`,
      [patientId, doctorId, dateTime, type, notes || null]
    );

    res.status(201).json({ message: "Appointment created successfully" });
  } catch (error) {
    console.error("Error creating appointment:", error);
    res.status(500).json({ message: "Failed to create appointment" });
  }
});

// Update appointment status
app.put("/api/appointments/:id/status", authenticateToken, async (req, res) => {
  try {
    const { status } = req.body;

    await dbPool.query(
      `UPDATE PatientAppointments 
       SET Status = $1 
       WHERE AppointmentID = $2`,
      [status, req.params.id]
    );

    res.json({ message: "Appointment status updated" });
  } catch (error) {
    console.error("Error updating appointment:", error);
    res.status(500).json({ message: "Failed to update appointment" });
  }
});

// Prescribe medication
app.post("/api/doctor/prescribe-medication", authenticateToken, async (req, res) => {
  if (req.user.role !== "doctor") return res.sendStatus(403);

  try {
    const { patientId, name, dosage, frequency, notes } = req.body;

    // Calculate next dose time (default to now + 1 day)
    const nextDose = new Date();
    nextDose.setDate(nextDose.getDate() + 1);

    await dbPool.query(
      `INSERT INTO PatientMedications 
       (PatientID, Name, Dosage, Frequency, NextDose, Notes, Status)
       VALUES ($1, $2, $3, $4, $5, $6, 'Pending')`,
      [patientId, name, dosage, frequency, nextDose, notes || null]
    );

    // Mark appointment as completed
    const doctorResult = await dbPool.query(
      "SELECT DoctorID FROM DoctorDetails WHERE UserID = $1",
      [req.user.userId]
    );
    const doctorId = doctorResult.rows[0].doctorid;

    await dbPool.query(
      `UPDATE PatientAppointments 
       SET Status = 'Completed' 
       WHERE PatientID = $1 AND DoctorID = $2
       AND Status = 'Scheduled'`,
      [patientId, doctorId]
    );

    res.status(201).json({ message: "Medication prescribed successfully" });
  } catch (error) {
    console.error("Error prescribing medication:", error);
    res.status(500).json({ message: "Failed to prescribe medication" });
  }
});

// AI Prediction Endpoint
app.get("/api/patient/ai-predictions", authenticateToken, async (req, res) => {
  if (req.user.role !== "patient") return res.sendStatus(403);

  try {
    const healthData = await dbPool.query(
      `SELECT * FROM PatientHealthData 
       WHERE PatientID = (SELECT PatientID FROM PatientDetails WHERE UserID = $1)
       ORDER BY RecordedAt DESC
       LIMIT 30`,
      [req.user.userId]
    );

    if (healthData.rows.length === 0) {
      return res.json(null);
    }

    const mockPredictions = generateMockPredictions(healthData.rows);
    res.json(mockPredictions);
  } catch (error) {
    console.error("AI prediction error:", error);
    res.status(500).json({ message: "Failed to generate predictions" });
  }
});

// AI Recommendations Endpoint
app.get("/api/patient/ai-recommendations", authenticateToken, async (req, res) => {
  if (req.user.role !== "patient") return res.sendStatus(403);

  try {
    const [healthData, riskScore] = await Promise.all([
      dbPool.query(
        `SELECT * FROM PatientHealthData 
         WHERE PatientID = (SELECT PatientID FROM PatientDetails WHERE UserID = $1)
         ORDER BY RecordedAt DESC
         LIMIT 10`,
        [req.user.userId]
      ),
      dbPool.query(
        `SELECT RiskScore FROM PatientRiskScores 
         WHERE PatientID = (SELECT PatientID FROM PatientDetails WHERE UserID = $1)
         ORDER BY CalculatedAt DESC
         LIMIT 1`,
        [req.user.userId]
      )
    ]);

    const recommendations = generateMockRecommendations(
      healthData.rows,
      riskScore.rows[0]?.riskscore || 0
    );

    res.json(recommendations);
  } catch (error) {
    console.error("AI recommendations error:", error);
    res.status(500).json({ message: "Failed to generate recommendations" });
  }
});

// AI Simulation Endpoint
app.post("/api/patient/ai-simulate", authenticateToken, async (req, res) => {
  if (req.user.role !== "patient") return res.sendStatus(403);

  try {
    const { days, includeExercise, includeDiet, includeMedication } = req.body;

    const healthData = await dbPool.query(
      `SELECT * FROM PatientHealthData 
       WHERE PatientID = (SELECT PatientID FROM PatientDetails WHERE UserID = $1)
       ORDER BY RecordedAt DESC
       LIMIT 30`,
      [req.user.userId]
    );

    if (healthData.rows.length === 0) {
      return res.status(400).json({ message: "Not enough health data for simulation" });
    }

    const simulationResults = generateMockSimulation(
      healthData.rows,
      days,
      includeExercise,
      includeDiet,
      includeMedication
    );

    res.json(simulationResults);
  } catch (error) {
    console.error("AI simulation error:", error);
    res.status(500).json({ message: "Failed to run simulation" });
  }
});

// AI Assistant Endpoint
app.post("/api/patient/ai-assistant", authenticateToken, async (req, res) => {
  if (req.user.role !== "patient") return res.sendStatus(403);

  try {
    const { message, healthData, medications, vitals, riskScore } = req.body;

    const response = generateMockAssistantResponse(
      message,
      healthData,
      medications,
      vitals,
      riskScore
    );

    res.json(response);
  } catch (error) {
    console.error("AI assistant error:", error);
    res.status(500).json({ message: "Failed to process your request" });
  }
});

// Add Medication endpoint
app.post("/api/patient/medications", authenticateToken, async (req, res) => {
  if (req.user.role !== "patient") return res.sendStatus(403);

  try {
    const { name, dosage, frequency, nextDose, instructions, prescribedBy } = req.body;

    const patientResult = await dbPool.query(
      "SELECT PatientID FROM PatientDetails WHERE UserID = $1",
      [req.user.userId]
    );
    const patientId = patientResult.rows[0].patientid;

    await dbPool.query(
      `INSERT INTO PatientMedications 
       (PatientID, Name, Dosage, Frequency, NextDose, Instructions, PrescribedBy, Status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'Pending')`,
      [patientId, name, dosage, frequency, nextDose, instructions || null, prescribedBy]
    );

    res.status(201).json({ message: "Medication added successfully" });
  } catch (error) {
    console.error("Error adding medication:", error);
    res.status(500).json({ message: "Failed to add medication" });
  }
});

// Helper functions for mock data generation
function generateMockPredictions(healthData) {
  // This would be replaced with actual model predictions
  const predictions = [];
  const metrics = [
    "bloodPressure",
    "heartRate",
    "bloodSugar",
    "oxygenLevel",
    "riskScore",
  ];
  const today = new Date();

  metrics.forEach((metric) => {
    for (let i = 0; i < 30; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);

      // Base value on last actual reading
      let baseValue = 0;
      if (healthData[0]) {
        switch (metric) {
          case "bloodPressure":
            baseValue = healthData[0].BloodPressure;
            break;
          case "heartRate":
            baseValue = healthData[0].HeartRate;
            break;
          case "bloodSugar":
            baseValue = healthData[0].BloodSugar;
            break;
          case "oxygenLevel":
            baseValue = healthData[0].OxygenLevel;
            break;
          case "riskScore":
            baseValue = healthData[0].RiskScore || 50;
            break;
        }
      }

      // Add some variation
      const variation = (Math.random() * 0.2 - 0.1) * baseValue;
      let value = baseValue + variation;

      // Ensure values stay in reasonable ranges
      if (metric === "bloodPressure") {
        const [systolic, diastolic] = value.split("/").map(Number);
        value = `${Math.max(80, Math.min(180, systolic))}/${Math.max(
          50,
          Math.min(120, diastolic)
        )}`;
      } else if (metric === "heartRate") {
        value = Math.max(50, Math.min(150, value));
      } else if (metric === "bloodSugar") {
        value = Math.max(70, Math.min(300, value));
      } else if (metric === "oxygenLevel") {
        value = Math.max(85, Math.min(100, value));
      } else if (metric === "riskScore") {
        value = Math.max(0, Math.min(100, value));
      }

      predictions.push({
        date: date.toISOString().split("T")[0],
        metric,
        value,
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
      category: "Critical Alert",
      recommendation:
        "Your risk score is high. Please consult with your doctor immediately.",
      priority: "high",
      expectedImpact: 30,
    });
  } else if (riskScore > 40) {
    recommendations.push({
      category: "Warning",
      recommendation:
        "Your risk score is elevated. Consider scheduling a check-up.",
      priority: "high",
      expectedImpact: 20,
    });
  }

  // Analyze blood pressure
  if (healthData.length > 0) {
    const latest = healthData[0];
    const [systolic, diastolic] = latest.BloodPressure.split("/").map(Number);

    if (systolic > 140 || diastolic > 90) {
      recommendations.push({
        category: "Blood Pressure",
        recommendation:
          "Your blood pressure is high. Reduce sodium intake and increase physical activity.",
        priority: systolic > 160 || diastolic > 100 ? "high" : "medium",
        expectedImpact: 15,
      });
    }
  }

  // Add general health recommendations
  recommendations.push(
    {
      category: "Exercise",
      recommendation:
        "Aim for at least 30 minutes of moderate exercise 5 days a week.",
      priority: "medium",
      expectedImpact: 10,
    },
    {
      category: "Nutrition",
      recommendation:
        "Increase your intake of fruits and vegetables to at least 5 servings per day.",
      priority: "medium",
      expectedImpact: 8,
    },
    {
      category: "Sleep",
      recommendation:
        "Maintain a consistent sleep schedule with 7-9 hours of sleep per night.",
      priority: "medium",
      expectedImpact: 12,
    }
  );

  return recommendations;
}

function generateMockSimulation(
  healthData,
  days,
  includeExercise,
  includeDiet,
  includeMedication
) {
  // Similar to generateMockPredictions but takes simulation parameters into account
  const predictions = [];
  const metrics = [
    "bloodPressure",
    "heartRate",
    "bloodSugar",
    "oxygenLevel",
    "riskScore",
  ];
  const today = new Date();

  metrics.forEach((metric) => {
    for (let i = 0; i < days; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);

      let baseValue = 0;
      if (healthData[0]) {
        switch (metric) {
          case "bloodPressure":
            baseValue = healthData[0].BloodPressure;
            break;
          case "heartRate":
            baseValue = healthData[0].HeartRate;
            break;
          case "bloodSugar":
            baseValue = healthData[0].BloodSugar;
            break;
          case "oxygenLevel":
            baseValue = healthData[0].OxygenLevel;
            break;
          case "riskScore":
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
      if (metric === "bloodPressure") {
        const [systolic, diastolic] = value.split("/").map(Number);
        value = `${Math.max(80, Math.min(180, systolic))}/${Math.max(
          50,
          Math.min(120, diastolic)
        )}`;
      } else if (metric === "heartRate") {
        value = Math.max(50, Math.min(150, value));
      } else if (metric === "bloodSugar") {
        value = Math.max(70, Math.min(300, value));
      } else if (metric === "oxygenLevel") {
        value = Math.max(85, Math.min(100, value));
      } else if (metric === "riskScore") {
        value = Math.max(0, Math.min(100, value));
      }

      predictions.push({
        date: date.toISOString().split("T")[0],
        metric,
        value,
      });
    }
  });

  return predictions;
}

function generateMockAssistantResponse(
  message,
  healthData,
  medications,
  vitals,
  riskScore
) {
  // Simple keyword-based response - in reality you'd use NLP
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes("blood pressure") || lowerMessage.includes("bp")) {
    return {
      response:
        `Your recent blood pressure reading is ${
          vitals?.bloodPressure || "unknown"
        }. ` +
        `Normal blood pressure is below 120/80. If your reading is consistently above this, ` +
        `consider lifestyle changes or consult your doctor.`,
      sources: ["CDC Blood Pressure Guidelines"],
    };
  } else if (
    lowerMessage.includes("heart rate") ||
    lowerMessage.includes("pulse")
  ) {
    return {
      response:
        `Your recent heart rate is ${vitals?.heartRate || "unknown"} bpm. ` +
        `A normal resting heart rate for adults is between 60-100 bpm. ` +
        `Regular exercise can help lower your resting heart rate over time.`,
      sources: ["American Heart Association"],
    };
  } else if (lowerMessage.includes("risk score")) {
    return {
      response:
        `Your current health risk score is ${
          riskScore || "unknown"
        } out of 100. ` +
        `Scores above 70 indicate high risk, 40-70 moderate risk, and below 40 low risk. ` +
        `This score is based on your health metrics and trends.`,
      sources: ["Internal Risk Model"],
    };
  } else if (lowerMessage.includes("medication") && medications?.length > 0) {
    const medList = medications
      .map((m) => `${m.Name} (${m.Dosage})`)
      .join(", ");
    return {
      response:
        `You have ${medications.length} active medications: ${medList}. ` +
        `Always take medications as prescribed and consult your doctor before making changes.`,
      sources: ["Your Medication Records"],
    };
  } else if (
    lowerMessage.includes("trend") ||
    lowerMessage.includes("progress")
  ) {
    return {
      response:
        `Based on your recent health data, your metrics are ${
          riskScore > 70 ? "concerning" : riskScore > 40 ? "moderate" : "stable"
        }. ` +
        `The most significant factor is your ${
          riskScore > 70
            ? "elevated risk score"
            : riskScore > 40
            ? "moderate risk score"
            : "healthy readings"
        }. ` +
        `Continue monitoring your health and follow your care plan.`,
      sources: ["Your Health Data Trends"],
    };
  } else {
    return {
      response:
        `I'm your health assistant. I can help explain your health metrics, medications, ` +
        `and provide general health information. For specific medical advice, please consult your doctor. ` +
        `Try asking about your blood pressure, heart rate, or medications.`,
      sources: ["Health Assistant Knowledge Base"],
    };
  }
}

// Add to your server.js
const OpenAI = require("openai");

// Initialize OpenAI with your secret key
const openai = new OpenAI({
  apiKey:
    process.env.OPENAI_API_KEY ||
    "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",
});

// AI Assistant Endpoint
app.post("/api/ai/assistant", authenticateToken, async (req, res) => {
  try {
    const { prompt, max_tokens = 500, temperature = 0.7 } = req.body;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content:
            "You are a knowledgeable and empathetic medical AI assistant. " +
            "Provide clear, accurate health information based on the patient's data. " +
            "Be concise but thorough. Always remind patients to consult their doctor " +
            "for medical advice. Format responses for easy reading with line breaks when needed.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      max_tokens,
      temperature,
    });

    const answer =
      completion.choices[0]?.message?.content ||
      "I couldn't generate a response. Please try again.";

    res.json({ answer });
  } catch (error) {
    console.error("OpenAI API error:", error);
    res.status(500).json({
      answer:
        "I'm experiencing technical difficulties. Please try again later or contact support.",
    });
  }
});

// Generate Twilio access token for video calls
app.post("/api/video/token", authenticateToken, async (req, res) => {
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
    console.error("Error generating video token:", error);
    res.status(500).json({ message: "Failed to generate video token" });
  }
});

// Start video call (updates appointment status)
app.post(
  "/api/appointments/:id/start-call",
  authenticateToken,
  async (req, res) => {
    try {
      const { id } = req.params;

      // Update appointment status
      await dbPool.request().input("appointmentId", sql.Int, id).query(`
        UPDATE PatientAppointments 
        SET Status = 'In Progress' 
        WHERE AppointmentID = @appointmentId
      `);

      res.json({ message: "Appointment call started" });
    } catch (error) {
      console.error("Error starting call:", error);
      res.status(500).json({ message: "Failed to start call" });
    }
  }
);

// Add Medication endpoint
app.post("/api/patient/medications", authenticateToken, async (req, res) => {
  if (req.user.role !== "patient") return res.sendStatus(403);

  try {
    const { name, dosage, frequency, nextDose, instructions, prescribedBy } =
      req.body;

    const result = await dbPool
      .request()
      .input(
        "patientId",
        sql.Int,
        (
          await dbPool
            .request()
            .input("userId", sql.Int, req.user.userId)
            .query(
              "SELECT PatientID FROM PatientDetails WHERE UserID = @userId"
            )
        ).recordset[0].PatientID
      )
      .input("name", sql.NVarChar, name)
      .input("dosage", sql.NVarChar, dosage)
      .input("frequency", sql.NVarChar, frequency)
      .input("nextDose", sql.DateTime, nextDose)
      .input("instructions", sql.NVarChar, instructions || null)
      .input("prescribedBy", sql.NVarChar, prescribedBy).query(`
        INSERT INTO PatientMedications 
        (PatientID, Name, Dosage, Frequency, NextDose, Instructions, PrescribedBy, Status)
        VALUES (@patientId, @name, @dosage, @frequency, @nextDose, @instructions, @prescribedBy, 'Pending')
      `);

    res.status(201).json({ message: "Medication added successfully" });
  } catch (error) {
    console.error("Error adding medication:", error);
    res.status(500).json({ message: "Failed to add medication" });
  }
});

// Get patient medications
app.get("/api/patient/medications", authenticateToken, async (req, res) => {
  if (req.user.role !== "patient") return res.sendStatus(403);

  try {
    const result = await dbPool
      .request()
      .input("userId", sql.Int, req.user.userId).query(`
        SELECT * FROM PatientMedications 
        WHERE PatientID = (SELECT PatientID FROM PatientDetails WHERE UserID = @userId)
        ORDER BY NextDose ASC
      `);

    res.json(result.recordset);
  } catch (error) {
    console.error("Error fetching medications:", error);
    res.status(500).json({ message: "Failed to fetch medications" });
  }
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: "Something broke!", error: err.message });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Handle graceful shutdown
process.on("SIGINT", async () => {
  if (dbPool) {
    await dbPool.end();
    console.log("Database connection closed");
  }
  process.exit(0);
});