-- Seed minimo (config)

insert into config.regions (name)
values ('MATRIZ'), ('SINOS'), ('LITORAL')
on conflict (name) do nothing;

insert into config.channels (code, name, is_active)
values
  ('ADS', 'ADS', true),
  ('INDICACAO', 'INDICACAO', true),
  ('ORGANICO', 'ORGANICO', true),
  ('OUTRO', 'OUTRO', true)
on conflict (code) do nothing;

insert into config.cities (name, region_id)
values
  ('Porto Alegre', (select id from config.regions where name = 'MATRIZ')),
  ('Canoas', (select id from config.regions where name = 'SINOS')),
  ('Novo Hamburgo', (select id from config.regions where name = 'SINOS')),
  ('Capao da Canoa', (select id from config.regions where name = 'LITORAL')),
  ('Torres', (select id from config.regions where name = 'LITORAL'))
on conflict (name, region_id) do nothing;

