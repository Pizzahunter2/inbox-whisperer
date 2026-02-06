-- Add unique constraint to prevent duplicate messages
ALTER TABLE public.messages 
ADD CONSTRAINT messages_user_provider_unique 
UNIQUE (user_id, provider_message_id);

-- Clean up existing duplicates (keep the first one inserted)
DELETE FROM public.messages a
USING public.messages b
WHERE a.id > b.id 
  AND a.provider_message_id = b.provider_message_id 
  AND a.user_id = b.user_id
  AND a.provider_message_id IS NOT NULL;