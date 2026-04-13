/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        background: "#0A0A0F",
        surface: "rgba(255, 255, 255, 0.05)",
        border: "rgba(255, 255, 255, 0.06)",
        primary: "#8B5CF6",
        "primary-light": "#A78BFA",
        secondary: "#06B6D4",
        accent: "#F59E0B",
        success: "#10B981",
        error: "#EF4444",
        warning: "#F59E0B",
      },
      fontFamily: {
        sans: ["SpaceGrotesk-Regular"],
        "sans-medium": ["SpaceGrotesk-Medium"],
        "sans-bold": ["SpaceGrotesk-Bold"],
        "sans-light": ["SpaceGrotesk-Light"],
      },
    },
  },
  plugins: [],
};
