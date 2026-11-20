// "Paper & Ink" theme: warm paper pages, ink text, one orange accent.
// Dark surfaces (3D hall, hero ring, movie banners, tickets) use ink as their background.
module.exports = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#F3EEE5", // page background
        card: "#FBF8F2", // raised surfaces on paper
        fg: "#16161A", // text on paper
        ink: "#16161A", // dark surfaces
        panel: "#202027", // panels on dark surfaces
        brand: "#FF5A36", // accent
        gold: "#A86A12", // ratings, test-mode badge
      },
      fontFamily: { sans: ["var(--font-sora)", "ui-sans-serif", "system-ui", "sans-serif"] },
    },
  },
  plugins: [],
};
