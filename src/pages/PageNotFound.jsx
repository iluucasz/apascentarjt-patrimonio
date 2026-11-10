import { Link, useLocation } from 'react-router-dom';
import { Home, SearchX } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PageNotFound() {
  const location = useLocation();
  const pageName = location.pathname.substring(1);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="max-w-md w-full text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-accent text-primary">
          <SearchX className="h-10 w-10" aria-hidden="true" />
        </div>
        <h1 className="mt-6 text-3xl font-bold tracking-tight">Página não encontrada</h1>
        <p className="mt-2 text-base text-muted-foreground">
          O endereço <span className="font-semibold text-foreground break-all">/{pageName}</span> não existe ou foi movido.
        </p>
        <Button asChild size="lg" className="mt-8">
          <Link to="/"><Home /> Voltar ao início</Link>
        </Button>
      </div>
    </div>
  );
}
