"use client";

import { useRouter, usePathname } from "next/navigation";
import { Locale, locales, localeLabels } from "@/i18n.config";
import { useState } from "react";

export function LanguageSelector() {
  const router = useRouter();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  // Extract current locale from pathname
  const currentLocale = (pathname.split("/")[1] as Locale) || "en";

  const handleLanguageChange = (newLocale: Locale) => {
    // Replace current locale in path or add it if not present
    let newPathname = pathname;

    if (
      locales.some((l) => pathname.startsWith(`/${l}/`) || pathname === `/${l}`)
    ) {
      // Replace existing locale
      newPathname = pathname.replace(
        new RegExp(`^/${currentLocale}(/|$)`),
        `/${newLocale}$1`,
      );
    } else {
      // Add locale to path
      newPathname = `/${newLocale}${pathname}`;
    }

    router.push(newPathname);
    setIsOpen(false);
  };

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          backgroundColor: "#007bff",
          color: "white",
          padding: "8px 12px",
          border: "none",
          borderRadius: "4px",
          cursor: "pointer",
          fontSize: "14px",
        }}
      >
        {localeLabels[currentLocale]} ▼
      </button>

      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            right: 0,
            backgroundColor: "white",
            border: "1px solid #ccc",
            borderRadius: "4px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
            zIndex: 1000,
            minWidth: "180px",
            marginTop: "4px",
          }}
        >
          {locales.map((locale) => (
            <button
              key={locale}
              onClick={() => handleLanguageChange(locale)}
              style={{
                display: "block",
                width: "100%",
                padding: "12px 16px",
                border: "none",
                backgroundColor: currentLocale === locale ? "#e7f3ff" : "white",
                color: currentLocale === locale ? "#007bff" : "#333",
                textAlign: "left",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: currentLocale === locale ? "bold" : "normal",
                borderRadius:
                  locale === locales[0]
                    ? "4px 4px 0 0"
                    : locale === locales[locales.length - 1]
                      ? "0 0 4px 4px"
                      : "0",
              }}
              onMouseEnter={(e) => {
                if (currentLocale !== locale) {
                  e.currentTarget.style.backgroundColor = "#f5f5f5";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor =
                  currentLocale === locale ? "#e7f3ff" : "white";
              }}
            >
              {localeLabels[locale]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
