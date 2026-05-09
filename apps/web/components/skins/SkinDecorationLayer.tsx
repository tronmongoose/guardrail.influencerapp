"use client";

import { useMemo } from "react";
import type { CSSProperties } from "react";
import { useSkinTokens } from "./SkinThemeProvider";
import { getSkinDecorations, resolveColorKey } from "@/lib/skin-decorations";
import { getPatternCSS } from "@/lib/decoration-patterns";

interface Props {
  skinId: string;
}

export function SkinDecorationLayer({ skinId }: Props) {
  const tokens = useSkinTokens();
  const decorations = useMemo(() => getSkinDecorations(skinId, tokens), [skinId, tokens]);

  return (
    <>
      {decorations.backgroundPattern && (() => {
        const pattern = decorations.backgroundPattern;
        const patColor = resolveColorKey(pattern.colorKey, tokens);
        const patCss = getPatternCSS({
          type: pattern.type,
          color: patColor,
          spacing: pattern.spacing,
          size: pattern.size,
        });
        return (
          <div
            aria-hidden="true"
            className="fixed inset-0 pointer-events-none z-10"
            style={{
              backgroundImage: patCss.backgroundImage,
              backgroundSize: patCss.backgroundSize,
              backgroundPosition: patCss.backgroundPosition,
              opacity: pattern.opacity,
            }}
          />
        );
      })()}

      {decorations.floatingElements.length > 0 && (
        <div
          aria-hidden="true"
          className="fixed inset-0 pointer-events-none overflow-hidden z-0"
        >
          {decorations.floatingElements.map((el, i) => {
            const color =
              el.color === "accent" ? tokens.color.accent.primary
              : el.color === "accent-secondary" ? tokens.color.accent.secondary
              : el.color === "text-primary" ? tokens.color.text.primary
              : el.color === "text-secondary" ? tokens.color.text.secondary
              : el.color === "white" ? "#ffffff"
              : tokens.color.accent.primary;

            const delay = el.animationDelay ?? "0s";
            const animStr = !el.animation ? "none"
              : el.animation === "float" ? `deco-float 6s ease-in-out ${delay} infinite`
              : el.animation === "float-slow" ? `deco-float-slow 8s ease-in-out ${delay} infinite`
              : el.animation === "float-reverse" ? `deco-float-reverse 7s ease-in-out ${delay} infinite`
              : el.animation === "pulse-gentle" ? `deco-pulse 4s ease-in-out ${delay} infinite`
              : el.animation === "drift" ? `deco-drift 12s ease-in-out ${delay} infinite`
              : el.animation === "wander" ? `deco-wander 14s ease-in-out ${delay} infinite`
              : "none";

            const isEmoji = el.shape === "emoji";
            const style: CSSProperties = {
              position: "absolute",
              top: el.top, left: el.left, right: el.right, bottom: el.bottom,
              width: el.size, height: el.size,
              ...(isEmoji ? {
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: el.size,
                lineHeight: 1,
                color,
                userSelect: "none" as const,
              } : {
                backgroundColor: el.shape === "ring" ? "transparent" : color,
                borderRadius: el.shape === "circle" || el.shape === "ring" ? "50%" : 2,
                border: el.shape === "ring" ? `1.5px solid ${color}` : undefined,
                transform: el.shape === "diamond" ? "rotate(45deg)" : undefined,
              }),
            };

            const cls = `learn-deco-${i}`;
            return (
              <div key={i} className={cls} style={style}>
                {isEmoji && el.emoji ? el.emoji : null}
                <style>{`.${cls} { opacity: ${el.opacity}; animation: ${animStr}; --el-opacity: ${el.opacity}; --el-opacity-peak: ${Math.min(el.opacity * 1.5, 1)}; }`}</style>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
