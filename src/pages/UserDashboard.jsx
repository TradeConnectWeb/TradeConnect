import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const UserDashboard = () => {
  const navigate = useNavigate();
  const [userData, setUserData] = useState({
    username: '',
    zone: '',
    email: '',
  });

  useEffect(() => {
    const username = localStorage.getItem('username');
    const zone = localStorage.getItem('zone');
    const email = localStorage.getItem('email');
    const token = localStorage.getItem('authToken');

    // Optional: Redirect if not logged in
    if (!token) {
      navigate('/login'); // redirect to login page
      return;
    }

    setUserData({ username, zone, email });
  }, [navigate]);

  return (
    <div>
      <h2>Welcome, {userData.username}!</h2>
      <p>Zone: {userData.zone}</p>
      <p>Email: {userData.email}</p>
    </div>
  );
};

export default UserDashboard;
