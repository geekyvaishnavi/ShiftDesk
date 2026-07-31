import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "@/generated/prisma/client";

function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");

  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function client(): PrismaClient {
  // Held on globalThis so a dev server's hot reloads reuse one client rather
  // than opening a new pool on every reload.
  globalForPrisma.prisma ??= createClient();
  return globalForPrisma.prisma;
}

/// Built on first use rather than at import. `next build` loads every route
/// module to collect page data, and a build machine has no database — creating
/// the client at module scope turned a missing DATABASE_URL into a failed
/// build instead of a failed request.
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const value = Reflect.get(client(), property);
    // Methods keep their receiver: `prisma.$transaction(...)` must run against
    // the client, not against this proxy.
    return typeof value === "function" ? value.bind(client()) : value;
  },
});
