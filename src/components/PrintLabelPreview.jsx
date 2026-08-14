import React from 'react';
import AssetQRCode from '@/components/AssetQRCode';
import AssetBarcode from '@/components/AssetBarcode';
import { useApp } from '@/lib/AppContext';
import { Image } from '@/components/ui/image';

const SIZE_MAP = {
  '50x25': { w: 50, h: 25 },
  '50x30': { w: 50, h: 30 },
  '60x30': { w: 60, h: 30 },
  '70x30': { w: 70, h: 30 }
};

export default function PrintLabelPreview({ asset, qrUrl, size = '50x30', showName = true, showCategory = false, showLogo = true, showQR = true, showBarcode = true, showNumber = true }) {
  const { settings } = useApp();
  const dim = SIZE_MAP[size] || SIZE_MAP['50x30'];
  // scale mm to px for preview (1mm ~ 3.78px), but cap for screen
  const scale = 3;
  const w = dim.w * scale;
  const h = dim.h * scale;

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="bg-white border border-slate-300 flex flex-col items-center justify-center text-black overflow-hidden"
        style={{ width: `${w}px`, height: `${h}px`, padding: '4px' }}
      >
        {showLogo && settings?.church_logo_url && (
          <Image src={settings.church_logo_url} className="h-4 w-auto object-contain" fittingType="fit" />
        )}
        <p className="text-[8px] font-bold leading-none text-center truncate w-full">{settings?.church_name || 'Igreja'}</p>
        <div className="flex items-center gap-1 mt-0.5">
          {showQR && <AssetQRCode value={qrUrl} size={Math.min(h * 0.6, 40)} />}
          <div className="flex flex-col items-center">
            {showNumber && <p className="font-mono text-[9px] font-bold leading-none">{asset.asset_number}</p>}
            {showName && <p className="text-[6px] leading-tight text-center max-w-[60px] truncate">{asset.name}</p>}
            {showCategory && <p className="text-[6px] leading-tight text-center">{asset.category_name}</p>}
          </div>
        </div>
        {showBarcode && (
          <div className="-mt-0.5">
            <AssetBarcode value={asset.asset_number} height={Math.floor(h * 0.18)} fontSize={7} width={1} />
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{dim.w}×{dim.h} mm</p>
    </div>
  );
}