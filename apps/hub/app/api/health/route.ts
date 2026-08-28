export const dynamic = 'force-static';

export function GET(): Response {
  return Response.json({ status: 'ok', scope: 'clear-water-bay-public' });
}
