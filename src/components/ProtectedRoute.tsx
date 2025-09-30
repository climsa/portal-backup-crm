import { Navigate, Outlet } from 'react-router-dom';

const ProtectedRoute = () => {
  const token = localStorage.getItem('token');

  // Jika ada token, tampilkan konten halaman (menggunakan <Outlet />).
  // Jika tidak, arahkan pengguna ke halaman login.
  return token ? <Outlet /> : <Navigate to="/login" />;
};

export default ProtectedRoute;
