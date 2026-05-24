import { baseColors } from "./colors";

export type ThemeMode = "light" | "dark";

export type DepthToken = {
  shadowColor: string;
  shadowOpacity: number;
  shadowRadius: number;
  shadowOffset: {
    width: number;
    height: number;
  };
  elevation: number;
};

export type ThemeDefinition = {
  mode: ThemeMode;
  isDark: boolean;

  background: string;
  backgroundSecondary: string;
  surface: string;
  surfaceAlt: string;
  surfaceElevated: string;

  text: string;
  textSecondary: string;
  textTertiary: string;
  textInverse: string;

  primary: string;
  primarySoft: string;
  primaryStrong: string;
  accentWarm: string;
  accentWarmStrong: string;
  aiAccent: string;

  border: string;
  borderSoft: string;
  divider: string;
  focusRing: string;

  link: string;
  overlay: string;
  shadow: string;

  depth: {
    raised: DepthToken;
    floating: DepthToken;
    modal: DepthToken;
    tabBar: DepthToken;
    cta: DepthToken;
    inputFocus: DepthToken;
  };

  disabled: {
    background: string;
    text: string;
    border: string;
  };

  error: {
    strong: string;
    main: string;
    border: string;
    surface: string;
    text: string;
    onColor: string;
  };

  success: {
    main: string;
    surface: string;
    text: string;
    onColor: string;
  };

  warning: {
    main: string;
    surface: string;
    text: string;
    onColor: string;
  };

  info: {
    main: string;
    surface: string;
    text: string;
    onColor: string;
  };

  chart: {
    protein: string;
    proteinSoft: string;
    carbs: string;
    carbsSoft: string;
    fat: string;
    fatSoft: string;
    calories: string;
    caloriesSoft: string;
  };

  macro: {
    protein: string;
    proteinSoft: string;
    carbs: string;
    carbsSoft: string;
    fat: string;
    fatSoft: string;
    calories: string;
    caloriesSoft: string;
  };

  cta: {
    primaryBackground: string;
    primaryText: string;
    secondaryBackground: string;
    secondaryText: string;
    secondaryBorder: string;
    ghostText: string;
    destructiveBackground: string;
    destructiveText: string;
  };

  button: {
    primary: {
      background: string;
      border: string;
      text: string;
      pressedBackground: string;
      pressedBorder: string;
      pressedText: string;
      disabledBackground: string;
      disabledBorder: string;
      disabledText: string;
    };
    secondary: {
      background: string;
      border: string;
      text: string;
      pressedBackground: string;
      pressedBorder: string;
      pressedText: string;
      disabledBackground: string;
      disabledBorder: string;
      disabledText: string;
    };
    ghost: {
      background: string;
      border: string;
      text: string;
      pressedBackground: string;
      pressedBorder: string;
      pressedText: string;
      disabledBackground: string;
      disabledBorder: string;
      disabledText: string;
    };
    destructive: {
      background: string;
      border: string;
      text: string;
      pressedBackground: string;
      pressedBorder: string;
      pressedText: string;
      disabledBackground: string;
      disabledBorder: string;
      disabledText: string;
    };
  };

  input: {
    background: string;
    backgroundError: string;
    backgroundDisabled: string;
    text: string;
    placeholder: string;
    border: string;
    borderDisabled: string;
    borderFocused: string;
    borderError: string;
  };

  status: {
    positive: string;
    caution: string;
    negative: string;
    neutral: string;
  };
};

const lightTheme: ThemeDefinition = {
  mode: "light",
  isDark: false,

  background: baseColors.cream50,
  backgroundSecondary: baseColors.sand100,
  surface: baseColors.cream0,
  surfaceAlt: baseColors.sand100,
  surfaceElevated: baseColors.white,

  text: baseColors.ink900,
  textSecondary: baseColors.ink700,
  textTertiary: baseColors.ink500,
  textInverse: baseColors.cream0,

  primary: baseColors.olive500,
  primarySoft: baseColors.olive400,
  primaryStrong: baseColors.olive700,
  accentWarm: baseColors.terracotta500,
  accentWarmStrong: baseColors.terracotta700,
  aiAccent: baseColors.terracotta500,

  border: baseColors.sand300,
  borderSoft: baseColors.sand200,
  divider: baseColors.sand300,
  focusRing: baseColors.focusRingLight,

  link: baseColors.olive500,
  overlay: baseColors.overlayLight,
  shadow: baseColors.shadowLight,

  depth: {
    raised: {
      shadowColor: baseColors.ink900,
      shadowOpacity: 0.08,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
      elevation: 3,
    },
    floating: {
      shadowColor: baseColors.ink900,
      shadowOpacity: 0.12,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 12 },
      elevation: 8,
    },
    modal: {
      shadowColor: baseColors.ink900,
      shadowOpacity: 0.16,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 16 },
      elevation: 10,
    },
    tabBar: {
      shadowColor: baseColors.ink900,
      shadowOpacity: 0.1,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: -6 },
      elevation: 12,
    },
    cta: {
      shadowColor: baseColors.ink900,
      shadowOpacity: 0.14,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 6,
    },
    inputFocus: {
      shadowColor: baseColors.ink900,
      shadowOpacity: 0.07,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 3 },
      elevation: 2,
    },
  },

  disabled: {
    background: baseColors.sand100,
    text: baseColors.ink500,
    border: baseColors.sand300,
  },

  error: {
    strong: baseColors.errorStrong,
    main: baseColors.error,
    border: baseColors.errorBorder,
    surface: baseColors.errorSurface,
    text: baseColors.errorStrong,
    onColor: baseColors.onError,
  },

  success: {
    main: baseColors.success,
    surface: baseColors.successSoft,
    text: baseColors.successText,
    onColor: baseColors.cream0,
  },

  warning: {
    main: baseColors.warning,
    surface: baseColors.warningSoft,
    text: baseColors.warningText,
    onColor: baseColors.cream0,
  },

  info: {
    main: baseColors.info,
    surface: baseColors.infoSoft,
    text: baseColors.infoText,
    onColor: baseColors.cream0,
  },

  chart: {
    protein: baseColors.macroProtein,
    proteinSoft: baseColors.macroProteinSoft,
    carbs: baseColors.macroCarbs,
    carbsSoft: baseColors.macroCarbsSoft,
    fat: baseColors.macroFat,
    fatSoft: baseColors.macroFatSoft,
    calories: baseColors.calories,
    caloriesSoft: baseColors.caloriesSoft,
  },

  macro: {
    protein: baseColors.macroProtein,
    proteinSoft: baseColors.macroProteinSoft,
    carbs: baseColors.macroCarbs,
    carbsSoft: baseColors.macroCarbsSoft,
    fat: baseColors.macroFat,
    fatSoft: baseColors.macroFatSoft,
    calories: baseColors.calories,
    caloriesSoft: baseColors.caloriesSoft,
  },

  cta: {
    primaryBackground: baseColors.olive500,
    primaryText: baseColors.cream0,
    secondaryBackground: baseColors.cream0,
    secondaryText: baseColors.ink900,
    secondaryBorder: baseColors.sand300,
    ghostText: baseColors.olive500,
    destructiveBackground: baseColors.errorStrong,
    destructiveText: baseColors.onError,
  },

  button: {
    primary: {
      background: baseColors.olive500,
      border: baseColors.olive500,
      text: baseColors.cream0,
      pressedBackground: baseColors.olive700,
      pressedBorder: baseColors.olive700,
      pressedText: baseColors.cream0,
      disabledBackground: baseColors.sand100,
      disabledBorder: baseColors.sand100,
      disabledText: baseColors.ink500,
    },
    secondary: {
      background: baseColors.cream0,
      border: baseColors.sand300,
      text: baseColors.ink900,
      pressedBackground: baseColors.cream50,
      pressedBorder: baseColors.sand300,
      pressedText: baseColors.ink900,
      disabledBackground: baseColors.sand100,
      disabledBorder: baseColors.sand300,
      disabledText: baseColors.ink500,
    },
    ghost: {
      background: "transparent",
      border: "transparent",
      text: baseColors.olive500,
      pressedBackground: baseColors.cream50,
      pressedBorder: "transparent",
      pressedText: baseColors.olive700,
      disabledBackground: "transparent",
      disabledBorder: "transparent",
      disabledText: baseColors.ink500,
    },
    destructive: {
      background: baseColors.errorStrong,
      border: baseColors.errorStrong,
      text: baseColors.onError,
      pressedBackground: baseColors.terracotta700,
      pressedBorder: baseColors.terracotta700,
      pressedText: baseColors.onError,
      disabledBackground: baseColors.sand100,
      disabledBorder: baseColors.sand300,
      disabledText: baseColors.ink700,
    },
  },

  input: {
    background: baseColors.cream0,
    backgroundError: baseColors.errorSurface,
    backgroundDisabled: baseColors.sand100,
    text: baseColors.ink900,
    placeholder: baseColors.ink500,
    border: baseColors.sand300,
    borderDisabled: baseColors.sand200,
    borderFocused: baseColors.olive400,
    borderError: baseColors.error,
  },

  status: {
    positive: baseColors.success,
    caution: baseColors.warning,
    negative: baseColors.error,
    neutral: baseColors.ink500,
  },
};

const darkTheme: ThemeDefinition = {
  mode: "dark",
  isDark: true,

  background: baseColors.darkBackground,
  backgroundSecondary: baseColors.darkSurface,
  surface: baseColors.darkSurface,
  surfaceAlt: baseColors.darkSurfaceAlt,
  surfaceElevated: "#242924",

  text: baseColors.darkText,
  textSecondary: baseColors.darkTextSecondary,
  textTertiary: baseColors.darkTextTertiary,
  textInverse: baseColors.ink900,

  primary: baseColors.olive400,
  primarySoft: "#89A284",
  primaryStrong: "#A6BDA0",
  accentWarm: baseColors.terracotta500,
  accentWarmStrong: "#D59A81",
  aiAccent: baseColors.terracotta500,

  border: baseColors.darkBorder,
  borderSoft: baseColors.darkBorderSoft,
  divider: baseColors.darkBorder,
  focusRing: baseColors.focusRingDark,

  link: "#9BB896",
  overlay: baseColors.overlayDark,
  shadow: baseColors.shadowDark,

  depth: {
    raised: {
      shadowColor: baseColors.black,
      shadowOpacity: 0.28,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 3,
    },
    floating: {
      shadowColor: baseColors.black,
      shadowOpacity: 0.34,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 14 },
      elevation: 8,
    },
    modal: {
      shadowColor: baseColors.black,
      shadowOpacity: 0.42,
      shadowRadius: 26,
      shadowOffset: { width: 0, height: 18 },
      elevation: 10,
    },
    tabBar: {
      shadowColor: baseColors.black,
      shadowOpacity: 0.36,
      shadowRadius: 22,
      shadowOffset: { width: 0, height: -8 },
      elevation: 12,
    },
    cta: {
      shadowColor: baseColors.black,
      shadowOpacity: 0.28,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 10 },
      elevation: 6,
    },
    inputFocus: {
      shadowColor: baseColors.black,
      shadowOpacity: 0.2,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    },
  },

  disabled: {
    background: "#222722",
    text: baseColors.darkTextTertiary,
    border: baseColors.darkBorderSoft,
  },

  error: {
    strong: "#D16A58",
    main: "#C85D4C",
    border: "#8A4A40",
    surface: "#2D201D",
    text: "#F2C4BB",
    onColor: baseColors.onError,
  },

  success: {
    main: "#7FA07A",
    surface: "#223025",
    text: "#C8D8C5",
    onColor: baseColors.ink900,
  },

  warning: {
    main: "#D1A15B",
    surface: "#332A1D",
    text: "#F0D9B4",
    onColor: baseColors.ink900,
  },

  info: {
    main: "#8CA9BF",
    surface: "#1F2A31",
    text: "#D0DEE8",
    onColor: baseColors.ink900,
  },

  chart: {
    protein: baseColors.macroProtein,
    proteinSoft: "rgba(74, 144, 226, 0.20)",
    carbs: baseColors.macroCarbs,
    carbsSoft: "rgba(102, 169, 107, 0.20)",
    fat: baseColors.macroFat,
    fatSoft: "rgba(201, 162, 39, 0.20)",
    calories: baseColors.calories,
    caloriesSoft: "rgba(94, 115, 80, 0.24)",
  },

  macro: {
    protein: baseColors.macroProtein,
    proteinSoft: "rgba(74, 144, 226, 0.20)",
    carbs: baseColors.macroCarbs,
    carbsSoft: "rgba(102, 169, 107, 0.20)",
    fat: baseColors.macroFat,
    fatSoft: "rgba(201, 162, 39, 0.20)",
    calories: baseColors.calories,
    caloriesSoft: "rgba(94, 115, 80, 0.24)",
  },

  cta: {
    primaryBackground: baseColors.olive400,
    primaryText: baseColors.ink900,
    secondaryBackground: baseColors.darkSurface,
    secondaryText: baseColors.darkText,
    secondaryBorder: baseColors.darkBorder,
    ghostText: baseColors.olive400,
    destructiveBackground: "#C85D4C",
    destructiveText: baseColors.onError,
  },

  button: {
    primary: {
      background: baseColors.olive400,
      border: baseColors.olive400,
      text: baseColors.ink900,
      pressedBackground: "#A6BDA0",
      pressedBorder: "#A6BDA0",
      pressedText: baseColors.ink900,
      disabledBackground: "#222722",
      disabledBorder: "#222722",
      disabledText: baseColors.darkTextTertiary,
    },
    secondary: {
      background: baseColors.darkSurface,
      border: baseColors.darkBorder,
      text: baseColors.darkText,
      pressedBackground: baseColors.darkSurfaceAlt,
      pressedBorder: baseColors.darkBorder,
      pressedText: baseColors.darkText,
      disabledBackground: "#1B1F1B",
      disabledBorder: baseColors.darkBorderSoft,
      disabledText: baseColors.darkTextTertiary,
    },
    ghost: {
      background: "transparent",
      border: "transparent",
      text: "#9BB896",
      pressedBackground: baseColors.darkBorderSoft,
      pressedBorder: "transparent",
      pressedText: baseColors.darkText,
      disabledBackground: "transparent",
      disabledBorder: "transparent",
      disabledText: baseColors.darkTextTertiary,
    },
    destructive: {
      background: "#2D201D",
      border: "#8A4A40",
      text: "#F2C4BB",
      pressedBackground: "#C85D4C",
      pressedBorder: "#C85D4C",
      pressedText: baseColors.onError,
      disabledBackground: "#1B1F1B",
      disabledBorder: baseColors.darkBorderSoft,
      disabledText: baseColors.darkTextTertiary,
    },
  },

  input: {
    background: "#202520",
    backgroundError: "#2D201D",
    backgroundDisabled: "#1B1F1B",
    text: baseColors.darkText,
    placeholder: baseColors.darkTextTertiary,
    border: baseColors.darkBorder,
    borderDisabled: baseColors.darkBorderSoft,
    borderFocused: baseColors.olive400,
    borderError: "#C85D4C",
  },

  status: {
    positive: "#7FA07A",
    caution: "#D1A15B",
    negative: "#C85D4C",
    neutral: baseColors.darkTextTertiary,
  },
};

export const themes = {
  light: lightTheme,
  dark: darkTheme,
};

export type ThemeName = keyof typeof themes;
