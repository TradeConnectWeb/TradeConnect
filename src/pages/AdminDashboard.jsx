import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [adminData, setAdminData] = useState({
    username: '',
    zone: '',
    email: '',
  });

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    const role = localStorage.getItem('role');

    if (!token || role !== 'admin') {
      navigate('/login');
      return;
    }

    const username = localStorage.getItem('username');
    const zone = localStorage.getItem('zone');
    const email = localStorage.getItem('email');

    setAdminData({ username, zone, email });
  }, [navigate]);

  return (
    <div>
      <h2>Welcome Admin {adminData.username}!</h2>
      <p>Zone: {adminData.zone}</p>
      <p>Email: {adminData.email}</p>
    </div>
  );
};

export default AdminDashboard;
