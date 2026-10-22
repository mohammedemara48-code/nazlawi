"use client";
/** Small fetch wrapper for client components: returns { ok, data, error } with the localized API error. */
export async function apiCall<T = Record<string, unknown>>(url: string, lang: string, init: { method?: string; body?: unknown; form?: FormData; timeoutMs?: number } = {}) {
  const sep = url.includes("?") ? "&" : "?";
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), init.timeoutMs ?? 60_000);
  try {
    const r = await fetch(`${url}${sep}lang=${lang}`, {
      signal: ctl.signal,
      method: init.method ?? (init.body || init.form ? "POST" : "GET"),
      headers: init.form ? undefined : { "Content-Type": "application/json" },
      body: init.form ?? (init.body === undefined ? undefined : JSON.stringify(init.body)),
    });
    const data = r.status === 204 ? null : await r.json().catch(() => null);
    if (!r.ok) return { ok: false as const, data: null, error: (data?.error?.message as string) ?? (lang === "en" ? "Something went wrong" : "حدث خطأ"), details: (data?.error?.details ?? []) as { field: string; message: string }[] };
    return { ok: true as const, data: data as T, error: null, details: [] };
  } catch (e) {
    const timedOut = e instanceof DOMException && e.name === "AbortError";
    return { ok: false as const, data: null, error: timedOut ? (lang === "en" ? "The server took too long to respond. Please try again." : "السيرفر اتأخر في الرد. حاول مرة تانية.") : (lang === "en" ? "Network error" : "مشكلة في الاتصال"), details: [] };
  } finally {
    clearTimeout(timer);
  }
}
