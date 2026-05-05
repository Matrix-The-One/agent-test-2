// Abort 工具统一处理“用户停止生成/连接断开”这类正常中断。
export const createAbortError = (message = "Request aborted.") => {
  const error = new Error(message);
  error.name = "AbortError";
  return error;
};

export const isAbortError = (error: unknown): error is Error => {
  // 不同运行时可能抛 Error 或 DOMException，这里统一按 name 判断。
  if (error instanceof Error) {
    return error.name === "AbortError";
  }

  if (typeof DOMException !== "undefined" && error instanceof DOMException) {
    return error.name === "AbortError";
  }

  return false;
};

export const throwIfAborted = (signal?: AbortSignal) => {
  // 在模型调用、数据库写入、图执行等异步边界前调用，尽早停止无用工作。
  if (!signal?.aborted) {
    return;
  }

  if (signal.reason instanceof Error) {
    throw signal.reason;
  }

  throw createAbortError(
    typeof signal.reason === "string" && signal.reason.length > 0
      ? signal.reason
      : undefined,
  );
};
