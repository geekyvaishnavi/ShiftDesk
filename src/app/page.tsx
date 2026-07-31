import Link from "next/link";

import { ThemeToggle } from "@/components/theme-toggle";
import { Wordmark } from "@/components/wordmark";
import { getCurrentUser } from "@/lib/auth";

/// The root is a public page rather than a redirect: someone arriving at the
/// deployed URL with no session should learn what this is before being asked
/// to sign in. Anyone already signed in gets a way straight back in.
export default async function Home() {
  const user = await getCurrentUser();
  const appHref = user?.role === "manager" ? "/dashboard" : "/shifts";
  const cta = user ? `Continue as ${user.fullName}` : "Sign in";
  const href = user ? appHref : "/login";

  return (
    <div className="bg-canvas relative isolate flex min-h-dvh flex-col overflow-hidden">
      {/* Two soft discs in the wordmark's plum. Kept faint: the page should
          look like the product, and the product has no colour in it that is
          not carrying meaning. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[760px]">
        <div className="bg-glow-a/12 absolute -top-48 -left-40 h-[36rem] w-[36rem] rounded-full blur-[140px] dark:opacity-50" />
        <div className="bg-glow-b/10 absolute -top-32 -right-32 h-[32rem] w-[32rem] rounded-full blur-[140px] dark:opacity-50" />
      </div>

      <header className="mx-auto flex w-full max-w-5xl items-center gap-2.5 px-5 py-4">
        <Wordmark size={22} />
        <span className="text-ink text-[13px] font-semibold">ShiftDesk</span>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <Link
            href={href}
            className="bg-plum flex h-8 items-center rounded-md px-3 text-[13px] font-medium text-white transition hover:opacity-90"
          >
            {user ? "Open ShiftDesk" : "Sign in"}
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-5">
        <section className="max-w-2xl pt-16 pb-2 md:pt-24">
          {/* The same dot the coverage grid uses for a fully staffed shift. */}
         

          <h1 className="text-ink mt-5 text-4xl font-semibold tracking-tight md:text-5xl md:leading-[1.08]">
            Shift scheduling for a clinic.
          </h1>

          <p className="text-muted mt-4 text-[15px] leading-relaxed">
            A manager creates shifts and sets how many doctors, nurses and receptionists each one
            needs. Staff claim the shifts they can cover. Two rules are enforced on the server for
            every claim: a profession cannot be filled beyond what the shift requires, and no one
            can hold two shifts that overlap in time.
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link
              href={href}
              className="bg-plum flex h-10 items-center rounded-md px-5 text-[13px] font-medium text-white transition hover:opacity-90"
            >
              {cta}
            </Link>
            {!user ? (
              <p className="text-muted text-[13px]">
                Seeded manager and staff logins are on the sign-in page.
              </p>
            ) : null}
          </div>
        </section>

        <Section label="What it does">
          <div className="grid gap-2.5 sm:grid-cols-2">
            <Card title="Shifts">
              A shift has a date, a start and end time, and a required count per profession.
              Managers create, edit and delete them. Editing re-checks the claims already on a
              shift and reports which ones it dropped.
            </Card>
            <Card title="Claim rules">
              A claim is refused if that profession is already full, or if it overlaps a shift the
              person holds. Both run inside a transaction that locks the shift row first, so
              simultaneous claims on the last slot cannot all succeed.
            </Card>
            <Card title="Coverage">
              A week view marking every shift fully staffed, partially staffed or empty, and naming
              the roles still missing. Weeks run Monday to Sunday and are addressable by URL.
            </Card>
            <Card title="CSV import">
              Staff and shift files are imported at seed time and by managers through the UI, using
              the same importer. Rows are accepted, merged or rejected; the report lists each
              non-accepted row with its original text and the reason.
            </Card>
          </div>
        </Section>

        <Section label="Who uses it">
          <div className="grid gap-2.5 sm:grid-cols-2">
            <Role
              title="A manager can"
              points={[
                "Create, edit and delete shifts, and set the count each profession needs",
                "Assign a staff member to a shift directly, under the same two rules",
                "See coverage for any week and which roles are still missing",
                "Upload a CSV and read the report of accepted, merged and rejected rows",
              ]}
            />
            <Role
              title="A staff member can"
              points={[
                "See the open shifts their profession still has room on",
                "Claim and release a shift, and read why one was refused",
                "See their own shifts for a week, with hours per day and per week",
                "Act only on themselves — the user id comes from the session",
              ]}
            />
          </div>
        </Section>

        <section className="pt-14 pb-16">
          <div className="border-hairline bg-surface flex flex-wrap items-center gap-4 rounded-lg border p-6">
            <div className="min-w-0 flex-1">
              <h2 className="text-ink text-[15px] font-semibold">
                {user ? "Back to your week" : "Sign in to look around"}
              </h2>
              <p className="text-muted mt-1 text-[13px]">
                {user
                  ? "Managers open on coverage, staff on the shifts they can claim."
                  : "The clinic’s two CSV exports are already imported, so there is a full rota behind the login."}
              </p>
            </div>
            <Link
              href={href}
              className="bg-plum flex h-10 flex-none items-center rounded-md px-5 text-[13px] font-medium text-white transition hover:opacity-90"
            >
              {cta}
            </Link>
          </div>
        </section>
      </main>

      {/* One row: a wordmark and the four routes. A footer with two columns
          of four short links left more empty space than content, and sits on
          a surface fill rather than under a rule so the page still has no
          lines drawn across it. */}
      <footer className="bg-surface/50 mt-16">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-6 gap-y-3 px-5 py-5">
          <div className="flex items-center gap-2">
            <Wordmark size={18} />
            <span className="text-ink text-[13px] font-semibold">ShiftDesk</span>
          </div>

          <nav aria-label="Product" className="flex flex-wrap items-center gap-x-5 gap-y-2 md:ml-auto">
            <FooterLink href="/dashboard">Coverage</FooterLink>
            <FooterLink href="/shifts">Shifts</FooterLink>
            <FooterLink href="/my-shifts">My shifts</FooterLink>
            <FooterLink href="/import">Import</FooterLink>
          </nav>
        </div>
      </footer>
    </div>
  );
}

/// The product links go through the session check like any other route, so a
/// signed-out visitor following one lands on the sign-in page rather than a
/// dead end.
function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-muted hover:text-ink text-[12px] transition">
      {children}
    </Link>
  );
}

/// Sections are titled the way panels are titled inside the app: a small
/// uppercase label rather than a heading competing with the hero.
function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="pt-14">
      <h2 className="text-muted mb-3 text-[11px] font-semibold tracking-wide uppercase">{label}</h2>
      {children}
    </section>
  );
}

/// Same treatment as every panel in the app — hairline border, surface fill,
/// rounded-lg — so the landing page and the product are visibly one thing.
const PANEL = "border-hairline bg-surface rounded-lg border p-5";

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className={PANEL}>
      <h3 className="text-ink text-[14px] font-semibold">{title}</h3>
      <p className="text-muted mt-1.5 text-[13px] leading-relaxed">{children}</p>
    </div>
  );
}

function Role({ title, points }: { title: string; points: string[] }) {
  return (
    <div className={PANEL}>
      <h3 className="text-ink text-[14px] font-semibold">{title}</h3>
      <ul className="mt-3 flex flex-col gap-2">
        {points.map((point) => (
          <li key={point} className="text-muted flex items-start gap-2 text-[13px] leading-relaxed">
            <span className="bg-plum/40 mt-[7px] h-1 w-1 flex-none rounded-full" aria-hidden />
            {point}
          </li>
        ))}
      </ul>
    </div>
  );
}
