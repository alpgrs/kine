-- Cancel token on appointments (patient self-cancellation via SMS link)
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS cancel_token text UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex');

CREATE INDEX IF NOT EXISTS appointments_cancel_token_idx ON public.appointments(cancel_token);

-- RPC: look up minimal appointment info by cancel token (no PII leak)
CREATE OR REPLACE FUNCTION public.get_appointment_by_token(_token text)
RETURNS TABLE(
  id uuid,
  patient_first_name text,
  start_time timestamptz,
  end_time timestamptz,
  service_name text,
  org_name text,
  status text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    a.id,
    a.patient_first_name,
    a.start_time,
    a.end_time,
    COALESCE(s.name, '—') AS service_name,
    o.name AS org_name,
    a.status::text
  FROM public.appointments a
  LEFT JOIN public.services s ON s.id = a.service_id
  JOIN public.organizations o ON o.id = a.organization_id
  WHERE a.cancel_token = _token;
$$;

GRANT EXECUTE ON FUNCTION public.get_appointment_by_token(text) TO anon, authenticated;

-- RPC: cancel appointment by token (only future, scheduled appointments)
CREATE OR REPLACE FUNCTION public.cancel_appointment_by_token(_token text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  appt public.appointments%ROWTYPE;
BEGIN
  SELECT * INTO appt FROM public.appointments WHERE cancel_token = _token FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF appt.status != 'scheduled' THEN RETURN false; END IF;
  IF appt.start_time <= now() THEN RETURN false; END IF;
  UPDATE public.appointments SET status = 'cancelled' WHERE cancel_token = _token;
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_appointment_by_token(text) TO anon, authenticated;
