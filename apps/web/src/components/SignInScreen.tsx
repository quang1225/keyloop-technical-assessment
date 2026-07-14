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
    <div className="flex min-h-screen items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-10 shadow-lg"
      >
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="text-sm font-semibold tracking-wide text-[var(--teal)] uppercase"
        >
          Keyloop
        </motion.p>
        <motion.h1
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
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
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25, duration: 0.4 }}
          type="button"
          disabled={loading}
          onClick={handleSignIn}
          className="mt-8 w-full rounded-lg bg-[var(--teal)] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[var(--teal-deep)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Signing in…" : "Sign in as Advisor"}
        </motion.button>
        {error && (
          <p className="mt-4 text-center text-sm text-[var(--danger)]">{error}</p>
        )}
      </motion.div>
    </div>
  );
}
