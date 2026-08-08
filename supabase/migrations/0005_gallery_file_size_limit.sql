-- Plafonne la taille des objets du bucket gallery (uploads signés + résultats).
-- 50 Mo = limite client vidéo ; les images générées restent bien en dessous.
update storage.buckets
set file_size_limit = 52428800
where id = 'gallery';
