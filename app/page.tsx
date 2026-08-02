import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";

export default async function Home() {
  const u = await getCurrentUser();
  if (!u) redirect("/signin");
  if (u.role === "MANAGER") redirect("/manager");
  redirect("/dashboard");
}
