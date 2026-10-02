ALTER TABLE "recipe_ingredients" DROP CONSTRAINT "recipe_ingredients_quantity_check";--> statement-breakpoint
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_quantity_check" CHECK (("recipe_ingredients"."quantity_kind" = 'exact' and "recipe_ingredients"."amount_num" is not null and "recipe_ingredients"."amount_den" is not null
          and "recipe_ingredients"."amount_max_num" is null and "recipe_ingredients"."amount_max_den" is null)
        or ("recipe_ingredients"."quantity_kind" = 'range' and "recipe_ingredients"."amount_num" is not null and "recipe_ingredients"."amount_den" is not null
          and "recipe_ingredients"."amount_max_num" is not null and "recipe_ingredients"."amount_max_den" is not null
          and "recipe_ingredients"."amount_num"::numeric * "recipe_ingredients"."amount_max_den" <= "recipe_ingredients"."amount_max_num"::numeric * "recipe_ingredients"."amount_den")
        or ("recipe_ingredients"."quantity_kind" = 'none' and "recipe_ingredients"."amount_num" is null and "recipe_ingredients"."amount_den" is null
          and "recipe_ingredients"."amount_max_num" is null and "recipe_ingredients"."amount_max_den" is null));