-- Create gmail_watch_state table for push notification state
CREATE TABLE public.gmail_watch_state (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  history_id TEXT NOT NULL,
  expiration TIMESTAMPTZ,
  gmail_email TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS (writes via service role only)
ALTER TABLE public.gmail_watch_state ENABLE ROW LEVEL SECURITY;

-- Users can read their own watch state
CREATE POLICY "Users can view their own watch state"
ON public.gmail_watch_state
FOR SELECT
USING (auth.uid() = user_id);

-- Enable realtime for messages table
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;