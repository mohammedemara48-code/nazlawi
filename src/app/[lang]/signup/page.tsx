import type { Metadata } from "next";
import { asLocale, dict } from "@/lib/i18n";
import AuthForm from "@/components/AuthForm";
type Props = { params: Promise<{ lang: string }>; searchParams: Promise<{ next?: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: dict(asLocale((await params).lang)).signup };
}
export default async function Page({ params, searchParams }: Props) {
  return <AuthForm lang={asLocale((await params).lang)} mode="signup" next={(await searchParams).next} />;
}
