-- Ручная миграция (план recipe-upload): то, что Drizzle не выражает.
-- 1) Ровно один основной ингредиент и основной раздел у рецепта — составные FK на свои строки,
--    отложенные до конца транзакции (рецепт и строки вставляются вместе).
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_main_ingredient_fk" FOREIGN KEY ("id", "main_ingredient_id")
  REFERENCES "recipe_ingredients" ("recipe_id", "id") DEFERRABLE INITIALLY DEFERRED;
--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_primary_section_fk" FOREIGN KEY ("id", "primary_section_id")
  REFERENCES "recipe_sections" ("recipe_id", "section_id") DEFERRABLE INITIALLY DEFERRED;
--> statement-breakpoint
-- 2) Каталог: 11 разделов (ADR-0018) и 5 тегов состава (ADR-0019) с постоянными id; подписи и slug — ru
--    (en добавит план публичного сайта). Повторный запуск ничего не меняет.
INSERT INTO "sections" ("id", "code", "position") VALUES
  ('04bf0a8d-6bfe-5558-b004-278dcbe4814f', 'breakfast', 0),
  ('772f6642-7c1b-5156-9661-2b9941b74af9', 'soups', 1),
  ('c90b53ba-b0c0-5121-b781-96d7e0ef5404', 'salads', 2),
  ('d1ced612-d7d1-5dbe-a7c1-98b77b3ab302', 'hot', 3),
  ('fa21ab53-16ce-5c3b-b646-27600c45545c', 'sides', 4),
  ('3f5aa167-db3c-5a6d-b947-9b69f353dedf', 'starters', 5),
  ('ed6933e1-8b7c-564a-bdc1-8269afddf04b', 'baking', 6),
  ('fc0d4155-1c5c-55af-b679-aa5d8297cf50', 'desserts', 7),
  ('6f804aca-e91a-5373-acf4-b89291380e55', 'sauces', 8),
  ('96ad0193-c664-5745-9df3-1bc17ecc94e6', 'drinks', 9),
  ('4cc872f8-1d5f-51df-a98b-1aca19551c99', 'preserves', 10)
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "section_localizations" ("section_id", "locale", "label", "slug") VALUES
  ('04bf0a8d-6bfe-5558-b004-278dcbe4814f', 'ru', 'Завтраки', 'zavtraki'),
  ('772f6642-7c1b-5156-9661-2b9941b74af9', 'ru', 'Супы', 'supy'),
  ('c90b53ba-b0c0-5121-b781-96d7e0ef5404', 'ru', 'Салаты', 'salaty'),
  ('d1ced612-d7d1-5dbe-a7c1-98b77b3ab302', 'ru', 'Горячее', 'goryachee'),
  ('fa21ab53-16ce-5c3b-b646-27600c45545c', 'ru', 'Гарниры', 'garniry'),
  ('3f5aa167-db3c-5a6d-b947-9b69f353dedf', 'ru', 'Закуски', 'zakuski'),
  ('ed6933e1-8b7c-564a-bdc1-8269afddf04b', 'ru', 'Выпечка', 'vypechka'),
  ('fc0d4155-1c5c-55af-b679-aa5d8297cf50', 'ru', 'Десерты', 'deserty'),
  ('6f804aca-e91a-5373-acf4-b89291380e55', 'ru', 'Соусы', 'sousy'),
  ('96ad0193-c664-5745-9df3-1bc17ecc94e6', 'ru', 'Напитки', 'napitki'),
  ('4cc872f8-1d5f-51df-a98b-1aca19551c99', 'ru', 'Заготовки', 'zagotovki')
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "composition_tags" ("id", "code", "position") VALUES
  ('24ca9069-d1f5-5376-b601-2454976ab926', 'protein', 0),
  ('047a54c2-c35e-54ec-8f91-6ae7744fcd95', 'fiber', 1),
  ('1e7c179c-e26c-5afc-947e-d546feba0b32', 'healthy-fats', 2),
  ('b39546fe-89b1-5d3a-bf26-ce0c3441cd90', 'low-sugar', 3),
  ('2507b851-573f-5a95-adf6-36933849c4a3', 'iron', 4)
ON CONFLICT DO NOTHING;
--> statement-breakpoint
INSERT INTO "composition_tag_localizations" ("tag_id", "locale", "label") VALUES
  ('24ca9069-d1f5-5376-b601-2454976ab926', 'ru', 'Белок'),
  ('047a54c2-c35e-54ec-8f91-6ae7744fcd95', 'ru', 'Клетчатка'),
  ('1e7c179c-e26c-5afc-947e-d546feba0b32', 'ru', 'Полезные жиры'),
  ('b39546fe-89b1-5d3a-bf26-ce0c3441cd90', 'ru', 'Мало сахара'),
  ('2507b851-573f-5a95-adf6-36933849c4a3', 'ru', 'Железо')
ON CONFLICT DO NOTHING;
