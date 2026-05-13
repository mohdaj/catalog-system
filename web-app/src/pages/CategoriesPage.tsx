import { useEffect, useState } from 'react';
import {
  getCategoryTree, createCategory, updateCategory, deleteCategory,
  getCategoryAttributes, createAttribute, updateAttribute, deleteAttribute, getCategoryAncestors,
} from '../api/categories';
import { createProduct, listProducts } from '../api/products';
import type { Category, AttributeDefinition, Product } from '../types';

type PanelMode = 'view' | 'edit' | 'add-sub' | 'add-product';

export default function CategoriesPage() {
  const [tree, setTree] = useState<Category[]>([]);
  const [selected, setSelected] = useState<Category | null>(null);
  const [ancestors, setAncestors] = useState<Category[]>([]);
  const [attrs, setAttrs] = useState<AttributeDefinition[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [panelMode, setPanelMode] = useState<PanelMode>('view');

  // Forms
  const [subForm, setSubForm] = useState({ name: '', description: '', labelEn: '', labelAr: '' });
  const [editForm, setEditForm] = useState({ name: '', description: '', labelEn: '', labelAr: '', parent_id: '' });
  const [prodForm, setProdForm] = useState({ name: '', description: '', base_price: '', status: 'draft', labelEn: '', labelAr: '' });
  const [prodAttrs, setProdAttrs] = useState<Record<string, any>>({});
  const [attrForm, setAttrForm] = useState({ name: '', attribute_type: 'text', is_required: false, is_filterable: false, options: '', labelEn: '', labelAr: '' });
  const [editAttrId, setEditAttrId] = useState<string | null>(null);
  const [editAttrForm, setEditAttrForm] = useState({ name: '', is_required: false, is_filterable: false, options: '' });

  // Root add form
  const [showRootForm, setShowRootForm] = useState(false);
  const [rootForm, setRootForm] = useState({ name: '', description: '', labelEn: '', labelAr: '' });

  const reload = () => getCategoryTree().then(setTree);
  useEffect(() => { reload(); }, []);

  const allCatsFlat = (() => {
    const f: Category[] = [];
    const walk = (ns: Category[]) => ns.forEach(n => { f.push(n); if (n.children) walk(n.children); });
    walk(tree); return f;
  })();

  const selectCategory = async (cat: Category) => {
    setSelected(cat);
    setPanelMode('view');
    getCategoryAttributes(cat.id).then(setAttrs);
    getCategoryAncestors(cat.id).then(setAncestors);
    listProducts({ category_id: cat.id, limit: 50 }).then(res => setProducts(res.items));
  };

  const mkLabels = (en: string, ar: string) => {
    const l: Record<string, string> = {}; if (en) l.en = en; if (ar) l.ar = ar;
    return Object.keys(l).length ? l : undefined;
  };

  const handleCreateRoot = async (e: React.FormEvent) => {
    e.preventDefault();
    await createCategory({ name: rootForm.name, description: rootForm.description || undefined, labels: mkLabels(rootForm.labelEn, rootForm.labelAr) });
    setRootForm({ name: '', description: '', labelEn: '', labelAr: '' }); setShowRootForm(false); reload();
  };

  const handleCreateSub = async (e: React.FormEvent) => {
    e.preventDefault(); if (!selected) return;
    await createCategory({ name: subForm.name, description: subForm.description || undefined, parent_id: selected.id, labels: mkLabels(subForm.labelEn, subForm.labelAr) });
    setSubForm({ name: '', description: '', labelEn: '', labelAr: '' }); setPanelMode('view'); reload();
    // Re-select to refresh
    const updated = await getCategoryTree();
    setTree(updated);
    selectCategory(selected);
  };

  const startEdit = () => {
    if (!selected) return;
    setEditForm({ name: selected.name, description: selected.description || '', labelEn: selected.labels?.en || '', labelAr: selected.labels?.ar || '', parent_id: selected.parent_id || '' });
    setPanelMode('edit');
  };

  const saveEdit = async () => {
    if (!selected) return;
    const payload: any = { name: editForm.name, description: editForm.description, labels: mkLabels(editForm.labelEn, editForm.labelAr) ?? {} };
    payload.parent_id = editForm.parent_id || null;
    await updateCategory(selected.id, payload);
    setPanelMode('view'); reload();
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault(); if (!selected) return;
    await createProduct({
      name: prodForm.name, description: prodForm.description || undefined, category_id: selected.id,
      base_price: parseFloat(prodForm.base_price), status: prodForm.status, labels: mkLabels(prodForm.labelEn, prodForm.labelAr),
      attributes: Object.keys(prodAttrs).length ? prodAttrs : undefined,
    });
    setProdForm({ name: '', description: '', base_price: '', status: 'draft', labelEn: '', labelAr: '' });
    setProdAttrs({}); setPanelMode('view');
    listProducts({ category_id: selected.id, limit: 50 }).then(res => setProducts(res.items));
  };

  const handleAddAttr = async (e: React.FormEvent) => {
    e.preventDefault(); if (!selected) return;
    const opts = attrForm.options.trim() ? attrForm.options.split(',').map(s => s.trim()) : undefined;
    await createAttribute(selected.id, { name: attrForm.name, attribute_type: attrForm.attribute_type, is_required: attrForm.is_required, options: opts, labels: mkLabels(attrForm.labelEn, attrForm.labelAr) });
    setAttrForm({ name: '', attribute_type: 'text', is_required: false, is_filterable: false, options: '', labelEn: '', labelAr: '' });
    getCategoryAttributes(selected.id).then(setAttrs);
  };

  const saveEditAttr = async () => {
    if (!editAttrId || !selected) return;
    const opts = editAttrForm.options.trim() ? editAttrForm.options.split(',').map(s => s.trim()) : undefined;
    await updateAttribute(selected.id, editAttrId, { name: editAttrForm.name, is_required: editAttrForm.is_required, is_filterable: editAttrForm.is_filterable, options: opts });
    setEditAttrId(null); getCategoryAttributes(selected.id).then(setAttrs);
  };

  const breadcrumb = ancestors.map(a => a.name).concat(selected ? [selected.name] : []).join(' > ');

  return (
    <div className="flex gap-6 h-[calc(100vh-3rem)]">
      {/* LEFT: Tree */}
      <div className="w-80 shrink-0 overflow-auto">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-bold">Catalog</h1>
          <button onClick={() => setShowRootForm(!showRootForm)} className="bg-blue-600 text-white px-3 py-1 rounded text-xs hover:bg-blue-700">+ Root</button>
        </div>
        {showRootForm && (
          <form onSubmit={handleCreateRoot} className="bg-white border rounded p-3 mb-3 space-y-1.5">
            <input placeholder="Name *" value={rootForm.name} onChange={e => setRootForm({ ...rootForm, name: e.target.value })} className="w-full border rounded px-2 py-1 text-sm" required />
            <input placeholder="Description" value={rootForm.description} onChange={e => setRootForm({ ...rootForm, description: e.target.value })} className="w-full border rounded px-2 py-1 text-sm" />
            <div className="grid grid-cols-2 gap-1">
              <input placeholder="EN" value={rootForm.labelEn} onChange={e => setRootForm({ ...rootForm, labelEn: e.target.value })} className="border rounded px-2 py-1 text-sm" />
              <input placeholder="AR" value={rootForm.labelAr} onChange={e => setRootForm({ ...rootForm, labelAr: e.target.value })} className="border rounded px-2 py-1 text-sm" dir="rtl" />
            </div>
            <div className="flex gap-1">
              <button type="submit" className="bg-green-600 text-white px-2 py-1 rounded text-xs">Create</button>
              <button type="button" onClick={() => setShowRootForm(false)} className="bg-gray-200 px-2 py-1 rounded text-xs">Cancel</button>
            </div>
          </form>
        )}
        <div className="bg-white border rounded p-3">
          {tree.length === 0 ? <p className="text-gray-500 text-sm">No categories.</p> : (
            <TreeView nodes={tree} selectedId={selected?.id || null} onSelect={(c: Category) => selectCategory(c)} depth={0} />
          )}
        </div>
      </div>

      {/* RIGHT: Detail panel */}
      <div className="flex-1 overflow-auto">
        {!selected ? (
          <div className="flex items-center justify-center h-full text-gray-400">Select a category from the tree</div>
        ) : (
          <div className="space-y-4">
            {/* Breadcrumb + actions */}
            <div className="text-xs text-gray-400">{breadcrumb}</div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold flex-1">{selected.name}</h2>
              <button onClick={() => { setPanelMode('add-sub'); setSubForm({ name: '', description: '', labelEn: '', labelAr: '' }); }} className={`px-3 py-1.5 rounded text-xs ${panelMode === 'add-sub' ? 'bg-green-600 text-white' : 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100'}`}>+ Subcategory</button>
              <button onClick={() => { setPanelMode('add-product'); setProdForm({ name: '', description: '', base_price: '', status: 'draft', labelEn: '', labelAr: '' }); setProdAttrs({}); }} className={`px-3 py-1.5 rounded text-xs ${panelMode === 'add-product' ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100'}`}>+ Product</button>
              <button onClick={startEdit} className="px-3 py-1.5 rounded text-xs bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100">Edit</button>
              <button onClick={async () => { if (confirm('Deactivate?')) { await deleteCategory(selected.id); setSelected(null); reload(); } }} className="px-3 py-1.5 rounded text-xs bg-red-50 text-red-700 border border-red-200 hover:bg-red-100">Deactivate</button>
            </div>

            {/* Category info */}
            {panelMode === 'view' && (
              <div className="bg-white border rounded p-4 text-sm space-y-1">
                <div><strong>Slug:</strong> {selected.slug}</div>
                {selected.description && <div><strong>Description:</strong> {selected.description}</div>}
                {selected.labels && <div><strong>Labels:</strong> {Object.entries(selected.labels).map(([k, v]) => `${k}: ${v}`).join(' | ')}</div>}
                <div><strong>Active:</strong> {selected.is_active ? 'Yes' : 'No'}</div>
              </div>
            )}

            {/* Edit form */}
            {panelMode === 'edit' && (
              <div className="bg-yellow-50 border border-yellow-200 rounded p-4 space-y-2">
                <h3 className="font-semibold text-sm">Edit Category</h3>
                <input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} className="w-full border rounded px-3 py-1.5 text-sm" />
                <input placeholder="Description" value={editForm.description} onChange={e => setEditForm({ ...editForm, description: e.target.value })} className="w-full border rounded px-3 py-1.5 text-sm" />
                <select value={editForm.parent_id} onChange={e => setEditForm({ ...editForm, parent_id: e.target.value })} className="w-full border rounded px-3 py-1.5 text-sm">
                  <option value="">(Root — no parent)</option>
                  {allCatsFlat.filter(c => c.id !== selected.id).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <input placeholder="Label EN" value={editForm.labelEn} onChange={e => setEditForm({ ...editForm, labelEn: e.target.value })} className="border rounded px-3 py-1.5 text-sm" />
                  <input placeholder="Label AR" value={editForm.labelAr} onChange={e => setEditForm({ ...editForm, labelAr: e.target.value })} className="border rounded px-3 py-1.5 text-sm" dir="rtl" />
                </div>
                <div className="flex gap-2">
                  <button onClick={saveEdit} className="bg-green-600 text-white px-3 py-1.5 rounded text-sm">Save</button>
                  <button onClick={() => setPanelMode('view')} className="bg-gray-200 px-3 py-1.5 rounded text-sm">Cancel</button>
                </div>
              </div>
            )}

            {/* Add subcategory form */}
            {panelMode === 'add-sub' && (
              <form onSubmit={handleCreateSub} className="bg-green-50 border border-green-200 rounded p-4 space-y-2">
                <h3 className="font-semibold text-sm">New Subcategory under "{selected.name}"</h3>
                <input placeholder="Name *" value={subForm.name} onChange={e => setSubForm({ ...subForm, name: e.target.value })} className="w-full border rounded px-3 py-1.5 text-sm" required />
                <input placeholder="Description" value={subForm.description} onChange={e => setSubForm({ ...subForm, description: e.target.value })} className="w-full border rounded px-3 py-1.5 text-sm" />
                <div className="grid grid-cols-2 gap-2">
                  <input placeholder="Label EN" value={subForm.labelEn} onChange={e => setSubForm({ ...subForm, labelEn: e.target.value })} className="border rounded px-3 py-1.5 text-sm" />
                  <input placeholder="Label AR" value={subForm.labelAr} onChange={e => setSubForm({ ...subForm, labelAr: e.target.value })} className="border rounded px-3 py-1.5 text-sm" dir="rtl" />
                </div>
                <div className="flex gap-2">
                  <button type="submit" className="bg-green-600 text-white px-3 py-1.5 rounded text-sm">Create Subcategory</button>
                  <button type="button" onClick={() => setPanelMode('view')} className="bg-gray-200 px-3 py-1.5 rounded text-sm">Cancel</button>
                </div>
              </form>
            )}

            {/* Add product form */}
            {panelMode === 'add-product' && (
              <form onSubmit={handleCreateProduct} className="bg-indigo-50 border border-indigo-200 rounded p-4 space-y-2">
                <h3 className="font-semibold text-sm">New Product in "{selected.name}"</h3>
                <input placeholder="Product name *" value={prodForm.name} onChange={e => setProdForm({ ...prodForm, name: e.target.value })} className="w-full border rounded px-3 py-1.5 text-sm" required />
                <input placeholder="Description" value={prodForm.description} onChange={e => setProdForm({ ...prodForm, description: e.target.value })} className="w-full border rounded px-3 py-1.5 text-sm" />
                <input placeholder="Price *" type="number" step="0.01" value={prodForm.base_price} onChange={e => setProdForm({ ...prodForm, base_price: e.target.value })} className="w-full border rounded px-3 py-1.5 text-sm" required />
                <select value={prodForm.status} onChange={e => setProdForm({ ...prodForm, status: e.target.value })} className="w-full border rounded px-3 py-1.5 text-sm">
                  <option value="draft">Draft</option><option value="active">Active</option><option value="archived">Archived</option>
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <input placeholder="Label EN" value={prodForm.labelEn} onChange={e => setProdForm({ ...prodForm, labelEn: e.target.value })} className="border rounded px-3 py-1.5 text-sm" />
                  <input placeholder="Label AR" value={prodForm.labelAr} onChange={e => setProdForm({ ...prodForm, labelAr: e.target.value })} className="border rounded px-3 py-1.5 text-sm" dir="rtl" />
                </div>
                {/* Dynamic attributes */}
                {attrs.length > 0 && (
                  <div className="border-t pt-2 space-y-1.5">
                    <h4 className="text-xs font-semibold text-gray-500">Attributes</h4>
                    {attrs.map(a => (
                      <div key={a.slug} className="flex items-center gap-2 text-sm">
                        <label className="w-28 truncate text-xs">{a.name}{a.is_required && <span className="text-red-500">*</span>}</label>
                        {a.attribute_type === 'boolean' ? (
                          <input type="checkbox" checked={!!prodAttrs[a.slug]} onChange={e => setProdAttrs({ ...prodAttrs, [a.slug]: e.target.checked })} />
                        ) : a.attribute_type === 'select' ? (
                          <select value={prodAttrs[a.slug] || ''} onChange={e => setProdAttrs({ ...prodAttrs, [a.slug]: e.target.value })} className="flex-1 border rounded px-2 py-1 text-xs">
                            <option value="">—</option>{a.options?.map(o => <option key={o} value={o}>{o}</option>)}
                          </select>
                        ) : a.attribute_type === 'number' ? (
                          <input type="number" step="any" value={prodAttrs[a.slug] || ''} onChange={e => setProdAttrs({ ...prodAttrs, [a.slug]: parseFloat(e.target.value) || '' })} className="flex-1 border rounded px-2 py-1 text-xs" />
                        ) : (
                          <input value={prodAttrs[a.slug] || ''} onChange={e => setProdAttrs({ ...prodAttrs, [a.slug]: e.target.value })} className="flex-1 border rounded px-2 py-1 text-xs" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-2">
                  <button type="submit" className="bg-indigo-600 text-white px-3 py-1.5 rounded text-sm">Create Product</button>
                  <button type="button" onClick={() => setPanelMode('view')} className="bg-gray-200 px-3 py-1.5 rounded text-sm">Cancel</button>
                </div>
              </form>
            )}

            {/* Attributes section */}
            <div className="bg-white border rounded p-4">
              <h3 className="font-bold text-sm mb-2">Attributes ({attrs.length})</h3>
              {attrs.length === 0 ? <p className="text-gray-400 text-xs mb-2">None defined.</p> : (
                <ul className="space-y-1.5 mb-3">{attrs.map(a => (
                  <li key={a.id} className="border-b pb-1.5">
                    {editAttrId === a.id ? (
                      <div className="bg-yellow-50 rounded p-2 space-y-1 text-sm">
                        <input value={editAttrForm.name} onChange={e => setEditAttrForm({ ...editAttrForm, name: e.target.value })} className="w-full border rounded px-2 py-1" />
                        {a.options && <input placeholder="Options" value={editAttrForm.options} onChange={e => setEditAttrForm({ ...editAttrForm, options: e.target.value })} className="w-full border rounded px-2 py-1" />}
                        <div className="flex gap-3 text-xs">
                          <label className="flex items-center gap-1"><input type="checkbox" checked={editAttrForm.is_required} onChange={e => setEditAttrForm({ ...editAttrForm, is_required: e.target.checked })} /> Req</label>
                          <label className="flex items-center gap-1"><input type="checkbox" checked={editAttrForm.is_filterable} onChange={e => setEditAttrForm({ ...editAttrForm, is_filterable: e.target.checked })} /> Filter</label>
                        </div>
                        <div className="flex gap-1">
                          <button onClick={saveEditAttr} className="bg-green-600 text-white px-2 py-0.5 rounded text-xs">Save</button>
                          <button onClick={() => setEditAttrId(null)} className="bg-gray-200 px-2 py-0.5 rounded text-xs">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between text-xs">
                        <div>
                          <span className="font-medium">{a.name}</span> <span className="text-gray-400">({a.attribute_type})</span>
                          {a.is_required && <span className="text-red-500 ml-1">*</span>}
                          {a.is_filterable && <span className="text-blue-500 ml-1">filterable</span>}
                          {a.inherited_from_category_id && <span className="text-purple-500 ml-1">inherited</span>}
                          {a.options && <span className="text-gray-400 ml-1">[{a.options.join(', ')}]</span>}
                        </div>
                        {!a.inherited_from_category_id && (
                          <span className="flex gap-1.5">
                            <button onClick={() => { setEditAttrId(a.id); setEditAttrForm({ name: a.name, is_required: a.is_required, is_filterable: a.is_filterable, options: a.options?.join(', ') || '' }); }} className="text-blue-600 hover:underline">edit</button>
                            <button onClick={() => { deleteAttribute(selected.id, a.id).then(() => getCategoryAttributes(selected.id).then(setAttrs)); }} className="text-red-500 hover:underline">del</button>
                          </span>
                        )}
                      </div>
                    )}
                  </li>
                ))}</ul>
              )}
              <form onSubmit={handleAddAttr} className="flex flex-wrap gap-2 items-end border-t pt-2">
                <input placeholder="Name" value={attrForm.name} onChange={e => setAttrForm({ ...attrForm, name: e.target.value })} className="border rounded px-2 py-1 text-xs w-28" required />
                <select value={attrForm.attribute_type} onChange={e => setAttrForm({ ...attrForm, attribute_type: e.target.value })} className="border rounded px-2 py-1 text-xs">
                  <option value="text">Text</option><option value="number">Number</option><option value="boolean">Bool</option>
                  <option value="select">Select</option><option value="multi_select">Multi</option>
                </select>
                {['select', 'multi_select'].includes(attrForm.attribute_type) && (
                  <input placeholder="opts (a,b,c)" value={attrForm.options} onChange={e => setAttrForm({ ...attrForm, options: e.target.value })} className="border rounded px-2 py-1 text-xs w-32" />
                )}
                <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={attrForm.is_required} onChange={e => setAttrForm({ ...attrForm, is_required: e.target.checked })} /> Req</label>
                <button type="submit" className="bg-blue-600 text-white px-2 py-1 rounded text-xs">+ Add</button>
              </form>
            </div>

            {/* Products in this category */}
            <div className="bg-white border rounded p-4">
              <h3 className="font-bold text-sm mb-2">Products ({products.length})</h3>
              {products.length === 0 ? <p className="text-gray-400 text-xs">No products in this category.</p> : (
                <table className="w-full text-xs">
                  <thead className="text-left text-gray-500"><tr><th className="pb-1">Name</th><th className="pb-1">Price</th><th className="pb-1">Status</th><th className="pb-1">Labels</th></tr></thead>
                  <tbody>{products.map(p => (
                    <tr key={p.id} className="border-t">
                      <td className="py-1.5 font-medium">{p.name} <span className="text-gray-400">{p.slug}</span></td>
                      <td className="py-1.5">${p.base_price.toFixed(2)}</td>
                      <td className="py-1.5"><span className={`px-1.5 py-0.5 rounded ${p.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{p.status}</span></td>
                      <td className="py-1.5 text-gray-400">{p.labels ? Object.entries(p.labels).map(([k, v]) => `${k}:${v}`).join(' | ') : '-'}</td>
                    </tr>
                  ))}</tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TreeView({ nodes, selectedId, onSelect, depth }: { nodes: Category[]; selectedId: string | null; onSelect: (c: Category) => void; depth: number }) {
  return (
    <ul className={depth > 0 ? 'ml-4 border-l border-gray-200 pl-2' : ''}>
      {nodes.map(c => (
        <li key={c.id}>
          <div
            onClick={() => onSelect(c)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer text-sm ${selectedId === c.id ? 'bg-blue-100 text-blue-800 font-semibold' : 'hover:bg-gray-100'} ${!c.is_active ? 'opacity-50' : ''}`}
          >
            <span>{c.children && c.children.length > 0 ? '\u25B6' : '\u25CB'}</span>
            <span className="truncate">{c.name}</span>
            {c.labels && <span className="text-[10px] text-gray-400 truncate">{Object.values(c.labels)[0]}</span>}
          </div>
          {c.children && c.children.length > 0 && (
            <TreeView nodes={c.children} selectedId={selectedId} onSelect={onSelect} depth={depth + 1} />
          )}
        </li>
      ))}
    </ul>
  );
}
