import { NURTURE_TEMPLATES } from "@/emails/nurture/nurture-templates";

export interface NurtureVars {
  firstName: string;
  statusLine: string;
  resumeUrl: string;
  unsubscribeUrl: string;
  preferencesUrl: string;
  companyAddress: string;
  assetBase: string;
  /** true only for creators who already have ≥1 video (state C) — strips the no-video block */
  hasVideo: boolean;
}

export interface RenderedNurture {
  subject: string;
  html: string;
  text: string;
  previewText: string;
}

const NO_VIDEO_BLOCK =
  /<!-- BEGIN no-video block[\s\S]*?<!-- END no-video block -->/g;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function applyTokens(input: string, vars: NurtureVars, forHtml: boolean): string {
  const t = (x: string) => (forHtml ? escapeHtml(x) : x);
  return input
    .replace(/\{\{first_name\}\}/g, t(vars.firstName))
    .replace(/\{\{status_line\}\}/g, t(vars.statusLine))
    .replace(/\{\{resume_url\}\}/g, vars.resumeUrl)
    .replace(/\{\{unsubscribe_url\}\}/g, vars.unsubscribeUrl)
    .replace(/\{\{preferences_url\}\}/g, vars.preferencesUrl)
    .replace(/\{\{company_address\}\}/g, t(vars.companyAddress))
    .replace(/\{\{asset_base\}\}/g, vars.assetBase);
}

/**
 * Render one nurture step to {subject, html, text} with all tokens filled.
 * Strips the "no video yet" block for creators who already uploaded video.
 */
export function renderNurtureEmail(step: number, vars: NurtureVars): RenderedNurture {
  const tpl = NURTURE_TEMPLATES.find((x) => x.step === step);
  if (!tpl) throw new Error(`No nurture template for step ${step}`);
  let html = tpl.html;
  if (vars.hasVideo) html = html.replace(NO_VIDEO_BLOCK, "");
  return {
    subject: applyTokens(tpl.subject, vars, false),
    html: applyTokens(html, vars, true),
    text: applyTokens(tpl.text, vars, false),
    previewText: tpl.previewText,
  };
}
