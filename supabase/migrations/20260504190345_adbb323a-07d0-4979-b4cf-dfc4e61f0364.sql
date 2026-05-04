
-- =====================================================================
-- ENUMS
-- =====================================================================
CREATE TYPE public.app_role AS ENUM ('owner', 'editor', 'viewer');
CREATE TYPE public.app_language AS ENUM ('fr', 'nl', 'en');
CREATE TYPE public.subscription_status AS ENUM ('trialing', 'active', 'past_due', 'canceled', 'incomplete', 'incomplete_expired', 'unpaid', 'paused');
CREATE TYPE public.invoice_status AS ENUM ('draft', 'open', 'paid', 'uncollectible', 'void');
CREATE TYPE public.notification_channel AS ENUM ('email', 'sms', 'in_app');
CREATE TYPE public.notification_status AS ENUM ('pending', 'sent', 'failed', 'read');
CREATE TYPE public.invitation_status AS ENUM ('pending', 'accepted', 'revoked', 'expired');
CREATE TYPE public.plan_interval AS ENUM ('month', 'year');

-- =====================================================================
-- PROFILES (extends auth.users)
-- =====================================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  language public.app_language NOT NULL DEFAULT 'fr',
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- ORGANIZATIONS
-- =====================================================================
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  address_street TEXT,
  address_city TEXT,
  address_postal_code TEXT,
  address_country TEXT DEFAULT 'BE',
  vat_number TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT vat_belgian_format CHECK (vat_number IS NULL OR vat_number ~ '^BE0[0-9]{3}\.?[0-9]{3}\.?[0-9]{3}$')
);
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- MEMBERSHIPS
-- =====================================================================
CREATE TABLE public.memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'viewer',
  invited_at TIMESTAMPTZ DEFAULT now(),
  accepted_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, organization_id)
);
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_memberships_user ON public.memberships(user_id);
CREATE INDEX idx_memberships_org ON public.memberships(organization_id);

-- =====================================================================
-- INVITATIONS
-- =====================================================================
CREATE TABLE public.invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role public.app_role NOT NULL DEFAULT 'editor',
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  status public.invitation_status NOT NULL DEFAULT 'pending',
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ
);
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_invitations_org ON public.invitations(organization_id);
CREATE INDEX idx_invitations_email ON public.invitations(email);

-- =====================================================================
-- PLANS
-- =====================================================================
CREATE TABLE public.plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_price_id TEXT UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  amount INTEGER NOT NULL, -- cents
  currency TEXT NOT NULL DEFAULT 'EUR',
  interval public.plan_interval NOT NULL DEFAULT 'month',
  features JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- SUBSCRIPTIONS
-- =====================================================================
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES public.plans(id) ON DELETE SET NULL,
  stripe_subscription_id TEXT UNIQUE,
  stripe_customer_id TEXT,
  status public.subscription_status NOT NULL DEFAULT 'incomplete',
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  canceled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
-- Enforce a single active subscription per organization
CREATE UNIQUE INDEX idx_one_active_sub_per_org
  ON public.subscriptions(organization_id)
  WHERE status IN ('trialing', 'active', 'past_due');

-- =====================================================================
-- INVOICES
-- =====================================================================
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  stripe_invoice_id TEXT UNIQUE,
  number TEXT NOT NULL UNIQUE,
  amount INTEGER NOT NULL, -- cents TTC
  amount_excl_vat INTEGER NOT NULL DEFAULT 0,
  vat_amount INTEGER NOT NULL DEFAULT 0,
  vat_rate NUMERIC(5,2) NOT NULL DEFAULT 21.00,
  currency TEXT NOT NULL DEFAULT 'EUR',
  status public.invoice_status NOT NULL DEFAULT 'draft',
  pdf_url TEXT,
  line_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_invoices_org ON public.invoices(organization_id);

-- Sequence helper for human-readable invoice numbers
CREATE SEQUENCE IF NOT EXISTS public.invoice_number_seq START 1;

-- =====================================================================
-- NOTIFICATIONS
-- =====================================================================
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  channel public.notification_channel NOT NULL DEFAULT 'in_app',
  status public.notification_status NOT NULL DEFAULT 'pending',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_notifications_user ON public.notifications(user_id);
CREATE INDEX idx_notifications_org ON public.notifications(organization_id);
CREATE INDEX idx_notifications_status ON public.notifications(status) WHERE status = 'pending';

-- =====================================================================
-- SECURITY DEFINER HELPERS (avoid RLS recursion on memberships)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.is_org_member(_org_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships
    WHERE organization_id = _org_id AND user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.has_org_role(_org_id UUID, _user_id UUID, _roles public.app_role[])
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.memberships
    WHERE organization_id = _org_id
      AND user_id = _user_id
      AND role = ANY(_roles)
  );
$$;

CREATE OR REPLACE FUNCTION public.user_org_ids(_user_id UUID)
RETURNS SETOF UUID LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT organization_id FROM public.memberships WHERE user_id = _user_id;
$$;

-- =====================================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- =====================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, language)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE((NEW.raw_user_meta_data->>'language')::public.app_language, 'fr')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================================
-- INVOICE NUMBER GENERATOR
-- =====================================================================
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  next_val BIGINT;
BEGIN
  next_val := nextval('public.invoice_number_seq');
  RETURN 'F-' || to_char(now(), 'YYYY') || '-' || lpad(next_val::TEXT, 4, '0');
END;
$$;

-- =====================================================================
-- UPDATED_AT TRIGGERS
-- =====================================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_orgs_updated BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_subs_updated BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =====================================================================
-- RLS POLICIES
-- =====================================================================

-- profiles: each user manages their own profile
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid());
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

-- organizations
CREATE POLICY "orgs_select_member" ON public.organizations
  FOR SELECT TO authenticated USING (public.is_org_member(id, auth.uid()));
CREATE POLICY "orgs_insert_authenticated" ON public.organizations
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "orgs_update_owner" ON public.organizations
  FOR UPDATE TO authenticated
  USING (public.has_org_role(id, auth.uid(), ARRAY['owner']::public.app_role[]));
CREATE POLICY "orgs_delete_owner" ON public.organizations
  FOR DELETE TO authenticated
  USING (public.has_org_role(id, auth.uid(), ARRAY['owner']::public.app_role[]));

-- memberships
CREATE POLICY "memberships_select_member" ON public.memberships
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_org_member(organization_id, auth.uid()));
CREATE POLICY "memberships_insert_owner_or_self_first" ON public.memberships
  FOR INSERT TO authenticated
  WITH CHECK (
    -- Owner of the org can add members
    public.has_org_role(organization_id, auth.uid(), ARRAY['owner']::public.app_role[])
    -- Or the user is registering themselves as the first owner of an org they just created
    OR (user_id = auth.uid() AND role = 'owner')
  );
CREATE POLICY "memberships_update_owner" ON public.memberships
  FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner']::public.app_role[]));
CREATE POLICY "memberships_delete_owner_or_self" ON public.memberships
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_org_role(organization_id, auth.uid(), ARRAY['owner']::public.app_role[])
  );

-- invitations
CREATE POLICY "invitations_select_org_owner" ON public.invitations
  FOR SELECT TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner']::public.app_role[]));
CREATE POLICY "invitations_insert_owner" ON public.invitations
  FOR INSERT TO authenticated
  WITH CHECK (public.has_org_role(organization_id, auth.uid(), ARRAY['owner']::public.app_role[]));
CREATE POLICY "invitations_update_owner" ON public.invitations
  FOR UPDATE TO authenticated
  USING (public.has_org_role(organization_id, auth.uid(), ARRAY['owner']::public.app_role[]));

-- plans (public read)
CREATE POLICY "plans_select_all" ON public.plans
  FOR SELECT TO authenticated, anon USING (is_active = true);

-- subscriptions
CREATE POLICY "subs_select_member" ON public.subscriptions
  FOR SELECT TO authenticated USING (public.is_org_member(organization_id, auth.uid()));

-- invoices
CREATE POLICY "invoices_select_member" ON public.invoices
  FOR SELECT TO authenticated USING (public.is_org_member(organization_id, auth.uid()));

-- notifications
CREATE POLICY "notif_select_own_or_org" ON public.notifications
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR (organization_id IS NOT NULL AND public.is_org_member(organization_id, auth.uid()))
  );
CREATE POLICY "notif_update_own_read" ON public.notifications
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- =====================================================================
-- STORAGE BUCKETS
-- =====================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('org-assets', 'org-assets', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('invoices', 'invoices', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: org-assets
CREATE POLICY "org_assets_public_read" ON storage.objects
  FOR SELECT TO authenticated, anon
  USING (bucket_id = 'org-assets');
CREATE POLICY "org_assets_upload_member" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'org-assets'
    AND public.has_org_role(
      ((storage.foldername(name))[1])::uuid,
      auth.uid(),
      ARRAY['owner','editor']::public.app_role[]
    )
  );
CREATE POLICY "org_assets_update_owner" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'org-assets'
    AND public.has_org_role(
      ((storage.foldername(name))[1])::uuid,
      auth.uid(),
      ARRAY['owner']::public.app_role[]
    )
  );
CREATE POLICY "org_assets_delete_owner" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'org-assets'
    AND public.has_org_role(
      ((storage.foldername(name))[1])::uuid,
      auth.uid(),
      ARRAY['owner']::public.app_role[]
    )
  );

-- Storage policies: invoices (private, members only)
CREATE POLICY "invoices_read_member" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'invoices'
    AND public.is_org_member(
      ((storage.foldername(name))[1])::uuid,
      auth.uid()
    )
  );

-- =====================================================================
-- SEED DEFAULT PLANS
-- =====================================================================
INSERT INTO public.plans (name, description, amount, currency, interval, features, sort_order) VALUES
  ('Starter', 'Pour démarrer en solo', 2900, 'EUR', 'month', '["1 utilisateur","100 rendez-vous/mois","Support email"]'::jsonb, 1),
  ('Pro', 'Pour les équipes en croissance', 5900, 'EUR', 'month', '["5 utilisateurs","1000 rendez-vous/mois","Notifications SMS","Support prioritaire"]'::jsonb, 2),
  ('Business', 'Pour les organisations établies', 9900, 'EUR', 'month', '["Utilisateurs illimités","Rendez-vous illimités","API access","Support dédié"]'::jsonb, 3);

-- =====================================================================
-- ENABLE REALTIME ON NOTIFICATIONS
-- =====================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
