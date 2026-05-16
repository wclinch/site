export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`html, body { overflow: hidden !important; }`}</style>
      {children}
    </>
  )
}
