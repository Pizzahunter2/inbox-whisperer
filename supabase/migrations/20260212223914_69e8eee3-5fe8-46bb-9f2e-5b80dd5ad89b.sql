CREATE POLICY "Users can delete proposals for their messages"
ON public.proposals
FOR DELETE
USING (EXISTS (
  SELECT 1 FROM messages
  WHERE messages.id = proposals.message_id
  AND messages.user_id = auth.uid()
));