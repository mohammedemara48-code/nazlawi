import type { Metadata } from "next";
import { asLocale, dict } from "@/lib/i18n";
import VerifyEmail from "@/components/VerifyEmail";
type Props = { params: Promise<{ lang: string }>; searchParams: Promise<{ token?: string }> };
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  return { title: dict(asLocale((await params).lang)).verifyTitle };
}
export default async function Page({ params, searchParams }: Props) {
  return <VerifyEmail lang={asLocale((await params).lang)} token={(await searchParams).token ?? ""} />;
}
