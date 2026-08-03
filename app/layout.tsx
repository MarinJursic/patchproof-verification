import type { Metadata } from "next";
import "./globals.css";

const title = "Patch Verification — Adversarial Software Verification";
const description =
  "A deterministic, evidence-first verifier that tries to disprove code patches.";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const metadataBase = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000");
const imageUrl = new URL(`${basePath}/patchproof-workbench.jpg`, metadataBase).toString();

export const metadata: Metadata = {
  title,
  description,
  metadataBase,
  openGraph: {
    title: "Patch Verification — Your tests passed. Your patch didn’t.",
    description: "Executable counterexamples for subtle software regressions.",
    images: [{
      url: imageUrl,
      width: 1280,
      height: 720,
      alt: "Patch Verification forensic workbench",
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Patch Verification",
    description: "Adversarial software verification with minimized counterexamples.",
    images: [imageUrl],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var saved=localStorage.getItem("patchproof-theme");var theme=saved==="light"||saved==="dark"?saved:(matchMedia("(prefers-color-scheme: light)").matches?"light":"dark");document.documentElement.dataset.theme=theme;document.documentElement.style.colorScheme=theme}catch(_){document.documentElement.dataset.theme="dark"}})();`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
