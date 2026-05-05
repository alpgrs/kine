
-- Extend organizations with healthcare fields
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS professional_title text,
  ADD COLUMN IF NOT EXISTS inami_number text,
  ADD COLUMN IF NOT EXISTS vat_exempt boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS booking_slug text,
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS public_phone text,
  ADD COLUMN IF NOT EXISTS public_email text;

UPDATE public.organizations SET booking_slug = slug WHERE booking_slug IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS organizations_booking_slug_uidx ON public.organizations(booking_slug) WHERE booking_slug IS NOT NULL;

-- Public can read minimal org info for booking page
CREATE POLICY "orgs_public_select_booking" ON public.organizations
  FOR SELECT TO anon, authenticated
  USING (booking_slug IS NOT NULL);

-- SERVICES
CREATE TABLE IF NOT EXISTS public.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  duration_minutes integer NOT NULL DEFAULT 30 CHECK (duration_minutes > 0),
  price_cents integer NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
  currency text NOT NULL DEFAULT 'EUR',
  color text DEFAULT '#10b981',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "services_select_member" ON public.services FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "services_select_public_active" ON public.services FOR SELECT TO anon, authenticated
  USING (is_active = true);
CREATE POLICY "services_insert_member" ON public.services FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','editor']::app_role[]));
CREATE POLICY "services_update_member" ON public.services FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','editor']::app_role[]));
CREATE POLICY "services_delete_owner" ON public.services FOR DELETE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner']::app_role[]));

CREATE TRIGGER set_services_updated_at BEFORE UPDATE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- WORKING HOURS
CREATE TABLE IF NOT EXISTS public.working_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.working_hours ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wh_select_public" ON public.working_hours FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "wh_insert_member" ON public.working_hours FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','editor']::app_role[]));
CREATE POLICY "wh_update_member" ON public.working_hours FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','editor']::app_role[]));
CREATE POLICY "wh_delete_member" ON public.working_hours FOR DELETE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','editor']::app_role[]));

-- APPOINTMENTS
DO $$ BEGIN
  CREATE TYPE public.appointment_status AS ENUM ('scheduled','completed','cancelled','no_show');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
  patient_first_name text NOT NULL,
  patient_last_name text NOT NULL,
  patient_email text NOT NULL,
  patient_phone text,
  notes text,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  status public.appointment_status NOT NULL DEFAULT 'scheduled',
  sms_sent boolean NOT NULL DEFAULT false,
  reminder_sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_time > start_time)
);
CREATE INDEX IF NOT EXISTS appointments_org_start_idx ON public.appointments(organization_id, start_time);
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- members can manage; public can INSERT (anonymous booking) and SELECT only minimal slot info via separate view? we expose select only to members.
CREATE POLICY "appt_select_member" ON public.appointments FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "appt_insert_public" ON public.appointments FOR INSERT TO anon, authenticated
  WITH CHECK (status = 'scheduled');
CREATE POLICY "appt_update_member" ON public.appointments FOR UPDATE TO authenticated
  USING (public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "appt_delete_member" ON public.appointments FOR DELETE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','editor']::app_role[]));

CREATE TRIGGER set_appointments_updated_at BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Public RPC: returns busy slots (start,end) for a given org/date range, no PII
CREATE OR REPLACE FUNCTION public.get_busy_slots(_org_id uuid, _from timestamptz, _to timestamptz)
RETURNS TABLE(start_time timestamptz, end_time timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT start_time, end_time FROM public.appointments
  WHERE organization_id = _org_id
    AND status = 'scheduled'
    AND start_time < _to
    AND end_time > _from;
$$;
GRANT EXECUTE ON FUNCTION public.get_busy_slots(uuid, timestamptz, timestamptz) TO anon, authenticated;

-- Link invoices to appointments
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS patient_name text,
  ADD COLUMN IF NOT EXISTS patient_email text,
  ADD COLUMN IF NOT EXISTS vat_exempt boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS inami_number text,
  ADD COLUMN IF NOT EXISTS notes text;

-- Allow members to insert/update invoices (currently locked)
CREATE POLICY "invoices_insert_member" ON public.invoices FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','editor']::app_role[]));
CREATE POLICY "invoices_update_member" ON public.invoices FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner','editor']::app_role[]));
