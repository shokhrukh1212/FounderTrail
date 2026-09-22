import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    const values=[
      {key:"X-Content-Type-Options",value:"nosniff"},{key:"X-Frame-Options",value:"DENY"},
      {key:"Referrer-Policy",value:"strict-origin-when-cross-origin"},{key:"Permissions-Policy",value:"camera=(), microphone=(), geolocation=()"},
      {key:"Content-Security-Policy",value:"frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'"},
    ];
    if(process.env.NODE_ENV==="production")values.push({key:"Strict-Transport-Security",value:"max-age=31536000; includeSubDomains"});
    return [{source:"/:path*",headers:values}];
  },
  async redirects() {
    return [{ source: "/live", destination: "/", permanent: true }];
  },
  // Files in public/ are served from the CDN, not bundled into functions, and the trace
  // can't see a process.cwd() read. Ship the logo the product share image embeds.
  outputFileTracingIncludes: {
    "/product/\\[slug\\]/opengraph-image": ["./public/brand/logo-256.png"],
  },
  experimental: {
    // The CLI checker can return empty captured output under Node 22.22,
    // which makes `next build` fail before compilation starts.
    useTypeScriptCli: false,
  },
};

export default nextConfig;
