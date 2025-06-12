import React, { useState } from 'react';

const Signup = () => {
  const [role, setRole] = useState('user');
  const [adminCode, setAdminCode] = useState('');
  const [username, setUsername] = useState('');
  const [zone, setZone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});

  const validateForm = () => {
    let isValid = true;
    let newErrors = {};

    if (!username.trim()) {
      newErrors.username = 'Username is required';
      isValid = false;
    }

    if (!zone.trim()) {
      newErrors.zone = 'Zone is required';
      isValid = false;
    }

    if (!email.trim()) {
      newErrors.email = 'Email is required';
      isValid = false;
    }

    if (!password.trim()) {
      newErrors.password = 'Password is required';
      isValid = false;
    }

    if (role === 'admin' && adminCode.trim() === '') {
      newErrors.adminCode = 'Admin code is required';
      isValid = false;
    } else if (role === 'admin' && adminCode !== 'TRADEADMIN123') {
      newErrors.adminCode = 'Invalid admin code';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSignup = (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    // Save data to localStorage
    localStorage.setItem('authToken', 'SOME_FAKE_TOKEN');
    localStorage.setItem('role', role);
    localStorage.setItem('username', username);
    localStorage.setItem('zone', zone);
    localStorage.setItem('email', email);
    localStorage.setItem('password', password); // ✅ Store password

    // Redirect
    window.location.href = role === 'admin' ? '/admin-dashboard' : '/user-dashboard';
  };

  return (
    <form onSubmit={handleSignup}>
      <h2>Sign Up</h2>

      <input
        type="text"
        placeholder="Username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />
      {errors.username && <div style={{ color: 'red' }}>{errors.username}</div>}

      <br />
      <input
        type="text"
        placeholder="Zone"
        value={zone}
        onChange={(e) => setZone(e.target.value)}
      />
      {errors.zone && <div style={{ color: 'red' }}>{errors.zone}</div>}

      <br />
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      {errors.email && <div style={{ color: 'red' }}>{errors.email}</div>}

      <br />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {errors.password && <div style={{ color: 'red' }}>{errors.password}</div>}

      <br />
      <select value={role} onChange={(e) => setRole(e.target.value)}>
        <option value="user">User</option>
        <option value="admin">Admin</option>
      </select>
      <br />

      {role === 'admin' && (
        <>
          <input
            type="text"
            placeholder="Admin Code"
            value={adminCode}
            onChange={(e) => setAdminCode(e.target.value)}
          />
          {errors.adminCode && (
            <div style={{ color: 'red' }}>{errors.adminCode}</div>
          )}
        </>
      )}

      <br />
      <button type="submit">Sign Up</button>
    </form>
  );
};

export default Signup;
