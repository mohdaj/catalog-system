import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { to: '/', label: 'Dashboard', icon: '⌂' },
  { to: '/categories', label: 'Catalog', icon: '🗂️' },
  { to: '/products', label: 'Products', icon: '📦' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const location = useLocation();

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 text-white flex flex-col">
        <div className="p-4 text-xl font-bold border-b border-gray-700">Catalog Admin</div>
        <nav className="flex-1 p-2 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`block px-4 py-2 rounded ${
                location.pathname === item.to ? 'bg-gray-700' : 'hover:bg-gray-800'
              }`}
            >
              {item.icon} {item.label}
            </Link>
          ))}
          {user?.role === 'superadmin' && (
            <Link
              to="/users"
              className={`block px-4 py-2 rounded ${
                location.pathname === '/users' ? 'bg-gray-700' : 'hover:bg-gray-800'
              }`}
            >
              👥 Users
            </Link>
          )}
        </nav>
        <div className="p-4 border-t border-gray-700">
          <div className="text-sm text-gray-400 mb-2">
            {user?.username} ({user?.role})
          </div>
          <button onClick={logout} className="text-red-400 hover:text-red-300 text-sm">
            Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}
