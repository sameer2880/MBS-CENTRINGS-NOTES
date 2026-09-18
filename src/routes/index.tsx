import { createFileRoute } from "@tanstack/react-router";
import { AppLanding } from "@/components/AppLanding";

export const Route = createFileRoute("/")({
  component: AppLanding,
});