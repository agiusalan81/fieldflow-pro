CREATE TABLE public.push_subscriptions (
  endpoint text PRIMARY KEY,
  user_id uuid NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX push_subscriptions_user_idx ON public.push_subscriptions(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own push subscriptions" ON public.push_subscriptions FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());