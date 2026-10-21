CREATE TABLE public.chat_reads (
  user_id uuid NOT NULL,
  thread_key text NOT NULL,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, thread_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_reads TO authenticated;
GRANT ALL ON public.chat_reads TO service_role;
ALTER TABLE public.chat_reads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own chat reads" ON public.chat_reads FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());