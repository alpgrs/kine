-- Unavailabilities: practitioner absence / holiday blocking
CREATE TABLE IF NOT EXISTS public.unavailabilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  date_from date NOT NULL,
  date_to date NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (date_to >= date_from)
);
ALTER TABLE public.unavailabilities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "unavail_select_member" ON public.unavailabilities
  FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));

CREATE POLICY "unavail_select_anon" ON public.unavailabilities
  FOR SELECT TO anon USING (true);

CREATE POLICY "unavail_insert_member" ON public.unavailabilities
  FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','editor']::app_role[]));

CREATE POLICY "unavail_delete_member" ON public.unavailabilities
  FOR DELETE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','editor']::app_role[]));

CREATE INDEX IF NOT EXISTS unavail_org_dates_idx ON public.unavailabilities(organization_id, date_from, date_to);

-- Update get_busy_slots to include unavailability windows
CREATE OR REPLACE FUNCTION public.get_busy_slots(_org_id uuid, _from timestamptz, _to timestamptz)
RETURNS TABLE(start_time timestamptz, end_time timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT start_time, end_time
  FROM public.appointments
  WHERE organization_id = _org_id
    AND status = 'scheduled'
    AND start_time < _to
    AND end_time > _from
  UNION ALL
  SELECT date_from::timestamptz, (date_to + INTERVAL '1 day')::timestamptz
  FROM public.unavailabilities
  WHERE organization_id = _org_id
    AND date_from <= _to::date
    AND date_to >= _from::date;
$$;
