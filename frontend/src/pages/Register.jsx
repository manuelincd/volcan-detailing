import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import { validateEmail, validatePassword } from '../utils/validators';

export default function Register() {
  const [form, setForm] = useState({ email: '', password: '', name: '', phone: '' });
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateEmail(form.email)) return setError('Invalid email');
    if (!validatePassword(form.password))
      return setError('Password must be 8+ chars with uppercase, number, and special character');
    try {
      await api.post('/auth/register', form);
      navigate('/login');
    } catch {
      setError('Registration failed');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <h1>Register</h1>
      {error && <p>{error}</p>}
      <input type="text" value={form.name} onChange={set('name')} placeholder="Full name" required />
      <input type="email" value={form.email} onChange={set('email')} placeholder="Email" required />
      <input type="password" value={form.password} onChange={set('password')} placeholder="Password" required />
      <input type="tel" value={form.phone} onChange={set('phone')} placeholder="Phone (optional)" />
      <button type="submit">Register</button>
      <Link to="/login">Already have an account?</Link>
    </form>
  );
}
