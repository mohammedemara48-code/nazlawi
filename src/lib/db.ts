import { PrismaClient } from "@prisma/client";
import { resolveDatabaseUrl } from "./db-env";
const g = globalThis as unknown as { prisma?: PrismaClient };
const url = resolveDatabaseUrl();
export const prisma = g.prisma ?? new PrismaClient(url ? { datasourceUrl: url } : undefined);
if (process.env.NODE_ENV !== "production") g.prisma = prisma;
