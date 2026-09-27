import React, { useRef } from 'react';
import { Camera, ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Dois botões para a foto: "Tirar foto" abre a câmera direto no celular
// (capture) e "Galeria" abre as fotos salvas — com capture o Android não
// oferece a galeria, por isso são inputs separados.
export default function PhotoPicker({ onChange, disabled = false, size = 'sm' }) {
  const cameraRef = useRef(null);
  const galleryRef = useRef(null);

  const handle = (e) => {
    onChange(e);
    e.target.value = ''; // permite escolher a mesma foto de novo
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" size={size} variant="outline" disabled={disabled} onClick={() => cameraRef.current?.click()}>
        <Camera className="w-4 h-4 mr-1.5" /> Tirar foto
      </Button>
      <Button type="button" size={size} variant="outline" disabled={disabled} onClick={() => galleryRef.current?.click()}>
        <ImageIcon className="w-4 h-4 mr-1.5" /> Galeria
      </Button>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={handle} className="hidden" />
      <input ref={galleryRef} type="file" accept="image/*" onChange={handle} className="hidden" />
    </div>
  );
}
