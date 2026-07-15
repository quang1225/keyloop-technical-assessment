import { useState } from "react";
import { motion } from "motion/react";
import { demoLogin, type Advisor } from "@/lib/api";
import { saveAdvisor } from "@/lib/auth";

type Props = {
  onSuccess: (advisor: Advisor) => void;
};

export function SignInScreen({ onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignIn() {
    setLoading(true);
    setError(null);
    try {
      const advisor = await demoLogin();
      saveAdvisor(advisor);
      onSuccess(advisor);
    } catch {
      setError("Could not sign in. Is the API running?");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="signin-stage relative flex h-dvh items-center justify-center overflow-hidden p-6">
      <div className="signin-grid pointer-events-none absolute inset-0" aria-hidden />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -left-24 top-16 h-64 w-64 rounded-full bg-[var(--teal)]/15 blur-3xl"
        animate={{ x: [0, 24, 0], y: [0, 12, 0] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -right-16 bottom-10 h-72 w-72 rounded-full bg-[var(--bg-accent)]/80 blur-3xl"
        animate={{ x: [0, -18, 0], y: [0, -14, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)]/95 p-10 shadow-xl backdrop-blur-sm"
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 16, delay: 0.05 }}
          className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--teal)] text-lg font-bold text-white shadow-md"
        >
          K
        </motion.div>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="text-sm font-semibold tracking-wide text-[var(--teal)] uppercase"
        >
          Keyloop
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.4 }}
          className="mt-2 text-3xl font-semibold text-[var(--ink)]"
        >
          Service Desk
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="mt-3 text-[var(--muted)]"
        >
          Sign in to manage service appointments for your dealership.
        </motion.p>
        <motion.ul
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25, duration: 0.4 }}
          className="mt-5 space-y-1.5 text-xs text-[var(--muted)]"
        >
          <li className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--teal)]" />
            Bay + technician conflict-safe booking
          </li>
          <li className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--teal)]" />
            Live day board with free-slot highlights
          </li>
          <li className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--teal)]" />
            Skill-qualified technician assignment
          </li>
        </motion.ul>
        <motion.button
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          type="button"
          disabled={loading}
          onClick={handleSignIn}
          whileTap={{ scale: 0.98 }}
          className="mt-8 w-full rounded-lg bg-[var(--teal)] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--teal-deep)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Signing in…" : "Sign in as Advisor"}
        </motion.button>
        {error && <p className="mt-4 text-center text-sm text-[var(--danger)]">{error}</p>}
      </motion.div>
    </div>
  );
}
