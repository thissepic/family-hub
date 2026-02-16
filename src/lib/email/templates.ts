type Locale = "en" | "de";

interface VerificationEmailData {
  familyName: string;
  verifyUrl: string;
}

interface PasswordResetEmailData {
  familyName: string;
  resetUrl: string;
}

interface EmailChangedNotificationData {
  familyName: string;
  oldEmail: string;
  newEmail: string;
}

interface TwoFactorEmailData {
  familyName: string;
}

interface OAuthAccountEmailData {
  familyName: string;
  provider: string;
  providerEmail: string;
}

// ─── Translations ──────────────────────────────────────────────────────────

const t: Record<string, Record<Locale, string>> = {
  // Verification
  verifySubject: {
    en: "Verify your email address",
    de: "Bestaetige deine E-Mail-Adresse",
  },
  verifyHeading: {
    en: "Welcome to Family Hub!",
    de: "Willkommen bei Family Hub!",
  },
  verifyBody: {
    en: "Please click the button below to verify your email address.",
    de: "Bitte klicke auf den Button, um deine E-Mail-Adresse zu bestaetigen.",
  },
  verifyButton: {
    en: "Verify Email",
    de: "E-Mail bestaetigen",
  },
  verifyExpiry: {
    en: "This link expires in 24 hours.",
    de: "Dieser Link ist 24 Stunden gueltig.",
  },

  // Password Reset
  resetSubject: {
    en: "Reset your password",
    de: "Passwort zuruecksetzen",
  },
  resetHeading: {
    en: "Password Reset",
    de: "Passwort zuruecksetzen",
  },
  resetBody: {
    en: "You requested a password reset for your Family Hub account. Click the button below to set a new password.",
    de: "Du hast ein Passwort-Reset fuer dein Family Hub Konto angefordert. Klicke auf den Button, um ein neues Passwort zu setzen.",
  },
  resetButton: {
    en: "Reset Password",
    de: "Passwort zuruecksetzen",
  },
  resetExpiry: {
    en: "This link expires in 1 hour.",
    de: "Dieser Link ist 1 Stunde gueltig.",
  },
  resetIgnore: {
    en: "If you didn't request this, you can safely ignore this email.",
    de: "Falls du dies nicht angefordert hast, kannst du diese E-Mail ignorieren.",
  },

  // Email Change Notification
  changeNotifySubject: {
    en: "Your email address has been changed",
    de: "Deine E-Mail-Adresse wurde geaendert",
  },
  changeNotifyHeading: {
    en: "Email Address Changed",
    de: "E-Mail-Adresse geaendert",
  },
  changeNotifyBody: {
    en: "The email address for your Family Hub account has been changed.",
    de: "Die E-Mail-Adresse fuer dein Family Hub Konto wurde geaendert.",
  },
  changeNotifyFrom: {
    en: "Old email:",
    de: "Alte E-Mail:",
  },
  changeNotifyTo: {
    en: "New email:",
    de: "Neue E-Mail:",
  },
  changeNotifyWarning: {
    en: "If you did not make this change, please contact support immediately.",
    de: "Falls du diese Aenderung nicht vorgenommen hast, wende dich bitte umgehend an den Support.",
  },

  // Email Change Verification
  changeVerifySubject: {
    en: "Verify your new email address",
    de: "Bestaetige deine neue E-Mail-Adresse",
  },
  changeVerifyBody: {
    en: "Please verify your new email address by clicking the button below.",
    de: "Bitte bestaetige deine neue E-Mail-Adresse, indem du auf den Button klickst.",
  },

  // 2FA Enabled
  twoFactorEnabledSubject: {
    en: "Two-factor authentication enabled",
    de: "Zwei-Faktor-Authentifizierung aktiviert",
  },
  twoFactorEnabledHeading: {
    en: "2FA Has Been Enabled",
    de: "2FA wurde aktiviert",
  },
  twoFactorEnabledBody: {
    en: "Two-factor authentication has been enabled on your Family Hub account. You will now need an authenticator app code when signing in.",
    de: "Zwei-Faktor-Authentifizierung wurde fuer dein Family Hub Konto aktiviert. Du benoetigst jetzt einen Authenticator-App-Code beim Anmelden.",
  },

  // 2FA Disabled
  twoFactorDisabledSubject: {
    en: "Two-factor authentication disabled",
    de: "Zwei-Faktor-Authentifizierung deaktiviert",
  },
  twoFactorDisabledHeading: {
    en: "2FA Has Been Disabled",
    de: "2FA wurde deaktiviert",
  },
  twoFactorDisabledBody: {
    en: "Two-factor authentication has been disabled on your Family Hub account. Your account is now protected by password only.",
    de: "Zwei-Faktor-Authentifizierung wurde fuer dein Family Hub Konto deaktiviert. Dein Konto ist jetzt nur noch durch ein Passwort geschuetzt.",
  },

  // OAuth Linked
  oauthLinkedSubject: {
    en: "New sign-in method linked",
    de: "Neue Anmeldemethode verknuepft",
  },
  oauthLinkedHeading: {
    en: "Account Linked",
    de: "Konto verknuepft",
  },
  oauthLinkedBody: {
    en: "A new sign-in method has been linked to your Family Hub account.",
    de: "Eine neue Anmeldemethode wurde mit deinem Family Hub Konto verknuepft.",
  },
  oauthProvider: {
    en: "Provider:",
    de: "Anbieter:",
  },
  oauthAccount: {
    en: "Account:",
    de: "Konto:",
  },

  // OAuth Unlinked
  oauthUnlinkedSubject: {
    en: "Sign-in method removed",
    de: "Anmeldemethode entfernt",
  },
  oauthUnlinkedHeading: {
    en: "Account Unlinked",
    de: "Konto entfernt",
  },
  oauthUnlinkedBody: {
    en: "A sign-in method has been removed from your Family Hub account.",
    de: "Eine Anmeldemethode wurde von deinem Family Hub Konto entfernt.",
  },

  // Shared security warning
  securityWarning: {
    en: "If you did not make this change, please secure your account immediately.",
    de: "Falls du diese Aenderung nicht vorgenommen hast, sichere bitte umgehend dein Konto.",
  },

  // Shared
  hi: { en: "Hi", de: "Hallo" },
  footer: {
    en: "This email was sent by Family Hub. Please do not reply.",
    de: "Diese E-Mail wurde von Family Hub gesendet. Bitte nicht antworten.",
  },
  linkFallback: {
    en: "If the button doesn't work, copy and paste this link into your browser:",
    de: "Falls der Button nicht funktioniert, kopiere diesen Link in deinen Browser:",
  },
};

// ─── Layout ────────────────────────────────────────────────────────────────

function layout(content: string, locale: Locale): string {
  return `<!DOCTYPE html>
<html lang="${locale}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <tr><td style="background:#3b82f6;padding:24px 32px;">
          <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:600;">Family Hub</h1>
        </td></tr>
        <tr><td style="padding:32px;">
          ${content}
        </td></tr>
        <tr><td style="padding:16px 32px;background:#fafafa;border-top:1px solid #e4e4e7;">
          <p style="margin:0;font-size:12px;color:#71717a;text-align:center;">${t.footer[locale]}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function button(text: string, url: string): string {
  return `<table cellpadding="0" cellspacing="0" style="margin:24px 0;"><tr><td>
    <a href="${url}" style="display:inline-block;padding:12px 28px;background:#3b82f6;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">${text}</a>
  </td></tr></table>`;
}

function linkFallback(url: string, locale: Locale): string {
  return `<p style="font-size:12px;color:#71717a;word-break:break-all;">${t.linkFallback[locale]}<br/><a href="${url}" style="color:#3b82f6;">${url}</a></p>`;
}

// ─── Templates ─────────────────────────────────────────────────────────────

export function verificationEmail(
  locale: Locale,
  data: VerificationEmailData,
): { subject: string; html: string } {
  const html = layout(
    `<p style="margin:0 0 8px;font-size:15px;color:#18181b;">${t.hi[locale]} <strong>${data.familyName}</strong>,</p>
     <h2 style="margin:0 0 16px;font-size:18px;color:#18181b;">${t.verifyHeading[locale]}</h2>
     <p style="font-size:14px;color:#3f3f46;line-height:1.6;">${t.verifyBody[locale]}</p>
     ${button(t.verifyButton[locale], data.verifyUrl)}
     <p style="font-size:13px;color:#71717a;">${t.verifyExpiry[locale]}</p>
     ${linkFallback(data.verifyUrl, locale)}`,
    locale,
  );

  return { subject: t.verifySubject[locale], html };
}

export function passwordResetEmail(
  locale: Locale,
  data: PasswordResetEmailData,
): { subject: string; html: string } {
  const html = layout(
    `<p style="margin:0 0 8px;font-size:15px;color:#18181b;">${t.hi[locale]} <strong>${data.familyName}</strong>,</p>
     <h2 style="margin:0 0 16px;font-size:18px;color:#18181b;">${t.resetHeading[locale]}</h2>
     <p style="font-size:14px;color:#3f3f46;line-height:1.6;">${t.resetBody[locale]}</p>
     ${button(t.resetButton[locale], data.resetUrl)}
     <p style="font-size:13px;color:#71717a;">${t.resetExpiry[locale]}</p>
     <p style="font-size:13px;color:#71717a;">${t.resetIgnore[locale]}</p>
     ${linkFallback(data.resetUrl, locale)}`,
    locale,
  );

  return { subject: t.resetSubject[locale], html };
}

export function emailChangedNotification(
  locale: Locale,
  data: EmailChangedNotificationData,
): { subject: string; html: string } {
  const html = layout(
    `<p style="margin:0 0 8px;font-size:15px;color:#18181b;">${t.hi[locale]} <strong>${data.familyName}</strong>,</p>
     <h2 style="margin:0 0 16px;font-size:18px;color:#18181b;">${t.changeNotifyHeading[locale]}</h2>
     <p style="font-size:14px;color:#3f3f46;line-height:1.6;">${t.changeNotifyBody[locale]}</p>
     <table style="margin:16px 0;font-size:14px;color:#3f3f46;">
       <tr><td style="padding:4px 12px 4px 0;font-weight:600;">${t.changeNotifyFrom[locale]}</td><td>${data.oldEmail}</td></tr>
       <tr><td style="padding:4px 12px 4px 0;font-weight:600;">${t.changeNotifyTo[locale]}</td><td>${data.newEmail}</td></tr>
     </table>
     <p style="font-size:13px;color:#ef4444;font-weight:500;">${t.changeNotifyWarning[locale]}</p>`,
    locale,
  );

  return { subject: t.changeNotifySubject[locale], html };
}

export function emailChangeVerification(
  locale: Locale,
  data: VerificationEmailData,
): { subject: string; html: string } {
  const html = layout(
    `<p style="margin:0 0 8px;font-size:15px;color:#18181b;">${t.hi[locale]} <strong>${data.familyName}</strong>,</p>
     <h2 style="margin:0 0 16px;font-size:18px;color:#18181b;">${t.changeVerifySubject[locale]}</h2>
     <p style="font-size:14px;color:#3f3f46;line-height:1.6;">${t.changeVerifyBody[locale]}</p>
     ${button(t.verifyButton[locale], data.verifyUrl)}
     <p style="font-size:13px;color:#71717a;">${t.verifyExpiry[locale]}</p>
     ${linkFallback(data.verifyUrl, locale)}`,
    locale,
  );

  return { subject: t.changeVerifySubject[locale], html };
}

export function twoFactorEnabledEmail(
  locale: Locale,
  data: TwoFactorEmailData,
): { subject: string; html: string } {
  const html = layout(
    `<p style="margin:0 0 8px;font-size:15px;color:#18181b;">${t.hi[locale]} <strong>${data.familyName}</strong>,</p>
     <h2 style="margin:0 0 16px;font-size:18px;color:#18181b;">${t.twoFactorEnabledHeading[locale]}</h2>
     <p style="font-size:14px;color:#3f3f46;line-height:1.6;">${t.twoFactorEnabledBody[locale]}</p>
     <p style="font-size:13px;color:#ef4444;font-weight:500;">${t.securityWarning[locale]}</p>`,
    locale,
  );

  return { subject: t.twoFactorEnabledSubject[locale], html };
}

export function twoFactorDisabledEmail(
  locale: Locale,
  data: TwoFactorEmailData,
): { subject: string; html: string } {
  const html = layout(
    `<p style="margin:0 0 8px;font-size:15px;color:#18181b;">${t.hi[locale]} <strong>${data.familyName}</strong>,</p>
     <h2 style="margin:0 0 16px;font-size:18px;color:#18181b;">${t.twoFactorDisabledHeading[locale]}</h2>
     <p style="font-size:14px;color:#3f3f46;line-height:1.6;">${t.twoFactorDisabledBody[locale]}</p>
     <p style="font-size:13px;color:#ef4444;font-weight:500;">${t.securityWarning[locale]}</p>`,
    locale,
  );

  return { subject: t.twoFactorDisabledSubject[locale], html };
}

export function oauthLinkedEmail(
  locale: Locale,
  data: OAuthAccountEmailData,
): { subject: string; html: string } {
  const html = layout(
    `<p style="margin:0 0 8px;font-size:15px;color:#18181b;">${t.hi[locale]} <strong>${data.familyName}</strong>,</p>
     <h2 style="margin:0 0 16px;font-size:18px;color:#18181b;">${t.oauthLinkedHeading[locale]}</h2>
     <p style="font-size:14px;color:#3f3f46;line-height:1.6;">${t.oauthLinkedBody[locale]}</p>
     <table style="margin:16px 0;font-size:14px;color:#3f3f46;">
       <tr><td style="padding:4px 12px 4px 0;font-weight:600;">${t.oauthProvider[locale]}</td><td>${data.provider}</td></tr>
       <tr><td style="padding:4px 12px 4px 0;font-weight:600;">${t.oauthAccount[locale]}</td><td>${data.providerEmail}</td></tr>
     </table>
     <p style="font-size:13px;color:#ef4444;font-weight:500;">${t.securityWarning[locale]}</p>`,
    locale,
  );

  return { subject: t.oauthLinkedSubject[locale], html };
}

export function oauthUnlinkedEmail(
  locale: Locale,
  data: OAuthAccountEmailData,
): { subject: string; html: string } {
  const html = layout(
    `<p style="margin:0 0 8px;font-size:15px;color:#18181b;">${t.hi[locale]} <strong>${data.familyName}</strong>,</p>
     <h2 style="margin:0 0 16px;font-size:18px;color:#18181b;">${t.oauthUnlinkedHeading[locale]}</h2>
     <p style="font-size:14px;color:#3f3f46;line-height:1.6;">${t.oauthUnlinkedBody[locale]}</p>
     <table style="margin:16px 0;font-size:14px;color:#3f3f46;">
       <tr><td style="padding:4px 12px 4px 0;font-weight:600;">${t.oauthProvider[locale]}</td><td>${data.provider}</td></tr>
       <tr><td style="padding:4px 12px 4px 0;font-weight:600;">${t.oauthAccount[locale]}</td><td>${data.providerEmail}</td></tr>
     </table>
     <p style="font-size:13px;color:#ef4444;font-weight:500;">${t.securityWarning[locale]}</p>`,
    locale,
  );

  return { subject: t.oauthUnlinkedSubject[locale], html };
}
