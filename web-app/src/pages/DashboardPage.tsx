import { useEffect, useState } from 'react';
import { getCategoryTree } from '../api/categories';
import { listProducts, listTags } from '../api/products';
import { healthCheck, lookupByRef } from '../api/lookup';
import { useAuth } from '../context/AuthContext';
import type { Product } from '../types';

export default function DashboardPage() {
  const { user } = useAuth();
  const [catCount, setCatCount] = useState(0);
  const [prodCount, setProdCount] = useState(0);
  const [tagCount, setTagCount] = useState(0);
  const [health, setHealth] = useState<string>('...');
  const [recent, setRecent] = useState<Product[]>([]);

  // Lookup
  const [lookupRef, setLookupRef] = useState('');
  const [lookupResult, setLookupResult] = useState<any>(null);
  const [lookupError, setLookupError] = useState('');

  useEffect(() => {
    getCategoryTree().then(tree => {
      let c = 0;
      const walk = (ns: any[]) => ns.forEach(n => { c++; if (n.children) walk(n.children); });
      walk(tree); setCatCount(c);
    });
    listProducts({ limit: 5 }).then(res => { setProdCount(res.total); setRecent(res.items); });
    listTags().then(tags => setTagCount(tags.length));
    healthCheck().then(h => setHealth(h.status)).catch(() => setHealth('error'));
  }, []);

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault(); setLookupError(''); setLookupResult(null);
    if (!lookupRef.trim()) return;
    try {
      const result = await lookupByRef(lookupRef.trim());
      setLookupResult(result);
    } catch (err: any) {
      setLookupError(err.response?.data?.detail || 'Not found');
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2">Dashboard</h1>
      <p className="text-gray-600 mb-6">Welcome, {user?.username}!</p>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Stat label="API Health" value={health} color={health === 'ok' ? 'green' : 'red'} />
        <Stat label="Categories" value={catCount} color="blue" />
        <Stat label="Products" value={prodCount} color="indigo" />
        <Stat label="Tags" value={tagCount} color="purple" />
      </div>

      {/* Ref Path Lookup */}
      <div className="bg-white border rounded-lg p-4 mb-8">
        <h2 className="font-bold mb-2">Reference Path Lookup</h2>
        <p className="text-sm text-gray-500 mb-3">Resolve dotted paths like <code className="bg-gray-100 px-1">electronics.phones.smartphones</code> or <code className="bg-gray-100 px-1">electronics.phones.iphone-15</code></p>
        <form onSubmit={handleLookup} className="flex gap-2">
          <input value={lookupRef} onChange={e => setLookupRef(e.target.value)} placeholder="e.g. electronics.phones.smartphones"
            className="flex-1 border rounded px-3 py-1.5 text-sm" />
          <button type="submit" className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm hover:bg-blue-700">Lookup</button>
        </form>
        {lookupError && <div className="mt-2 text-red-600 text-sm">{lookupError}</div>}
        {lookupResult && (
          <div className="mt-3 bg-gray-50 border rounded p-3 text-sm">
            <div className="font-semibold mb-1">Type: <span className="text-blue-600">{lookupResult.type}</span></div>
            <div><strong>Name:</strong> {lookupResult.data.name}</div>
            <div><strong>Slug:</strong> {lookupResult.data.slug}</div>
            <div><strong>Ref Path:</strong> <code className="bg-gray-100 px-1">{lookupResult.data.ref_path}</code></div>
            {lookupResult.data.labels && (
              <div><strong>Labels:</strong> {Object.entries(lookupResult.data.labels).map(([k, v]) => `${k}: ${v}`).join(' | ')}</div>
            )}
            {lookupResult.type === 'product' && (
              <>
                <div><strong>Price:</strong> ${lookupResult.data.base_price}</div>
                <div><strong>Status:</strong> {lookupResult.data.status}</div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Recent Products */}
      <div className="bg-white border rounded-lg p-4">
        <h2 className="font-bold mb-3">Recent Products</h2>
        {recent.length === 0 ? <p className="text-gray-500 text-sm">No products yet.</p> : (
          <table className="w-full text-sm">
            <thead className="text-left text-gray-500">
              <tr><th className="pb-2">Name</th><th className="pb-2">Price</th><th className="pb-2">Status</th><th className="pb-2">Labels</th></tr>
            </thead>
            <tbody>
              {recent.map(p => (
                <tr key={p.id} className="border-t">
                  <td className="py-2 font-medium">{p.name} <span className="text-xs text-gray-400">{p.slug}</span></td>
                  <td className="py-2">${p.base_price.toFixed(2)}</td>
                  <td className="py-2"><span className={`px-2 py-0.5 rounded text-xs ${p.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{p.status}</span></td>
                  <td className="py-2 text-xs">{p.labels ? Object.entries(p.labels).map(([k, v]) => `${k}:${v}`).join(' | ') : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string | number; color: string }) {
  const c: Record<string, string> = {
    green: 'bg-green-50 text-green-700 border-green-200', red: 'bg-red-50 text-red-700 border-red-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200', indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
  };
  return (
    <div className={`border rounded-lg p-4 ${c[color] || c.blue}`}>
      <div className="text-xs font-medium uppercase tracking-wide">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}
