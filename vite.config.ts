import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import obfuscatorPlugin from "rollup-plugin-obfuscator";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Enable source maps only in development
    sourcemap: mode === "development",
    rollupOptions: {
      output: {
        // Manual chunk splitting for better caching
        manualChunks: {
          // Vendor chunks
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-ui": [
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-tabs",
            "@radix-ui/react-toast",
            "@radix-ui/react-tooltip",
          ],
          "vendor-query": ["@tanstack/react-query"],
          "vendor-motion": ["framer-motion"],
          "vendor-supabase": ["@supabase/supabase-js"],
          "vendor-charts": ["recharts"],
        },
      },
      plugins: [
        mode === "production" &&
          obfuscatorPlugin({
            options: {
              // Obfuscation settings - balanced for security vs performance
              compact: true,
              controlFlowFlattening: true,
              controlFlowFlatteningThreshold: 0.5,
              deadCodeInjection: true,
              deadCodeInjectionThreshold: 0.2,
              debugProtection: true,
              debugProtectionInterval: 2000,
              disableConsoleOutput: true,
              identifierNamesGenerator: "hexadecimal",
              log: false,
              numbersToExpressions: true,
              renameGlobals: false,
              selfDefending: true,
              simplify: true,
              splitStrings: true,
              splitStringsChunkLength: 5,
              stringArray: true,
              stringArrayCallsTransform: true,
              stringArrayEncoding: ["base64"],
              stringArrayIndexShift: true,
              stringArrayRotate: true,
              stringArrayShuffle: true,
              stringArrayWrappersCount: 2,
              stringArrayWrappersChainedCalls: true,
              stringArrayWrappersParametersMaxCount: 4,
              stringArrayWrappersType: "function",
              stringArrayThreshold: 0.75,
              transformObjectKeys: true,
              unicodeEscapeSequence: false,
            },
          }),
      ].filter(Boolean),
    },
    // Minification settings
    minify: "terser",
    terserOptions: {
      compress: {
        drop_console: mode === "production",
        drop_debugger: true,
        pure_funcs: mode === "production" ? ["console.log", "console.info", "console.debug"] : [],
        passes: 2, // Multiple compression passes
      },
      mangle: {
        safari10: true,
      },
      format: {
        comments: false,
      },
    },
    // Chunk splitting for better caching
    chunkSizeWarningLimit: 1000,
    // Target modern browsers for smaller bundles
    target: "es2020",
    // Enable CSS code splitting
    cssCodeSplit: true,
  },
  // Optimize dependencies
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-router-dom",
      "@tanstack/react-query",
      "framer-motion",
    ],
  },
}));
