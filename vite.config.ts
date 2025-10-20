import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

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
      registerType: "autoUpdate",
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
      workbox: {
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5 MB
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2}"],
        runtimeCaching: [
          {
            // Cache animal data with cache-first strategy
            urlPattern: /^https:\/\/sxorybjlxyquxteptdyk\.supabase\.co\/rest\/v1\/animals\?.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "animals-cache",
              expiration: {
                maxAgeSeconds: 60 * 60, // 1 hour
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            // Cache records with network-first strategy
            urlPattern: /^https:\/\/sxorybjlxyquxteptdyk\.supabase\.co\/rest\/v1\/(milking_records|weight_records|health_records|ai_records)\?.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "records-cache",
              expiration: {
                maxAgeSeconds: 30 * 60, // 30 minutes
              },
            },
          },
          {
            // Cache feed inventory
            urlPattern: /^https:\/\/sxorybjlxyquxteptdyk\.supabase\.co\/rest\/v1\/feed_inventory\?.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "feed-cache",
              expiration: {
                maxAgeSeconds: 2 * 60 * 60, // 2 hours
              },
            },
          },
          {
            // General API cache fallback
            urlPattern: /^https:\/\/sxorybjlxyquxteptdyk\.supabase\.co\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "api-cache",
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24, // 24 hours
              },
            },
          },
        ],
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
