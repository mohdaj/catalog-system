import api from './client';
import type { Product, PaginatedResponse } from '../types';

export async function listProducts(params?: {
  category_id?: string;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<PaginatedResponse<Product>> {
  const { data } = await api.get('/products', { params });
  return data;
}

export async function getProduct(id: string): Promise<Product> {
  const { data } = await api.get(`/products/${id}`);
  return data;
}

export async function createProduct(payload: {
  name: string;
  category_id: string;
  base_price: number;
  status?: string;
  description?: string;
  labels?: Record<string, string>;
  attributes?: Record<string, any>;
}): Promise<Product> {
  const { data } = await api.post('/products', payload);
  return data;
}

export async function updateProduct(
  id: string,
  payload: Partial<{
    name: string;
    description: string;
    labels: Record<string, string>;
    base_price: number;
    status: string;
    attributes: Record<string, any>;
  }>,
): Promise<Product> {
  const { data } = await api.put(`/products/${id}`, payload);
  return data;
}

export async function deleteProduct(id: string): Promise<void> {
  await api.delete(`/products/${id}`);
}

export async function searchProducts(q: string, limit = 20): Promise<PaginatedResponse<Product>> {
  const { data } = await api.get('/products/search', { params: { q, limit } });
  return data;
}

// --- Tags ---

export async function listTags(): Promise<{ id: string; name: string; slug: string }[]> {
  const { data } = await api.get('/tags');
  return data;
}

export async function createTag(name: string): Promise<{ id: string; name: string; slug: string }> {
  const { data } = await api.post('/tags', { name });
  return data;
}

export async function attachTag(productId: string, tagId: string): Promise<void> {
  await api.post(`/products/${productId}/tags`, { tag_id: tagId });
}

export async function detachTag(productId: string, tagId: string): Promise<void> {
  await api.delete(`/products/${productId}/tags/${tagId}`);
}
