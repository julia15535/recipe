import { encode } from "uqr";

// QR-код ссылки на бота: вход начат на компьютере — подтверждаем с телефона. Рисуем сами одним
// путём SVG (без внешних картинок и скриптов — их не пустит CSP кабинета).
export function LoginQr({ value }: { value: string }) {
  const { data, size } = encode(value, { ecc: "M", border: 2 });
  const path = data.flatMap((row, y) => row.map((dark, x) => (dark ? `M${x} ${y}h1v1h-1z` : ""))).join("");
  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label="QR-код ссылки на бота входа"
      className="size-48 rounded-xl bg-primary text-primary ring-1 ring-secondary"
    >
      <path d={path} fill="currentColor" />
    </svg>
  );
}
