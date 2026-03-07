import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-white dark:bg-gray-900">
        <div className="flex flex-col items-center gap-4">
          <div className="w-14 h-14 bg-ck-600 rounded-2xl flex items-center justify-center text-3xl text-white shadow-lg animate-pulse">
            💬
          </div>
          <p className="text-gray-400 text-sm">Loading ChatKey...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
