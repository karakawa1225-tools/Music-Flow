export const config = {
  runtime: 'nodejs',
  maxDuration: 10
}

export default function handler(_req: Request): Response {
  return Response.json({
    ok: true,
    db: process.env.TURSO_DATABASE_URL ? 'turso' : 'unset',
    hasTursoToken: Boolean(process.env.TURSO_AUTH_TOKEN),
    hasJwt: Boolean(process.env.JWT_SECRET),
    hasBlob: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
    region: process.env.VERCEL_REGION || null
  })
}
