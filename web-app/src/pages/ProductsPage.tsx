import { useEffect, useState } from 'react';
import {
  listProducts, createProduct, updateProduct, deleteProduct, searchProducts,
  listTags, createTag, attachTag, detachTag,
} from '../api/products';
import { getCategoryTree } from '../api/categories';
import type { Product, Category, Tag } from '../types';

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [form, setForm] = useState({ name: '', description: '', category_id: '', base_price: '', status: 'draft', labelEn: '', labelAr: '' });

  // Edit state
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [editForm, setEditForm] = useState({ name: '', description: '', base_price: '', status: '', labelEn: '', labelAr: '' });

  // Tag modal
  const [tagProduct, setTagProduct] = useState<Product | null>(null);
  const [newTagName, setNewTagName] = useState('');

  const flatCats = (tree: Category[]): Category[] => {
    const f: Category[] = [];
    const walk = (ns: Category[]) => ns.forEach(n => { f.push(n); if (n.children) walk(n.children); });
    walk(tree); return f;
  };

  const reload = async () => {
    if (search.trim()) {
      const res = await searchProducts(search);
      setProducts(res.items); setTotal(res.total);
    } else {
      const params: any = { limit: 50 };
      if (filterCat) params.category_id = filterCat;
      if (filterStatus) params.status = filterStatus;
      const res = await listProducts(params);
      setProducts(res.items); setTotal(res.total);
    }
  };

  useEffect(() => { reload(); }, [filterCat, filterStatus]);
  useEffect(() => {
    getCategoryTree().then(t => setCategories(flatCats(t)));
    listTags().then(setTags);
  }, []);

  const mkLabels = (en: string, ar: string) => {
    const l: Record<string, string> = {}; if (en) l.en = en; if (ar) l.ar = ar;
    return Object.keys(l).length ? l : undefined;
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await createProduct({
      name: form.name, description: form.description || undefined, category_id: form.category_id,
      base_price: parseFloat(form.base_price), status: form.status, labels: mkLabels(form.labelEn, form.labelAr),
    });
    setForm({ name: '', description: '', category_id: '', base_price: '', status: 'draft', labelEn: '', labelAr: '' });
    setShowForm(false); reload();
  };

  const startEdit = (p: Product) => {
    setEditProduct(p);
    setEditForm({ name: p.name, description: p.description || '', base_price: String(p.base_price), status: p.status, labelEn: p.labels?.en || '', labelAr: p.labels?.ar || '' });
  };

  const saveEdit = async () => {
    if (!editProduct) return;
    await updateProduct(editProduct.id, {
      name: editForm.name, description: editForm.description, base_price: parseFloat(editForm.base_price),
      status: editForm.status, labels: mkLabels(editForm.labelEn, editForm.labelAr) ?? {},
    });
    setEditProduct(null); reload();
  };

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); reload(); };

  const handleAttachTag = async (tagId: string) => {
    if (!tagProduct) return;
    try { await attachTag(tagProduct.id, tagId); reload(); setTagProduct({ ...tagProduct, tags: [...tagProduct.tags, tags.find(t => t.id === tagId)!] }); } catch {}
  };

  const handleDetachTag = async (tagId: string) => {
    if (!tagProduct) return;
    await detachTag(tagProduct.id, tagId);
    setTagProduct({ ...tagProduct, tags: tagProduct.tags.filter(t => t.id !== tagId) }); reload();
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;
    const t = await createTag(newTagName.trim());
    setTags([...tags, t]); setNewTagName('');
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Products <span className="text-gray-400 text-base">({total})</span></h1>
        <button onClick={() => setShowForm(!showForm)} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">+ New Product</button>
      </div>

      {/* Filters + Search */}
      <div className="flex gap-3 mb-4 items-center">
        <form onSubmit={handleSearch} className="flex gap-2">
          <input placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)} className="border rounded px-3 py-1.5 text-sm w-64" />
          <button type="submit" className="bg-gray-200 px-3 py-1.5 rounded text-sm">Search</button>
          {search && <button type="button" onClick={() => { setSearch(''); setTimeout(reload, 0); }} className="text-xs text-gray-500">Clear</button>}
        </form>
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)} className="border rounded px-2 py-1.5 text-sm">
          <option value="">All categories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="border rounded px-2 py-1.5 text-sm">
          <option value="">All statuses</option>
          <option value="draft">Draft</option><option value="active">Active</option><option value="archived">Archived</option>
        </select>
      </div>

      {/* Create form */}
      {showForm && (
        <form onSubmit={handleCreate} className="bg-white border rounded p-4 mb-4 max-w-lg space-y-2">
          <input placeholder="Name *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full border rounded px-3 py-1.5 text-sm" required />
          <input placeholder="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="w-full border rounded px-3 py-1.5 text-sm" />
          <select value={form.category_id} onChange={e => setForm({ ...form, category_id: e.target.value })} className="w-full border rounded px-3 py-1.5 text-sm" required>
            <option value="">Select category</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input placeholder="Price *" type="number" step="0.01" value={form.base_price} onChange={e => setForm({ ...form, base_price: e.target.value })} className="w-full border rounded px-3 py-1.5 text-sm" required />
          <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="w-full border rounded px-3 py-1.5 text-sm">
            <option value="draft">Draft</option><option value="active">Active</option><option value="archived">Archived</option>
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input placeholder="Label (EN)" value={form.labelEn} onChange={e => setForm({ ...form, labelEn: e.target.value })} className="border rounded px-3 py-1.5 text-sm" />
            <input placeholder="Label (AR)" value={form.labelAr} onChange={e => setForm({ ...form, labelAr: e.target.value })} className="border rounded px-3 py-1.5 text-sm" dir="rtl" />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="bg-green-600 text-white px-3 py-1.5 rounded text-sm">Create</button>
            <button type="button" onClick={() => setShowForm(false)} className="bg-gray-200 px-3 py-1.5 rounded text-sm">Cancel</button>
          </div>
        </form>
      )}

      {/* Edit modal */}
      {editProduct && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setEditProduct(null)}>
          <div className="bg-white rounded-lg p-6 w-full max-w-lg space-y-3" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold">Edit: {editProduct.name}</h2>
            <input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} className="w-full border rounded px-3 py-2 text-sm" />
            <input placeholder="Description" value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} className="w-full border rounded px-3 py-2 text-sm" />
            <input type="number" step="0.01" value={editForm.base_price} onChange={e => setEditForm({ ...editForm, base_price: e.target.value })} className="w-full border rounded px-3 py-2 text-sm" />
            <select value={editForm.status} onChange={e => setEditForm({ ...editForm, status: e.target.value })} className="w-full border rounded px-3 py-2 text-sm">
              <option value="draft">Draft</option><option value="active">Active</option><option value="archived">Archived</option>
            </select>
            <div className="grid grid-cols-2 gap-2">
              <input placeholder="Label (EN)" value={editForm.labelEn} onChange={e => setEditForm({ ...editForm, labelEn: e.target.value })} className="border rounded px-3 py-2 text-sm" />
              <input placeholder="Label (AR)" value={editForm.labelAr} onChange={e => setEditForm({ ...editForm, labelAr: e.target.value })} className="border rounded px-3 py-2 text-sm" dir="rtl" />
            </div>
            <div className="flex gap-2">
              <button onClick={saveEdit} className="bg-green-600 text-white px-4 py-2 rounded text-sm">Save</button>
              <button onClick={() => setEditProduct(null)} className="bg-gray-200 px-4 py-2 rounded text-sm">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Tag modal */}
      {tagProduct && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setTagProduct(null)}>
          <div className="bg-white rounded-lg p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-3">Tags: {tagProduct.name}</h2>
            <div className="flex flex-wrap gap-2 mb-4">
              {tagProduct.tags.map(t => (
                <span key={t.id} className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-sm flex items-center gap-1">
                  {t.name} <button onClick={() => handleDetachTag(t.id)} className="text-red-500 font-bold">&times;</button>
                </span>
              ))}
              {tagProduct.tags.length === 0 && <span className="text-gray-400 text-sm">No tags</span>}
            </div>
            <h3 className="text-sm font-semibold mb-2">Add existing tag</h3>
            <div className="flex flex-wrap gap-1 mb-3">
              {tags.filter(t => !tagProduct.tags.some(pt => pt.id === t.id)).map(t => (
                <button key={t.id} onClick={() => handleAttachTag(t.id)} className="bg-gray-100 px-2 py-1 rounded text-xs hover:bg-blue-100">{t.name}</button>
              ))}
            </div>
            <div className="flex gap-2">
              <input placeholder="New tag name" value={newTagName} onChange={e => setNewTagName(e.target.value)} className="border rounded px-2 py-1 text-sm flex-1" />
              <button onClick={handleCreateTag} className="bg-blue-600 text-white px-3 py-1 rounded text-sm">Create</button>
            </div>
            <button onClick={() => setTagProduct(null)} className="mt-3 text-sm text-gray-500 hover:underline">Close</button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white border rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Labels</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Tags</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map(p => (
              <tr key={p.id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-3">
                  <span className="font-medium">{p.name}</span><br />
                  <span className="text-xs text-gray-400">{p.slug}</span>
                  {p.description && <span className="text-xs text-gray-400 ml-2">— {p.description.slice(0, 40)}</span>}
                </td>
                <td className="px-4 py-3 text-xs">{p.labels ? Object.entries(p.labels).map(([k, v]) => <div key={k}>{k}: {v}</div>) : '-'}</td>
                <td className="px-4 py-3">${p.base_price.toFixed(2)}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs ${p.status === 'active' ? 'bg-green-100 text-green-700' : p.status === 'draft' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100'}`}>{p.status}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {p.tags.map(t => <span key={t.id} className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">{t.name}</span>)}
                    <button onClick={() => setTagProduct(p)} className="text-xs text-blue-600 hover:underline">manage</button>
                  </div>
                </td>
                <td className="px-4 py-3 space-x-2">
                  <button onClick={() => startEdit(p)} className="text-blue-600 text-xs hover:underline">edit</button>
                  <button onClick={async () => { if (confirm('Delete permanently?')) { await deleteProduct(p.id); reload(); } }} className="text-red-500 text-xs hover:underline">delete</button>
                </td>
              </tr>
            ))}
            {products.length === 0 && <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No products found.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
