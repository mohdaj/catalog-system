import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({
  children,
  requiredRole,
}: {
  children: React.ReactNode;
  requiredRole?: 'admin' | 'superadmin';
}) {
  const { user, loading } = useAuth();

  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (requiredRole === 'superadmin' && user.role !== 'superadmin') {
    return <div className="p-8 text-red-600 font-semibold">Access denied. Superadmin only.</div>;
  }

  return <>{children}</>;
}
