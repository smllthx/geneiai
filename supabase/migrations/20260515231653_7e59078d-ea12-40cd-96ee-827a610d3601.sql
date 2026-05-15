
-- Unique endpoint para upsert
DO $$ BEGIN
  ALTER TABLE public.push_subscriptions ADD CONSTRAINT push_subscriptions_endpoint_key UNIQUE (endpoint);
EXCEPTION WHEN duplicate_table THEN NULL; WHEN duplicate_object THEN NULL; END $$;

-- Función que llama al edge function send-push vía pg_net
CREATE OR REPLACE FUNCTION public.trigger_send_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  fn_url text := 'https://vkzofofafjvbazvrhhyj.supabase.co/functions/v1/send-push';
  anon  text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZrem9mb2ZhZmp2YmF6dnJoaHlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2NzYyNDUsImV4cCI6MjA5NDI1MjI0NX0.CHMGgaXfK3uJMh_C_AtQYMSe9mL0r0tk4elkTMQf5mg';
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

DROP TRIGGER IF EXISTS notificaciones_send_push ON public.notificaciones;
CREATE TRIGGER notificaciones_send_push
AFTER INSERT ON public.notificaciones
FOR EACH ROW EXECUTE FUNCTION public.trigger_send_push();
