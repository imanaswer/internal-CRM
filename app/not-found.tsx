import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-4 text-center">
      <h1 className="text-xl font-semibold tracking-tight">Page not found</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        This page doesn&apos;t exist. Head back to your dashboard.
      </p>
      <Link href="/" className={buttonVariants({ variant: "default" })}>
        Go home
      </Link>
    </div>
  );
}
