-- Phase 4 integration flags. All start OFF: each module (and the pilot-site
-- embed) is enabled deliberately once its integration is verified.
INSERT INTO "feature_flags" ("key", "enabled", "updated_by") VALUES
  ('avasar_profile_api', false, 'migration'),
  ('collaborate_profile_api', false, 'migration'),
  ('learn_profile_api', false, 'migration'),
  ('meet_profile_api', false, 'migration'),
  ('iris_profile_api', false, 'migration'),
  ('pilot_site_embed', false, 'migration')
ON CONFLICT ("key") DO NOTHING;
