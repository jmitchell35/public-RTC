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
        "home-btn",
        variant === "primary" ? "home-btn-primary" : "home-btn-secondary",
        className
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

