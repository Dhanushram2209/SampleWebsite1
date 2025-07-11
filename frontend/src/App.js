import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from 'antd';
import Login from './components/Auth/Login/Login';
import Register from './components/Auth/Register/Register';
import PatientDashboard from './pages/Dashboard/PatientDashboard/PatientDashboard';
import DoctorDashboard from './pages/Dashboard/DoctorDashboard/DoctorDashboard';
import { getCurrentUser } from './services/api';
import './App.css';

const { Content } = Layout;

const PrivateRoute = ({ children, roles }) => {
  const user = getCurrentUser();
  
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  
  if (roles && !roles.includes(user.role)) {
    // Redirect to appropriate dashboard based on role
    switch(user.role) {
      case 'patient':
        return <Navigate to="/patient-dashboard" replace />;
      case 'doctor':
        return <Navigate to="/doctor-dashboard" replace />;
      default:
        return <Navigate to="/login" replace />;
    }
  }
  
  return children;
};

const App = () => {
  return (
    <Router>
      <Layout style={{ minHeight: '100vh' }}>
        <Content>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            
            {/* Protected routes */}
            <Route path="/patient-dashboard" element={
              <PrivateRoute roles={['patient']}>
                <PatientDashboard />
              </PrivateRoute>
            } />
            
            <Route path="/doctor-dashboard" element={
              <PrivateRoute roles={['doctor']}>
                <DoctorDashboard />
              </PrivateRoute>
            } />
            
            {/* Root path - redirect based on auth status */}
            <Route path="/" element={
              getCurrentUser() ? (
                (() => {
                  const user = getCurrentUser();
                  if (user.role === 'patient') {
                    return <Navigate to="/patient-dashboard" replace />;
                  } else if (user.role === 'doctor') {
                    return <Navigate to="/doctor-dashboard" replace />;
                  } 
                  return <Navigate to="/login" replace />;
                })()
              ) : (
                <Navigate to="/login" replace />
              )
            } />
            
            {/* Catch-all route */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Content>
      </Layout>
    </Router>
  );
};

export default App;