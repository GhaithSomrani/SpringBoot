import api from './axios';

export interface SubcategoryDto {
  id: string;
  name: string;
}

export interface CategoryDto {
  id: string;
  name: string;
  color?: string;
  icon?: string;
  subcategories: SubcategoryDto[];
}

export interface CreateCategoryPayload {
  name: string;
  color?: string;
  icon?: string;
}

export interface CreateSubcategoryPayload {
  name: string;
}

const base = (groupId: string) => `/api/groups/${groupId}/categories`;

export async function getCategories(groupId: string): Promise<CategoryDto[]> {
  const res = await api.get<{ data: CategoryDto[] }>(base(groupId));
  return res.data.data;
}

export async function createCategory(
  groupId: string,
  payload: CreateCategoryPayload,
): Promise<CategoryDto> {
  const res = await api.post<{ data: CategoryDto }>(base(groupId), payload);
  return res.data.data;
}

export async function updateCategory(
  groupId: string,
  catId: string,
  payload: Partial<CreateCategoryPayload>,
): Promise<CategoryDto> {
  const res = await api.put<{ data: CategoryDto }>(`${base(groupId)}/${catId}`, payload);
  return res.data.data;
}

export async function deleteCategory(groupId: string, catId: string): Promise<void> {
  await api.delete(`${base(groupId)}/${catId}`);
}

export async function addSubcategory(
  groupId: string,
  catId: string,
  payload: CreateSubcategoryPayload,
): Promise<CategoryDto> {
  const res = await api.post<{ data: CategoryDto }>(
    `${base(groupId)}/${catId}/subcategories`,
    payload,
  );
  return res.data.data;
}

export async function updateSubcategory(
  groupId: string,
  catId: string,
  subId: string,
  payload: CreateSubcategoryPayload,
): Promise<CategoryDto> {
  const res = await api.put<{ data: CategoryDto }>(
    `${base(groupId)}/${catId}/subcategories/${subId}`,
    payload,
  );
  return res.data.data;
}

export async function deleteSubcategory(
  groupId: string,
  catId: string,
  subId: string,
): Promise<CategoryDto> {
  const res = await api.delete<{ data: CategoryDto }>(
    `${base(groupId)}/${catId}/subcategories/${subId}`,
  );
  return res.data.data;
}
