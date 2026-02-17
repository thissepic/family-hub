"use server";

import { cookies } from "next/headers";

const ALLOWED_LOCALES = ["en", "de"];

export async function setLocale(locale: string): Promise<void> {
  if (!ALLOWED_LOCALES.includes(locale)) return;

  const cookieStore = await cookies();
  cookieStore.set("locale", locale, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}
