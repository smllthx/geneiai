CREATE OR REPLACE FUNCTION public.trigger_send_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  fn_url text := 'https://fbqovchaouhisdyxhdhy.supabase.co/functions/v1/send-push';
  anon  text := 'sb_publishable_9J09fdA8WeaGCBo5dOYPtQ_Bvp3ljpx';
BEGIN
  PERFORM net.http_post(
    url := fn_url,
    headers := jsonb_build_object('Content-Type','application/json','apikey',anon,'Authorization','Bearer '||anon),
    body := jsonb_build_object(
      'user_id', NEW.user_id,
      'titulo', NEW.titulo,
      'mensaje', NEW.mensaje,
      'url', NEW.url,
      'notificacion_id', NEW.id
    )
  );
  RETURN NEW;
END; $$;
