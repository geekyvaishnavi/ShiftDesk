/// A 24-hour ring with one shift block filled — a day, and the part of it that
/// is covered. The faint ring is the rest of the day still to staff. Stroke
/// weights are set so the filled arc still reads at 20px in the sidebar.
export function Wordmark({ size = 24 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="bg-plum flex flex-none items-center justify-center"
      style={{ width: size, height: size, borderRadius: size * 0.29 }}
    >
      <svg
        width={size * 0.63}
        height={size * 0.63}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        className="text-white"
        role="presentation"
      >
        <circle cx="12" cy="12" r="8.4" strokeWidth="2.6" opacity=".45" />
        <path d="M12 3.6a8.4 8.4 0 0 1 8.4 8.4" strokeWidth="4" strokeLinecap="round" />
      </svg>
    </span>
  );
}
