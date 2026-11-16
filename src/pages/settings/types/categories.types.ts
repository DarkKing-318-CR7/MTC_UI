export interface Category {
  id: string;
  name: string;
  description: string | null;
  isDefault: boolean;
}

export interface CategoryFormValues {
  name: string;
  description?: string;
}
