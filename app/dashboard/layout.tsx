import Sidebar from "@/components/Sidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "var(--bg)" }}>
      <Sidebar />
      {/* pt-12 clears the phone top bar, which is absent from md: upward.
          min-w-0 lets wide tables scroll inside the flex child instead of
          pushing the whole layout sideways. */}
      <main className="min-w-0 flex-1 overflow-y-auto pt-12 md:pt-0">
        <div className="mx-auto max-w-[1400px] p-3 sm:p-4">{children}</div>
      </main>
    </div>
  );
}
