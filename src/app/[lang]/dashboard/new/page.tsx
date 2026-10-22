import { redirect } from "next/navigation";
import { asLocale, href } from "@/lib/i18n";

type Props = { params: Promise<{ lang: string }> };
/** Products are added from the dashboard's Products tab. */
export default async function NewListing({ params }: Props) {
  redirect(href(asLocale((await params).lang), "/dashboard?tab=products"));
}
