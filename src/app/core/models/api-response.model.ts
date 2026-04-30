export interface ApiResponse<T> {
  success: boolean;
  statusCode?: number;
  message?: string | null;
  errors?: string[] | null;
  data?: T | null;
  pageIndex?: number | null;
  pageSize?: number | null;
  totalCount?: number | null;
}
