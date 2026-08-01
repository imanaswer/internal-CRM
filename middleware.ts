export { auth as middleware } from "@/auth";
export const config = { matcher: ["/dashboard/:path*", "/activities/:path*", "/manager/:path*", "/api/export"] };
