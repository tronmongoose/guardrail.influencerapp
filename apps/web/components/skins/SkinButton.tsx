import type { ButtonHTMLAttributes, CSSProperties } from "react";

type SkinButtonVariant = "primary" | "secondary";

interface SkinButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: SkinButtonVariant;
}

/**
 * Skin-aware button that consumes token CSS vars for radius and accent colors.
 * Replaces hardcoded rounded-xl + inline backgroundColor patterns.
 */
export function SkinButton({
  variant = "primary",
  className = "",
  style,
  children,
  ...props
}: SkinButtonProps) {
  const radiusVar = `--token-comp-btn-${variant}-radius`;

  const variantStyles: CSSProperties =
    variant === "primary"
      ? {
          backgroundColor: "var(--token-color-accent)",
          color: "var(--token-color-bg-default)",
          borderRadius: `var(${radiusVar})`,
          border: "none",
        }
      : {
          backgroundColor: "transparent",
          color: "var(--token-color-accent)",
          borderRadius: `var(${radiusVar})`,
          border: "1px solid var(--token-color-accent)",
        };

  return (
    <button
      className={`font-medium transition hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      style={{ ...variantStyles, ...style }}
      {...props}
    >
      {children}
    </button>
  );
}
