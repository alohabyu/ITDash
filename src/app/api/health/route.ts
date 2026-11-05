/** Liveness probe for Docker / load balancers: answers as long as the server is up. */
export function GET() {
  return Response.json({ status: "ok" });
}
