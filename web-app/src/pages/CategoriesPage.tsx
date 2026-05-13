import { useEffect, useState } from 'react';
import {
  getCategoryTree, createCategory, updateCategory, deleteCategory,
  getCategoryAttributes, createAttribute, updateAttribute, deleteAttribute, getCategoryAncestors,
} from '../api/categories';
import type { Category, AttributeDefinition } from '../types';

export default function CategoriesPage() {
  const [tree, setTree] = useState<Category[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [parentId, setParentId] = useState<string | undefined>();
  const [form, setForm] = useState({ name: '', description: '', labelEn: '', labelAr: '' });
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', description: '', labelEn: '', labelAr: '' });
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);
  const [attrs, setAttrs] = useState<AttributeDefinition[]>([]);
  const [ancestors, setAncestors] = useState<Category[]>([]);
  const [attrForm, setAttrForm] = useState({ name: '', attribute_type: 'text', is_required: false, is_filterable: false, options: '', labelEn: '', labelAr: '' });
  const [editAttrId, setEditAttrId] = useState<string | null>(null);
  const [editAttrForm, setEditAttrForm] = useState({ name: '', is_required: false, is_filterable: false, options: '' });

  const reload = () => getCategoryTree().then(setTree);
  useEffect(() => { reload(); }, []);

  const loadAttrs = (catId: string) => {
    setSelectedCatId(catId);
    getCategoryAttributes(catId).then(setAttrs);
    getCategoryAncestors(catId).then(setAncestors);
  };

  const mkLabels = (en: string, ar: string) => {
    const l: Record<string, string> = {}; if (en) l.en = en; if (ar) l.ar = ar;
    return Object.keys(l).length ? l : undefined;
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await createCategory({ name: form.name, description: form.description || undefined, parent_id: parentId, labels: mkLabels(form.labelEn, form.labelAr) });
    setForm({ name: '', description: '', labelEn: '', labelAr: '' }); setShowForm(false); setParentId(undefined); reload();
  };

  const startEdit = (c: Category) => {
    setEditId(c.id);
    setEditForm({ name: c.name, description: c.description || '', labelEn: c.labels?.en || '', labelAr: c.labels?.ar || '' });
  };

  const saveEdit = async () => {
    if (!editId) return;
    await updateCategory(editId, { name: editForm.name, description: editForm.description, labels: mkLabels(editForm.labelEn, editForm.labelAr) ?? {} });
    setEditId(null); reload();
  };

  const handleAddAttr = async (e: React.FormEvent) => {
    e.preventDefault(); if (!selectedCatId) return;
    const opts = attrForm.options.trim() ? attrForm.options.split(',').map(s => s.trim()) : undefined;
    await createAttribute(selectedCatId, {
      name: attrForm.name, attribute_type: attrForm.attribute_type,
      is_required: attrForm.is_required, options: opts,
      labels: mkLabels(attrForm.labelEn, attrForm.labelAr),
    });
    setAttrForm({ name: '', attribute_type: 'text', is_required: false, is_filterable: false, options: '', labelEn: '', labelAr: '' });
    loadAttrs(selectedCatId);
  };

  const startEditAttr = (a: AttributeDefinition) => {
    setEditAttrId(a.id);
    setEditAttrForm({ name: a.name, is_required: a.is_required, is_filterable: a.is_filterable, options: a.options?.join(', ') || '' });
  };

  const saveEditAttr = async () => {
    if (!editAttrId || !selectedCatId) return;
    const opts = editAttrForm.options.trim() ? editAttrForm.options.split(',').map(s => s.trim()) : undefined;
    await updateAttribute(selectedCatId, editAttrId, { name: editAttrForm.name, is_required: editAttrForm.is_required, is_filterable: editAttrForm.is_filterable, options: opts });
    setEditAttrId(null); loadAttrs(selectedCatId);
  };

  const selectedCatName = (() => {
    const find = (nodes: Category[]): string | null => {
      for (const n of nodes) {
        if (n.id === selectedCatId) return n.name;
        if (n.children) { const r = find(n.children); if (r) return r; }
      }
      return null;
    };
    return find(tree);
  })();

  return (
    <div className="flex gap-6">
      <div className="flex-1">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">Categories</h1>
          <button onClick={() => { setParentId(undefined); setShowForm(true); }} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">+ Root Category</button>
        </div>
        {showForm && (
          <form onSubmit={handleCreate} className="bg-white border rounded p-4 mb-4 space-y-2">
            <h3 className="font-semibold text-sm">{parentId ? 'New Subcategory' : 'New Root Category'}</h3>
            <input placeholder="Name *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full border rounded px-3 py-1.5 text-sm" required />
            <input placeholder="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="w-full border rounded px-3 py-1.5 text-sm" />
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
        <div className="bg-white border rounded p-4">
          {tree.length === 0 ? <p className="text-gray-500 text-sm">No categories yet.</p> : (
            <CatTree nodes={tree} onAddChild={pid => { setParentId(pid); setShowForm(true); }}
              onDelete={async id => { if (confirm('Deactivate?')) { await deleteCategory(id); reload(); } }}
              onEdit={startEdit} onSelect={loadAttrs} editId={editId} editForm={editForm}
              setEditForm={setEditForm} onSave={saveEdit} onCancel={() => setEditId(null)} selId={selectedCatId} depth={0} />
          )}
        </div>
      </div>

      {/* Attributes panel */}
      {selectedCatId && (
        <div className="w-[420px] bg-white border rounded p-4 h-fit sticky top-6">
          {/* Breadcrumb */}
          <div className="text-xs text-gray-400 mb-1">
            {ancestors.map(a => a.name).concat(selectedCatName ? [selectedCatName] : []).join(' > ')}
          </div>
          <h2 className="font-bold mb-3">Attributes — {selectedCatName}</h2>

          {attrs.length === 0 ? <p className="text-gray-500 text-sm mb-3">No attributes.</p> : (
            <ul className="space-y-2 mb-4">{attrs.map(a => (
              <li key={a.id} className="border-b pb-2">
                {editAttrId === a.id ? (
                  <div className="bg-yellow-50 border border-yellow-200 rounded p-2 space-y-1 text-sm">
                    <input value={editAttrForm.name} onChange={e => setEditAttrForm({ ...editAttrForm, name: e.target.value })} className="w-full border rounded px-2 py-1" />
                    {a.options && <input placeholder="Options" value={editAttrForm.options} onChange={e => setEditAttrForm({ ...editAttrForm, options: e.target.value })} className="w-full border rounded px-2 py-1" />}
                    <div className="flex gap-3">
                      <label className="flex items-center gap-1"><input type="checkbox" checked={editAttrForm.is_required} onChange={e => setEditAttrForm({ ...editAttrForm, is_required: e.target.checked })} /> Required</label>
                      <label className="flex items-center gap-1"><input type="checkbox" checked={editAttrForm.is_filterable} onChange={e => setEditAttrForm({ ...editAttrForm, is_filterable: e.target.checked })} /> Filterable</label>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={saveEditAttr} className="bg-green-600 text-white px-2 py-0.5 rounded text-xs">Save</button>
                      <button onClick={() => setEditAttrId(null)} className="bg-gray-200 px-2 py-0.5 rounded text-xs">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between text-sm">
                    <div>
                      <span className="font-medium">{a.name}</span> <span className="text-gray-400">({a.attribute_type})</span>
                      {a.is_required && <span className="text-red-500 ml-1">*req</span>}
                      {a.is_filterable && <span className="text-blue-500 ml-1">filterable</span>}
                      {a.inherited_from_category_id && <span className="text-xs text-purple-500 ml-1">inherited</span>}
                      {a.options && <div className="text-xs text-gray-400">[{a.options.join(', ')}]</div>}
                      {a.labels && <div className="text-xs text-gray-400">{Object.entries(a.labels).map(([k, v]) => `${k}:${v}`).join(' | ')}</div>}
                    </div>
                    {!a.inherited_from_category_id && (
                      <span className="flex gap-1.5">
                        <button onClick={() => startEditAttr(a)} className="text-blue-600 text-xs hover:underline">edit</button>
                        <button onClick={() => { deleteAttribute(selectedCatId!, a.id).then(() => loadAttrs(selectedCatId!)); }} className="text-red-500 text-xs hover:underline">del</button>
                      </span>
                    )}
                  </div>
                )}
              </li>
            ))}</ul>
          )}

          <form onSubmit={handleAddAttr} className="space-y-2 border-t pt-3">
            <h3 className="text-sm font-semibold">Add Attribute</h3>
            <input placeholder="Name" value={attrForm.name} onChange={e => setAttrForm({ ...attrForm, name: e.target.value })} className="w-full border rounded px-2 py-1 text-sm" required />
            <select value={attrForm.attribute_type} onChange={e => setAttrForm({ ...attrForm, attribute_type: e.target.value })} className="w-full border rounded px-2 py-1 text-sm">
              <option value="text">Text</option><option value="number">Number</option><option value="boolean">Boolean</option>
              <option value="select">Select</option><option value="multi_select">Multi Select</option>
            </select>
            {['select', 'multi_select'].includes(attrForm.attribute_type) && (
              <input placeholder="Options (comma separated)" value={attrForm.options} onChange={e => setAttrForm({ ...attrForm, options: e.target.value })} className="w-full border rounded px-2 py-1 text-sm" />
            )}
            <div className="flex gap-3 text-sm">
              <label className="flex items-center gap-1"><input type="checkbox" checked={attrForm.is_required} onChange={e => setAttrForm({ ...attrForm, is_required: e.target.checked })} /> Required</label>
              <label className="flex items-center gap-1"><input type="checkbox" checked={attrForm.is_filterable} onChange={e => setAttrForm({ ...attrForm, is_filterable: e.target.checked })} /> Filterable</label>
            </div>
            <div className="grid grid-cols-2 gap-1">
              <input placeholder="Label EN" value={attrForm.labelEn} onChange={e => setAttrForm({ ...attrForm, labelEn: e.target.value })} className="border rounded px-2 py-1 text-sm" />
              <input placeholder="Label AR" value={attrForm.labelAr} onChange={e => setAttrForm({ ...attrForm, labelAr: e.target.value })} className="border rounded px-2 py-1 text-sm" dir="rtl" />
            </div>
            <button type="submit" className="bg-blue-600 text-white px-3 py-1 rounded text-sm w-full">Add Attribute</button>
          </form>
        </div>
      )}
    </div>
  );
}

function CatTree({ nodes, onAddChild, onDelete, onEdit, onSelect, editId, editForm, setEditForm, onSave, onCancel, selId, depth }: any) {
  return (
    <ul className={depth > 0 ? 'ml-5 border-l border-gray-200 pl-3' : ''}>
      {nodes.map((c: Category) => (
        <li key={c.id} className="py-1">
          {editId === c.id ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded p-2 space-y-1">
              <input value={editForm.name} onChange={(e: any) => setEditForm({ ...editForm, name: e.target.value })} className="w-full border rounded px-2 py-1 text-sm" />
              <input placeholder="Description" value={editForm.description} onChange={(e: any) => setEditForm({ ...editForm, description: e.target.value })} className="w-full border rounded px-2 py-1 text-sm" />
              <div className="grid grid-cols-2 gap-1">
                <input placeholder="EN" value={editForm.labelEn} onChange={(e: any) => setEditForm({ ...editForm, labelEn: e.target.value })} className="border rounded px-2 py-1 text-sm" />
                <input placeholder="AR" value={editForm.labelAr} onChange={(e: any) => setEditForm({ ...editForm, labelAr: e.target.value })} className="border rounded px-2 py-1 text-sm" dir="rtl" />
              </div>
              <div className="flex gap-1">
                <button onClick={onSave} className="bg-green-600 text-white px-2 py-0.5 rounded text-xs">Save</button>
                <button onClick={onCancel} className="bg-gray-200 px-2 py-0.5 rounded text-xs">Cancel</button>
              </div>
            </div>
          ) : (
            <div className={`flex items-center gap-1.5 text-sm rounded px-1 py-0.5 ${selId === c.id ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
              <span className="font-medium cursor-pointer" onClick={() => onSelect(c.id)}>{c.name}</span>
              <span className="text-xs text-gray-400">{c.slug}</span>
              {c.labels && <span className="text-xs bg-blue-100 text-blue-700 px-1.5 rounded">{Object.entries(c.labels).map(([k, v]: any) => `${k}:${v}`).join(' | ')}</span>}
              {!c.is_active && <span className="text-xs text-red-500">(off)</span>}
              <span className="ml-auto flex gap-1.5 shrink-0">
                <button onClick={() => onEdit(c)} className="text-xs text-blue-600 hover:underline">edit</button>
                <button onClick={() => onAddChild(c.id)} className="text-xs text-green-600 hover:underline">+child</button>
                <button onClick={() => onDelete(c.id)} className="text-xs text-red-500 hover:underline">off</button>
              </span>
            </div>
          )}
          {c.children?.length > 0 && <CatTree nodes={c.children} onAddChild={onAddChild} onDelete={onDelete} onEdit={onEdit} onSelect={onSelect} editId={editId} editForm={editForm} setEditForm={setEditForm} onSave={onSave} onCancel={onCancel} selId={selId} depth={depth + 1} />}
        </li>
      ))}
    </ul>
  );
}
