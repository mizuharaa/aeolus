import type { MetadataRoute } from 'next'
export default function sitemap():MetadataRoute.Sitemap {return ['','/faq','/docs','/scenarios','/privacy','/terms'].map(path=>({url:`https://olus.sh${path}`,changeFrequency:'monthly',priority:path===''?1:.6}))}
