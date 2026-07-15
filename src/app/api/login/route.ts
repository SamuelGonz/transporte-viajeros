import { NextResponse } from "next/server";
import {
  AUTH_COOKIE,
  COOKIE_MAX_AGE,
  checkCredentials,
  createToken,
} from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { username, password } = (await request.json()) ?? {};

    if (!process.env.AUTH_USERNAME || !process.env.AUTH_PASSWORD) {
      return NextResponse.json(
        { error: "El servidor no tiene configuradas las credenciales." },
        { status: 500 }
      );
    }

    if (
      typeof username !== "string" ||
      typeof password !== "string" ||
      !checkCredentials(username, password)
    ) {
      return NextResponse.json(
        { error: "Usuario o contraseña incorrectos." },
        { status: 401 }
      );
    }

    const token = await createToken(username);
    const res = NextResponse.json({ ok: true });
    res.cookies.set(AUTH_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: COOKIE_MAX_AGE,
    });
    return res;
  } catch {
    return NextResponse.json({ error: "Petición inválida." }, { status: 400 });
  }
}
