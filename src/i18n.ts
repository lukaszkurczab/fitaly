import i18n from "i18next";
import type { LanguageDetectorAsyncModule } from "i18next";
import { initReactI18next } from "react-i18next";
import * as Localization from "expo-localization";

import en_common from "./locales/en/common.json";
import en_login from "./locales/en/login.json";
import en_terms from "./locales/en/terms.json";
import en_privacy from "./locales/en/privacy.json";
import en_resetPassword from "./locales/en/resetPassword.json";
import en_onboarding from "./locales/en/onboarding.json";
import en_profile from "./locales/en/profile.json";
import en_meals from "./locales/en/meals.json";
import en_chat from "./locales/en/chat.json";
import en_statistics from "./locales/en/statistics.json";
import en_home from "./locales/en/home.json";
import en_history from "./locales/en/history.json";
import en_notifications from "./locales/en/notifications.json";
import en_share from "./locales/en/share.json";
import en_diet from "./locales/en/diet.json";

import pl_common from "./locales/pl/common.json";
import pl_login from "./locales/pl/login.json";
import pl_terms from "./locales/pl/terms.json";
import pl_privacy from "./locales/pl/privacy.json";
import pl_resetPassword from "./locales/pl/resetPassword.json";
import pl_onboarding from "./locales/pl/onboarding.json";
import pl_profile from "./locales/pl/profile.json";
import pl_meals from "./locales/pl/meals.json";
import pl_chat from "./locales/pl/chat.json";
import pl_statistics from "./locales/pl/statistics.json";
import pl_home from "./locales/pl/home.json";
import pl_history from "./locales/pl/history.json";
import pl_notifications from "./locales/pl/notifications.json";
import pl_share from "./locales/pl/share.json";
import pl_diet from "./locales/pl/diet.json";

const languageDetector: LanguageDetectorAsyncModule = {
  type: "languageDetector",
  async: true,
  detect: async () => {
    const locales = Localization.getLocales?.() || [];
    const code = locales[0]?.languageCode?.toLowerCase() || "en";
    return code === "pl" ? "pl" : "en";
  },
  init: () => {},
  cacheUserLanguage: () => {},
};

i18n
  .use(languageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: "en",
    supportedLngs: ["en", "pl"],
    ns: [
      "common",
      "login",
      "terms",
      "privacy",
      "resetPassword",
      "onboarding",
      "profile",
      "meals",
      "statistics",
      "chat",
      "home",
      "history",
      "notifications",
      "share",
      "diet",
    ],
    defaultNS: "common",
    resources: {
      en: {
        common: en_common,
        login: en_login,
        terms: en_terms,
        privacy: en_privacy,
        resetPassword: en_resetPassword,
        onboarding: en_onboarding,
        profile: en_profile,
        meals: en_meals,
        statistics: en_statistics,
        chat: en_chat,
        home: en_home,
        history: en_history,
        notifications: en_notifications,
        share: en_share,
        diet: en_diet,
      },
      pl: {
        common: pl_common,
        login: pl_login,
        terms: pl_terms,
        privacy: pl_privacy,
        resetPassword: pl_resetPassword,
        onboarding: pl_onboarding,
        profile: pl_profile,
        meals: pl_meals,
        statistics: pl_statistics,
        chat: pl_chat,
        home: pl_home,
        history: pl_history,
        notifications: pl_notifications,
        share: pl_share,
        diet: pl_diet,
      },
    },
    interpolation: { escapeValue: false },
    returnNull: false,
    cleanCode: true,
  });

export default i18n;
