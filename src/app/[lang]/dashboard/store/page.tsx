import { redirect } from "next/navigation";
import { asLocale, href } from "@/lib/i18n";

type Props = { params: Promise<{ lang: string }> };
/** Store settings now live in the dashboard's "Store info" tab. */
export default async function StoreSettings({ params }: Props) {
  redirect(href(asLocale((await params).lang), "/dashboard?tab=info"));
}
