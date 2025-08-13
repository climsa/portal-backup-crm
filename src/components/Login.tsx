import React, { useState, ChangeEvent, FormEvent } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const Login = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [error, setError] = useState<string>('');

  const { email, password } = formData;

  const onChange = (e: ChangeEvent<HTMLInputElement>) =>
    setFormData({ ...formData, [e.target.name]: e.target.value });

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    try {
      const res = await axios.post('http://localhost:3000/api/auth/login', {
        email,
        password,
      });

      localStorage.setItem('token', res.data.token);
      navigate('/dashboard');

    } catch (err: any) {
      const errorMessage = err.response?.data?.msg || 'Terjadi kesalahan saat login.';
      setError(errorMessage);
      console.error(err.response?.data);
    }
  };

  return (
    <div style={{ fontFamily: 'sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', backgroundColor: '#f3f4f6' }}>
      <div style={{ width: '100%', maxWidth: '400px', padding: '32px', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 'bold', textAlign: 'center', color: '#111827' }}>
          Login to Your Portal
        </h2>
        <form style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }} onSubmit={onSubmit}>
          <div>
            <label htmlFor="email" style={{ fontSize: '14px', fontWeight: '500', color: '#374151' }}>
              Email Address
            </label>
            <input
              type="email"
              name="email"
              value={email}
              onChange={onChange}
              required
              style={{ width: '100%', padding: '8px 12px', marginTop: '4px', border: '1px solid #d1d5db', borderRadius: '4px' }}
            />
          </div>
          <div>
            <label htmlFor="password" style={{ fontSize: '14px', fontWeight: '500', color: '#374151' }}>
              Password
            </label>
            <input
              type="password"
              name="password"
              value={password}
              onChange={onChange}
              required
              style={{ width: '100%', padding: '8px 12px', marginTop: '4px', border: '1px solid #d1d5db', borderRadius: '4px' }}
            />
          </div>
          {error && (
            <div style={{ padding: '12px', fontSize: '14px', color: '#b91c1c', backgroundColor: '#fee2e2', borderRadius: '4px' }}>
              {error}
            </div>
          )}
          <div>
            <button
              type="submit"
              style={{ width: '100%', padding: '10px 16px', fontWeight: '500', color: 'white', backgroundColor: '#4f46e5', borderRadius: '4px', border: 'none', cursor: 'pointer' }}
            >
              Login
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;
