"use client";

import { LogOut } from "lucide-react";

import { AppButton } from "@/components/app-button";

import { logout } from "../actions";

export function LogoutForm() {
  return (
    <form action={logout}>
      <AppButton type="submit" color="tertiary" iconLeading={LogOut}>
        Выйти
      </AppButton>
    </form>
  );
}
