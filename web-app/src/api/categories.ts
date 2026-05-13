import api from './client';
import type { Category, AttributeDefinition } from '../types';

export async function getCategoryTree(): Promise<Category[]> {
  const { data } = await api.get('/categories?tree=true');
  return data;
}

export async function getCategory(id: string): Promise<Category> {
  const { data } = await api.get(`/categories/${id}`);
  return data;
}

export async function createCategory(payload: {
  name: string;
  description?: string;
  labels?: Record<string, string>;
  parent_id?: string;
}): Promise<Category> {
  const { data } = await api.post('/categories', payload);
  return data;
}

export async function updateCategory(
  id: string,
  payload: Partial<{ name: string; description: string; labels: Record<string, string>; is_active: boolean }>,
): Promise<Category> {
  const { data } = await api.put(`/categories/${id}`, payload);
  return data;
}

export async function deleteCategory(id: string): Promise<void> {
  await api.delete(`/categories/${id}`);
}

export async function getCategoryAttributes(id: string): Promise<AttributeDefinition[]> {
  const { data } = await api.get(`/categories/${id}/attributes`);
  return data;
}

export async function createAttribute(
  categoryId: string,
  payload: { name: string; attribute_type: string; is_required?: boolean; options?: string[]; labels?: Record<string, string> },
): Promise<AttributeDefinition> {
  const { data } = await api.post(`/categories/${categoryId}/attributes`, payload);
  return data;
}
