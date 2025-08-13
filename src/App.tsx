import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <Router>
      <Routes>
        {/* Rute Publik: Siapa saja bisa mengakses halaman login */}
        <Route path="/login" element={<Login />} />

        {/* Rute Terproteksi: Hanya pengguna yang sudah login yang bisa mengakses */}
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<Dashboard />} />
        </Route>

        {/* Rute default: Arahkan ke dasbor. ProtectedRoute akan menangani jika belum login */}
        <Route 
          path="*" 
          element={<Navigate to="/dashboard" />} 
        />
      </Routes>
    </Router>
  );
}

export default App;
