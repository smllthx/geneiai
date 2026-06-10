export default function handler(_req: any, res: any) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.status(200).json({
    ok: true,
    service: "GENEAI",
    checked_at: new Date().toISOString(),
  });
}
