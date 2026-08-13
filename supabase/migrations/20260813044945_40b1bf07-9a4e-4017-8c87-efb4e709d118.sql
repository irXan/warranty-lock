create schema if not exists app_private;

revoke all on schema app_private from public, anon;
grant usage on schema app_private to authenticated, service_role;

alter function public.has_role(uuid, public.app_role) set schema app_private;
alter function public.is_workshop_member(uuid, uuid) set schema app_private;
alter function public.is_workshop_owner(uuid, uuid) set schema app_private;
alter function public.current_workshop_id(uuid) set schema app_private;
alter function public.get_receipt_by_track_id(text) set schema app_private;

revoke all on function app_private.has_role(uuid, public.app_role) from public, anon;
revoke all on function app_private.is_workshop_member(uuid, uuid) from public, anon;
revoke all on function app_private.is_workshop_owner(uuid, uuid) from public, anon;
revoke all on function app_private.current_workshop_id(uuid) from public, anon;
revoke all on function app_private.get_receipt_by_track_id(text) from public, anon, authenticated;

grant execute on function app_private.has_role(uuid, public.app_role) to authenticated, service_role;
grant execute on function app_private.is_workshop_member(uuid, uuid) to authenticated, service_role;
grant execute on function app_private.is_workshop_owner(uuid, uuid) to authenticated, service_role;
grant execute on function app_private.current_workshop_id(uuid) to authenticated, service_role;
grant execute on function app_private.get_receipt_by_track_id(text) to service_role;

alter function app_private.has_role(uuid, public.app_role) set search_path = app_private, public;
alter function app_private.is_workshop_member(uuid, uuid) set search_path = app_private, public;
alter function app_private.is_workshop_owner(uuid, uuid) set search_path = app_private, public;
alter function app_private.current_workshop_id(uuid) set search_path = app_private, public;
alter function app_private.get_receipt_by_track_id(text) set search_path = app_private, public;