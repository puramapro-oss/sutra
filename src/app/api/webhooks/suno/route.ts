/** Required provider callback acknowledgement only. Unauthenticated callbacks
 * never modify a job, a user, a URL or billing. Authenticated polling is the sole
 * source of truth. Do not parse, persist or log this untrusted request body.
 */
export function POST() {
  return Response.json({ code: 200 }, { headers: { 'Cache-Control': 'no-store' } })
}
