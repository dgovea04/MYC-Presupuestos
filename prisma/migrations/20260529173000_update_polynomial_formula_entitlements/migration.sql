UPDATE "MembershipPlan"
SET "entitlements" = ARRAY['exports.basic', 'polynomial_formula']::TEXT[]
WHERE "slug" = 'starter';

UPDATE "MembershipPlan"
SET "entitlements" = ARRAY[
  'ai.local',
  'partidas.similarity',
  'work_schedule.intelligent',
  'polynomial_formula',
  'polynomial_formula.adjustments',
  'risk_analysis',
  'exports.advanced',
  'exports.basic'
]::TEXT[]
WHERE "slug" IN ('pro', 'empresa');
