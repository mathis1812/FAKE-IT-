-- Durcissement du bucket "video-uploads" créé par 0005 (déjà appliquée en
-- base, donc non modifiée : les limites arrivent dans cette migration-ci).
--
-- 0005 a créé un bucket public sans limite de taille côté serveur, sans
-- restriction de type MIME et sans policy de suppression. Comme
-- uploadVideoDirect (app/page.tsx) uploade la vidéo source avant toute
-- vérification de crédits, un compte à 0 crédit pouvait y déposer des
-- fichiers de n'importe quelle taille et de n'importe quel type, en boucle :
-- hébergement gratuit à nos frais. Les limites posées ici sont appliquées par
-- Supabase Storage lui-même, indépendamment de ce que fait le client.
--
-- Migration ré-exécutable : `drop policy if exists` avant chaque
-- `create policy`, et un `update` idempotent sur le bucket.

-- 50 Mio = 52428800 octets, aligné sur MAX_VIDEO_SOURCE_BYTES côté client.
-- Types MIME : mp4 et mov (quicktime), les seuls formats acceptés par la
-- validation côté client.
update storage.buckets
set
  file_size_limit = 52428800,
  allowed_mime_types = array['video/mp4', 'video/quicktime']
where id = 'video-uploads';

-- Suppression limitée : un utilisateur authentifié ne peut supprimer que dans
-- son propre dossier (premier segment du chemin = son user id), jamais dans
-- celui d'un autre utilisateur. Même forme que la policy d'insertion de 0005.
drop policy if exists "Users can delete from their own video-uploads folder"
  on storage.objects;

create policy "Users can delete from their own video-uploads folder"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'video-uploads'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
