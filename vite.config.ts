import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";
import { visualizer } from "rollup-plugin-visualizer";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
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
      external: ['capacitor-native-settings'],
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
}));
