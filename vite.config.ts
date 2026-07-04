import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";
import { visualizer } from "rollup-plugin-visualizer";

// Content-Security-Policy injected as a <meta> into the built index.html only.
// It is applied at BUILD time (not in the Vite dev server, which needs
// 'unsafe-eval'/inline for HMR) so it ships in the production web bundle AND the
// Capacitor (Android/iOS) bundle, where there is no HTTP layer to send headers.
// The full header set (HSTS, X-Frame-Options, etc.) is served via public/_headers
// for the web host. Keep this CSP in sync with public/_headers.
// 'unsafe-inline' on style-src is required by Radix/shadcn + Mapbox GL inline
// styles; blob:/worker-src by Mapbox GL workers and the PWA service worker.
const CSP_META = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self'",
  "manifest-src 'self'",
  "worker-src 'self' blob:",
  "child-src 'self' blob:",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https://fonts.gstatic.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "script-src 'self' https://challenges.cloudflare.com",
  "frame-src 'self' https://challenges.cloudflare.com",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://ai.gateway.lovable.dev https://api.elevenlabs.io wss://api.elevenlabs.io https://api.mapbox.com https://events.mapbox.com https://*.tiles.mapbox.com https://connectivitycheck.gstatic.com https://fonts.googleapis.com https://fonts.gstatic.com",
  "upgrade-insecure-requests",
].join("; ");

// Public Lovable Cloud fallback values. These are publishable frontend values,
// not secrets. Keep them here so production builds still boot if the hosting
// build environment does not inject VITE_* variables after `.env` was untracked.
const PUBLIC_SUPABASE_FALLBACKS = {
  VITE_SUPABASE_URL: "https://sxorybjlxyquxteptdyk.supabase.co",
  VITE_SUPABASE_PROJECT_ID: "sxorybjlxyquxteptdyk",
  VITE_SUPABASE_PUBLISHABLE_KEY:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJIUzI1NiIsInJlZiI6InN4b3J5YmpseHlxdXh0ZXB0ZHlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkxNjQ3ODUsImV4cCI6MjA3NDc0MDc4NX0.WalyDDm7YNNcdiZrrB3PfMUpD2Qj8ld-9SWMv5lB1cA",
} as const;

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const publicSupabaseEnv = {
    VITE_SUPABASE_URL: env.VITE_SUPABASE_URL || PUBLIC_SUPABASE_FALLBACKS.VITE_SUPABASE_URL,
    VITE_SUPABASE_PROJECT_ID: env.VITE_SUPABASE_PROJECT_ID || PUBLIC_SUPABASE_FALLBACKS.VITE_SUPABASE_PROJECT_ID,
    VITE_SUPABASE_PUBLISHABLE_KEY:
      env.VITE_SUPABASE_PUBLISHABLE_KEY || PUBLIC_SUPABASE_FALLBACKS.VITE_SUPABASE_PUBLISHABLE_KEY,
  };

  return ({
  server: {
    host: "::",
    port: 8080,
  },
  define: {
    "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(publicSupabaseEnv.VITE_SUPABASE_URL),
    "import.meta.env.VITE_SUPABASE_PROJECT_ID": JSON.stringify(publicSupabaseEnv.VITE_SUPABASE_PROJECT_ID),
    "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(publicSupabaseEnv.VITE_SUPABASE_PUBLISHABLE_KEY),
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    // Inject the CSP <meta> into index.html for production/native builds only.
    {
      name: "inject-csp-meta",
      apply: "build" as const,
      transformIndexHtml: {
        order: "pre" as const,
        handler: () => [
          {
            tag: "meta",
            attrs: {
              "http-equiv": "Content-Security-Policy",
              content: CSP_META,
            },
            injectTo: "head-prepend" as const,
          },
        ],
      },
    },
    VitePWA({
      strategies: 'injectManifest', // Use custom service worker
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectRegister: false, // Manual registration
      includeAssets: ["favicon.ico", "apple-touch-icon.png", "mask-icon.svg"],
      manifest: {
        name: "Doc Aga - Farm Management System",
        short_name: "Doc Aga",
        description: "Comprehensive farm management system with AI-powered veterinary assistance, livestock tracking, and marketplace",
        theme_color: "#10b981",
        background_color: "#ffffff",
        display: "standalone",
        icons: [
          {
            src: "/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      injectManifest: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MB
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
      },
    }),
    // Bundle analyzer - generates stats.html after build
    mode === "production" && visualizer({
      filename: "./dist/stats.html",
      open: false,
      gzipSize: true,
      brotliSize: true,
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      // Externalize native-only Capacitor plugins that aren't available in web builds
      external: [
        '@capacitor/camera',
        '@capacitor/local-notifications',
        '@capacitor/haptics',
      ],
      output: {
        manualChunks: {
          // Vendor chunk for React and core dependencies
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Separate chunk for UI components
          'vendor-ui': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-select',
            '@radix-ui/react-tabs',
            '@radix-ui/react-toast',
          ],
          // Separate chunk for charts
          'vendor-charts': ['recharts'],
          // Supabase and data layer
          'vendor-data': ['@supabase/supabase-js', '@tanstack/react-query'],
        },
      },
    },
    // Optimize chunk size warnings
    chunkSizeWarningLimit: 1000,
  },
  });
});
