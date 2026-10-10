// Refreshes the Supabase session cookie on every request and sends anonymous visitors to
// /login. This is only a convenience redirect: data access is enforced by RLS.
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PUBLIC_PATHS = ["/login", "/signup"];

// Names only, never values: tells whoever deploys which variable this environment lacks.
function missingEnv(): string[] {
  const missing: string[] = [];
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  return missing;
}

export async function proxy(request: NextRequest) {
  const missing = missingEnv();
  if (missing.length > 0) {
    return new NextResponse(
      `Configuración incompleta en este entorno de Vercel. Falta: ${missing.join(", ")}. ` +
        "Agrégala en Settings > Environment Variables (marcando Preview y Production) y vuelve a desplegar.",
      { status: 500, headers: { "content-type": "text/plain; charset=utf-8" } },
    );
  }

  try {
    return await refreshSession(request);
  } catch (e) {
    console.error("proxy failed", e);
    const message = e instanceof Error ? e.message : "error desconocido";
    return new NextResponse(`Error al validar la sesión: ${message}`, {
      status: 500,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
}

async function refreshSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet, headers) => {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  // getUser validates the token with Supabase Auth instead of trusting the cookie.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublic = PUBLIC_PATHS.some((p) => request.nextUrl.pathname.startsWith(p));
  if (!user && !isPublic) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (user && isPublic) {
    return NextResponse.redirect(new URL("/queue", request.url));
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
