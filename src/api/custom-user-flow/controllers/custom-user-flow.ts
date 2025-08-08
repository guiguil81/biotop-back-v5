import crypto from "node:crypto";
import { yup, validateYupSchema } from "@strapi/utils";

// --------------------
// Config (env overrides)
// --------------------
const OTP_TTL_MINUTES = Number(process.env.EMAIL_CHANGE_OTP_TTL_MINUTES || 60); // validité code (10 min)
const OTP_MAX_ATTEMPTS = Number(process.env.EMAIL_CHANGE_OTP_MAX_ATTEMPTS || 5); // tentatives max

// --------------------
// Helpers
// --------------------

// unicité email (scope local si souhaité)
const assertEmailAvailable = async (emailL, userId, scopeByProvider) => {
  const where = scopeByProvider
    ? { email: emailL, provider: "local", id: { $ne: userId } }
    : { email: emailL, id: { $ne: userId } };

  const count = await strapi.db
    .query("plugin::users-permissions.user")
    .count({ where });

  if (count > 0) throw new Error("Email déjà pris");
};

// charge l'utilisateur “fraîchement” depuis la DB
const getMe = async (id) =>
  strapi.db.query("plugin::users-permissions.user").findOne({
    where: { id },
    select: [
      "id",
      "email",
      "confirmed",
      "provider",
      "emailChangeOtp",
      "emailChangeOtpExpires",
      "emailChangeOtpAttempts",
      "emailChangeRateLimitUntil",
      "emailChangeBackoffStep",
      "emailChangeBackoffResetAt",
      "emailChangeDailyCount",
      "emailChangeDailyCountResetAt",
    ],
  });

// simplissime : 6 chiffres aléatoires
const generateOtp6 = () =>
  String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");

const secondsUntil = (dateIso) => {
  const diffMs = new Date(dateIso).getTime() - Date.now();
  return Math.max(0, Math.ceil(diffMs / 1000));
};

const humanizeSecondsFR = (secs) => {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  if (m > 0) return `${m} min ${String(s).padStart(2, "0")} s`;
  return `${s} s`;
};

const parseBackoffSteps = () => {
  const raw = process.env.EMAIL_CHANGE_OTP_BACKOFF_STEPS || "";
  const arr = raw
    .split(",")
    .map((x) => Number(x.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  return arr.length
    ? arr
    : [Number(process.env.EMAIL_CHANGE_OTP_RESEND_COOLDOWN_SECONDS || 120)];
};

// envoi email via plugin email
const sendOtpEmail = async (to, code) => {
  const emailService = strapi.plugin("email").service("email");

  const subject = "Votre code de vérification";
  const text = `Voici votre code à 6 chiffres : ${code}\nIl expire dans ${OTP_TTL_MINUTES} minutes.`;
  const html = `
    <div style="font-family:system-ui,Segoe UI,Roboto,Arial">
      <p>Voici votre code à 6 chiffres :</p>
      <p style="font-size:24px;font-weight:700;letter-spacing:4px">${code}</p>
      <p>Il expire dans ${OTP_TTL_MINUTES} minutes.</p>
    </div>
  `;

  await emailService.send({ to, subject, text, html });
};

// --------------------
// Validation schemas
// --------------------
const sendCodeSchema = yup.object({}).noUnknown();

const confirmSchema = yup
  .object({
    code: yup
      .string()
      .required("Code requis")
      .matches(/^\d{6}$/, "Code invalide"),
    newEmail: yup.string().email().required("Nouvel email requis"),
  })
  .noUnknown()
  .required();

// --------------------
// Controller
// --------------------
export default {
  // Déjà présent chez toi, gardé tel quel (j’ai juste laissé ici pour contexte)
  async updateUnconfirmedEmail(ctx) {
    try {
      const user = ctx.state.user;
      if (!user) return ctx.unauthorized("Utilisateur non authentifié");

      if (user.confirmed) {
        return ctx.forbidden(
          "Compte déjà confirmé. Utilisez la route OTP dédiée.",
        );
      }

      const unconfirmedSchema = yup
        .object({
          email: yup.string().email(),
          password: yup
            .string()
            .min(8, "Au moins 8 caractères")
            .matches(/[A-Z]/, "Au moins une majuscule")
            .matches(/[a-z]/, "Au moins une minuscule")
            .matches(/\d/, "Au moins un chiffre"),
        })
        .noUnknown()
        .test(
          "at-least-one",
          "Fournir au moins email ou password",
          (v) => !!(v?.email || v?.password),
        );

      await validateYupSchema(unconfirmedSchema)(ctx.request.body);

      const emailProvided = typeof ctx.request.body.email === "string";
      const pwdProvided = typeof ctx.request.body.password === "string";
      const nextEmailL = emailProvided
        ? ctx.request.body.email.toLowerCase()
        : undefined;

      if (emailProvided) {
        await assertEmailAvailable(nextEmailL, user.id, true);
      }

      const sameEmail = emailProvided
        ? nextEmailL === (user.email || "").toLowerCase()
        : true;
      const nothingToChange = sameEmail && !pwdProvided;
      if (nothingToChange) {
        return ctx.badRequest("Aucune modification détectée");
      }

      const userService = strapi.plugin("users-permissions").service("user");

      const dataToUpdate = {
        ...(emailProvided && !sameEmail ? { email: nextEmailL } : {}),
        ...(pwdProvided ? { password: ctx.request.body.password } : {}),
        confirmed: false,
      };

      const updatedUser = await userService.edit(user.id, dataToUpdate);

      if (emailProvided && !sameEmail) {
        try {
          await userService.sendConfirmationEmail(updatedUser);
        } catch (e) {
          strapi.log.error(
            "sendConfirmationEmail failed after updateUnconfirmedEmail",
            e,
          );
        }
      }

      ctx.body = {
        ok: true,
        message: "Modifications enregistrées. Vérifie ta boîte mail.",
      };
    } catch (err) {
      strapi.log.error("updateUnconfirmedEmail error", err);
      return ctx.badRequest(err.message || "Requête invalide");
    }
  },

  // -------------- NEW 1/2 : envoi du code --------------
  async sendEmailChangeCode(ctx) {
    try {
      await validateYupSchema(sendCodeSchema)(ctx.request.body);

      const authUser = ctx.state.user;
      if (!authUser) return ctx.unauthorized("Utilisateur non authentifié");

      const me = await getMe(authUser.id);
      if (!me?.email) return ctx.badRequest("Email introuvable sur le compte");
      if (!me.confirmed) {
        ctx.status = 403; // Forbidden
        ctx.body = {
          ok: false,
          code: "ACCOUNT_UNCONFIRMED",
          message:
            "Votre compte n'est pas confirmé. Veuillez confirmer votre email avant de demander un code.",
        };
        return;
      }

      const now = new Date();

      // 1) Anti-spam immédiat (respecte un éventuel cooldown en cours)
      if (
        me.emailChangeRateLimitUntil &&
        new Date(me.emailChangeRateLimitUntil) > now
      ) {
        const retryAfterSeconds = secondsUntil(me.emailChangeRateLimitUntil);
        ctx.set("Retry-After", String(retryAfterSeconds));
        ctx.status = 429;
        ctx.body = {
          ok: false,
          code: "RATE_LIMIT",
          retryAfterSeconds,
          retryAfterISO: me.emailChangeRateLimitUntil,
          message: `Trop de demandes. Réessayez dans ${humanizeSecondsFR(retryAfterSeconds)}.`,
        };
        return;
      }

      // 2) Quota / jour (fenêtre glissante 24h)
      const MAX_PER_DAY = Number(process.env.EMAIL_CHANGE_OTP_MAX_PER_DAY || 0);
      let dailyCount = me.emailChangeDailyCount || 0;
      let dailyResetAt = me.emailChangeDailyCountResetAt
        ? new Date(me.emailChangeDailyCountResetAt)
        : null;

      if (!dailyResetAt || dailyResetAt <= now) {
        // Nouvelle fenêtre de 24h à partir de maintenant
        dailyCount = 0;
        dailyResetAt = new Date(Date.now() + 24 * 3600 * 1000);
      }

      if (MAX_PER_DAY > 0 && dailyCount >= MAX_PER_DAY) {
        const retryAfterSeconds = secondsUntil(dailyResetAt.toISOString());
        ctx.set("Retry-After", String(retryAfterSeconds));
        ctx.status = 429;
        ctx.body = {
          ok: false,
          code: "DAILY_CAP",
          retryAfterSeconds,
          retryAfterISO: dailyResetAt.toISOString(),
          message: `Limite quotidienne atteinte. Réessayez dans ${humanizeSecondsFR(retryAfterSeconds)}.`,
        };
        return;
      }

      // 3) Backoff progressif
      const backoffEnabled =
        String(process.env.EMAIL_CHANGE_OTP_BACKOFF_ENABLED || "false") ===
        "true";
      const steps = parseBackoffSteps();
      const backoffResetAfter = Number(
        process.env.EMAIL_CHANGE_OTP_BACKOFF_RESET_AFTER_SECONDS || 3600,
      );

      let step = me.emailChangeBackoffStep || 0;
      const backoffResetAt = me.emailChangeBackoffResetAt
        ? new Date(me.emailChangeBackoffResetAt)
        : null;

      // reset du backoff si la fenêtre est passée
      if (!backoffEnabled || (backoffResetAt && backoffResetAt <= now)) {
        step = 0;
      }

      // cooldown à appliquer maintenant
      const cooldownSeconds = backoffEnabled
        ? steps[Math.min(step, steps.length - 1)]
        : Number(process.env.EMAIL_CHANGE_OTP_RESEND_COOLDOWN_SECONDS || 120);

      // 4) Génère l’OTP et persiste l’état
      const code = generateOtp6();
      const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);
      const nextAllowedAt = new Date(Date.now() + cooldownSeconds * 1000);

      const userService = strapi.plugin("users-permissions").service("user");

      await userService.edit(me.id, {
        emailChangeOtp: code,
        emailChangeOtpExpires: expiresAt,
        emailChangeOtpAttempts: 0,
        emailChangeRateLimitUntil: nextAllowedAt,

        // met à jour le backoff (avance d’un cran et ouvre une nouvelle fenêtre)
        ...(backoffEnabled
          ? {
              emailChangeBackoffStep: Math.min(step + 1, steps.length - 1),
              emailChangeBackoffResetAt: new Date(
                Date.now() + backoffResetAfter * 1000,
              ),
            }
          : {
              emailChangeBackoffStep: 0,
              emailChangeBackoffResetAt: null,
            }),

        // incrémente le compteur quotidien
        emailChangeDailyCount: dailyCount + 1,
        emailChangeDailyCountResetAt: dailyResetAt,
      });

      // 5) Envoie l’email (template SendGrid si configuré)
      await sendOtpEmail(me.email, code);

      ctx.body = {
        ok: true,
        message: "Code envoyé. Vérifiez votre boîte mail.",
        cooldownSeconds,
        expiresMinutes: OTP_TTL_MINUTES,
      };
    } catch (err) {
      strapi.log.error("sendEmailChangeCode error", err);
      return ctx.badRequest(err.message || "Requête invalide");
    }
  },

  // -------------- NEW 2/2 : validation + changement email --------------
  async confirmEmailChange(ctx) {
    try {
      await validateYupSchema(confirmSchema)(ctx.request.body);

      const authUser = ctx.state.user;
      if (!authUser) return ctx.unauthorized("Utilisateur non authentifié");

      const { code, newEmail } = ctx.request.body;
      const nextEmailL = newEmail.toLowerCase();

      const me = await getMe(authUser.id);
      if (!me) return ctx.unauthorized("Utilisateur non authentifié");

      // Vérifs OTP
      if (!me.emailChangeOtp || !me.emailChangeOtpExpires) {
        return ctx.badRequest("Aucun code actif. Redemandez un code.");
      }
      const now = new Date();

      if (new Date(me.emailChangeOtpExpires) < now) {
        return ctx.badRequest("Code expiré. Redemandez un code.");
      }

      if ((me.emailChangeOtpAttempts || 0) >= OTP_MAX_ATTEMPTS) {
        return ctx.badRequest("Trop d’essais. Redemandez un nouveau code.");
      }

      if (code !== me.emailChangeOtp) {
        // Incrémente les tentatives
        await strapi
          .plugin("users-permissions")
          .service("user")
          .edit(me.id, {
            emailChangeOtpAttempts: (me.emailChangeOtpAttempts || 0) + 1,
          });

        return ctx.badRequest("Code invalide.");
      }

      // Unicité + no-op
      if (nextEmailL === (me.email || "").toLowerCase()) {
        return ctx.badRequest("Le nouvel email est identique à l’actuel.");
      }
      await assertEmailAvailable(nextEmailL, me.id, true);

      // Update email + reset OTP + force re-confirmation
      const userService = strapi.plugin("users-permissions").service("user");

      const updatedUser = await userService.edit(me.id, {
        email: nextEmailL,
        confirmed: false,

        // reset OTP
        emailChangeOtp: null,
        emailChangeOtpExpires: null,
        emailChangeOtpAttempts: 0,
        emailChangeRateLimitUntil: null,

        // reset du backoff après validation
        emailChangeBackoffStep: 0,
        emailChangeBackoffResetAt: null,
      });

      // Envoi email de confirmation standard (users-permissions)
      try {
        await userService.sendConfirmationEmail(updatedUser);
      } catch (e) {
        strapi.log.error(
          "sendConfirmationEmail failed after confirmEmailChange",
          e,
        );
      }

      ctx.body = {
        ok: true,
        message:
          "Email mis à jour. Vérifiez votre boîte pour confirmer votre compte.",
      };
    } catch (err) {
      strapi.log.error("confirmEmailChange error", err);
      return ctx.badRequest(err.message || "Requête invalide");
    }
  },
};
