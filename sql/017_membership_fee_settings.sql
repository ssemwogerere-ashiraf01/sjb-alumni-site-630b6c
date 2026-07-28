insert into public.app_settings (key, value) values
  ('membership_fee_alumni', '{"amount": 3000, "currency": "UGX"}'),
  ('membership_fee_non_alumni', '{"amount": 15000, "currency": "UGX"}')
on conflict (key) do update set value = excluded.value, updated_at = now();
