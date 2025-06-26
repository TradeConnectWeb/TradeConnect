import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

import Login from './pages/Login';
import Signup from './pages/Signup';
import ForgotPassword from './pages/Forgot';
import UserDashboard from './pages/UserDashboard';
import AdminDashboard from './pages/AdminDashboard';

import { getFirebaseApp } from './firebase'; // tugma sa export mo sa firebase.js

const isAuthenticated = () => {
  return !!localStorage.getItem('authToken');
};

const getUserRole = () => {
  return localStorage.getItem('role'); 
};

const App = () => {
 useEffect(() => {
  getFirebaseApp(); // ito ang tatawagin mo
}, []);

  return (
    <Router>
      <Routes>
        <Route path="/" element={isAuthenticated() ? <Navigate to={`/${getUserRole()}-dashboard`} /> : <Navigate to="/login" />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot" element={<ForgotPassword />} />
        <Route path="/user-dashboard" element={<UserDashboard />} />
        <Route path="/admin-dashboard" element={<AdminDashboard />} />
      </Routes>
    </Router>
  );
};

export default App;
