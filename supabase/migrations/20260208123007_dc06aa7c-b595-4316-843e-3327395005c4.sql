
-- Add monthly_budget column to profiles
ALTER TABLE public.profiles ADD COLUMN monthly_budget numeric DEFAULT 0;
