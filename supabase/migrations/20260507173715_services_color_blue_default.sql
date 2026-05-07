-- Switch the default color of newly created services from emerald (#10b981)
-- to bright blue (#3b82f6) to match the new brand palette.
ALTER TABLE public.services ALTER COLUMN color SET DEFAULT '#3b82f6';

-- Re-color existing services that still carry the old emerald default so the
-- agenda doesn't render green chips on legacy data.
UPDATE public.services SET color = '#3b82f6' WHERE color = '#10b981';
