/**
 * Site-wide URL constants.
 *
 * The dashboard is built to mount at /us/futa-wage-base-dashboard on
 * policyengine.org (multi-zone). Until that mount is live, canonical and
 * share URLs must point at the host that actually serves the page, so the
 * absolute site URL is derived from the deployment environment:
 *
 * 1. NEXT_PUBLIC_SITE_URL, when set (use it to switch to policyengine.org
 *    once the mount returns 200);
 * 2. Vercel's production URL for this project, plus the base path;
 * 3. localhost for development.
 *
 * next.config.js repeats the base-path rule because it cannot import TS.
 */

export const BASE_PATH =
  process.env.NEXT_PUBLIC_BASE_PATH !== undefined
    ? process.env.NEXT_PUBLIC_BASE_PATH
    : '/us/futa-wage-base-dashboard';

const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (vercelHost ? `https://${vercelHost}${BASE_PATH}` : `http://localhost:3010${BASE_PATH}`);

/**
 * Origin only, for Next's `metadataBase`. Next already prefixes file-based
 * metadata routes (opengraph-image) with the base path, so a metadataBase
 * that includes the base path would double it.
 */
export const SITE_ORIGIN = new URL(SITE_URL).origin;

export const REPO_URL = 'https://github.com/PolicyEngine/futa-wage-base-dashboard';

/** Prefix a public asset path with the base path. */
export const asset = (path: string) => `${BASE_PATH}${path.startsWith('/') ? path : `/${path}`}`;
