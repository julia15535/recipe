import { AppButton } from "@/components/app-button";

// Заглушка: вход владельца через Telegram — отдельный план (ADR-0010).
export default function AdminPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-screen-sm flex-col gap-6 px-4 py-10">
      <h1 className="font-display text-display-xs text-primary">Кабинет владельца</h1>
      <p className="text-md text-tertiary">Вход через Telegram появится на следующем этапе.</p>
      <div className="flex flex-wrap gap-3">
        <AppButton color="secondary" href="/ru">
          На сайт
        </AppButton>
        <AppButton color="secondary" href="/admin/ui">
          Проба дизайна
        </AppButton>
      </div>
    </main>
  );
}
