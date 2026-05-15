
DROP POLICY IF EXISTS "fotos_public_read" ON storage.objects;
-- Lectura solo de archivos propios (las URLs públicas siguen funcionando para mostrar imágenes en <img>)
CREATE POLICY "fotos_owner_list" ON storage.objects FOR SELECT USING (
  bucket_id = 'fotos' AND auth.uid()::text = (storage.foldername(name))[1]
);
