const SESSION_ID = '68c68c63-9eee-4ee5-a46b-f453d2e8c6bf';

/** Frontend-only session handler used by the AlterU self-hosted deployer. */
export async function handleApi(request) {
  const url = new URL(request.url);

  if (request.method === 'GET' && url.pathname.endsWith('/api/health')) {
    return Response.json({
      ok: true,
      game: 'stitch-sprites',
      sessionId: SESSION_ID,
      mode: 'frontend-only',
    });
  }

  return new Response('Not Found', { status: 404 });
}
