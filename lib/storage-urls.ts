/**
 * Vérifie qu'une URL pointe vers un objet du bucket public `gallery`
 * appartenant à `userId` (préfixe de chemin `{userId}/…`).
 */
export function isOwnedGalleryPublicUrl(
  url: string,
  userId: string,
): boolean {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!supabaseUrl || !userId) return false;

  try {
    const target = new URL(url);
    const base = new URL(supabaseUrl);
    if (target.origin !== base.origin) return false;

    const prefix = `/storage/v1/object/public/gallery/${userId}/`;
    return target.pathname.startsWith(prefix);
  } catch {
    return false;
  }
}
