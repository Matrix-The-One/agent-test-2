// 普通 HTTP API 的统一响应信封；前端 chatApi 会识别这个结构并解包 data。
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

// 用 metadata 控制某些接口跳过响应包装，例如 /api/agent/stream。
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
