import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

const title = "PatchProof — Adversarial Software Verification";
const description =
  "A deterministic, evidence-first verifier that tries to disprove code patches.";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const forwardedHost = requestHeaders.get("x-forwarded-host");
  const directHost = requestHeaders.get("host");
  const candidateHost = forwardedHost ?? directHost ?? "localhost:3000";
  const safeHost = /^[a-z0-9.-]+(?::\d+)?$/i.test(candidateHost)
    ? candidateHost
    : "localhost:3000";
  const forwardedProtocol = requestHeaders.get("x-forwarded-proto");
  const protocol =
    forwardedProtocol === "http" || forwardedProtocol === "https"
      ? forwardedProtocol
      : safeHost.startsWith("localhost")
        ? "http"
        : "https";
  const metadataBase = new URL(`${protocol}://${safeHost}`);

  return {
    title,
    description,
    metadataBase,
    openGraph: {
      title: "PatchProof — Your tests passed. Your patch didn’t.",
      description: "Executable counterexamples for subtle software regressions.",
      images: [{
        url: new URL("/demo/patchproof-console.png", metadataBase).toString(),
        width: 1600,
        height: 1000,
        alt: "PatchProof adversarial verification console",
      }],
    },
    twitter: {
      card: "summary_large_image",
      title: "PatchProof",
      description: "Adversarial software verification with minimized counterexamples.",
      images: [new URL("/demo/patchproof-console.png", metadataBase).toString()],
    },
  };
}

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
