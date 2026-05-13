import { useEffect, useState } from 'react';
import { listProducts, createProduct, deleteProduct } from '../api/products';
import { getCategoryTree } from '../api/categories';
import type { Product, Category } from '../types';

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', category_id: '', base_price: '', status: 'draft', labelEn: '', labelAr: '' });

  const reload = () => {
    listProducts({ limit: 50 }).then((res) => { setProducts(res.items); setTotal(res.total); });
  };

  useEffect(() => {
    reload();
    getCategoryTree().then((tree) => {
      const flat: Category[] = [];
      const walk = (nodes: Category[]) => nodes.forEach((n) => { flat.push(n); if (n.children) walk(n.children); });
      walk(tree);
      setCategories(flat);
    });
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const labels: Record<string, string> = {};
    if (form.labelEn) labels.en = form.labelEn;
    if (form.labelAr) labels.ar = form.labelAr;
    await createProduct({
      name: form.name,
      category_id: form.category_id,
      base_price: parseFloat(form.base_price),
      status: form.status,
      labels: Object.keys(labels).length > 0 ? labels : undefined,
    });
    setShowForm(false);
    setForm({ name: '', category_id: '', base_price: '', status: 'draft', labelEn: '', labelAr: '' });
    reload();
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this product permanently?')) {
      await deleteProduct(id);
      reload();
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Products <span className="text-gray-400 text-base">({total})</span></h1>
        <button onClick={() => setShowForm(!showForm)} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
          + New Product
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white border rounded-lg p-4 mb-6 max-w-lg space-y-3">
          <input placeholder="Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full border rounded px-3 py-2" required />
          <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}
            className="w-full border rounded px-3 py-2" required>
            <option value="">Select category</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input placeholder="Price *" type="number" step="0.01" value={form.base_price}
            onChange={(e) => setForm({ ...form, base_price: e.target.value })} className="w-full border rounded px-3 py-2" required />
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
            className="w-full border rounded px-3 py-2">
            <option value="draft">Draft</option><option value="active">Active</option><option value="archived">Archived</option>
          </select>
          <input placeholder="Label (English)" value={form.labelEn} onChange={(e) => setForm({ ...form, labelEn: e.target.value })}
            className="w-full border rounded px-3 py-2" />
          <input placeholder="Label (Arabic)" value={form.labelAr} onChange={(e) => setForm({ ...form, labelAr: e.target.value })}
            className="w-full border rounded px-3 py-2" dir="rtl" />
          <div className="flex gap-2">
            <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded">Create</button>
            <button type="button" onClick={() => setShowForm(false)} className="bg-gray-300 px-4 py-2 rounded">Cancel</button>
          </div>
        </form>
      )}

      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Labels</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-3 font-medium">{p.name}<br /><span className="text-xs text-gray-400">{p.slug}</span></td>
                <td className="px-4 py-3 text-xs">
                  {p.labels ? Object.entries(p.labels).map(([k, v]) => <div key={k}>{k}: {v}</div>) : '-'}
                </td>
                <td className="px-4 py-3">${p.base_price.toFixed(2)}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    p.status === 'active' ? 'bg-green-100 text-green-700' :
                    p.status === 'draft' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'
                  }`}>{p.status}</span>
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => handleDelete(p.id)} className="text-red-500 hover:underline text-xs">Delete</button>
                </td>
              </tr>
            ))}
            {products.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No products yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
