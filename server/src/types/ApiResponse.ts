export interface SuccessResponse<T = any> {
  success: true;
  data: T;
  total?: number;
  limit?: number;
  offset?: number;
}

export interface ErrorResponse {
  success: false;
  error: string;
  errorCode: string;
}

export type ApiResponse<T = any> = SuccessResponse<T> | ErrorResponse;
