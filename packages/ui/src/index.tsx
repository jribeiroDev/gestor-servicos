import { clsx } from "clsx";
import type { ButtonHTMLAttributes, InputHTMLAttributes, PropsWithChildren, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "danger";

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-stone-950 text-white hover:bg-stone-800",
  secondary: "border border-stone-300 bg-white text-stone-800 hover:bg-stone-100",
  danger: "border border-red-200 bg-white text-red-700 hover:bg-red-50",
};

export function Button({
  className,
  variant = "primary",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      className={clsx(
        "inline-flex h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
        buttonVariants[variant],
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
