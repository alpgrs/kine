-- Per-organization invoice sequence (Belgian legal requirement: sequential per entity)
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS invoice_seq integer NOT NULL DEFAULT 0;

-- Replace global-sequence function with per-org atomic counter
CREATE OR REPLACE FUNCTION public.generate_invoice_number(_org_id uuid)
RETURNS text
LANGUAGE plpgsql AS $$
DECLARE
  next_val integer;
BEGIN
  UPDATE public.organizations
    SET invoice_seq = invoice_seq + 1
    WHERE id = _org_id
    RETURNING invoice_seq INTO next_val;
  RETURN 'F-' || to_char(now(), 'YYYY') || '-' || lpad(next_val::text, 4, '0');
END;
$$;
