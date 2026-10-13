/**
 * Public-preview defense-in-depth headers.
 *
 * These protect the rendered app and both read-only APIs. They do not
 * substitute for Vercel WAF rate limiting or protect against all XSS.
 * CSP intentionally restricts embedding/base/object without prescribing
 * script/style sources that would break Next.js runtime/hydration.
 */
const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Content-Security-Policy', value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'" },
];

const nextConfig = {
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
