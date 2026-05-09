import { Heading, Img, Section, Text, Hr } from "@react-email/components";
import * as React from "react";
import { EmailLayout, PrimaryButton, type EmailBrand } from "./EmailLayout";

export interface ProgramReadyProps {
  firstName: string;
  programTitle: string;
  targetTransformation: string | null;
  lessonCount: number;
  totalMinutes: number | null;
  heroImageUrl: string | null;
  editUrl: string;
  brand: EmailBrand;
  appUrl?: string;
}

export function ProgramReady(props: ProgramReadyProps) {
  const {
    firstName,
    programTitle,
    targetTransformation,
    lessonCount,
    totalMinutes,
    heroImageUrl,
    editUrl,
    brand,
    appUrl,
  } = props;

  const accent = brand.accent;

  const meta = [
    `${lessonCount} ${lessonCount === 1 ? "lesson" : "lessons"}`,
    totalMinutes ? `${totalMinutes} min total` : null,
  ]
    .filter(Boolean)
    .join("  ·  ");

  const greetingName = firstName?.trim() ? firstName.split(" ")[0] : "there";

  return (
    <EmailLayout
      preview={`${programTitle} is ready to review`}
      brand={brand}
      appUrl={appUrl}
    >
      <div
        style={{
          height: 4,
          backgroundColor: accent,
          borderRadius: 2,
          margin: "-32px -28px 28px",
        }}
      />

      <Text
        style={{
          fontSize: 13,
          color: "#64748b",
          margin: "0 0 4px",
          letterSpacing: 0.6,
          textTransform: "uppercase",
        }}
      >
        Your program is ready
      </Text>

      <Heading
        as="h1"
        style={{
          fontSize: 30,
          lineHeight: 1.15,
          fontWeight: 700,
          margin: "0 0 12px",
          color: "#0f172a",
        }}
      >
        Nice work, {greetingName}.
      </Heading>

      <Text style={{ fontSize: 16, color: "#475569", margin: "0 0 20px", lineHeight: 1.55 }}>
        <strong style={{ color: "#0f172a" }}>{programTitle}</strong> has been generated and is
        waiting for your review.
      </Text>

      {heroImageUrl ? (
        <Img
          src={heroImageUrl}
          width="504"
          alt={programTitle}
          style={{
            width: "100%",
            maxWidth: 504,
            borderRadius: 12,
            display: "block",
            margin: "8px 0 20px",
          }}
        />
      ) : null}

      {targetTransformation ? (
        <Text
          style={{
            fontSize: 15,
            color: "#475569",
            margin: "0 0 12px",
            lineHeight: 1.55,
            fontStyle: "italic",
          }}
        >
          “{targetTransformation}”
        </Text>
      ) : null}

      {meta ? (
        <Text
          style={{
            fontSize: 13,
            color: "#64748b",
            textTransform: "uppercase",
            letterSpacing: 0.6,
            margin: "0 0 24px",
          }}
        >
          {meta}
        </Text>
      ) : null}

      <Section style={{ textAlign: "center", margin: "8px 0 12px" }}>
        <PrimaryButton href={editUrl} brand={brand}>
          Open your program  →
        </PrimaryButton>
      </Section>

      <Text
        style={{
          fontSize: 13,
          color: "#94a3b8",
          textAlign: "center",
          margin: "0 0 4px",
        }}
      >
        Edit the curriculum, set your price, and publish whenever you're ready.
      </Text>

      <Hr style={{ borderColor: "#eef0f4", margin: "24px 0 16px" }} />

      <Text
        style={{
          fontSize: 12,
          color: "#94a3b8",
          margin: 0,
          textAlign: "center",
        }}
      >
        Heads up — nothing is live until you hit publish.
      </Text>
    </EmailLayout>
  );
}

export default ProgramReady;
