export type BodyReadResult =
  | { ok: true; bytes: Uint8Array }
  | { ok: false; status: 400 | 408 | 413 };

/** Read a small request body with both a byte ceiling and an absolute deadline. */
export async function readBoundedBody(
  request: Request,
  maxBytes = 2_048,
  timeoutMs = 10_000,
): Promise<BodyReadResult> {
  const reader = request.body?.getReader();
  if (!reader) return { ok: false, status: 400 };
  const deadline = Date.now() + timeoutMs;
  let length = 0;
  const chunks: Uint8Array[] = [];
  const cancel = () => { void reader.cancel().catch(() => {}); };
  for (;;) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) { cancel(); return { ok: false, status: 408 }; }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timedOut = new Promise<{ timeout: true }>(resolve => {
      timer = setTimeout(() => resolve({ timeout: true }), remaining);
    });
    let result: ReadableStreamReadResult<Uint8Array> | { timeout: true };
    try {
      result = await Promise.race([
        reader.read().then(value => value as ReadableStreamReadResult<Uint8Array>),
        timedOut,
      ]);
    } catch {
      if (timer) clearTimeout(timer);
      cancel();
      return { ok: false, status: 400 };
    }
    if (timer) clearTimeout(timer);
    if ('timeout' in result) { cancel(); return { ok: false, status: 408 }; }
    if (result.done) break;
    length += result.value.byteLength;
    if (length > maxBytes) { cancel(); return { ok: false, status: 413 }; }
    chunks.push(result.value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return { ok: true, bytes };
}
