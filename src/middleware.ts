import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE, verifyToken } from "@/lib/auth";

// Rutas accesibles sin sesión.
const PUBLIC_PATHS = ["/login"];
const PUBLIC_API_PREFIXES = ["/api/login", "/api/logout"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(AUTH_COOKIE)?.value;
  const authed = await verifyToken(token);

  const isPublic =
    PUBLIC_PATHS.includes(pathname) ||
    PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p));

  // Si ya está autenticado y va al login, lo mandamos al inicio.
  if (authed && pathname === "/login") {
    return NextResponse.redirect(new URL("/", req.url));
  }

  // Si no está autenticado y la ruta no es pública, al login.
  if (!authed && !isPublic) {
    const url = new URL("/login", req.url);
    if (pathname !== "/") url.searchParams.set("from", pathname + req.nextUrl.search);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

// Se aplica a todo excepto assets estáticos y ficheros con extensión.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
