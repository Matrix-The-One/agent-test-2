import { SetMetadata } from "@nestjs/common";

import { RAW_RESPONSE_METADATA_KEY } from "../Http/apiResponse.js";

// 标记某个 Controller/Handler 返回原始响应，例如 SSE。
// 全局 ApiResponseInterceptor 会读取这个 metadata 并跳过 JSON envelope 包装。
export const RawResponse = () => SetMetadata(RAW_RESPONSE_METADATA_KEY, true);
