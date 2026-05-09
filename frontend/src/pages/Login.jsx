import { useState } from 'react';
import { useNavigate, useLocation, Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { validateEmail } from '../utils/validators';

export default function Login() {
  const { user, loading, login } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();

  const [email,       setEmail]       = useState('');
  const [password,    setPassword]    = useState('');
  const [error,       setError]       = useState('');
  const [submitting,  setSubmitting]  = useState(false);

  // Already authenticated — redirect immediately
  if (!loading && user) {
    const destination = location.state?.from?.pathname ?? `/${user.role}`;
    return <Navigate to={destination} replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!validateEmail(email)) {
      setError('Enter a valid email address.');
      return;
    }

    setSubmitting(true);
    try {
      const loggedInUser = await login(email, password);
      // Redirect back to the page the user tried to visit, or to their dashboard
      const destination = location.state?.from?.pathname ?? `/${loggedInUser.role}`;
      navigate(destination, { replace: true });
    } catch (err) {
      const code = err.response?.data?.code;
      if (code === 'RATE_LIMIT_EXCEEDED') {
        setError('Too many login attempts. Please wait 15 minutes and try again.');
      } else {
        // Deliberately vague — do not confirm whether the email exists
        setError('Invalid email or password.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <h1>Sign in</h1>

      {error && <p role="alert">{error}</p>}

      <label htmlFor="email">Email</label>
      <input
        id="email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        autoComplete="email"
        required
        disabled={submitting}
      />

      <label htmlFor="password">Password</label>
      <input
        id="password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete="current-password"
        required
        disabled={submitting}
      />

      <button type="submit" disabled={submitting}>
        {submitting ? 'Signing in…' : 'Sign in'}
      </button>

      <Link to="/register">Create an account</Link>
    </form>
  );
}
