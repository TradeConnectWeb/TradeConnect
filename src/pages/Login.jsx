import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleLogin = (e) => {
    e.preventDefault();
    const storedEmail = localStorage.getItem('email');
    const storedPassword = localStorage.getItem('password');
    const role = localStorage.getItem('role');

    if (email === storedEmail && password === storedPassword) {
      localStorage.setItem('authToken', 'LOGGED_IN');
      navigate(role === 'admin' ? '/admin-dashboard' : '/user-dashboard');
    } else {
      alert('Invalid email or password');
    }
  };

  return (
    <form onSubmit={handleLogin}>
      <h2>Login</h2>
      <input
        type="email"
        placeholder="Enter email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <br />
      <input
        type="password"
        placeholder="Enter password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <br />
      <button type="submit">Login</button>
    </form>
  );
};

export default Login;
