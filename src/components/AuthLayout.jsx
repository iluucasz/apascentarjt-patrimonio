import React from "react";
import { QrCode, ClipboardCheck, FileText } from "lucide-react";
import BrandMark from "@/components/BrandMark";
import { useApp } from "@/lib/AppContext";

const HIGHLIGHTS = [
  { icon: QrCode, text: "Etiquetas com QR Code para cada item" },
  { icon: ClipboardCheck, text: "Inventário conferido pelo celular" },
  { icon: FileText, text: "Relatório em PDF pronto para enviar" },
];

// Moldura das telas de entrada: painel da marca no computador, só o formulário no celular.
export default function AuthLayout({ icon: Icon, title, subtitle, footer, children }) {
  const { settings } = useApp();
  const name = settings?.church_name || "Gestão Patrimonial";

  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="relative hidden overflow-hidden bg-sidebar text-sidebar-foreground lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
        <svg className="pointer-events-none absolute -bottom-40 -left-40 h-[640px] w-[640px] text-sidebar-primary/15" viewBox="0 0 640 640" fill="none" aria-hidden="true">
          {[300, 240, 180, 120, 60].map((r) => <circle key={r} cx="320" cy="320" r={r} stroke="currentColor" strokeWidth="2" />)}
        </svg>
        <div className="relative flex items-center gap-3">
          <BrandMark logoUrl={settings?.church_logo_url} bgColor={settings?.logo_bg_color} className="h-12 w-12 rounded-2xl" iconClassName="w-6 h-6" />
          <p className="text-lg font-bold text-white">{name}</p>
        </div>
        <div className="relative max-w-md">
          <h2 className="text-4xl font-bold leading-tight tracking-tight text-white">Cada bem no seu lugar, e todo mundo sabendo onde.</h2>
          <ul className="mt-8 space-y-4">
            {HIGHLIGHTS.map(({ icon: HIcon, text }) => (
              <li key={text} className="flex items-center gap-3.5 text-base">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sidebar-accent text-sidebar-primary"><HIcon className="h-5 w-5" aria-hidden="true" /></span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-sm text-sidebar-foreground/60">Gestão de patrimônio para igrejas</p>
      </aside>

      <main className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <BrandMark logoUrl={settings?.church_logo_url} bgColor={settings?.logo_bg_color} className="h-11 w-11 rounded-xl" />
            <p className="font-bold">{name}</p>
          </div>
          {Icon && (
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-primary">
              <Icon className="h-6 w-6" aria-hidden="true" />
            </div>
          )}
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{title}</h1>
          {subtitle && <p className="mt-2 text-base text-muted-foreground">{subtitle}</p>}
          <div className="mt-8">{children}</div>
          {footer && <p className="mt-8 text-sm text-muted-foreground">{footer}</p>}
        </div>
      </main>
    </div>
  );
}
