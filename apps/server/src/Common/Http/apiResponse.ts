export type ApiSuccessResponse<T> = {
  success: true;
  data: T;
  errorMsg: "";
};

export type ApiErrorResponse = {
  success: false;
  data: null;
  errorMsg: string;
  errorCode?: string | null;
  errors?: unknown;
};

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export const RAW_RESPONSE_METADATA_KEY = "raw-response";

export const buildSuccessResponse = <T>(data: T): ApiSuccessResponse<T | null> => ({
  data: data ?? null,
  errorMsg: "",
  success: true,
});

export const buildErrorResponse = (options: {
  errorCode?: string | null;
  errorMsg: string;
  errors?: unknown;
}): ApiErrorResponse => ({
  ...(options.errors === undefined ? {} : { errors: options.errors }),
  data: null,
  errorCode: options.errorCode ?? null,
  errorMsg: options.errorMsg,
  success: false,
});
