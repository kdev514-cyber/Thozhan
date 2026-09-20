"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ThozhanLogo from "@/components/thozhan/ThozhanLogo";
import {
  Mail,
  Lock,
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  Sparkles,
  Check,
} from "lucide-react";

export default function Home() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setErrorMessage("");
    setLoading(true);

    try {
      const supabase = createClient();

      const { data, error } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

      if (error) {
        console.error("Supabase login error:", error);
        setErrorMessage(error.message);
        setLoading(false);
        return;
      }

      if (!data.session) {
        setErrorMessage(
          "Login succeeded but Supabase did not create a session."
        );
        setLoading(false);
        return;
      }

      console.log("Login successful:", data.user?.email);

      router.replace("/dashboard");
      router.refresh();
    } catch (error) {
      console.error("Unexpected login error:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong while signing in."
      );

      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#F7F7F5] text-[#18181B]">
      <div className="min-h-screen lg:grid lg:grid-cols-[1.08fr_0.92fr]">
        {/* LEFT / BRAND */}
        <section className="relative hidden lg:flex overflow-hidden border-r border-[#E8E8E4] px-14 xl:px-20 py-12 flex-col justify-between">
          {/* Decorative orbit */}
          <div className="pointer-events-none absolute -left-28 top-[18%] h-[560px] w-[560px] rounded-full border border-[#625ED1]/10" />
          <div className="pointer-events-none absolute -left-8 top-[27%] h-[390px] w-[390px] rounded-full border border-[#625ED1]/10" />

          <div className="pointer-events-none absolute left-[38%] top-[29%] h-2.5 w-2.5 rounded-full bg-[#625ED1] shadow-[0_0_0_7px_rgba(98,94,209,0.08)]" />

          {/* Brand */}
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

          {/* Main message */}
          <div className="relative z-10 max-w-[650px] pb-8">
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#625ED1]/15 bg-[#625ED1]/[0.06] px-3.5 py-2 text-xs font-medium text-[#5753C9]">
              <Sparkles size={14} />
              Your personal AI companion
            </div>

            <h1 className="max-w-[620px] text-[52px] xl:text-[64px] font-semibold leading-[1.02] tracking-[-0.055em]">
              Less inbox.
              <span className="block text-[#625ED1]">
                More clarity.
              </span>
            </h1>

            <p className="mt-7 max-w-[560px] text-[17px] leading-8 text-zinc-500">
              Thozhan reads through the noise, finds what matters,
              keeps track of your tasks and helps organise your day.
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

        {/* RIGHT / LOGIN */}
        <section className="relative flex min-h-screen items-center justify-center px-5 py-10 sm:px-8 lg:px-12">
          {/* Mobile header */}
          <div className="absolute left-5 right-5 top-6 flex items-center justify-between lg:hidden">
            <div className="flex items-center gap-2.5">
              <ThozhanLogo compact />

              <div>
                <p className="text-sm font-semibold">Thozhan</p>
                <p className="text-[9px] uppercase tracking-[0.16em] text-zinc-400">
                  Always with you
                </p>
              </div>
            </div>

            <span className="text-xs text-zinc-400">
              தோழன்
            </span>
          </div>

          <div className="w-full max-w-[430px]">
            <div className="mb-9">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#625ED1]">
                Welcome back
              </p>

              <h2 className="text-[34px] sm:text-[38px] font-semibold tracking-[-0.04em]">
                Sign in to Thozhan
              </h2>

              <p className="mt-3 text-[15px] leading-6 text-zinc-500">
                Your inbox, tasks and meetings are waiting.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              {/* EMAIL */}
              <div>
                <label
                  htmlFor="email"
                  className="text-[13px] font-medium text-zinc-700"
                >
                  Email address
                </label>

                <div className="relative mt-2">
                  <Mail
                    size={17}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400"
                  />

                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full rounded-xl border border-[#DEDEDA] bg-white py-3.5 pl-11 pr-4 text-[14px] outline-none transition placeholder:text-zinc-400 focus:border-[#625ED1] focus:ring-4 focus:ring-[#625ED1]/[0.08]"
                  />
                </div>
              </div>

              {/* PASSWORD */}
              <div>
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="password"
                    className="text-[13px] font-medium text-zinc-700"
                  >
                    Password
                  </label>

                  <span className="text-xs text-zinc-400">
                    Keep it private
                  </span>
                </div>

                <div className="relative mt-2">
                  <Lock
                    size={17}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400"
                  />

                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full rounded-xl border border-[#DEDEDA] bg-white py-3.5 pl-11 pr-12 text-[14px] outline-none transition placeholder:text-zinc-400 focus:border-[#625ED1] focus:ring-4 focus:ring-[#625ED1]/[0.08]"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowPassword((current) => !current)
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
                </div>
              </div>

              {/* ERROR */}
              {errorMessage && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                  <p className="text-sm leading-5 text-red-600">
                    {errorMessage}
                  </p>
                </div>
              )}

              {/* LOGIN */}
              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#5753C9] py-3.5 text-sm font-medium text-white shadow-[0_8px_24px_rgba(87,83,201,0.18)] transition hover:bg-[#4D49BA] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader2
                      size={17}
                      className="animate-spin"
                    />
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign in
                    <ArrowRight size={17} />
                  </>
                )}
              </button>
            </form>

            {/* SIGN UP */}
            <div className="mt-8 border-t border-[#E7E7E3] pt-7">
              <p className="text-center text-sm text-zinc-500">
                New to Thozhan?{" "}
                <button
                  type="button"
                  onClick={() => router.push("/signup")}
                  className="font-medium text-[#5753C9] transition hover:text-[#4541A9]"
                >
                  Create an account
                </button>
              </p>
            </div>

            <p className="mt-8 text-center text-[11px] leading-5 text-zinc-400 lg:hidden">
              தோழன் · Your personal AI companion
            </p>
          </div>
        </section>
      </div>
    </main>
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
