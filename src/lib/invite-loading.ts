export const INVITE_TIMEOUT_MS = 10_000;

// Bound the entire operation, including any authentication/storage middleware.
export async function withInviteTimeout<T>(
  operation: (signal: AbortSignal) => PromiseLike<T>,
  timeoutMs = INVITE_TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error("Could not check your invitation. Please try again."));
      controller.abort();
    }, timeoutMs);
  });
  try {
    return await Promise.race([Promise.resolve().then(() => operation(controller.signal)), timeout]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}