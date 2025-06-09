import React, { useState } from 'react';

const Signup = () => {
  const [role, setRole] = useState('user');
  const [adminCode, setAdminCode] = useState('');
  const [errors, setErrors] = useState({});

  const validateForm = () => {
    let isValid = true;
    let newErrors = {};

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

    // Save auth and role
    localStorage.setItem('authToken', 'SOME_FAKE_TOKEN');
    localStorage.setItem('role', role);

    // Redirect
    window.location.href = role === 'admin' ? '/admin-dashboard' : '/user-dashboard';
  };

  return (
    <form onSubmit={handleSignup}>
      <h2>Sign Up</h2>

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
            id="adminCode"
          />
          {errors.adminCode && (
            <div id="adminCode-error" style={{ color: 'red' }}>
              {errors.adminCode}
            </div>
          )}
        </>
      )}

      <br />
      <button type="submit">Sign Up</button>
    </form>
  );
};

export default Signup;
