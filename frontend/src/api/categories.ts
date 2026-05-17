import api from './axios';

export interface SubcategoryDto {
  id: string;
  name: string;
  color?: string;
}

export interface CategoryDto {
  id: string;
  name: string;
  color?: string;
  subcategories: SubcategoryDto[];
}

export async function getCategories(groupId: string): Promise<CategoryDto[]> {
  const res = await api.get<{ data: CategoryDto[] }>(`/api/groups/${groupId}/categories`);
  return res.data.data;
}
