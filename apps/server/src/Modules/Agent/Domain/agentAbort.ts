export const createAbortError = (message = "Request aborted.") => {
  const error = new Error(message);
  error.name = "AbortError";
  return error;
};

export const isAbortError = (error: unknown): error is Error => {
  if (error instanceof Error) {
    return error.name === "AbortError";
  }

  if (typeof DOMException !== "undefined" && error instanceof DOMException) {
    return error.name === "AbortError";
  }

  return false;
};

export const throwIfAborted = (signal?: AbortSignal) => {
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
