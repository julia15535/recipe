import { type PhotoRef, photoSources } from "@/lib/domain/photo";
import { cx } from "@/utils/cx";

// Фото блюда (ADR-0028): кадр 4:3, который выбрал владелец, — ровно он и виден; `srcset` по реальным ширинам,
// `width/height` — без прыжков страницы. Фото над рецептом — первым (`priority`), на карточках — по мере прокрутки.
type Props = { photo: PhotoRef; alt: string; sizes: string; priority?: boolean; className?: string };

export function RecipePhoto({ photo, alt, sizes, priority = false, className }: Props) {
  const { src, srcSet, width, height } = photoSources(photo);
  return (
    <img
      src={src}
      srcSet={srcSet}
      sizes={sizes}
      width={width}
      height={height}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding="async"
      className={cx("aspect-[4/3] w-full bg-brand-50 object-cover", className)}
    />
  );
}
