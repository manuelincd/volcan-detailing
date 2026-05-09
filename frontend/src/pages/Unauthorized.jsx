import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Unauthorized() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const goHome = () => {
    if (user) navigate(`/${user.role}`, { replace: true });
    else navigate('/login', { replace: true });
  };

  return (
    <div>
      <h1>Access denied</h1>
      <p>You do not have permission to view this page.</p>
      <button onClick={goHome}>Go to my dashboard</button>
    </div>
  );
}
