-- Asistente virtual: conversaciones y mensajes persistentes
-- Ejecutar después de produccion-setup.sql (usa user_has_company)
-- NOTA: tras correrla, ejecutar: NOTIFY pgrst, 'reload schema';

-- Tabla de conversaciones (una por usuario+empresa, puede haber varias)
CREATE TABLE IF NOT EXISTS public.chat_conversaciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  user_id uuid NOT NULL,
  titulo text NOT NULL DEFAULT 'Nueva conversación',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Tabla de mensajes
CREATE TABLE IF NOT EXISTS public.chat_mensajes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversacion_id uuid NOT NULL REFERENCES public.chat_conversaciones(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_mensajes_conversacion_idx ON public.chat_mensajes (conversacion_id, created_at);
CREATE INDEX IF NOT EXISTS chat_conversaciones_user_company_idx ON public.chat_conversaciones (user_id, company_id, updated_at DESC);

-- RLS (solo si company_members existe, igual que el resto de módulos)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'company_members') THEN
    ALTER TABLE public.chat_conversaciones ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.chat_mensajes ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS "chat_conversaciones_propias" ON public.chat_conversaciones;
    CREATE POLICY "chat_conversaciones_propias" ON public.chat_conversaciones FOR ALL USING (
      user_has_company(chat_conversaciones.company_id) AND user_id = auth.uid()
    );

    DROP POLICY IF EXISTS "chat_mensajes_acceso" ON public.chat_mensajes;
    CREATE POLICY "chat_mensajes_acceso" ON public.chat_mensajes FOR ALL USING (
      EXISTS (
        SELECT 1 FROM public.chat_conversaciones c
        WHERE c.id = chat_mensajes.conversacion_id
          AND user_has_company(c.company_id)
          AND c.user_id = auth.uid()
      )
    );
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
