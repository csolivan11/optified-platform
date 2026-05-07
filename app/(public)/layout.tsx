import { Logo } from "@/components/layout/logo";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="px-8 py-6">
        <Logo size="sm" />
      </header>
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md animate-slide-up">{children}</div>
      </main>
      <footer className="px-8 py-6 text-center text-caption text-muted-foreground">
        Optified Medical · Conflict-free health optimization
      </footer>
    </div>
  );
}
