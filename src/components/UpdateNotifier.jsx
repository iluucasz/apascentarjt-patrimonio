import { useEffect } from 'react';
import { toast } from 'sonner';

// O sistema é uma página única: uma aba aberta antes de um deploy continua
// rodando o código antigo até ser recarregada. Aqui comparamos o script em uso
// com o do index.html publicado e, se mudou, pedimos para atualizar.
const CHECK_INTERVAL_MS = 5 * 60 * 1000;
const SCRIPT_RE = /<script[^>]+src="(\/assets\/[^"]+\.js)"/;

function currentScript() {
  const el = document.querySelector('script[type="module"][src^="/assets/"]');
  return el ? el.getAttribute('src') : null;
}

export default function UpdateNotifier() {
  useEffect(() => {
    const running = currentScript();
    if (!running) return undefined; // em desenvolvimento (Vite) não há bundle para comparar

    let notified = false;
    const check = async () => {
      if (notified || document.visibilityState === 'hidden') return;
      try {
        const html = await (await fetch('/', { cache: 'no-store' })).text();
        const published = html.match(SCRIPT_RE)?.[1];
        if (published && published !== running) {
          notified = true;
          toast('Nova versão do sistema disponível', {
            description: 'Atualize a página para usar a versão mais recente.',
            duration: Infinity,
            action: { label: 'Atualizar', onClick: () => window.location.reload() },
          });
        }
      } catch {
        // sem conexão: tenta de novo na próxima verificação
      }
    };

    const timer = setInterval(check, CHECK_INTERVAL_MS);
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', check);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', check);
      document.removeEventListener('visibilitychange', check);
    };
  }, []);

  return null;
}
