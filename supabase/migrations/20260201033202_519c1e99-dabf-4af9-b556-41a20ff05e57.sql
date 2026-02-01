-- Create enum types
CREATE TYPE public.email_category AS ENUM ('meeting_request', 'action_needed', 'fyi', 'newsletter', 'other');
CREATE TYPE public.confidence_level AS ENUM ('low', 'medium', 'high');
CREATE TYPE public.reply_tone AS ENUM ('neutral', 'friendly', 'formal');
CREATE TYPE public.action_status AS ENUM ('pending', 'sent', 'drafted', 'archived', 'declined');
CREATE TYPE public.proposed_action_type AS ENUM ('reply', 'draft', 'schedule', 'ask_question', 'archive', 'mark_done', 'decline');

-- Create profiles table for user preferences
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  reply_tone reply_tone DEFAULT 'neutral',
  signature TEXT DEFAULT '',
  timezone TEXT DEFAULT 'America/New_York',
  working_hours_start TIME DEFAULT '09:00',
  working_hours_end TIME DEFAULT '17:00',
  meeting_min_notice_hours INTEGER DEFAULT 24,
  meeting_default_duration INTEGER DEFAULT 30,
  auto_suggest_slots BOOLEAN DEFAULT true,
  auto_archive_newsletters BOOLEAN DEFAULT false,
  flag_invoices BOOLEAN DEFAULT true,
  demo_mode BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create connected_accounts table
CREATE TABLE public.connected_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('gmail', 'google_calendar')),
  status TEXT DEFAULT 'not_connected' CHECK (status IN ('connected', 'not_connected', 'error')),
  access_token_encrypted TEXT,
  refresh_token_encrypted TEXT,
  token_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(user_id, provider)
);

-- Create messages table
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  provider_message_id TEXT,
  from_name TEXT,
  from_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_snippet TEXT,
  body_full TEXT,
  received_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  is_demo BOOLEAN DEFAULT false,
  processed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create classifications table
CREATE TABLE public.classifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES public.messages(id) ON DELETE CASCADE NOT NULL UNIQUE,
  category email_category NOT NULL,
  confidence confidence_level NOT NULL,
  extracted_entities JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create proposals table
CREATE TABLE public.proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES public.messages(id) ON DELETE CASCADE NOT NULL UNIQUE,
  proposed_action proposed_action_type NOT NULL,
  summary TEXT NOT NULL,
  suggested_reply TEXT,
  suggested_time_slots JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Create outcomes table
CREATE TABLE public.outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES public.messages(id) ON DELETE CASCADE NOT NULL UNIQUE,
  final_action proposed_action_type NOT NULL,
  final_reply_text TEXT,
  status action_status NOT NULL DEFAULT 'pending',
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connected_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outcomes ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);

-- Connected accounts policies
CREATE POLICY "Users can view their own connected accounts" ON public.connected_accounts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own connected accounts" ON public.connected_accounts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own connected accounts" ON public.connected_accounts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own connected accounts" ON public.connected_accounts
  FOR DELETE USING (auth.uid() = user_id);

-- Messages policies
CREATE POLICY "Users can view their own messages" ON public.messages
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own messages" ON public.messages
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own messages" ON public.messages
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own messages" ON public.messages
  FOR DELETE USING (auth.uid() = user_id);

-- Classifications policies (need to check through messages table)
CREATE POLICY "Users can view classifications for their messages" ON public.classifications
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.messages WHERE messages.id = classifications.message_id AND messages.user_id = auth.uid())
  );

CREATE POLICY "Users can insert classifications for their messages" ON public.classifications
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.messages WHERE messages.id = classifications.message_id AND messages.user_id = auth.uid())
  );

-- Proposals policies
CREATE POLICY "Users can view proposals for their messages" ON public.proposals
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.messages WHERE messages.id = proposals.message_id AND messages.user_id = auth.uid())
  );

CREATE POLICY "Users can insert proposals for their messages" ON public.proposals
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.messages WHERE messages.id = proposals.message_id AND messages.user_id = auth.uid())
  );

CREATE POLICY "Users can update proposals for their messages" ON public.proposals
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.messages WHERE messages.id = proposals.message_id AND messages.user_id = auth.uid())
  );

-- Outcomes policies
CREATE POLICY "Users can view outcomes for their messages" ON public.outcomes
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.messages WHERE messages.id = outcomes.message_id AND messages.user_id = auth.uid())
  );

CREATE POLICY "Users can insert outcomes for their messages" ON public.outcomes
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.messages WHERE messages.id = outcomes.message_id AND messages.user_id = auth.uid())
  );

CREATE POLICY "Users can update outcomes for their messages" ON public.outcomes
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.messages WHERE messages.id = outcomes.message_id AND messages.user_id = auth.uid())
  );

-- Create function to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  
  -- Also create default connected account entries
  INSERT INTO public.connected_accounts (user_id, provider, status)
  VALUES 
    (NEW.id, 'gmail', 'not_connected'),
    (NEW.id, 'google_calendar', 'not_connected');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Add updated_at triggers
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_connected_accounts_updated_at
  BEFORE UPDATE ON public.connected_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_outcomes_updated_at
  BEFORE UPDATE ON public.outcomes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();