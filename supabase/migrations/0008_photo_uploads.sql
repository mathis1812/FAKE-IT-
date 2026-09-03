-- Bucket dédié aux photos sources déposées par le client, en remplacement de
-- l'hébergeur tiers kie.ai.
--
-- Pourquoi : la photo traversait le réseau quatre fois avant que Gemini ne
-- commence. Navigateur → notre fonction → kie.ai (upload), puis à la
-- génération notre fonction re-téléchargeait les mêmes octets depuis kie.ai
-- avant de les encoder en base64 pour Gemini. L'URL source n'étant jamais
-- persistée (`persistImageBytes` ne stocke que `result_url`), cet
-- aller-retour n'avait aucune valeur durable — uniquement de la latence, une
-- dépendance tierce et une clé d'API de plus.
--
-- Même forme que le bucket `video-uploads` (0005/0006), limites comprises :
-- l'upload a lieu avant toute vérification de crédits, donc les plafonds
-- doivent être appliqués par Supabase Storage lui-même et non par le client.
--
-- Migration ré-exécutable : `on conflict do nothing`, `update` idempotent et
-- `drop policy if exists` avant chaque `create policy`.

insert into storage.buckets (id, name, public)
values ('photo-uploads', 'photo-uploads', true)
on conflict (id) do nothing;

-- 4 Mio = 4194304 octets, aligné sur MAX_UPLOAD_BYTES côté client
-- (lib/studio-image.ts), qui ré-encode la photo jusqu'à tenir dessous.
-- Types MIME : les trois formats que produit ou laisse passer prepareImage.
update storage.buckets
set
  file_size_limit = 4194304,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'photo-uploads';

-- Lecture publique : l'URL est transmise à notre fonction de génération, qui
-- la télécharge sans porter de session utilisateur.
drop policy if exists "Public read access to photo-uploads bucket"
  on storage.objects;

create policy "Public read access to photo-uploads bucket"
  on storage.objects for select
  using (bucket_id = 'photo-uploads');

-- Écriture limitée : un utilisateur authentifié ne peut uploader que dans son
-- propre dossier (premier segment du chemin = son user id).
drop policy if exists "Users can upload to their own photo-uploads folder"
  on storage.objects;

create policy "Users can upload to their own photo-uploads folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'photo-uploads'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can delete from their own photo-uploads folder"
  on storage.objects;

create policy "Users can delete from their own photo-uploads folder"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'photo-uploads'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
