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

// 2) THEME REDIRECT (demo) — bare /rnd/<theme> → its first scene at /demo.
//    next.config.{js,ts}:
//      async redirects() {
//        return [{ source: "/rnd/:theme([^/.]+)", destination: "/rnd/:theme/demo", permanent: false }];
//      }
//    The `([^/.]+)` guard avoids catching /rnd/<slug>/page consensus|product
//    routes that own their own index — only single-segment theme URLs redirect.

export {};
