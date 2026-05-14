import { useEffect, useState } from 'react';
import {
  listProducts, createProduct, updateProduct, deleteProduct, searchProducts,
  getProduct, addProductImage, deleteProductImage,
  listTags, createTag, attachTag, detachTag,
} from '../api/products';
import { getCategoryTree, getCategoryAttributes } from '../api/categories';
import type { Product, Category, Tag, AttributeDefinition } from '../types';

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [page, setPage] = useState(0);
  const LIMIT = 20;
  const [form, setForm] = useState({ name: '', description: '', category_id: '', base_price: '', status: 'draft', labelEn: '', labelAr: '' });

  // Category attributes for dynamic attr input
  const [catAttrs, setCatAttrs] = useState<AttributeDefinition[]>([]);
  const [formAttrs, setFormAttrs] = useState<Record<string, any>>({});

  // Edit / Detail / Tags / Images modals
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [editForm, setEditForm] = useState({ name: '', description: '', base_price: '', status: '', labelEn: '', labelAr: '', category_id: '' });
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  const [tagProduct, setTagProduct] = useState<Product | null>(null);
  const [newTagName, setNewTagName] = useState('');
  const [imgProduct, setImgProduct] = useState<Product | null>(null);
  const [imgUrl, setImgUrl] = useState('');
  const [imgAlt, setImgAlt] = useState('');

  const flatCats = (tree: Category[]): Category[] => {
    const f: Category[] = [];
    const walk = (ns: Category[]) => ns.forEach(n => { f.push(n); if (n.children) walk(n.children); });
    walk(tree); return f;
  };

  const reload = async () => {
    if (search.trim()) {
      const res = await searchProducts(search, LIMIT, page * LIMIT);
      setProducts(res.items); setTotal(res.total);
    } else {
      const params: any = { limit: LIMIT, offset: page * LIMIT };
      if (filterCat) params.category_id = filterCat;
      if (filterStatus) params.status = filterStatus;
      if (minPrice) params.min_price = parseFloat(minPrice);
      if (maxPrice) params.max_price = parseFloat(maxPrice);
      const res = await listProducts(params);
      setProducts(res.items); setTotal(res.total);
    }
  };

  useEffect(() => { reload(); }, [filterCat, filterStatus, page]);
  useEffect(() => {
    getCategoryTree().then(t => setCategories(flatCats(t)));
    listTags().then(setTags);
  }, []);

  // Load category attrs when form category changes
  useEffect(() => {
    if (form.category_id) {
      getCategoryAttributes(form.category_id).then(setCatAttrs);
      setFormAttrs({});
    } else { setCatAttrs([]); }
  }, [form.category_id]);

  const mkLabels = (en: string, ar: string) => {
    const l: Record<string, string> = {}; if (en) l.en = en; if (ar) l.ar = ar;
    return Object.keys(l).length ? l : undefined;
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await createProduct({
      name: form.name, description: form.description || undefined, category_id: form.category_id,
      base_price: parseFloat(form.base_price), status: form.status, labels: mkLabels(form.labelEn, form.labelAr),
      attributes: Object.keys(formAttrs).length ? formAttrs : undefined,
    });
    setForm({ name: '', description: '', category_id: '', base_price: '', status: 'draft', labelEn: '', labelAr: '' });
    setFormAttrs({}); setShowForm(false); reload();
  };

  const startEdit = (p: Product) => {
    setEditProduct(p);
    setEditForm({ name: p.name, description: p.description || '', base_price: String(p.base_price), status: p.status, labelEn: p.labels?.en || '', labelAr: p.labels?.ar || '', category_id: p.category_id });
  };

  const saveEdit = async () => {
    if (!editProduct) return;
    const payload: any = {
      name: editForm.name, description: editForm.description, base_price: parseFloat(editForm.base_price),
      status: editForm.status, labels: mkLabels(editForm.labelEn, editForm.labelAr) ?? {},
    };
    if (editForm.category_id !== editProduct.category_id) {
      payload.category_id = editForm.category_id;
    }
    await updateProduct(editProduct.id, payload);
    setEditProduct(null); reload();
  };

  const openDetail = async (id: string) => { const p = await getProduct(id); setDetailProduct(p); };

  const handleAddImage = async () => {
    if (!imgProduct || !imgUrl.trim()) return;
    await addProductImage(imgProduct.id, { url: imgUrl, alt_text: imgAlt || undefined });
    setImgUrl(''); setImgAlt('');
    const p = await getProduct(imgProduct.id); setImgProduct(p); reload();
  };

  const handleDeleteImage = async (imageId: string) => {
    if (!imgProduct) return;
    await deleteProductImage(imgProduct.id, imageId);
    const p = await getProduct(imgProduct.id); setImgProduct(p); reload();
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Products <span className="text-gray-400 text-base">({total})</span></h1>
        {/*<button onClick={() => setShowForm(!showForm)} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">+ New Product</button>*/}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4 items-end">
        <form onSubmit={e => { e.preventDefault(); setPage(0); reload(); }} className="flex gap-2">
          <input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="border rounded px-3 py-1.5 text-sm w-56" />
          <button type="submit" className="bg-gray-200 px-3 py-1.5 rounded text-sm">Go</button>
          {search && <button type="button" onClick={() => { setSearch(''); setPage(0); setTimeout(reload, 0); }} className="text-xs text-gray-500">Clear</button>}
        </form>
        <select value={filterCat} onChange={e => { setFilterCat(e.target.value); setPage(0); }} className="border rounded px-2 py-1.5 text-sm">
          <option value="">All categories</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(0); }} className="border rounded px-2 py-1.5 text-sm">
          <option value="">All statuses</option><option value="draft">Draft</option><option value="active">Active</option><option value="archived">Archived</option>
        </select>
        <div className="flex gap-1 items-center text-sm">
          <input placeholder="Min $" value={minPrice} onChange={e => setMinPrice(e.target.value)} className="border rounded px-2 py-1.5 w-20 text-sm" type="number" step="0.01" />
          <span>—</span>
          <input placeholder="Max $" value={maxPrice} onChange={e => setMaxPrice(e.target.value)} className="border rounded px-2 py-1.5 w-20 text-sm" type="number" step="0.01" />
          <button onClick={() => { setPage(0); reload(); }} className="bg-gray-200 px-2 py-1.5 rounded text-sm">Filter</button>
        </div>
      </div>

      {/* Create form with dynamic attributes */}
      {showForm && (
        <form onSubmit={handleCreate} className="bg-white border rounded p-4 mb-4 max-w-xl space-y-2">
          <input placeholder="Name *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full border rounded px-3 py-1.5 text-sm" required />
          <input placeholder="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="w-full border rounded px-3 py-1.5 text-sm" />
          <select value={form.category_id} onChange={e => setForm({ ...form, category_id: e.target.value })} className="w-full border rounded px-3 py-1.5 text-sm" required>
            <option value="">Select category</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input placeholder="Price *" type="number" step="0.01" value={form.base_price} onChange={e => setForm({ ...form, base_price: e.target.value })} className="w-full border rounded px-3 py-1.5 text-sm" required />
          <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} className="w-full border rounded px-3 py-1.5 text-sm">
            <option value="draft">Draft</option><option value="active">Active</option><option value="archived">Archived</option>
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input placeholder="Label (EN)" value={form.labelEn} onChange={e => setForm({ ...form, labelEn: e.target.value })} className="border rounded px-3 py-1.5 text-sm" />
            <input placeholder="Label (AR)" value={form.labelAr} onChange={e => setForm({ ...form, labelAr: e.target.value })} className="border rounded px-3 py-1.5 text-sm" dir="rtl" />
          </div>
          {/* Dynamic attributes based on selected category */}
          {catAttrs.length > 0 && (
            <div className="border-t pt-2 space-y-2">
              <h4 className="text-sm font-semibold">Category Attributes</h4>
              {catAttrs.map(a => (
                <div key={a.slug} className="flex items-center gap-2 text-sm">
                  <label className="w-32 truncate">{a.name}{a.is_required && <span className="text-red-500">*</span>}</label>
                  {a.attribute_type === 'boolean' ? (
                    <input type="checkbox" checked={!!formAttrs[a.slug]} onChange={e => setFormAttrs({ ...formAttrs, [a.slug]: e.target.checked })} />
                  ) : a.attribute_type === 'select' ? (
                    <select value={formAttrs[a.slug] || ''} onChange={e => setFormAttrs({ ...formAttrs, [a.slug]: e.target.value })} className="flex-1 border rounded px-2 py-1">
                      <option value="">—</option>{a.options?.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : a.attribute_type === 'number' ? (
                    <input type="number" step="any" value={formAttrs[a.slug] || ''} onChange={e => setFormAttrs({ ...formAttrs, [a.slug]: parseFloat(e.target.value) || '' })} className="flex-1 border rounded px-2 py-1" />
                  ) : (
                    <input value={formAttrs[a.slug] || ''} onChange={e => setFormAttrs({ ...formAttrs, [a.slug]: e.target.value })} className="flex-1 border rounded px-2 py-1" />
                  )}
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <button type="submit" className="bg-green-600 text-white px-3 py-1.5 rounded text-sm">Create</button>
            <button type="button" onClick={() => setShowForm(false)} className="bg-gray-200 px-3 py-1.5 rounded text-sm">Cancel</button>
          </div>
        </form>
      )}

      {/* Table */}
      <div className="bg-white border rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-4 py-3">Name</th><th className="px-4 py-3">Labels</th><th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">Status</th><th className="px-4 py-3">Tags</th><th className="px-4 py-3">Imgs</th><th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map(p => (
              <tr key={p.id} className="border-t hover:bg-gray-50">
                <td className="px-4 py-3 cursor-pointer" onClick={() => openDetail(p.id)}>
                  <span className="font-medium text-blue-600 hover:underline">{p.name}</span><br />
                  <span className="text-xs text-gray-400">{p.slug}</span>
                </td>
                <td className="px-4 py-3 text-xs">{p.labels ? Object.entries(p.labels).map(([k, v]) => <div key={k}>{k}: {v}</div>) : '-'}</td>
                <td className="px-4 py-3">${p.base_price.toFixed(2)}</td>
                <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-xs ${p.status === 'active' ? 'bg-green-100 text-green-700' : p.status === 'draft' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100'}`}>{p.status}</span></td>
                <td className="px-4 py-3">
                  {p.tags.map(t => <span key={t.id} className="bg-gray-100 px-1.5 py-0.5 rounded text-xs mr-1">{t.name}</span>)}
                  <button onClick={() => setTagProduct(p)} className="text-xs text-blue-600 hover:underline">+</button>
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs">{p.images.length}</span>
                  <button onClick={async () => { const full = await getProduct(p.id); setImgProduct(full); }} className="text-xs text-blue-600 hover:underline ml-1">manage</button>
                </td>
                <td className="px-4 py-3 space-x-2">
                  <button onClick={() => startEdit(p)} className="text-blue-600 text-xs hover:underline">edit</button>
                  <button onClick={async () => { if (confirm('Delete?')) { await deleteProduct(p.id); reload(); } }} className="text-red-500 text-xs hover:underline">del</button>
                </td>
              </tr>
            ))}
            {products.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">No products found.</td></tr>}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Prev</button>
          <span className="text-sm">Page {page + 1} of {totalPages}</span>
          <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} className="px-3 py-1 border rounded text-sm disabled:opacity-40">Next</button>
        </div>
      )}

      {/* Edit modal */}
      {editProduct && (
        <Modal onClose={() => setEditProduct(null)} title={`Edit: ${editProduct.name}`}>
          <input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} className="w-full border rounded px-3 py-2 text-sm" />
          <input placeholder="Description" value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} className="w-full border rounded px-3 py-2 text-sm" />
          <label className="block text-xs font-medium text-gray-500">Category</label>
          <select value={editForm.category_id} onChange={e => setEditForm({ ...editForm, category_id: e.target.value })} className="w-full border rounded px-3 py-2 text-sm">
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input type="number" step="0.01" value={editForm.base_price} onChange={e => setEditForm({ ...editForm, base_price: e.target.value })} className="w-full border rounded px-3 py-2 text-sm" />
          <select value={editForm.status} onChange={e => setEditForm({ ...editForm, status: e.target.value })} className="w-full border rounded px-3 py-2 text-sm">
            <option value="draft">Draft</option><option value="active">Active</option><option value="archived">Archived</option>
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input placeholder="Label EN" value={editForm.labelEn} onChange={e => setEditForm({ ...editForm, labelEn: e.target.value })} className="border rounded px-3 py-2 text-sm" />
            <input placeholder="Label AR" value={editForm.labelAr} onChange={e => setEditForm({ ...editForm, labelAr: e.target.value })} className="border rounded px-3 py-2 text-sm" dir="rtl" />
          </div>
          <div className="flex gap-2"><button onClick={saveEdit} className="bg-green-600 text-white px-4 py-2 rounded text-sm">Save</button><button onClick={() => setEditProduct(null)} className="bg-gray-200 px-4 py-2 rounded text-sm">Cancel</button></div>
        </Modal>
      )}

      {/* Detail modal */}
      {detailProduct && (
        <Modal onClose={() => setDetailProduct(null)} title={detailProduct.name}>
          <div className="space-y-2 text-sm">
            <div><strong>Slug:</strong> {detailProduct.slug}</div>
            <div><strong>Description:</strong> {detailProduct.description || '—'}</div>
            <div><strong>Price:</strong> ${detailProduct.base_price.toFixed(2)}</div>
            <div><strong>Status:</strong> {detailProduct.status}</div>
            {detailProduct.ref_path && <div><strong>Ref Path:</strong> <code className="bg-gray-100 px-1">{detailProduct.ref_path}</code></div>}
            {detailProduct.labels && <div><strong>Labels:</strong> {Object.entries(detailProduct.labels).map(([k, v]) => `${k}: ${v}`).join(' | ')}</div>}
            {Object.keys(detailProduct.attributes).length > 0 && (
              <div><strong>Attributes:</strong><pre className="bg-gray-50 p-2 rounded mt-1 text-xs">{JSON.stringify(detailProduct.attributes, null, 2)}</pre></div>
            )}
            {detailProduct.images.length > 0 && (
              <div><strong>Images ({detailProduct.images.length}):</strong>
                {detailProduct.images.map(img => <div key={img.id} className="text-xs text-gray-500 truncate">{img.url} {img.alt_text && `(${img.alt_text})`}</div>)}
              </div>
            )}
            {detailProduct.tags.length > 0 && (
              <div><strong>Tags:</strong> {detailProduct.tags.map(t => t.name).join(', ')}</div>
            )}
          </div>
        </Modal>
      )}

      {/* Tag modal */}
      {tagProduct && (
        <Modal onClose={() => setTagProduct(null)} title={`Tags: ${tagProduct.name}`}>
          <div className="flex flex-wrap gap-2 mb-4">
            {tagProduct.tags.map(t => (
              <span key={t.id} className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-sm flex items-center gap-1">
                {t.name} <button onClick={async () => { await detachTag(tagProduct.id, t.id); setTagProduct({ ...tagProduct, tags: tagProduct.tags.filter(x => x.id !== t.id) }); reload(); }} className="text-red-500 font-bold">&times;</button>
              </span>
            ))}
            {tagProduct.tags.length === 0 && <span className="text-gray-400 text-sm">No tags</span>}
          </div>
          <div className="flex flex-wrap gap-1 mb-3">
            {tags.filter(t => !tagProduct.tags.some(pt => pt.id === t.id)).map(t => (
              <button key={t.id} onClick={async () => { try { await attachTag(tagProduct.id, t.id); setTagProduct({ ...tagProduct, tags: [...tagProduct.tags, t] }); reload(); } catch {} }} className="bg-gray-100 px-2 py-1 rounded text-xs hover:bg-blue-100">{t.name}</button>
            ))}
          </div>
          <div className="flex gap-2">
            <input placeholder="New tag" value={newTagName} onChange={e => setNewTagName(e.target.value)} className="border rounded px-2 py-1 text-sm flex-1" />
            <button onClick={async () => { if (!newTagName.trim()) return; const t = await createTag(newTagName.trim()); setTags([...tags, t]); setNewTagName(''); }} className="bg-blue-600 text-white px-3 py-1 rounded text-sm">Create</button>
          </div>
        </Modal>
      )}

      {/* Image modal */}
      {imgProduct && (
        <Modal onClose={() => setImgProduct(null)} title={`Images: ${imgProduct.name}`}>
          {imgProduct.images.length === 0 ? <p className="text-gray-500 text-sm mb-3">No images.</p> : (
            <ul className="space-y-2 mb-4">{imgProduct.images.map(img => (
              <li key={img.id} className="flex items-center justify-between text-sm border-b pb-1">
                <div className="truncate flex-1">
                  <span className="text-blue-600">{img.url}</span>
                  {img.alt_text && <span className="text-gray-400 ml-2">({img.alt_text})</span>}
                  <span className="text-gray-300 ml-2">#{img.sort_order}</span>
                </div>
                <button onClick={() => handleDeleteImage(img.id)} className="text-red-500 text-xs ml-2 shrink-0">remove</button>
              </li>
            ))}</ul>
          )}
          <div className="space-y-2 border-t pt-3">
            <input placeholder="Image URL" value={imgUrl} onChange={e => setImgUrl(e.target.value)} className="w-full border rounded px-2 py-1 text-sm" />
            <input placeholder="Alt text (optional)" value={imgAlt} onChange={e => setImgAlt(e.target.value)} className="w-full border rounded px-2 py-1 text-sm" />
            <button onClick={handleAddImage} className="bg-blue-600 text-white px-3 py-1 rounded text-sm w-full">Add Image</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[85vh] overflow-auto space-y-3" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold">{title}</h2>
        {children}
      </div>
    </div>
  );
}
