"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ThozhanLogo from "@/components/thozhan/ThozhanLogo";
import {
  Mail,
  Lock,
  User,
  ArrowRight,
  ArrowLeft,
  CheckCircle,
  Eye,
  EyeOff,
  Loader2,
  Sparkles,
  Check,
} from "lucide-react";

export default function SignupPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function handleSignup(
    e: React.FormEvent<HTMLFormElement>
  ) {
    e.preventDefault();

    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 6) {
      setError(
        "Password must contain at least 6 characters."
      );
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();

      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            name: name.trim(),
          },
        },
      });

      if (error) {
        setError(error.message);
        return;
      }

      setSuccess(true);
    } catch (caught) {
      console.error("Signup error:", caught);

      setError(
        caught instanceof Error
          ? caught.message
          : "Something went wrong while creating your account."
      );
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <main className="min-h-screen bg-[#F7F7F5] text-[#18181B] flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-[440px]">
          <div className="flex justify-center mb-10">
            <ThozhanLogo />
          </div>

          <div className="rounded-[24px] border border-[#E5E5E1] bg-white p-8 sm:p-10 text-center shadow-[0_18px_60px_rgba(24,24,27,0.05)]">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50">
              <CheckCircle
                size={27}
                className="text-emerald-600"
              />
            </div>

            <p className="mt-7 text-xs font-semibold uppercase tracking-[0.18em] text-[#625ED1]">
              Almost there
            </p>

            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em]">
              Check your email
            </h1>

            <p className="mt-4 text-sm leading-6 text-zinc-500">
              We sent a confirmation link to
            </p>

            <p className="mt-1 break-all text-sm font-semibold text-zinc-800">
              {email}
            </p>

            <p className="mt-5 text-sm leading-6 text-zinc-500">
              Confirm your email address to activate your
              Thozhan account.
            </p>

            <button
              type="button"
              onClick={() => router.push("/")}
              className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-[#5753C9] py-3.5 text-sm font-medium text-white transition hover:bg-[#4D49BA]"
            >
              Back to sign in
              <ArrowRight size={17} />
            </button>
          </div>

          <p className="mt-7 text-center text-[11px] text-zinc-400">
            தோழன் · Always with you
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F7F7F5] text-[#18181B]">
      <div className="min-h-screen lg:grid lg:grid-cols-[1.08fr_0.92fr]">
        {/* LEFT SIDE */}
        <section className="relative hidden lg:flex overflow-hidden border-r border-[#E8E8E4] px-14 xl:px-20 py-12 flex-col justify-between">
          {/* Orbit decoration */}
          <div className="pointer-events-none absolute -left-28 top-[18%] h-[560px] w-[560px] rounded-full border border-[#625ED1]/10" />

          <div className="pointer-events-none absolute -left-8 top-[27%] h-[390px] w-[390px] rounded-full border border-[#625ED1]/10" />

          <div className="pointer-events-none absolute left-[38%] top-[29%] h-2.5 w-2.5 rounded-full bg-[#625ED1] shadow-[0_0_0_7px_rgba(98,94,209,0.08)]" />

          {/* Logo */}
          <div className="relative z-10 flex items-center gap-3">
            <ThozhanLogo />

            <div>
              <p className="text-[17px] font-semibold tracking-[-0.02em]">
                Thozhan
              </p>

              <p className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.2em] text-zinc-400">
                Always with you
              </p>
            </div>
          </div>

          {/* Hero */}
          <div className="relative z-10 max-w-[650px] pb-8">
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#625ED1]/15 bg-[#625ED1]/[0.06] px-3.5 py-2 text-xs font-medium text-[#5753C9]">
              <Sparkles size={14} />
              Your personal AI companion
            </div>

            <h1 className="max-w-[620px] text-[52px] xl:text-[64px] font-semibold leading-[1.02] tracking-[-0.055em]">
              Start with
              <span className="block text-[#625ED1]">
                a clearer day.
              </span>
            </h1>

            <p className="mt-7 max-w-[560px] text-[17px] leading-8 text-zinc-500">
              Create your Thozhan account and bring your
              emails, priorities, tasks and meetings into one
              intelligent workspace.
            </p>

            <div className="mt-10 grid max-w-[560px] grid-cols-3 gap-3">
              <Feature label="Priority emails" />
              <Feature label="Smart tasks" />
              <Feature label="Meetings" />
            </div>
          </div>

          <div className="relative z-10 flex items-center justify-between text-xs text-zinc-400">
            <span>தோழன் · Your AI companion</span>
            <span>Built for your everyday</span>
          </div>
        </section>

        {/* RIGHT SIDE */}
        <section className="relative flex min-h-screen items-center justify-center px-5 py-12 sm:px-8 lg:px-12">
          {/* Mobile logo */}
          <div className="absolute left-5 right-5 top-6 flex items-center justify-between lg:hidden">
            <div className="flex items-center gap-2.5">
              <ThozhanLogo compact />

              <div>
                <p className="text-sm font-semibold">
                  Thozhan
                </p>

                <p className="text-[9px] uppercase tracking-[0.16em] text-zinc-400">
                  Always with you
                </p>
              </div>
            </div>

            <span className="text-xs text-zinc-400">
              தோழன்
            </span>
          </div>

          <div className="w-full max-w-[430px] pt-14 lg:pt-0">
            <button
              type="button"
              onClick={() => router.push("/")}
              className="mb-8 inline-flex items-center gap-2 text-xs font-medium text-zinc-500 transition hover:text-[#5753C9]"
            >
              <ArrowLeft size={15} />
              Back to sign in
            </button>

            <div className="mb-8">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#625ED1]">
                Get started
              </p>

              <h2 className="text-[34px] sm:text-[38px] font-semibold tracking-[-0.04em]">
                Create your account
              </h2>

              <p className="mt-3 text-[15px] leading-6 text-zinc-500">
                Your intelligent workspace starts here.
              </p>
            </div>

            <form
              onSubmit={handleSignup}
              className="space-y-4"
            >
              {/* NAME */}
              <Field
                label="Your name"
                icon={<User size={17} />}
              >
                <input
                  id="name"
                  type="text"
                  required
                  autoComplete="name"
                  value={name}
                  onChange={(e) =>
                    setName(e.target.value)
                  }
                  placeholder="Enter your name"
                  className={inputClass}
                />
              </Field>

              {/* EMAIL */}
              <Field
                label="Email address"
                icon={<Mail size={17} />}
              >
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) =>
                    setEmail(e.target.value)
                  }
                  placeholder="you@example.com"
                  className={inputClass}
                />
              </Field>

              {/* PASSWORD */}
              <Field
                label="Password"
                icon={<Lock size={17} />}
              >
                <input
                  id="password"
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  required
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) =>
                    setPassword(e.target.value)
                  }
                  placeholder="At least 6 characters"
                  className={`${inputClass} pr-12`}
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowPassword(
                      (current) => !current
                    )
                  }
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 transition hover:text-zinc-700"
                  aria-label={
                    showPassword
                      ? "Hide password"
                      : "Show password"
                  }
                >
                  {showPassword ? (
                    <EyeOff size={17} />
                  ) : (
                    <Eye size={17} />
                  )}
                </button>
              </Field>

              {/* CONFIRM PASSWORD */}
              <Field
                label="Confirm password"
                icon={<Lock size={17} />}
              >
                <input
                  id="confirm-password"
                  type={
                    showConfirmPassword
                      ? "text"
                      : "password"
                  }
                  required
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) =>
                    setConfirmPassword(e.target.value)
                  }
                  placeholder="Enter password again"
                  className={`${inputClass} pr-12`}
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowConfirmPassword(
                      (current) => !current
                    )
                  }
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 transition hover:text-zinc-700"
                  aria-label={
                    showConfirmPassword
                      ? "Hide password"
                      : "Show password"
                  }
                >
                  {showConfirmPassword ? (
                    <EyeOff size={17} />
                  ) : (
                    <Eye size={17} />
                  )}
                </button>
              </Field>

              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                  <p className="text-sm leading-5 text-red-600">
                    {error}
                  </p>
                </div>
              )}

              <button
                disabled={loading}
                type="submit"
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[#5753C9] py-3.5 text-sm font-medium text-white shadow-[0_8px_24px_rgba(87,83,201,0.18)] transition hover:bg-[#4D49BA] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader2
                      size={17}
                      className="animate-spin"
                    />
                    Creating account...
                  </>
                ) : (
                  <>
                    Create account
                    <ArrowRight size={17} />
                  </>
                )}
              </button>
            </form>

            <div className="mt-7 border-t border-[#E7E7E3] pt-6">
              <p className="text-center text-sm text-zinc-500">
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => router.push("/")}
                  className="font-medium text-[#5753C9] transition hover:text-[#4541A9]"
                >
                  Sign in
                </button>
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

const inputClass =
  "w-full rounded-xl border border-[#DEDEDA] bg-white py-3.5 pl-11 pr-4 text-[14px] outline-none transition placeholder:text-zinc-400 focus:border-[#625ED1] focus:ring-4 focus:ring-[#625ED1]/[0.08]";

function Field({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-[13px] font-medium text-zinc-700">
        {label}
      </label>

      <div className="relative mt-2">
        <span className="absolute left-4 top-1/2 z-10 -translate-y-1/2 text-zinc-400">
          {icon}
        </span>

        {children}
      </div>
    </div>
  );
}

function Feature({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-[#E4E4E0] bg-white/70 px-3.5 py-3 text-xs font-medium text-zinc-600 backdrop-blur-sm">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#625ED1]/10 text-[#5753C9]">
        <Check size={12} strokeWidth={2.5} />
      </span>

      {label}
    </div>
  );
}