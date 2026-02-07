
-- Add missing RLS policies for gmail_watch_state (INSERT, UPDATE, DELETE)
CREATE POLICY "Users can insert their own watch state"
  ON public.gmail_watch_state
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own watch state"
  ON public.gmail_watch_state
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own watch state"
  ON public.gmail_watch_state
  FOR DELETE
  USING (auth.uid() = user_id);

-- Add missing UPDATE/DELETE policies for classifications
CREATE POLICY "Users can update classifications for their messages"
  ON public.classifications
  FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.messages WHERE messages.id = classifications.message_id AND messages.user_id = auth.uid()));

CREATE POLICY "Users can delete classifications for their messages"
  ON public.classifications
  FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.messages WHERE messages.id = classifications.message_id AND messages.user_id = auth.uid()));
