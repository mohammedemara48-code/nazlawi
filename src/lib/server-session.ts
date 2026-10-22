import { cookies } from "next/headers";
import { SESSION_COOKIE } from "./constants";
import { verifySession } from "./session";
export async function getServerSession() {
  return verifySession((await cookies()).get(SESSION_COOKIE)?.value);
}
