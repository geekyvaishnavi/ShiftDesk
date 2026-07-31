import { $ } from "bun";
import { mock } from "bun:test";
import { Client } from "pg";

/// `server-only` resolves to a module that throws unless the importer is a
/// React Server Component, which a test runner is not. It exists to keep
/// server code out of the client bundle, and that guard still holds where it
/// matters — the Next build — so here it is replaced with an empty module
/// rather than removed from the files it protects.
mock.module("server-only", () => ({}));

/// Runs once before any test file. The claim rules are enforced by Postgres
/// row locks, so they cannot be tested against a fake — these tests need a real
/// database, and it must not be the one being developed against.
///
/// The URL is derived rather than configured so `bun test` works from a fresh
/// clone with nothing but `docker compose up -d db`.
function testDatabaseUrl(): string {
  const explicit = process.env.TEST_DATABASE_URL;
  if (explicit) return explicit;

  const dev = process.env.DATABASE_URL;
  if (!dev) {
    throw new Error("Set DATABASE_URL (or TEST_DATABASE_URL) before running the tests.");
  }

  const url = new URL(dev);
  url.pathname = `${url.pathname.replace(/^\//, "")}_test`;
  return url.toString();
}

const url = testDatabaseUrl();
const name = new URL(url).pathname.replace(/^\//, "");

// The suite truncates between tests. Refusing anything not named *_test is what
// stands between a stray DATABASE_URL and someone's development data.
if (!name.endsWith("_test")) {
  throw new Error(
    `Refusing to run tests against "${name}": the test database name must end in _test.`,
  );
}

const admin = new URL(url);
admin.pathname = "/postgres";

const client = new Client({ connectionString: admin.toString() });
await client.connect();
const existing = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [name]);
if (existing.rowCount === 0) {
  // Identifiers cannot be parameterised, hence the interpolation. `name` is
  // checked above and comes from the developer's own connection string.
  await client.query(`CREATE DATABASE "${name}"`);
}
await client.end();

await $`bunx prisma migrate deploy`.env({ ...process.env, DATABASE_URL: url }).quiet();

// Set last, so everything the tests import — including the shared client in
// src/lib/prisma.ts — builds against the test database rather than the dev one.
process.env.DATABASE_URL = url;
