
CREATE TABLE public.redeemed_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  code TEXT NOT NULL,
  description TEXT,
  granted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

ALTER TABLE public.redeemed_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own redemptions"
ON public.redeemed_codes FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert redemptions"
ON public.redeemed_codes FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE UNIQUE INDEX idx_redeemed_codes_user_code ON public.redeemed_codes (user_id, code);
