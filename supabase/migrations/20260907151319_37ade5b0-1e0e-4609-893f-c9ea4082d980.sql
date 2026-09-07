CREATE TYPE public.warranty_claim_status AS ENUM ('Submitted','Reviewing','Approved','Rejected','Resolved');

CREATE TABLE public.warranty_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id uuid NOT NULL REFERENCES public.receipts(id) ON DELETE CASCADE,
  workshop_id uuid NOT NULL REFERENCES public.workshops(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 10 AND 2000),
  status public.warranty_claim_status NOT NULL DEFAULT 'Submitted',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX warranty_claims_workshop_idx ON public.warranty_claims (workshop_id, created_at DESC);
CREATE INDEX warranty_claims_user_idx ON public.warranty_claims (user_id, created_at DESC);
CREATE INDEX warranty_claims_receipt_idx ON public.warranty_claims (receipt_id);
CREATE UNIQUE INDEX warranty_claims_one_open_per_customer
  ON public.warranty_claims (receipt_id, user_id)
  WHERE status IN ('Submitted','Reviewing','Approved');

CREATE TABLE public.warranty_claim_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL REFERENCES public.warranty_claims(id) ON DELETE CASCADE,
  status public.warranty_claim_status NOT NULL,
  note text CHECK (note IS NULL OR char_length(note) <= 2000),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX warranty_claim_events_claim_idx ON public.warranty_claim_events (claim_id, created_at);

GRANT SELECT ON public.warranty_claims TO authenticated;
GRANT ALL ON public.warranty_claims TO service_role;
GRANT SELECT ON public.warranty_claim_events TO authenticated;
GRANT ALL ON public.warranty_claim_events TO service_role;

ALTER TABLE public.warranty_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warranty_claim_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY warranty_claims_owner_select ON public.warranty_claims
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY warranty_claims_workshop_select ON public.warranty_claims
  FOR SELECT TO authenticated
  USING (app_private.is_workshop_member(auth.uid(), workshop_id));

CREATE POLICY warranty_claims_workshop_update ON public.warranty_claims
  FOR UPDATE TO authenticated
  USING (app_private.is_workshop_member(auth.uid(), workshop_id))
  WITH CHECK (app_private.is_workshop_member(auth.uid(), workshop_id));

CREATE POLICY warranty_claim_events_owner_select ON public.warranty_claim_events
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.warranty_claims c
    WHERE c.id = claim_id AND c.user_id = auth.uid()
  ));

CREATE POLICY warranty_claim_events_workshop_select ON public.warranty_claim_events
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.warranty_claims c
    WHERE c.id = claim_id AND app_private.is_workshop_member(auth.uid(), c.workshop_id)
  ));

CREATE TRIGGER warranty_claims_set_updated_at
  BEFORE UPDATE ON public.warranty_claims
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();