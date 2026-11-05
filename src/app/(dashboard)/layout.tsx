import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";

/** App shell: fixed sidebar on desktop, sheet on mobile, sticky header. */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <main id="main-content" className="bg-grid flex-1 px-4 py-6 sm:px-6 lg:py-8">
          <div className="mx-auto w-full max-w-[1440px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
