CREATE OR REPLACE FUNCTION public.enforce_warranty_claim_integrity()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
begin
  if old.id is distinct from new.id
     or old.receipt_id is distinct from new.receipt_id
     or old.workshop_id is distinct from new.workshop_id
     or old.user_id is distinct from new.user_id
     or old.reason is distinct from new.reason
     or old.created_at is distinct from new.created_at
  then
    raise exception 'Warranty claim core fields are immutable';
  end if;

  if new.status is distinct from old.status then
    if not (
      (old.status = 'Submitted' and new.status = 'Reviewing')
      or (old.status = 'Reviewing' and new.status in ('Approved','Rejected'))
      or (old.status = 'Approved' and new.status = 'Resolved')
    ) then
      raise exception 'Invalid warranty claim status transition: % -> %', old.status, new.status;
    end if;
  end if;

  return new;
end;
$$;

DROP TRIGGER IF EXISTS warranty_claims_integrity ON public.warranty_claims;
CREATE TRIGGER warranty_claims_integrity
BEFORE UPDATE ON public.warranty_claims
FOR EACH ROW EXECUTE FUNCTION public.enforce_warranty_claim_integrity();

REVOKE EXECUTE ON FUNCTION public.enforce_warranty_claim_integrity() FROM PUBLIC, anon, authenticated;