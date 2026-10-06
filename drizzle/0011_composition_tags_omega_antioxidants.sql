-- Ручная миграция (план composition-tags-omega-antioxidants, ADR-0035): теги состава «Омега-3» и «Антиоксиданты»
-- с постоянными id и подписями ru + en; порядок всех семи — абсолютными позициями (фильтр поиска; на рецепте порядок
-- автора). Повторный запуск даёт то же состояние. Тег с тем же кодом, но другим id роняет миграцию (уникальный код):
-- на id ссылаются рецепты. EN «Fibre» → «Fiber» — американский английский на весь сайт (ADR-0019).
INSERT INTO "composition_tags" ("id", "code", "position") VALUES
  ('d7f2c44c-a0e4-4f09-8333-43cc7376d713', 'omega-3', 3),
  ('092046fc-4b5f-4705-bebe-2165cc3bb061', 'antioxidants', 6)
ON CONFLICT ("id") DO NOTHING;
--> statement-breakpoint
UPDATE "composition_tags" AS "tag" SET "position" = "wanted"."position"
FROM (VALUES
  ('protein', 0),
  ('fiber', 1),
  ('healthy-fats', 2),
  ('omega-3', 3),
  ('low-sugar', 4),
  ('iron', 5),
  ('antioxidants', 6)
) AS "wanted" ("code", "position")
WHERE "tag"."code" = "wanted"."code";
--> statement-breakpoint
INSERT INTO "composition_tag_localizations" ("tag_id", "locale", "label") VALUES
  ('d7f2c44c-a0e4-4f09-8333-43cc7376d713', 'ru', 'Омега-3'),
  ('d7f2c44c-a0e4-4f09-8333-43cc7376d713', 'en', 'Omega-3'),
  ('092046fc-4b5f-4705-bebe-2165cc3bb061', 'ru', 'Антиоксиданты'),
  ('092046fc-4b5f-4705-bebe-2165cc3bb061', 'en', 'Antioxidants'),
  ('047a54c2-c35e-54ec-8f91-6ae7744fcd95', 'en', 'Fiber')
ON CONFLICT ("tag_id", "locale") DO UPDATE SET "label" = EXCLUDED."label";
--> statement-breakpoint
-- Проверка итога: ровно семь тегов в нужном порядке, у новых — свои id, у каждого — подписи ru и en.
DO $$
BEGIN
  IF (SELECT string_agg("code" || ':' || "position", ',' ORDER BY "position") FROM "composition_tags")
     IS DISTINCT FROM 'protein:0,fiber:1,healthy-fats:2,omega-3:3,low-sugar:4,iron:5,antioxidants:6' THEN
    RAISE EXCEPTION 'теги состава: неожиданный набор или порядок';
  END IF;
  IF (SELECT count(*) FROM "composition_tags" WHERE ("id", "code") IN (
       ('d7f2c44c-a0e4-4f09-8333-43cc7376d713'::uuid, 'omega-3'),
       ('092046fc-4b5f-4705-bebe-2165cc3bb061'::uuid, 'antioxidants'))) <> 2 THEN
    RAISE EXCEPTION 'теги состава: у нового тега чужой id';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "composition_tags" AS "tag"
    WHERE (SELECT count(*) FROM "composition_tag_localizations" AS "label"
           WHERE "label"."tag_id" = "tag"."id" AND "label"."locale" IN ('ru', 'en')) <> 2
  ) THEN
    RAISE EXCEPTION 'теги состава: нет подписи ru или en';
  END IF;
END $$;
