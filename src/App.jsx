import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from '@/pages/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from '@/components/ProtectedRoute';
import { AppProvider } from '@/lib/AppContext';
import { Toaster as SonnerToaster } from 'sonner';
// Auth pages
import Login from '@/pages/Login';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
// App pages
import Dashboard from '@/pages/Dashboard';
import Patrimonios from '@/pages/Patrimonios';
import NovoPatrimonio from '@/pages/NovoPatrimonio';
import EditarPatrimonio from '@/pages/EditarPatrimonio';
import AssetDetail from '@/pages/AssetDetail';
import Scanner from '@/pages/Scanner';
import Inventarios from '@/pages/Inventarios';
import InventarioDetail from '@/pages/InventarioDetail';
import Movimentacoes from '@/pages/Movimentacoes';
import Manutencoes from '@/pages/Manutencoes';
import Locais from '@/pages/Locais';
import Categorias from '@/pages/Categorias';
import Etiquetas from '@/pages/Etiquetas';
import Usuarios from '@/pages/Usuarios';
import Configuracoes from '@/pages/Configuracoes';

const AuthenticatedApp = () => {
  const { isLoadingAuth } = useAuth();

  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <AppProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route element={<ProtectedRoute unauthenticatedElement={<Navigate to="/login" replace />} />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/patrimonios" element={<Patrimonios />} />
          <Route path="/patrimonios/novo" element={<NovoPatrimonio />} />
          <Route path="/patrimonios/:id/editar" element={<EditarPatrimonio />} />
          <Route path="/p/:assetNumber" element={<AssetDetail />} />
          <Route path="/scanner" element={<Scanner />} />
          <Route path="/inventarios" element={<Inventarios />} />
          <Route path="/inventarios/:id" element={<InventarioDetail />} />
          <Route path="/movimentacoes" element={<Movimentacoes />} />
          <Route path="/manutencoes" element={<Manutencoes />} />
          <Route path="/locais" element={<Locais />} />
          <Route path="/categorias" element={<Categorias />} />
          <Route path="/etiquetas" element={<Etiquetas />} />
          <Route path="/usuarios" element={<Usuarios />} />
          <Route path="/configuracoes" element={<Configuracoes />} />
        </Route>
        <Route path="*" element={<PageNotFound />} />
      </Routes>
    </AppProvider>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
        <SonnerToaster richColors position="top-right" />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App