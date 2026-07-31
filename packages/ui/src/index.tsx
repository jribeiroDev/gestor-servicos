import { clsx } from "clsx";
import { forwardRef } from "react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, PropsWithChildren, ReactNode } from "react";

export { ThemeToggle, THEME_INIT_SCRIPT } from "./theme-toggle";

export type ButtonVariant = "primary" | "secondary" | "danger";

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-stone-950 text-white hover:bg-stone-800 dark:bg-white dark:text-stone-950 dark:hover:bg-stone-200",
  secondary:
    "border border-stone-300 bg-white text-stone-800 hover:bg-stone-100 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-200 dark:hover:bg-stone-800",
  danger:
    "border border-red-200 bg-white text-red-700 hover:bg-red-50 dark:border-red-900/60 dark:bg-stone-900 dark:text-red-400 dark:hover:bg-red-950/40",
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

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={clsx(
          "h-10 w-full rounded-md border border-stone-300 bg-white px-3 text-sm text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-teal-700 focus:ring-2 focus:ring-teal-100 dark:border-stone-700 dark:bg-stone-950 dark:text-stone-100 dark:placeholder:text-stone-500 dark:focus:border-teal-500 dark:focus:ring-teal-900/40",
          className,
        )}
        {...props}
      />
    );
  },
);

export function Panel({ children, title, aside }: PropsWithChildren<{ title: string; aside?: ReactNode }>) {
  return (
    <section className="rounded-lg border border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900">
      <header className="flex items-center justify-between border-b border-stone-200 px-5 py-4 dark:border-stone-800">
        <h2 className="text-base font-semibold text-stone-950 dark:text-stone-100">{title}</h2>
        {aside}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}
