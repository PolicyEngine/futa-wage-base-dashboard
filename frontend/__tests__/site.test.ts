import { describe, expect, it } from 'vitest';
import { BASE_PATH, SITE_URL, SITE_ORIGIN, asset } from '@/lib/site';

describe('site URLs', () => {
  it('derives the origin without the base path so Next does not double it', () => {
    expect(SITE_URL.startsWith(SITE_ORIGIN)).toBe(true);
    expect(new URL(SITE_ORIGIN).pathname).toBe('/');
    if (BASE_PATH) {
      expect(SITE_URL.endsWith(BASE_PATH)).toBe(true);
      expect(SITE_ORIGIN.endsWith(BASE_PATH)).toBe(false);
    }
  });

  it('prefixes public assets with the base path exactly once', () => {
    expect(asset('/policyengine-logo-teal.png')).toBe(`${BASE_PATH}/policyengine-logo-teal.png`);
    expect(asset('policyengine-logo-teal.png')).toBe(`${BASE_PATH}/policyengine-logo-teal.png`);
  });
});
