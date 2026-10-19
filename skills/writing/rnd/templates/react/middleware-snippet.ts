// Host wiring for the rnd surface (do once). The /rnd pages are public + noindex.

// 1) AUTH ALLOW-LIST — let /rnd through whatever gates the rest of the app.
//    Adapt to the host's middleware. Next.js 16+ hosts use `proxy.ts` (exported
//    `proxy` fn, nodejs runtime) — the deprecated `middleware.ts` name still
//    works on 15, but edit whichever file the host actually has: a leftover
//    middleware.ts beside a proxy.ts is silently ignored. Common shapes:
//
//    next-auth / custom matcher — exclude /rnd from the protected matcher:
//      export const config = { matcher: ["/((?!rnd|_next|favicon.ico).*)"] };
//
//    WorkOS / explicit allow-list (founder-x style):
//      const PUBLIC = ["/rnd", /^\/rnd\//];
//      if (PUBLIC.some((p) => (typeof p === "string" ? path === p : p.test(path)))) return NextResponse.next();

// 2) THEME SHORTHAND (demo) — bare /rnd/<theme> → /rnd/<theme>/demo.
//    Do NOT put this in next.config redirects(). Those run before routing, so
//    they also catch /rnd/<slug> consensus and product pages, and every new
//    page has to join an exclusion list or it bounces to a /demo that 404s.
//    Use the route instead:
//      app/rnd/[theme]/page.tsx ← theme-shorthand-page.tsx
//    A real page folder (app/rnd/<slug>/page.tsx) is a static segment and wins
//    over [theme], so new pages need no registration.

export {};
