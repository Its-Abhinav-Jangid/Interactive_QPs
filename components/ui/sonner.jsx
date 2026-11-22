"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner } from "sonner";

export function Toaster(props) {
  const { theme } = useTheme();
  return (
    <Sonner
      theme={theme === "dark" ? "dark" : "light"}
      position="bottom-right"
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast:
            "group rounded-xl border border-border bg-popover text-popover-foreground shadow-xl",
          description: "text-muted-foreground",
        },
      }}
      {...props}
    />
  );
}
