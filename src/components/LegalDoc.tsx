/** Renders a bilingual legal document. Content lives in src/lib/legal.ts (template — needs legal review before publishing to stores). */
import type { LegalDoc as Doc } from "@/lib/legal";
export default function LegalDoc({ doc }: { doc: Doc }) {
  return (
    <article className="card mx-auto max-w-3xl space-y-5 p-6 sm:p-8" data-testid="legal-doc">
      <header>
        <h1 className="font-serif text-3xl font-bold">{doc.title}</h1>
        <p className="mt-1 text-sm text-stone-500">{doc.updated}</p>
        <p className="mt-4 leading-8 text-stone-700">{doc.intro}</p>
      </header>
      {doc.sections.map((s) => (
        <section key={s.h} className="space-y-2">
          <h2 className="text-xl font-bold">{s.h}</h2>
          {s.p.map((p, i) => <p key={i} className="leading-8 text-stone-700">{p}</p>)}
        </section>
      ))}
    </article>
  );
}
