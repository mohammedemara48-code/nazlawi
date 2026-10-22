"use client";
/** Small fetch wrapper for client components: returns { ok, data, error } with the localized API error. */
export async function apiCall<T = Record<string, unknown>>(url: string, lang: string, init: { method?: string; body?: unknown; form?: FormData } = {}) {
  const sep = url.includes("?") ? "&" : "?";
  try {
    const r = await fetch(`${url}${sep}lang=${lang}`, {
      method: init.method ?? (init.body || init.form ? "POST" : "GET"),
      headers: init.form ? undefined : { "Content-Type": "application/json" },
      body: init.form ?? (init.body === undefined ? undefined : JSON.stringify(init.body)),
    });
    const data = r.status === 204 ? null : await r.json().catch(() => null);
    if (!r.ok) return { ok: false as const, data: null, error: (data?.error?.message as string) ?? (lang === "en" ? "Something went wrong" : "حدث خطأ"), details: (data?.error?.details ?? []) as { field: string; message: string }[] };
    return { ok: true as const, data: data as T, error: null, details: [] };
  } catch {
    return { ok: false as const, data: null, error: lang === "en" ? "Network error" : "مشكلة في الاتصال", details: [] };
  }
}
