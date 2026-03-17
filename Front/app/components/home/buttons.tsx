import { ButtonHTMLAttributes } from "react";
import clsx from "clsx";

type ButtonVariant = "primary" | "secondary";

type BaseProps = {
  label: string;
  variant?: ButtonVariant;
} & ButtonHTMLAttributes<HTMLButtonElement>;

function Button({ label, variant = "primary", className, ...rest }: BaseProps) {
  return (
    <button
      className={clsx(
        "cursor-pointer rounded-xl border-0 px-4 py-3 text-sm font-bold transition-all active:translate-y-px",
        variant === "primary"
          ? "bg-gradient-to-br from-indigo-600 to-indigo-500 text-white shadow-[0_10px_25px_rgba(99,102,241,0.25)] hover:from-indigo-700 hover:to-indigo-600"
          : "border border-slate-200 bg-slate-100 text-slate-950 hover:bg-slate-200",
        className,
      )}
      {...rest}
    >
      {label}
    </button>
  );
}

export function PrimaryButton(props: BaseProps) {
  return <Button {...props} variant="primary" />;
}

export function SecondaryButton(props: BaseProps) {
  return <Button {...props} variant="secondary" />;
}
