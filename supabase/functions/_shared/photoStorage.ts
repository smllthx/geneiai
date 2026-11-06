export const GENEALOGY_PHOTO_BUCKET = "fotos";

const TREE_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function genealogyPhotoStoragePath(reference: unknown, explicitPath?: unknown) {
  const storedPath = typeof explicitPath === "string" ? explicitPath.trim() : "";
  if (storedPath) return safeDecode(storedPath);
  if (typeof reference !== "string") return null;
  const value = reference.trim();
  if (!value) return null;

  const storagePrefix = `storage://${GENEALOGY_PHOTO_BUCKET}/`;
  if (value.startsWith(storagePrefix)) return safeDecode(value.slice(storagePrefix.length));

  try {
    const url = new URL(value);
    const markers = [
      `/storage/v1/object/public/${GENEALOGY_PHOTO_BUCKET}/`,
      `/storage/v1/object/sign/${GENEALOGY_PHOTO_BUCKET}/`,
      `/storage/v1/object/authenticated/${GENEALOGY_PHOTO_BUCKET}/`,
    ];
    const marker = markers.find((candidate) => url.pathname.includes(candidate));
    if (!marker) return null;
    return safeDecode(url.pathname.slice(url.pathname.indexOf(marker) + marker.length));
  } catch {
    return null;
  }
}

export function stableGenealogyPhotoReference(path: string) {
  return `storage://${GENEALOGY_PHOTO_BUCKET}/${path}`;
}

export function ownedGenealogyPhotoPath(
  reference: unknown,
  explicitPath: unknown,
  userId: string,
  treeId?: string | null,
) {
  const path = genealogyPhotoStoragePath(reference, explicitPath);
  if (!path || path.length > 1024 || path.startsWith("/") || path.includes("\\") || path.includes("\0")) return null;
  const parts = path.split("/");
  if (parts.length < 2 || parts.some((part) => !part || part === "." || part === "..")) return null;
  if (parts[0] !== userId) return null;

  // Current objects use user/tree/file. Historical objects used user/file.
  if (treeId && parts.length >= 3 && TREE_UUID_RE.test(parts[1]) && parts[1] !== treeId) return null;
  return path;
}

export async function createOwnedGenealogyPhotoSignedUrl(
  supabase: any,
  options: {
    reference: unknown;
    storagePath?: unknown;
    userId: string;
    treeId?: string | null;
    expiresIn?: number;
  },
) {
  const path = ownedGenealogyPhotoPath(
    options.reference,
    options.storagePath,
    options.userId,
    options.treeId,
  );
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from(GENEALOGY_PHOTO_BUCKET)
    .createSignedUrl(path, options.expiresIn ?? 300);
  if (error || typeof data?.signedUrl !== "string" || !data.signedUrl) return null;
  return { path, signedUrl: data.signedUrl as string };
}

export async function downloadOwnedGenealogyPhoto(
  supabase: any,
  options: {
    reference: unknown;
    storagePath?: unknown;
    userId: string;
    treeId?: string | null;
  },
) {
  const path = ownedGenealogyPhotoPath(
    options.reference,
    options.storagePath,
    options.userId,
    options.treeId,
  );
  if (!path) return null;
  const { data, error } = await supabase.storage.from(GENEALOGY_PHOTO_BUCKET).download(path);
  if (error || !(data instanceof Blob)) return null;
  return { path, blob: data };
}
