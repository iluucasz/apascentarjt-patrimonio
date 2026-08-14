import React from 'react';
import { QRCodeSVG } from 'qrcode.react';

export default function AssetQRCode({ value, size = 128, className = '' }) {
  return (
    <div className={className} style={{ display: 'inline-block' }}>
      <QRCodeSVG
        value={value}
        size={size}
        level="M"
        includeMargin={false}
        bgColor="#ffffff"
        fgColor="#000000"
      />
    </div>
  );
}