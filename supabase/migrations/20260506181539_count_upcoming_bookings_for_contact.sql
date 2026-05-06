-- Anti-abuse helper: returns how many upcoming scheduled bookings a contact
-- (matched by email or phone) already has within the given organization.
-- Exposed to anon so the public booking page can rate-limit before insert.
CREATE OR REPLACE FUNCTION public.count_upcoming_bookings_for_contact(
  _org_id uuid,
  _email text,
  _phone text
)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::integer
  FROM public.appointments
  WHERE organization_id = _org_id
    AND status = 'scheduled'
    AND start_time > now()
    AND (
      (NULLIF(_email, '') IS NOT NULL AND lower(patient_email) = lower(_email))
      OR (NULLIF(_phone, '') IS NOT NULL AND patient_phone = _phone)
    );
$$;

GRANT EXECUTE ON FUNCTION public.count_upcoming_bookings_for_contact(uuid, text, text) TO anon, authenticated;
