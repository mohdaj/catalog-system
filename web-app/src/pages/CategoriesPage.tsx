import { useEffect, useState } from 'react';
import { getCategoryTree, createCategory, deleteCategory } from '../api/categories';
import type { Category } from '../types';

export default function CategoriesPage() {
  const [tree, setTree] = useState<Category[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [parentId, setParentId] = useState<string | undefined>();
  const [formName, setFormName] = useState('');
  const [formLabelEn, setFormLabelEn] = useState('');
  const [formLabelAr, setFormLabelAr] = useState('');

  const reload = () => getCategoryTree().then(setTree);
  useEffect(() => { reload(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const labels: Record<string, string> = {};
    if (formLabelEn) labels.en = formLabelEn;
    if (formLabelAr) labels.ar = formLabelAr;
    await createCategory({
      name: formName,
      parent_id: parentId,
      labels: Object.keys(labels).length > 0 ? labels : undefined,
    });
    setFormName(''); setFormLabelEn(''); setFormLabelAr('');
    setShowForm(false); setParentId(undefined);
    reload();
  };

  const handleDelete = async (id: string) => {
    if (confirm('Deactivate this category?')) {
      await deleteCategory(id);
      reload();
    }
  };

  const openCreateChild = (pid: string) => {
    setParentId(pid);
    setShowForm(true);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Categories</h1>
        <button
          onClick={() => { setParentId(undefined); setShowForm(true); }}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          + Root Category
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white border rounded-lg p-4 mb-6 max-w-lg space-y-3">
          <h3 className="font-semibold">{parentId ? 'New Subcategory' : 'New Root Category'}</h3>
          <input placeholder="Name *" value={formName} onChange={(e) => setFormName(e.target.value)}
            className="w-full border rounded px-3 py-2" required />
          <input placeholder="Label (English)" value={formLabelEn} onChange={(e) => setFormLabelEn(e.target.value)}
            className="w-full border rounded px-3 py-2" />
          <input placeholder="Label (Arabic)" value={formLabelAr} onChange={(e) => setFormLabelAr(e.target.value)}
            className="w-full border rounded px-3 py-2" dir="rtl" />
          <div className="flex gap-2">
            <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">Create</button>
            <button type="button" onClick={() => setShowForm(false)} className="bg-gray-300 px-4 py-2 rounded">Cancel</button>
          </div>
        </form>
      )}

      <div className="bg-white border rounded-lg p-4">
        {tree.length === 0 ? (
          <p className="text-gray-500">No categories yet. Create one above.</p>
        ) : (
          <TreeNode nodes={tree} onAddChild={openCreateChild} onDelete={handleDelete} depth={0} />
        )}
      </div>
    </div>
  );
}

function TreeNode({
  nodes, onAddChild, onDelete, depth,
}: {
  nodes: Category[]; onAddChild: (id: string) => void; onDelete: (id: string) => void; depth: number;
}) {
  return (
    <ul className={depth > 0 ? 'ml-6 border-l border-gray-200 pl-4' : ''}>
      {nodes.map((cat) => (
        <li key={cat.id} className="py-2">
          <div className="flex items-center gap-2">
            <span className="font-medium">{cat.name}</span>
            <span className="text-xs text-gray-400">{cat.slug}</span>
            {cat.labels && (
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                {Object.entries(cat.labels).map(([k, v]) => `${k}: ${v}`).join(' | ')}
              </span>
            )}
            {!cat.is_active && <span className="text-xs text-red-500">(inactive)</span>}
            <button onClick={() => onAddChild(cat.id)} className="text-xs text-blue-600 hover:underline ml-2">+ child</button>
            <button onClick={() => onDelete(cat.id)} className="text-xs text-red-500 hover:underline">deactivate</button>
          </div>
          {cat.children && cat.children.length > 0 && (
            <TreeNode nodes={cat.children} onAddChild={onAddChild} onDelete={onDelete} depth={depth + 1} />
          )}
        </li>
      ))}
    </ul>
  );
}
