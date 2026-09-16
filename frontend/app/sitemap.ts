import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';
import { MODEL_INFO } from '@/lib/data';

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      // The page changes when the analysis is rerun, not on every deploy.
      lastModified: new Date(MODEL_INFO.generated),
      changeFrequency: 'monthly',
      priority: 1,
    },
  ];
}
