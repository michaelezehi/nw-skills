# =============================================================================
# Scanner blackhole — include inside each HTTPS `server {}` block
# =============================================================================
# Named `.inc` so nginx.conf's `include /etc/nginx/conf.d/*.conf` does NOT pick
# it up as a standalone file. It is included explicitly, same convention as
# proxy-headers.inc.
#
# `return 444` closes the connection without a response. A scanner learns
# nothing — no status code, no headers, no timing signal — and the request never
# reaches the app.
#
# The classifiers ($is_probe_path, $is_scanner_ua) are defined as `map` blocks
# in nginx.conf. Using `if` here is one of the two documented-safe uses of `if`
# in a server context: `return` is a rewrite-module directive, so this does not
# hit the "if is evil" location-matching pitfalls.

if ($is_probe_path) { return 444; }
if ($is_scanner_ua) { return 444; }
