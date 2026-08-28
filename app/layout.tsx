import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Script from "next/script";
import localFont from "next/font/local";
import { Suspense } from "react";
import { VemetricScript } from "@vemetric/react";
import { MetaPixelRouteTracker } from "@/components/MetaPixelRouteTracker";
import { SiteHeader } from "@/components/SiteHeader";
import { brandCopy } from "@/lib/brand";
import { config } from "@/lib/config";
import "./globals.css";

const publicSiteUrl = new URL(config.siteUrl);
const socialTitle = brandCopy.metaTitle;
const socialDescription = brandCopy.metaDescription;
const socialImage = {
  url: "/og.jpg",
  width: 1200,
  height: 630,
  type: "image/jpeg",
  alt: `${config.siteName} — ${brandCopy.line}`,
};

// Next ships these exact variable fonts with the installed package. Loading them
// locally keeps production builds deterministic and avoids a Google Fonts request.
const geistSans = localFont({
  src: "../node_modules/next/dist/next-devtools/server/font/geist-latin.woff2",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "../node_modules/next/dist/next-devtools/server/font/geist-mono-latin.woff2",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  metadataBase: publicSiteUrl,
  // No `icons` here on purpose. Declaring one pins the tag to a bare "/icon.svg", and a
  // browser that has already cached a favicon under that exact URL keeps showing the old
  // artwork forever. Left alone, the app/icon.svg file convention emits the same file
  // with a content hash on the URL, so changing the logo changes the URL and the tab
  // updates. Whenever the logo changes, change components/Logo.tsx and app/icon.svg
  // together -- they are the same mark drawn twice.
  title: {
    default: socialTitle,
    template: `%s · ${config.siteName}`,
  },
  description: socialDescription,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    siteName: config.siteName,
    locale: "en_US",
    url: "/",
    title: socialTitle,
    description: socialDescription,
    images: [socialImage],
  },
  twitter: {
    card: "summary_large_image",
    title: socialTitle,
    description: socialDescription,
    images: [socialImage],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const vemetricToken = process.env.NEXT_PUBLIC_VEMETRIC_TOKEN;
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      style={{ "--accent": config.accentColor } as CSSProperties}
    >
      <body className="min-h-full flex flex-col">
        <Script id="owner-fragment-scrubber" strategy="beforeInteractive">
          {`try{if(location.pathname.startsWith('/manage/')&&/^#(?:token|approval)=/.test(location.hash)){sessionStorage.setItem('bidindex-owner-fragment',location.hash);history.replaceState(null,'',location.pathname+location.search)}}catch{}`}
        </Script>
        {vemetricToken ? <VemetricScript token={vemetricToken} /> : null}
        {config.metaPixel.id ? (
          <>
            <Script id="meta-pixel" strategy="afterInteractive">
              {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
              n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
              n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
              t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script',
              'https://connect.facebook.net/en_US/fbevents.js');
              fbq('init','${config.metaPixel.id}');
              fbq('track','PageView');`}
            </Script>
            <noscript>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                height="1"
                width="1"
                style={{ display: "none" }}
                alt=""
                src={`https://www.facebook.com/tr?id=${config.metaPixel.id}&ev=PageView&noscript=1`}
              />
            </noscript>
            {/* useSearchParams needs a boundary so it never opts a page out of prerendering. */}
            <Suspense fallback={null}>
              <MetaPixelRouteTracker />
            </Suspense>
          </>
        ) : null}
        {config.xPixel.id ? (
          <Script id="x-pixel" strategy="afterInteractive">
            {`!function(e,t,n,s,u,a){e.twq||(s=e.twq=function(){s.exe?s.exe.apply(s,arguments):s.queue.push(arguments);
            },s.version='1.1',s.queue=[],u=t.createElement(n),u.async=!0,u.src='https://static.ads-twitter.com/uwt.js',
            a=t.getElementsByTagName(n)[0],a.parentNode.insertBefore(u,a))}(window,document,'script');
            twq('config','${config.xPixel.id}');`}
          </Script>
        ) : null}
        <SiteHeader siteName={config.siteName} />
        {children}
        <footer className="site-footer"><div className="app-shell"><span>{config.siteName}</span><span>{brandCopy.line}</span></div></footer>
      </body>
    </html>
  );
}
