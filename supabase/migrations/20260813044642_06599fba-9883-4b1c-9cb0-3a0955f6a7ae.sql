create or replace function public.enforce_receipt_immutability()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  if old.id is distinct from new.id
     or old.track_id is distinct from new.track_id
     or old.workshop_id is distinct from new.workshop_id
     or old.customer_name is distinct from new.customer_name
     or old.customer_phone is distinct from new.customer_phone
     or old.customer_email is distinct from new.customer_email
     or old.device_model is distinct from new.device_model
     or old.serial_number is distinct from new.serial_number
     or old.issue_description is distinct from new.issue_description
     or old.warranty_days is distinct from new.warranty_days
     or old.created_by is distinct from new.created_by
     or old.created_at is distinct from new.created_at
  then
    raise exception 'Receipt core fields are immutable';
  end if;
  return new;
end;
$function$;

revoke all on function public.is_workshop_member(uuid, uuid) from public, anon;
revoke all on function public.is_workshop_owner(uuid, uuid) from public, anon;
revoke all on function public.current_workshop_id(uuid) from public, anon;
revoke all on function public.has_role(uuid, public.app_role) from public, anon;

grant execute on function public.is_workshop_member(uuid, uuid) to authenticated, service_role;
grant execute on function public.is_workshop_owner(uuid, uuid) to authenticated, service_role;
grant execute on function public.current_workshop_id(uuid) to authenticated, service_role;
grant execute on function public.has_role(uuid, public.app_role) to authenticated, service_role;