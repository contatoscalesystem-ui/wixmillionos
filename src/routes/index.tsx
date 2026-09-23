import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard" });
  },
  head: () => ({
    meta: [
      { title: "WIX MILLION OS" },
      { name: "description", content: "Central de operação comercial da WIX MILLION." },
      { property: "og:title", content: "WIX MILLION OS" },
      { property: "og:description", content: "Central de operação comercial da WIX MILLION." },
    ],
  }),
});
