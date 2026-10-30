import { OldLinkRedirect } from "@/components/old-link-redirect";

// Exported as 404.html, which GitHub Pages serves for unknown paths.
export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-6">
      <OldLinkRedirect />
    </main>
  );
}
