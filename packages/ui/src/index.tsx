import { clsx } from "clsx";
import type { ButtonHTMLAttributes, InputHTMLAttributes, PropsWithChildren, ReactNode } from "react";

export function Button({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={clsx(
        "inline-flex h-10 items-center justify-center gap-2 rounded-md bg-stone-950 px-4 text-sm font-medium text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={clsx(
        "h-10 w-full rounded-md border border-stone-300 bg-white px-3 text-sm outline-none transition focus:border-teal-700 focus:ring-2 focus:ring-teal-100",
        className,
      )}
      {...props}
    />
  );
}

export function Panel({ children, title, aside }: PropsWithChildren<{ title: string; aside?: ReactNode }>) {
  return (
    <section className="rounded-lg border border-stone-200 bg-white">
      <header className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
        <h2 className="text-base font-semibold text-stone-950">{title}</h2>
        {aside}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}
