// ============================================================
// LocoSnap — Email Service (Resend)
// ============================================================
// Sends transactional emails via Resend. Currently:
//   - Welcome email on signup (trilingual DE/EN/PL)
//
// Copy is locked to the approved spec at docs/email-welcome-spec.md
// (hybrid: spec copy verbatim, wrapped in branded HTML with logo).
// DE is first because it's the #1 market; EN bridges; PL is #2.
//
// Reply-To routes to hello@locosnap.app → founder inbox via
// ImprovMX. Welcome is the highest-intent moment for inbound
// feedback so replies must land somewhere a human reads.

import { Resend } from "resend";
import { config } from "../config/env";
import { captureServerError } from "./analytics";

const FROM = "Stephen from LocoSnap <noreply@locosnap.app>";
const REPLY_TO = "hello@locosnap.app";
const LOGO_URL = "https://locosnap.app/images/icon.png";
const WELCOME_SUBJECT = "Welcome to LocoSnap / Willkommen / Witaj";

let client: Resend | null = null;

function getClient(): Resend | null {
  if (!config.hasResend) return null;
  if (!client) client = new Resend(config.resendApiKey);
  return client;
}

// ── Welcome email ────────────────────────────────────────────

function welcomeHtml(): string {
  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Welcome to LocoSnap</title>
</head>
<body style="margin:0; padding:0; background-color:#f4f4f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#1a1a1a; line-height:1.55;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f4f4f5;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px; background-color:#ffffff; border-radius:12px; overflow:hidden;">
          <tr>
            <td align="center" style="padding:32px 24px 24px 24px;">
              <img src="${LOGO_URL}" alt="LocoSnap" width="72" height="72" style="display:block; border-radius:16px;">
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 8px 32px;">
              <p style="margin:0 0 14px 0; font-size:16px;">Hi,</p>
              <p style="margin:0 0 14px 0; font-size:16px;">willkommen bei LocoSnap — du bist im Club.</p>
              <p style="margin:0 0 14px 0; font-size:16px;">Worum es geht: Zug fotografieren, die App erkennt ihn, du baust deine Sammlung auf. Klassen, Baujahre, Strecken — alles drin.</p>
              <p style="margin:0 0 14px 0; font-size:16px;">Eine Sache vorweg: keine Werbung, keine Pop-ups, keine verkauften Daten. Ich baue die App allein, neben der Arbeit. Pro ist das, was es am Leben hält.</p>
              <p style="margin:0 0 14px 0; font-size:16px;">3 kostenlose Scans zum Loslegen. Wenn du mehr willst: Pro startet bei 1 € im ersten Monat — am günstigsten im Jahresabo, unbegrenzt scannen, jederzeit kündbar. Viel Spaß.</p>
              <p style="margin:0; font-size:16px;">Stephen</p>
            </td>
          </tr>
          <tr><td style="padding:20px 32px;"><hr style="border:none; border-top:1px solid #e5e5e5; margin:0;"></td></tr>
          <tr>
            <td style="padding:0 32px 8px 32px;">
              <p style="margin:0 0 14px 0; font-size:16px;">Hi,</p>
              <p style="margin:0 0 14px 0; font-size:16px;">welcome to LocoSnap — you're in the club.</p>
              <p style="margin:0 0 14px 0; font-size:16px;">Quick rundown: snap a train, the app identifies it, you build a collection. Classes, build years, routes — all in there.</p>
              <p style="margin:0 0 14px 0; font-size:16px;">One thing up front: no ads, no pop-ups, no sold data. I build this on my own, around a day job. Pro is what keeps it alive.</p>
              <p style="margin:0 0 14px 0; font-size:16px;">3 free scans to get going. Want more? Pro starts at €1 for the first month — best value on the annual plan, unlimited scans, cancel anytime. Have fun.</p>
              <p style="margin:0; font-size:16px;">Stephen</p>
            </td>
          </tr>
          <tr><td style="padding:20px 32px;"><hr style="border:none; border-top:1px solid #e5e5e5; margin:0;"></td></tr>
          <tr>
            <td style="padding:0 32px 32px 32px;">
              <p style="margin:0 0 14px 0; font-size:16px;">Cześć,</p>
              <p style="margin:0 0 14px 0; font-size:16px;">witaj w LocoSnap — jesteś w klubie.</p>
              <p style="margin:0 0 14px 0; font-size:16px;">Krótko: robisz zdjęcie pociągu, aplikacja go rozpoznaje, ty budujesz kolekcję. Serie, rok produkcji, trasy — wszystko w środku.</p>
              <p style="margin:0 0 14px 0; font-size:16px;">Jedna rzecz na start: zero reklam, zero pop-upów, zero sprzedaży danych. Robię to sam, obok pracy. Pro to to, co trzyma to przy życiu.</p>
              <p style="margin:0 0 14px 0; font-size:16px;">3 darmowe skany na rozgrzewkę. Chcesz więcej? Pro od 4,49 zł za pierwszy miesiąc — najtaniej w abonamencie rocznym, skanowanie bez limitu, anuluj kiedy chcesz. Baw się dobrze.</p>
              <p style="margin:0; font-size:16px;">Stephen</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 24px 32px; background-color:#fafafa;">
              <p style="margin:16px 0 0 0; font-size:12px; color:#888888; text-align:center;">
                LocoSnap · <a href="https://locosnap.app" style="color:#888888; text-decoration:underline;">locosnap.app</a><br>
                Reply to this email — it reaches a real person.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function welcomeText(): string {
  return [
    "Hi,",
    "",
    "willkommen bei LocoSnap — du bist im Club.",
    "",
    "Worum es geht: Zug fotografieren, die App erkennt ihn, du baust deine Sammlung auf. Klassen, Baujahre, Strecken — alles drin.",
    "",
    "Eine Sache vorweg: keine Werbung, keine Pop-ups, keine verkauften Daten. Ich baue die App allein, neben der Arbeit. Pro ist das, was es am Leben hält.",
    "",
    "3 kostenlose Scans zum Loslegen. Wenn du mehr willst: Pro startet bei 1 € im ersten Monat — am günstigsten im Jahresabo, unbegrenzt scannen, jederzeit kündbar. Viel Spaß.",
    "",
    "Stephen",
    "",
    "---",
    "",
    "Hi,",
    "",
    "welcome to LocoSnap — you're in the club.",
    "",
    "Quick rundown: snap a train, the app identifies it, you build a collection. Classes, build years, routes — all in there.",
    "",
    "One thing up front: no ads, no pop-ups, no sold data. I build this on my own, around a day job. Pro is what keeps it alive.",
    "",
    "3 free scans to get going. Want more? Pro starts at €1 for the first month — best value on the annual plan, unlimited scans, cancel anytime. Have fun.",
    "",
    "Stephen",
    "",
    "---",
    "",
    "Cześć,",
    "",
    "witaj w LocoSnap — jesteś w klubie.",
    "",
    "Krótko: robisz zdjęcie pociągu, aplikacja go rozpoznaje, ty budujesz kolekcję. Serie, rok produkcji, trasy — wszystko w środku.",
    "",
    "Jedna rzecz na start: zero reklam, zero pop-upów, zero sprzedaży danych. Robię to sam, obok pracy. Pro to to, co trzyma to przy życiu.",
    "",
    "3 darmowe skany na rozgrzewkę. Chcesz więcej? Pro od 4,49 zł za pierwszy miesiąc — najtaniej w abonamencie rocznym, skanowanie bez limitu, anuluj kiedy chcesz. Baw się dobrze.",
    "",
    "Stephen",
    "",
    "—",
    "LocoSnap · locosnap.app",
    "Reply to this email — it reaches a real person.",
  ].join("\n");
}

export async function sendWelcomeEmail(toEmail: string): Promise<boolean> {
  const resend = getClient();
  if (!resend) {
    console.warn("[EMAIL] Resend not configured — skipping welcome email");
    return false;
  }
  if (!toEmail || !toEmail.includes("@")) {
    console.warn(`[EMAIL] Invalid recipient: ${toEmail}`);
    return false;
  }

  try {
    const { data, error } = await resend.emails.send({
      from: FROM,
      to: toEmail,
      replyTo: REPLY_TO,
      subject: WELCOME_SUBJECT,
      html: welcomeHtml(),
      text: welcomeText(),
    });

    if (error) {
      console.error(`[EMAIL] Resend error for ${toEmail}:`, error);
      captureServerError(new Error(JSON.stringify(error)), {
        context: "send_welcome_email",
        recipient: toEmail,
      });
      return false;
    }

    console.log(`[EMAIL] Welcome sent to ${toEmail} (id: ${data?.id})`);
    return true;
  } catch (err) {
    console.error(`[EMAIL] Exception sending welcome to ${toEmail}:`, err);
    captureServerError(err as Error, {
      context: "send_welcome_email",
      recipient: toEmail,
    });
    return false;
  }
}
