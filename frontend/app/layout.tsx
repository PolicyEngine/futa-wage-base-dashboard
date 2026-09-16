import Script from 'next/script';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { SITE_URL, SITE_ORIGIN, REPO_URL } from '@/lib/site';

const GA_ID = 'G-2YHG89FY0N';
const TOOL_NAME = 'futa-wage-base-dashboard';

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  display: 'swap',
});

const TITLE = 'FUTA taxable wage base dashboard | PolicyEngine';
const DESCRIPTION =
  'FUTA revenue estimates for raising the federal unemployment taxable wage base from $7,000 to $43,000 in 2026 and indexing it to inflation (CPI-U).';

export const metadata: Metadata = {
  title: {
    default: TITLE,
    template: '%s | PolicyEngine',
  },
  description: DESCRIPTION,
  metadataBase: new URL(SITE_ORIGIN),
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
  },
  twitter: {
    card: 'summary_large_image',
    site: '@ThePolicyEngine',
    creator: '@ThePolicyEngine',
    title: TITLE,
    description: DESCRIPTION,
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

// JSON-LD: the page is a fixed dataset with one CSV download, not an application.
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Dataset',
  name: 'FUTA taxable wage base reform revenue estimates, 2026 to 2035',
  description: DESCRIPTION,
  url: SITE_URL,
  temporalCoverage: '2026/2035',
  spatialCoverage: 'United States',
  isBasedOn: 'https://github.com/PolicyEngine/policyengine-us',
  distribution: [
    {
      '@type': 'DataDownload',
      encodingFormat: 'text/csv',
      contentUrl: `${REPO_URL}/blob/main/analysis/futa_wage_base_estimates.csv`,
    },
  ],
  creator: {
    '@type': 'Organization',
    name: 'PolicyEngine',
    url: 'https://policyengine.org',
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
          <div style={{ padding: '1rem 2rem', textAlign: 'center', fontFamily: 'sans-serif' }}>
            <p>
              The year selector, the Validation and methods tab, the chart, and the CSV download
              need JavaScript. The overview and headline estimates below are readable without it.
            </p>
          </div>
        </noscript>
        {children}
      </body>
    </html>
  );
}
