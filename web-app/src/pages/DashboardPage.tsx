import { useEffect, useState } from 'react';
import { getCategoryTree } from '../api/categories';
import { listProducts } from '../api/products';
import { useAuth } from '../context/AuthContext';

export default function DashboardPage() {
  const { user } = useAuth();
  const [categoryCount, setCategoryCount] = useState(0);
  const [productCount, setProductCount] = useState(0);

  useEffect(() => {
    getCategoryTree().then((tree) => {
      let count = 0;
      const walk = (nodes: any[]) => {
        nodes.forEach((n) => {
          count++;
          if (n.children) walk(n.children);
        });
      };
      walk(tree);
      setCategoryCount(count);
    });
    listProducts({ limit: 1 }).then((res) => setProductCount(res.total));
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
      <p className="text-gray-600 mb-8">Welcome, {user?.username}!</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard label="Categories" value={categoryCount} color="blue" />
        <StatCard label="Products" value={productCount} color="green" />
        <StatCard label="Role" value={user?.role ?? ''} color="purple" />
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string | number; color: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    green: 'bg-green-50 text-green-700 border-green-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
  };
  return (
    <div className={`border rounded-lg p-6 ${colors[color]}`}>
      <div className="text-sm font-medium uppercase tracking-wide">{label}</div>
      <div className="text-3xl font-bold mt-2">{value}</div>
    </div>
  );
}
