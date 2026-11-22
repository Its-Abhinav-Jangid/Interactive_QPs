"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  GraduationCap,
  Loader2,
  LockKeyhole,
  Mail,
  Sparkles,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function LoginForm({ next = "/", initialError = null }) {
  const router = useRouter();
  const [tab, setTab] = useState("password");
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(initialError);
  const [notice, setNotice] = useState(null);

  const isSignUp = mode === "signup";

  function goNext() {
    router.replace(next);
    router.refresh();
  }

  async function handlePasswordSubmit(event) {
    event.preventDefault();
    setError(null);
    setNotice(null);

    if (!email.trim()) return setError("Enter your email address.");
    if (password.length < 6) {
      return setError("Password must be at least 6 characters long.");
    }

    setLoading(true);
    const supabase = createClient();

    try {
      if (isSignUp) {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { display_name: displayName.trim() || email.split("@")[0] },
            emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
          },
        });
        if (signUpError) throw signUpError;
        if (data.session) {
          goNext();
          return;
        }
        setNotice(
          "Account created. Check your inbox for the confirmation link, then sign in."
        );
        setMode("signin");
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInError) throw signInError;
        goNext();
        return;
      }
    } catch (caught) {
      setError(caught?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleMagicLink(event) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    if (!email.trim()) return setError("Enter your email address.");

    setLoading(true);
    const supabase = createClient();
    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          shouldCreateUser: true,
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      });
      if (otpError) throw otpError;
      setNotice(
        "Magic link sent. Open the email on this device to finish signing in."
      );
    } catch (caught) {
      setError(caught?.message || "Could not send the magic link.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <div className="relative hidden overflow-hidden bg-[#1d1b3a] text-white lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(124,108,255,0.45),transparent_45%),radial-gradient(circle_at_80%_80%,rgba(45,212,191,0.28),transparent_45%)]"
        />
        <div className="relative z-10 p-12">
          <Link href="/" className="inline-flex items-center gap-2.5 text-lg font-semibold">
            <span className="grid size-9 place-items-center rounded-xl bg-white/15 backdrop-blur">
              <GraduationCap className="size-5" />
            </span>
            PaperDesk
          </Link>
          <h1 className="mt-20 max-w-md text-4xl font-semibold leading-tight tracking-tight">
            Your board papers, finally built for practice.
          </h1>
          <p className="mt-4 max-w-md text-base leading-relaxed text-white/70">
            Import a paper once. Get a timed, auto-saving exam workspace, a clean
            student link, and rubric-ready answers you can hand to any AI examiner.
          </p>
          <ul className="mt-10 space-y-4 text-sm text-white/80">
            {[
              "Split reading panes, charts and attempt limits",
              "Cloud sync for you, local save for guests",
              "Copy Q&A with a strict evaluator prompt built in",
            ].map((item) => (
              <li key={item} className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-teal-300" />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="relative z-10 border-t border-white/10 p-12 text-xs text-white/50">
          Built for CBSE and other board exam practice. Your answer keys stay out of
          every student-facing view.
        </div>
      </div>

      <div className="flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <Link href="/" className="inline-flex items-center gap-2 text-lg font-semibold">
              <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
                <GraduationCap className="size-5" />
              </span>
              PaperDesk
            </Link>
          </div>

          <Card className="border-border/80 shadow-xl">
            <CardHeader>
              <CardTitle className="text-2xl">
                {isSignUp ? "Create your account" : "Welcome back"}
              </CardTitle>
              <CardDescription>
                {isSignUp
                  ? "Sign up to import papers and keep attempts in sync."
                  : "Sign in to open your paper library and resume attempts."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={tab} onValueChange={setTab}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="password">
                    <LockKeyhole className="mr-1.5 size-3.5" />
                    Password
                  </TabsTrigger>
                  <TabsTrigger value="magic">
                    <Sparkles className="mr-1.5 size-3.5" />
                    Magic link
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="password">
                  <form onSubmit={handlePasswordSubmit} className="space-y-4">
                    {isSignUp && (
                      <div className="space-y-2">
                        <Label htmlFor="display-name">Display name</Label>
                        <Input
                          id="display-name"
                          value={displayName}
                          onChange={(event) => setDisplayName(event.target.value)}
                          placeholder="Riya Mehta"
                          autoComplete="name"
                        />
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder="you@example.com"
                        autoComplete="email"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="password">Password</Label>
                      <Input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder="At least 6 characters"
                        autoComplete={isSignUp ? "new-password" : "current-password"}
                        required
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading && <Loader2 className="size-4 animate-spin" />}
                      {isSignUp ? "Create account" : "Sign in"}
                      {!loading && <ArrowRight className="size-4" />}
                    </Button>
                  </form>
                  <p className="mt-4 text-center text-sm text-muted-foreground">
                    {isSignUp ? "Already have an account?" : "New to PaperDesk?"}{" "}
                    <button
                      type="button"
                      className="font-medium text-primary underline-offset-4 hover:underline"
                      onClick={() => {
                        setMode(isSignUp ? "signin" : "signup");
                        setError(null);
                        setNotice(null);
                      }}
                    >
                      {isSignUp ? "Sign in" : "Create one"}
                    </button>
                  </p>
                </TabsContent>

                <TabsContent value="magic">
                  <form onSubmit={handleMagicLink} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="magic-email">Email</Label>
                      <Input
                        id="magic-email"
                        type="email"
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        placeholder="you@example.com"
                        autoComplete="email"
                        required
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Mail className="size-4" />
                      )}
                      Email me a sign-in link
                    </Button>
                    <p className="text-center text-xs text-muted-foreground">
                      A magic link signs you in without a password. New emails create
                      an account automatically.
                    </p>
                  </form>
                </TabsContent>
              </Tabs>

              {error && (
                <div
                  role="alert"
                  className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                >
                  {error}
                </div>
              )}
              {notice && (
                <div
                  role="status"
                  className="mt-4 rounded-lg border border-success/30 bg-success/10 px-3 py-2 text-sm text-success"
                >
                  {notice}
                </div>
              )}
            </CardContent>
          </Card>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Taking a shared test? You do not need an account —{" "}
            <span className="font-medium text-foreground">open the share link directly</span>.
          </p>
        </div>
      </div>
    </div>
  );
}
