-- Feature 5A: in-app portal notifications

CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  receipt_id uuid REFERENCES public.receipts(id) ON DELETE CASCADE,
  claim_id uuid REFERENCES public.warranty_claims(id) ON DELETE CASCADE,
  track_id text,
  event_key text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX notifications_user_event_key_idx
  ON public.notifications (user_id, event_key);
CREATE INDEX notifications_user_created_idx
  ON public.notifications (user_id, created_at DESC);
CREATE INDEX notifications_user_unread_idx
  ON public.notifications (user_id) WHERE read_at IS NULL;

GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users mark own notifications read"
  ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Only read_at may ever change from the client.
CREATE OR REPLACE FUNCTION app_private.enforce_notification_immutability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app_private
AS $$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.type IS DISTINCT FROM OLD.type
     OR NEW.title IS DISTINCT FROM OLD.title
     OR NEW.body IS DISTINCT FROM OLD.body
     OR NEW.receipt_id IS DISTINCT FROM OLD.receipt_id
     OR NEW.claim_id IS DISTINCT FROM OLD.claim_id
     OR NEW.track_id IS DISTINCT FROM OLD.track_id
     OR NEW.event_key IS DISTINCT FROM OLD.event_key
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Only the read state of a notification can change';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER notifications_immutable
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION app_private.enforce_notification_immutability();

REVOKE ALL ON FUNCTION app_private.enforce_notification_immutability() FROM PUBLIC, anon, authenticated;

-- Repair status changes -> active customer claimants of that repair
CREATE OR REPLACE FUNCTION app_private.notify_repair_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app_private
AS $$
DECLARE
  r RECORD;
  msg text;
BEGIN
  SELECT id, track_id, device_model INTO r FROM public.receipts WHERE id = NEW.receipt_id;
  IF r.id IS NULL THEN RETURN NEW; END IF;

  msg := CASE NEW.status
    WHEN 'Ready for Pickup' THEN 'Your ' || r.device_model || ' is ready for pickup.'
    WHEN 'Delivered' THEN 'Your ' || r.device_model || ' was marked delivered. Warranty cover starts now.'
    ELSE 'Your ' || r.device_model || ' repair is now "' || NEW.status || '".'
  END;

  INSERT INTO public.notifications (user_id, type, title, body, receipt_id, track_id, event_key)
  SELECT rc.user_id,
         CASE NEW.status
           WHEN 'Ready for Pickup' THEN 'repair_ready'
           WHEN 'Delivered' THEN 'repair_delivered'
           ELSE 'repair_status'
         END,
         'Repair update · ' || r.track_id,
         msg,
         r.id,
         r.track_id,
         'status_event:' || NEW.id
  FROM public.receipt_claims rc
  WHERE rc.receipt_id = NEW.receipt_id AND rc.status = 'active'
  ON CONFLICT (user_id, event_key) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER status_events_notify
  AFTER INSERT ON public.status_events
  FOR EACH ROW EXECUTE FUNCTION app_private.notify_repair_status_change();

REVOKE ALL ON FUNCTION app_private.notify_repair_status_change() FROM PUBLIC, anon, authenticated;

-- Warranty claim events -> claim owner, plus workshop members on submission
CREATE OR REPLACE FUNCTION app_private.notify_warranty_claim_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, app_private
AS $$
DECLARE
  c RECORD;
BEGIN
  SELECT wc.id, wc.user_id, wc.workshop_id, wc.receipt_id, r.track_id, r.device_model
    INTO c
  FROM public.warranty_claims wc
  JOIN public.receipts r ON r.id = wc.receipt_id
  WHERE wc.id = NEW.claim_id;
  IF c.id IS NULL THEN RETURN NEW; END IF;

  IF NEW.status = 'Submitted' THEN
    -- Workshop owner/staff get the new-claim alert.
    INSERT INTO public.notifications (user_id, type, title, body, receipt_id, claim_id, track_id, event_key)
    SELECT wm.user_id,
           'claim_submitted',
           'New warranty claim · ' || c.track_id,
           'A customer submitted a warranty claim for ' || c.device_model || '.',
           c.receipt_id, c.id, c.track_id,
           'claim_event:' || NEW.id
    FROM public.workshop_members wm
    WHERE wm.workshop_id = c.workshop_id
    ON CONFLICT (user_id, event_key) DO NOTHING;
  ELSE
    -- Customer hears about every review step after submission.
    INSERT INTO public.notifications (user_id, type, title, body, receipt_id, claim_id, track_id, event_key)
    VALUES (
      c.user_id,
      'claim_status',
      'Warranty claim ' || NEW.status || ' · ' || c.track_id,
      CASE WHEN NEW.note IS NOT NULL AND length(trim(NEW.note)) > 0
        THEN 'Your claim is now "' || NEW.status || '". Note: ' || NEW.note
        ELSE 'Your claim is now "' || NEW.status || '".'
      END,
      c.receipt_id, c.id, c.track_id,
      'claim_event:' || NEW.id
    )
    ON CONFLICT (user_id, event_key) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER warranty_claim_events_notify
  AFTER INSERT ON public.warranty_claim_events
  FOR EACH ROW EXECUTE FUNCTION app_private.notify_warranty_claim_event();

REVOKE ALL ON FUNCTION app_private.notify_warranty_claim_event() FROM PUBLIC, anon, authenticated;