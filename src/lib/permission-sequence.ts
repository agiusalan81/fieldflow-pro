/** A timed-out prompt is still browser-owned: never open another prompt over it. */
export async function boundedPermission<T>(request: () => Promise<T>, ms = 5000): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([request(), new Promise<null>(resolve => { timer = setTimeout(() => resolve(null), ms); })]);
  } catch { return null; }
  finally { clearTimeout(timer); }
}

export async function permissionSequence<T>(push: () => Promise<T>, location: () => Promise<void>) {
  const result = await boundedPermission(push);
  if (result !== null) await boundedPermission(location);
  return result;
}