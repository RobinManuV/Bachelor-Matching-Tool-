// Dedicated Worker route: project-robin.com/rbmt* -> rbmt.netlify.app.
// Netlify remains the origin for static files and Functions; the browser stays
// on project-robin.com so assets, API calls and the admin share one origin.
const ORIGIN = 'https://rbmt.netlify.app';
const PREFIX = '/rbmt';
const PAGE_PATHS = new Set([PREFIX, `${PREFIX}/admin`, `${PREFIX}/colegios`]);

export function upstreamFor(url) {
  if (url.pathname !== PREFIX && !url.pathname.startsWith(`${PREFIX}/`)) return null;
  return new URL((url.pathname.slice(PREFIX.length) || '/') + url.search, ORIGIN);
}

export default {
  async fetch(request) {
    const publicUrl = new URL(request.url);
    if (PAGE_PATHS.has(publicUrl.pathname)) {
      return Response.redirect(`${publicUrl.origin}${publicUrl.pathname}/${publicUrl.search}`, 308);
    }

    const upstream = upstreamFor(publicUrl);
    if (!upstream) return fetch(request);

    const upstreamRequest = new Request(upstream, request);
    upstreamRequest.headers.set('Origin', upstream.origin);
    upstreamRequest.headers.set('X-Forwarded-Host', publicUrl.host);
    upstreamRequest.headers.set('X-Forwarded-Prefix', PREFIX);
    const response = await fetch(upstreamRequest, { redirect: 'manual' });

    const location = response.headers.get('location');
    if (!location) return response;
    const destination = new URL(location, upstream);
    if (destination.origin !== upstream.origin) return response;
    const responseHeaders = new Headers(response.headers);
    responseHeaders.set('location', `${publicUrl.origin}${PREFIX}${destination.pathname}${destination.search}${destination.hash}`);
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers: responseHeaders });
  },
};
