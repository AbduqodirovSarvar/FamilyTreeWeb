import { RenderMode, ServerRoute } from '@angular/ssr';

/**
 * Static routes can be prerendered. The dynamic /:familyName route can't —
 * the family name is unknown at build time and the API may be unreachable
 * during build, so we render it on each request instead.
 */
export const serverRoutes: ServerRoute[] = [
  { path: '', renderMode: RenderMode.Prerender },
  { path: 'not-found', renderMode: RenderMode.Prerender },
  { path: ':familyName', renderMode: RenderMode.Server },
  { path: '**', renderMode: RenderMode.Server }
];
