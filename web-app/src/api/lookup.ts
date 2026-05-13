import api from './client';

export interface LookupResult {
  type: 'category' | 'product';
  data: any;
}

export async function lookupByRef(ref: string): Promise<LookupResult> {
  const { data } = await api.get('/lookup', { params: { ref } });
  return data;
}

export async function healthCheck(): Promise<{ status: string }> {
  const { data } = await api.get('/health');
  return data;
}
