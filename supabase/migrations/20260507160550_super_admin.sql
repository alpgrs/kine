-- =====================================================================
-- SUPER ADMIN: platform-wide owner that can manage all organizations
-- =====================================================================

-- Flag on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_super_admin boolean NOT NULL DEFAULT false;

-- Predicate helper (SECURITY DEFINER to avoid recursive RLS lookups)
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT is_super_admin FROM public.profiles WHERE id = _user_id), false);
$$;

GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated;

-- =====================================================================
-- RLS: super admin can see / modify everything
-- =====================================================================

-- profiles: read all, update flag
CREATE POLICY "profiles_select_super_admin" ON public.profiles
  FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));
CREATE POLICY "profiles_update_super_admin" ON public.profiles
  FOR UPDATE TO authenticated USING (public.is_super_admin(auth.uid()));

-- organizations
CREATE POLICY "orgs_select_super_admin" ON public.organizations
  FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));
CREATE POLICY "orgs_update_super_admin" ON public.organizations
  FOR UPDATE TO authenticated USING (public.is_super_admin(auth.uid()));
CREATE POLICY "orgs_delete_super_admin" ON public.organizations
  FOR DELETE TO authenticated USING (public.is_super_admin(auth.uid()));

-- memberships
CREATE POLICY "memberships_select_super_admin" ON public.memberships
  FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));
CREATE POLICY "memberships_delete_super_admin" ON public.memberships
  FOR DELETE TO authenticated USING (public.is_super_admin(auth.uid()));

-- subscriptions
CREATE POLICY "subs_select_super_admin" ON public.subscriptions
  FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));
CREATE POLICY "subs_update_super_admin" ON public.subscriptions
  FOR UPDATE TO authenticated USING (public.is_super_admin(auth.uid()));

-- invoices
CREATE POLICY "invoices_select_super_admin" ON public.invoices
  FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));

-- appointments
CREATE POLICY "appt_select_super_admin" ON public.appointments
  FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));

-- services / working_hours / unavailabilities
CREATE POLICY "services_select_super_admin" ON public.services
  FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));
CREATE POLICY "wh_select_super_admin" ON public.working_hours
  FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));
CREATE POLICY "unavail_select_super_admin" ON public.unavailabilities
  FOR SELECT TO authenticated USING (public.is_super_admin(auth.uid()));

-- =====================================================================
-- ADMIN RPCs
-- =====================================================================

-- Global aggregated stats
CREATE OR REPLACE FUNCTION public.admin_global_stats()
RETURNS json
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  result json;
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden: super admin required';
  END IF;

  SELECT json_build_object(
    'organizations_count', (SELECT COUNT(*) FROM public.organizations),
    'users_count', (SELECT COUNT(*) FROM public.profiles),
    'appointments_total', (SELECT COUNT(*) FROM public.appointments),
    'appointments_30d', (SELECT COUNT(*) FROM public.appointments WHERE created_at >= NOW() - INTERVAL '30 days'),
    'appointments_upcoming', (SELECT COUNT(*) FROM public.appointments WHERE status = 'scheduled' AND start_time >= NOW()),
    'invoices_count', (SELECT COUNT(*) FROM public.invoices),
    'revenue_total_cents', (SELECT COALESCE(SUM(amount), 0) FROM public.invoices WHERE status IN ('open', 'paid')),
    'revenue_30d_cents', (SELECT COALESCE(SUM(amount), 0) FROM public.invoices WHERE status IN ('open', 'paid') AND issued_at >= NOW() - INTERVAL '30 days'),
    'subs_active', (SELECT COUNT(*) FROM public.subscriptions WHERE status IN ('trialing', 'active')),
    'subs_past_due', (SELECT COUNT(*) FROM public.subscriptions WHERE status = 'past_due'),
    'orgs_signups_30d', (SELECT COUNT(*) FROM public.organizations WHERE created_at >= NOW() - INTERVAL '30 days')
  ) INTO result;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_global_stats() TO authenticated;

-- Listing of organizations with summary fields
CREATE OR REPLACE FUNCTION public.admin_list_organizations()
RETURNS TABLE(
  id uuid,
  name text,
  slug text,
  booking_slug text,
  professional_title text,
  inami_number text,
  vat_exempt boolean,
  created_at timestamptz,
  member_count bigint,
  appointments_count bigint,
  invoices_count bigint,
  revenue_cents bigint,
  sub_status text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    o.id,
    o.name,
    o.slug,
    o.booking_slug,
    o.professional_title,
    o.inami_number,
    o.vat_exempt,
    o.created_at,
    (SELECT COUNT(*) FROM public.memberships WHERE organization_id = o.id),
    (SELECT COUNT(*) FROM public.appointments WHERE organization_id = o.id),
    (SELECT COUNT(*) FROM public.invoices WHERE organization_id = o.id),
    (SELECT COALESCE(SUM(amount), 0) FROM public.invoices WHERE organization_id = o.id AND status IN ('open', 'paid')),
    (SELECT status::text FROM public.subscriptions WHERE organization_id = o.id ORDER BY created_at DESC LIMIT 1)
  FROM public.organizations o
  WHERE public.is_super_admin(auth.uid());
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_organizations() TO authenticated;

-- Listing of users with org count
CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE(
  id uuid,
  email text,
  first_name text,
  last_name text,
  language text,
  is_super_admin boolean,
  created_at timestamptz,
  org_count bigint
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    p.id,
    p.email,
    p.first_name,
    p.last_name,
    p.language::text,
    p.is_super_admin,
    p.created_at,
    (SELECT COUNT(*) FROM public.memberships WHERE user_id = p.id)
  FROM public.profiles p
  WHERE public.is_super_admin(auth.uid())
  ORDER BY p.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;

-- Toggle super admin flag for another user (only if caller is super admin)
CREATE OR REPLACE FUNCTION public.admin_set_super_admin(_user_id uuid, _value boolean)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden: super admin required';
  END IF;
  -- Prevent demoting yourself
  IF _user_id = auth.uid() AND _value = false THEN
    RAISE EXCEPTION 'Cannot demote yourself';
  END IF;
  UPDATE public.profiles SET is_super_admin = _value WHERE id = _user_id;
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_super_admin(uuid, boolean) TO authenticated;

-- =====================================================================
-- AUTO-PROMOTE specific email on signup (idempotent)
-- =====================================================================

-- Update existing profile if it already exists (for the case where the user
-- has already signed up before this migration ran).
UPDATE public.profiles
  SET is_super_admin = true
  WHERE lower(email) = 'gurseveralperen@gmail.com';

-- Hook into handle_new_user so future signups with this email auto-promote.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, language, is_super_admin)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE((NEW.raw_user_meta_data->>'language')::public.app_language, 'fr'),
    lower(NEW.email) = 'gurseveralperen@gmail.com'
  )
  ON CONFLICT (id) DO UPDATE
    SET is_super_admin = profiles.is_super_admin OR (lower(NEW.email) = 'gurseveralperen@gmail.com');
  RETURN NEW;
END;
$$;
