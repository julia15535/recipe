import { AppButton } from "@/components/app-button";

// 404 внутри кабинета. Кабинет рендерится на каждый запрос с потоковой отдачей (CSP с nonce),
// поэтому notFound() приходит уже после заголовков: код ответа 200, страница — эта.
export default function AdminNotFound() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-screen-sm flex-col gap-6 px-4 py-10">
      <h1 className="font-display text-display-xs text-primary">Такой страницы в кабинете нет</h1>
      <AppButton href="/admin" className="self-start">
        В кабинет
      </AppButton>
    </main>
  );
}
