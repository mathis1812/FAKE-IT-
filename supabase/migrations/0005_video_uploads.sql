-- Bucket dédié aux vidéos sources uploadées directement par le client
-- (contrairement au bucket "gallery", dont les écritures sont réservées à
-- service_role). Nécessaire pour l'édition vidéo-vers-vidéo (Kling O1 sur
-- fal.ai, accepte jusqu'à 200 Mo) : une vidéo source peut dépasser la
-- limite de taille de requête des fonctions serverless Vercel (~4,5 Mo),
-- donc l'upload doit passer directement du navigateur vers Supabase
-- Storage, sans transiter par nos routes API.
insert into storage.buckets (id, name, public)
values ('video-uploads', 'video-uploads', true)
on conflict (id) do nothing;

create policy "Public read access to video-uploads bucket"
  on storage.objects for select
  using (bucket_id = 'video-uploads');

-- Écriture limitée : un utilisateur authentifié ne peut uploader que dans
-- son propre dossier (premier segment du chemin = son user id), jamais
-- dans celui d'un autre utilisateur.
create policy "Users can upload to their own video-uploads folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'video-uploads'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
