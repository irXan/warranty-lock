revoke all on function public.enforce_receipt_immutability() from public, anon, authenticated;
revoke all on function public.seed_initial_status() from public, anon, authenticated;
revoke all on function public.sync_receipt_status() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.update_updated_at_column() from public, anon, authenticated;
revoke all on function public.get_receipt_by_track_id(text) from public;
grant execute on function public.get_receipt_by_track_id(text) to anon, authenticated;