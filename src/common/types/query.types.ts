export type FilterOperator =
  | 'eq'
  | 'ne'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'like'
  | 'ilike'
  | 'in'
  | 'nin'
  | 'isNull'
  | 'isNotNull'
  | 'between';

export interface QueryFilter {
  field: string;
  operator: FilterOperator;
  value?: unknown;
}

export interface QuerySort {
  field: string;
  order: 'asc' | 'desc';
}

export interface QueryRelation {
  field: string;
  select?: string[];
}

export interface FindOptions {
  filters?: QueryFilter[];
  sort?: QuerySort[];
  page?: number;
  limit?: number;
  relations?: QueryRelation[];
  select?: string[];
}
