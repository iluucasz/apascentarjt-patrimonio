import { db } from '@/lib/db';

import React, { useState } from 'react';
import { toast } from 'sonner';

import BrandMark from '@/components/BrandMark';
import { Label } from '@/components/ui/label';

const DEFAULT_COLOR = '#111827';

// Logo e cor de fundo de um local. Cada um pode ser próprio ou herdado
// (`inherited` = o que o local usaria sem valor próprio; `inheritLabel` diz de
// onde vem, ex.: "do local pai").
// value: { logoMode, logo_url, colorMode, logo_bg_color }
export default function LocationBrandingFields({ value, onChange, inherited, inheritLabel, onUploadingChange }) {
  const [uploading, setUploading] = useState(false);
  const set = (patch) => onChange({ ...value, ...patch });

  const logoUrl = value.logoMode === 'own' && value.logo_url ? value.logo_url : inherited.logoUrl;
  const bgColor = value.colorMode === 'own' && value.logo_bg_color ? value.logo_bg_color : inherited.bgColor;

  const handleLogo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    onUploadingChange?.(true);
    try {
      const { file_url } = await db.integrations.Core.UploadFile({ file });
      set({ logoMode: 'own', logo_url: file_url });
    } catch (err) {
      toast.error('Erro ao enviar logo');
    } finally {
      setUploading(false);
      onUploadingChange?.(false);
    }
  };

  return (
    <div className="rounded-lg border border-border p-3 space-y-3">
      <div className="flex items-center gap-3">
        <BrandMark logoUrl={logoUrl} bgColor={bgColor} className="w-12 h-12" iconClassName="w-6 h-6" />
        <p className="text-xs text-muted-foreground">Ícone mostrado na barra lateral quando este local estiver selecionado.</p>
      </div>

      <div className="space-y-1.5">
        <Label>Logo</Label>
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" checked={value.logoMode !== 'own'} onChange={() => set({ logoMode: 'inherit' })} />
          Usar a logo {inheritLabel}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" checked={value.logoMode === 'own'} onChange={() => set({ logoMode: 'own' })} />
          Usar uma logo própria
        </label>
        {value.logoMode === 'own' && (
          <div className="pl-6">
            <input type="file" accept="image/*" onChange={handleLogo} className="text-sm w-full" />
            {uploading && <p className="text-xs text-muted-foreground mt-1">Enviando...</p>}
            {!uploading && !value.logo_url && <p className="text-xs text-muted-foreground mt-1">Sem arquivo, continua usando a logo {inheritLabel}.</p>}
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <Label>Cor de fundo</Label>
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" checked={value.colorMode !== 'own'} onChange={() => set({ colorMode: 'inherit' })} />
          Usar a cor {inheritLabel}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="radio"
            checked={value.colorMode === 'own'}
            onChange={() => set({ colorMode: 'own', logo_bg_color: value.logo_bg_color || inherited.bgColor || DEFAULT_COLOR })}
          />
          Usar uma cor própria
        </label>
        {value.colorMode === 'own' && (
          <div className="pl-6 flex items-center gap-2">
            <input type="color" value={value.logo_bg_color || DEFAULT_COLOR} onChange={(e) => set({ logo_bg_color: e.target.value })} className="h-9 w-14 cursor-pointer rounded border border-input bg-transparent" />
            <span className="text-xs font-mono text-muted-foreground">{value.logo_bg_color || DEFAULT_COLOR}</span>
          </div>
        )}
      </div>
    </div>
  );
}
