import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const tempLoginEnabled =
  process.env.ALLOW_TEMP_LOGIN === "true" && process.env.NODE_ENV !== "production";

async function signInWithGoogle() {
  "use server";
  await signIn("google", { redirectTo: "/" });
}

async function signInWithTempCredentials(formData: FormData) {
  "use server";
  try {
    await signIn("credentials", {
      username: formData.get("username"),
      password: formData.get("password"),
      redirectTo: "/",
    });
  } catch (error) {
    // Auth.js throws a NEXT_REDIRECT "error" on success — it must propagate.
    // Only AuthError (bad credentials) is ours to handle.
    if (error instanceof AuthError) {
      redirect("/signin?error=1");
    }
    throw error;
  }
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-4">
      <div className="flex flex-col items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-xl bg-primary text-lg font-bold text-primary-foreground shadow-md shadow-primary/25">
          G
        </span>
        <div className="text-center">
          <h1 className="text-lg font-semibold tracking-tight">Activity Reporting</h1>
          <p className="text-sm text-muted-foreground">G-TEC internal daily work reporting</p>
        </div>
      </div>

      <Card className="w-full max-w-sm shadow-sm">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>Use your gteceducation.com Google account.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {error && (
            <p
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
            >
              {error === "AccessDenied"
                ? "Access is restricted to gteceducation.com Google accounts."
                : error === "1"
                  ? "Invalid username or password."
                  : "Sign-in failed. Please try again."}
            </p>
          )}

          <form action={signInWithGoogle}>
            <Button type="submit" className="w-full">
              <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
                <path
                  fill="currentColor"
                  d="M21.35 11.1H12v2.9h5.35c-.5 2.5-2.6 3.9-5.35 3.9a6 6 0 1 1 0-12c1.5 0 2.9.55 3.95 1.55l2.2-2.2A9 9 0 1 0 12 21c5.2 0 8.85-3.65 8.85-8.8 0-.4-.05-.75-.1-1.1Z"
                />
              </svg>
              Sign in with Google
            </Button>
          </form>

          {tempLoginEnabled && (
            <>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="h-px flex-1 bg-border" />
                Temp login — testing only
                <div className="h-px flex-1 bg-border" />
              </div>
              <form action={signInWithTempCredentials} className="flex flex-col gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="username">Username</Label>
                  <Input id="username" name="username" autoComplete="username" required />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                  />
                </div>
                <Button type="submit" variant="outline" className="w-full">
                  Sign in (temp)
                </Button>
              </form>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
