export interface Labels {
  [locale: string]: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  labels: Labels | null;
  ref_path: string | null;
  parent_id: string | null;
  is_active: boolean;
  sort_order: number;
  children?: Category[];
  created_at: string;
  updated_at: string;
}

export interface AttributeDefinition {
  id: string;
  category_id: string;
  name: string;
  slug: string;
  labels: Labels | null;
  attribute_type: 'text' | 'number' | 'boolean' | 'select' | 'multi_select';
  is_required: boolean;
  is_filterable: boolean;
  options: string[] | null;
  sort_order: number;
  inherited_from_category_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  labels: Labels | null;
  ref_path: string | null;
  category_id: string;
  base_price: number;
  status: 'draft' | 'active' | 'archived';
  attributes: Record<string, any>;
  images: ProductImage[];
  tags: Tag[];
  created_at: string;
  updated_at: string;
}

export interface ProductImage {
  id: string;
  product_id: string;
  url: string;
  alt_text: string | null;
  sort_order: number;
  created_at: string;
}

export interface Tag {
  id: string;
  name: string;
  slug: string;
}

export interface User {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'superadmin';
  is_active: boolean;
  created_at: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}
