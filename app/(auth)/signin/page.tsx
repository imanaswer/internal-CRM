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
    <div className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>Employee Activity Reporting System</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {error && (
            <p className="text-sm text-destructive">Invalid username or password.</p>
          )}

          <form action={signInWithGoogle}>
            <Button type="submit" className="w-full">
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
