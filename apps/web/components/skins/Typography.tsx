import type { CSSProperties, ElementType, ReactNode } from "react";

// ---------------------------------------------------------------------------
// Heading
// ---------------------------------------------------------------------------

type HeadingSize = "xl" | "lg" | "md";

interface HeadingProps {
  size?: HeadingSize;
  as?: ElementType;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

const HEADING_ELEMENTS: Record<HeadingSize, ElementType> = {
  xl: "h1",
  lg: "h2",
  md: "h3",
};

export function Heading({ size = "lg", as, className, style, children }: HeadingProps) {
  const Tag = as ?? HEADING_ELEMENTS[size];
  const prefix = `--token-text-heading-${size}`;
  return (
    <Tag
      className={className}
      style={{
        fontFamily: `var(${prefix}-font)`,
        fontSize: `var(${prefix}-size)`,
        fontWeight: `var(${prefix}-weight)`,
        lineHeight: `var(${prefix}-line-height)`,
        color: "var(--token-color-text-primary)",
        ...style,
      }}
    >
      {children}
    </Tag>
  );
}

// ---------------------------------------------------------------------------
// Body
// ---------------------------------------------------------------------------

type BodySize = "md" | "sm";

interface BodyProps {
  size?: BodySize;
  as?: ElementType;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

export function Body({ size = "md", as = "p", className, style, children }: BodyProps) {
  const Tag = as;
  const prefix = `--token-text-body-${size}`;
  return (
    <Tag
      className={className}
      style={{
        fontFamily: `var(${prefix}-font)`,
        fontSize: `var(${prefix}-size)`,
        fontWeight: `var(${prefix}-weight)`,
        lineHeight: `var(${prefix}-line-height)`,
        color: "var(--token-color-text-secondary)",
        ...style,
      }}
    >
      {children}
    </Tag>
  );
}

// ---------------------------------------------------------------------------
// Label
// ---------------------------------------------------------------------------

interface LabelProps {
  as?: ElementType;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

export function Label({ as = "span", className, style, children }: LabelProps) {
  const Tag = as;
  return (
    <Tag
      className={className}
      style={{
        fontFamily: "var(--token-text-label-sm-font)",
        fontSize: "var(--token-text-label-sm-size)",
        fontWeight: "var(--token-text-label-sm-weight)",
        lineHeight: "var(--token-text-label-sm-line-height)",
        color: "var(--token-color-text-secondary)",
        ...style,
      }}
    >
      {children}
    </Tag>
  );
}
