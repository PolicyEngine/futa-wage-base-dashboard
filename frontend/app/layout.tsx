import Script from 'next/script';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Providers from '@/components/Providers';

const GA_ID = 'G-2YHG89FY0N';
const TOOL_NAME = 'futa-wage-base-dashboard';

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  display: 'swap',
});

const SITE_URL = 'https://policyengine.org/us/futa-wage-base-dashboard';
const OG_IMAGE = 'https://policyengine.org/assets/logos/policyengine/og-logo.png';

const TITLE = 'FUTA taxable wage base dashboard | PolicyEngine';
const DESCRIPTION =
  'Federal revenue estimates for raising the FUTA taxable wage base from $7,000 to $43,000 in 2026 and indexing it to the CPI-U.';

export const metadata: Metadata = {
  title: {
    default: TITLE,
    template: '%s | PolicyEngine',
  },
  description: DESCRIPTION,
  metadataBase: new URL(SITE_URL),
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: 'PolicyEngine',
    type: 'website',
    locale: 'en_US',
    images: [
      {
        url: OG_IMAGE,
        width: 1200,
        height: 630,
        alt: 'PolicyEngine - FUTA taxable wage base dashboard',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@ThePolicyEngine',
    creator: '@ThePolicyEngine',
    title: TITLE,
    description: DESCRIPTION,
    images: [
      {
        url: OG_IMAGE,
        alt: 'PolicyEngine - FUTA taxable wage base dashboard',
      },
    ],
  },
  other: {
    'theme-color': '#2C7A7B',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  keywords: [
    'FUTA',
    'federal unemployment tax',
    'taxable wage base',
    'unemployment insurance',
    'payroll tax',
    'UI financing',
    'revenue estimate',
    'PolicyEngine',
  ],
};

// JSON-LD structured data for rich search results
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'FUTA taxable wage base dashboard',
  description: DESCRIPTION,
  url: SITE_URL,
  applicationCategory: 'FinanceApplication',
  operatingSystem: 'All',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
  },
  creator: {
    '@type': 'Organization',
    name: 'PolicyEngine',
    url: 'https://policyengine.org',
    logo: 'https://policyengine.org/assets/logos/policyengine/og-logo.png',
    sameAs: [
      'https://twitter.com/ThePolicyEngine',
      'https://www.facebook.com/PolicyEngine',
      'https://www.linkedin.com/company/thepolicyengine',
      'https://github.com/PolicyEngine',
      'https://www.youtube.com/@policyengine',
      'https://www.instagram.com/PolicyEngine/',
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.className}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
          strategy="afterInteractive"
        />
        <Script id="gtag-init" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_ID}', { tool_name: '${TOOL_NAME}' });
          `}
        </Script>
        <Script id="engagement-tracking" strategy="afterInteractive">
          {`
            (function() {
              var TOOL_NAME = '${TOOL_NAME}';
              if (typeof window === 'undefined' || !window.gtag) return;

              var scrollFired = {};
              window.addEventListener('scroll', function() {
                var docHeight = document.documentElement.scrollHeight - window.innerHeight;
                if (docHeight <= 0) return;
                var pct = Math.floor((window.scrollY / docHeight) * 100);
                [25, 50, 75, 100].forEach(function(m) {
                  if (pct >= m && !scrollFired[m]) {
                    scrollFired[m] = true;
                    window.gtag('event', 'scroll_depth', { percent: m, tool_name: TOOL_NAME });
                  }
                });
              }, { passive: true });

              [30, 60, 120, 300].forEach(function(sec) {
                setTimeout(function() {
                  if (document.visibilityState !== 'hidden') {
                    window.gtag('event', 'time_on_tool', { seconds: sec, tool_name: TOOL_NAME });
                  }
                }, sec * 1000);
              });

              document.addEventListener('click', function(e) {
                var link = e.target && e.target.closest ? e.target.closest('a') : null;
                if (!link || !link.href) return;
                try {
                  var url = new URL(link.href, window.location.origin);
                  if (url.hostname && url.hostname !== window.location.hostname) {
                    window.gtag('event', 'outbound_click', {
                      url: link.href,
                      target_hostname: url.hostname,
                      tool_name: TOOL_NAME
                    });
                  }
                } catch (err) {}
              });
            })();
          `}
        </Script>
      </head>
      <body>
        <noscript>
          <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'sans-serif' }}>
            <h1>FUTA taxable wage base dashboard</h1>
            <p>This dashboard requires JavaScript to run. Please enable JavaScript in your browser settings to use this tool.</p>
            <p>Visit <a href="https://policyengine.org">PolicyEngine</a> for more information.</p>
          </div>
        </noscript>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
