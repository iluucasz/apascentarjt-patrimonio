import React, { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

export default function AssetBarcode({ value, width = 2, height = 60, displayValue = true, fontSize = 14, className = '' }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current || !value) return;
    try {
      JsBarcode(ref.current, value, {
        format: 'CODE128',
        width,
        height,
        displayValue,
        fontSize,
        margin: 4,
        textMargin: 2,
        background: '#ffffff',
        lineColor: '#000000'
      });
    } catch (e) {
      // ignore
    }
  }, [value, width, height, displayValue, fontSize]);

  return <svg ref={ref} className={className} />;
}