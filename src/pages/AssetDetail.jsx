import { db } from '@/lib/db';

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

import { useApp } from '@/lib/AppContext';
import Layout from '@/components/Layout';
import PageHeader from '@/components/PageHeader';
import { AssetStatusBadge, AssetConditionBadge } from '@/components/AssetBadges';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import ConfirmDialog from '@/components/ConfirmDialog';
import { toast } from 'sonner';
import AssetQRCode from '@/components/AssetQRCode';
import AssetBarcode from '@/components/AssetBarcode';
import PrintLabelPreview from '@/components/PrintLabelPreview';
import { Image } from '@/components/ui/image';
import { formatCurrency, formatDate, formatDateTime, MOVEMENT_LABELS, MAINTENANCE_LABELS, DISPOSED_REASON_LABELS, DOC_TYPE_LABELS } from '@/lib/format';
import { canEditAsset, canDisposeAsset, canDeleteAsset, canMoveAsset, canMaintainAsset, canViewFinancials } from '@/lib/permissions';
import { Pencil, ArrowLeftRight, Wrench, Archive, Printer, ImageIcon, FileText, Trash2, Download, Layers, Ellipsis } from 'lucide-react';
import StatusPill from '@/components/StatusPill';
import { MAINTENANCE_TONES } from '@/lib/format';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

export default function AssetDetail() {
  const { assetNumber } = useParams();
  const navigate = useNavigate();
  const { user, locations } = useApp();
  const [asset, setAsset] = useState(null);
  const [movements, setMovements] = useState([]);
  const [maintenances, setMaintenances] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [audits, setAudits] = useState([]);
  const [notFound, setNotFound] = useState(false);

  // move modal
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveForm, setMoveForm] = useState({ to_location_id: '', location_detail: '', responsible_person: '', movement_type: 'transfer', notes: '' });
  // maintenance modal
  const [maintOpen, setMaintOpen] = useState(false);
  const [maintForm, setMaintForm] = useState({ description: '', provider: '', start_date: '', cost: '', notes: '' });
  // dispose modal
  const [disposeOpen, setDisposeOpen] = useState(false);
  const [disposeForm, setDisposeForm] = useState({ disposed_reason: 'descarte', disposed_notes: '' });
  // print modal
  const [printOpen, setPrintOpen] = useState(false);
  // doc upload
  const [docForm, setDocForm] = useState({ name: '', type: 'documento', file_url: '' });
  // delete
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    try {
      const list = await db.entities.Asset.filter({ asset_number: assetNumber });
      if (list.length === 0) { setNotFound(true); return; }
      const a = list[0];
      setAsset(a);
      setMovements(await db.entities.AssetMovement.filter({ asset_id: a.id }, '-created_date', 100));
      setMaintenances(await db.entities.MaintenanceRecord.filter({ asset_id: a.id }, '-created_date', 100));
      setDocuments(await db.entities.AssetDocument.filter({ asset_id: a.id }, '-created_date', 100));
      try { setAudits(await db.entities.AuditLog.filter({ entity_id: a.id }, '-created_date', 50)); } catch (e) {}
    } catch (e) { setNotFound(true); }
  };

  useEffect(() => { load(); }, [assetNumber]);

  const appUrl = window.location.origin;
  const qrUrl = asset ? `${appUrl}/p/${asset.asset_number}` : '';

  const handleMove = async () => {
    if (!moveForm.to_location_id) { toast.error('Selecione a nova unidade'); return; }
    try {
      const loc = locations.find((l) => l.id === moveForm.to_location_id);
      await db.entities.AssetMovement.create({
        asset_id: asset.id, asset_number: asset.asset_number, asset_name: asset.name,
        from_location_id: asset.location_id, from_location_name: asset.location_name,
        to_location_id: moveForm.to_location_id, to_location_name: loc?.name || '',
        responsible_person: moveForm.responsible_person, movement_type: moveForm.movement_type,
        notes: moveForm.notes, moved_by_name: user?.full_name || user?.email
      });
      await db.entities.Asset.update(asset.id, { location_id: moveForm.to_location_id, location_name: loc?.name || '', location_detail: moveForm.location_detail });
      await db.entities.AuditLog.create({ action: 'asset_move', entity_type: 'Asset', entity_id: asset.id, entity_label: asset.asset_number, user_name: user?.full_name || user?.email });
      setMoveOpen(false);
      setMoveForm({ to_location_id: '', location_detail: '', responsible_person: '', movement_type: 'transfer', notes: '' });
      await load();
      toast.success('Movimentação registrada');
    } catch (e) { toast.error('Erro ao movimentar'); }
  };

  const handleMaint = async () => {
    if (!maintForm.description) { toast.error('Descreva o problema'); return; }
    try {
      await db.entities.MaintenanceRecord.create({
        asset_id: asset.id, asset_number: asset.asset_number, asset_name: asset.name,
        description: maintForm.description, provider: maintForm.provider,
        start_date: maintForm.start_date, cost: maintForm.cost ? Number(maintForm.cost) : 0,
        status: 'open', notes: maintForm.notes, created_by_name: user?.full_name || user?.email
      });
      await db.entities.Asset.update(asset.id, { status: 'maintenance' });
      await db.entities.AuditLog.create({ action: 'maintenance_start', entity_type: 'Asset', entity_id: asset.id, entity_label: asset.asset_number, user_name: user?.full_name || user?.email });
      setMaintOpen(false);
      setMaintForm({ description: '', provider: '', start_date: '', cost: '', notes: '' });
      await load();
      toast.success('Manutenção registrada');
    } catch (e) { toast.error('Erro ao registrar manutenção'); }
  };

  const finishMaint = async (m) => {
    try {
      await db.entities.MaintenanceRecord.update(m.id, { status: 'completed', end_date: new Date().toISOString().slice(0, 10) });
      await db.entities.Asset.update(asset.id, { status: 'active' });
      await load();
      toast.success('Manutenção concluída');
    } catch (e) { toast.error('Erro'); }
  };

  const handleDispose = async () => {
    if (!disposeForm.disposed_notes) { toast.error('Observação obrigatória'); return; }
    try {
      await db.entities.Asset.update(asset.id, {
        status: 'disposed', archived_at: new Date().toISOString(),
        disposed_reason: disposeForm.disposed_reason, disposed_notes: disposeForm.disposed_notes
      });
      await db.entities.AuditLog.create({ action: 'asset_dispose', entity_type: 'Asset', entity_id: asset.id, entity_label: asset.asset_number, new_data: disposeForm, user_name: user?.full_name || user?.email });
      setDisposeOpen(false);
      await load();
      toast.success('Patrimônio baixado');
    } catch (e) { toast.error('Erro ao dar baixa'); }
  };

  const handleDocUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !docForm.name) { toast.error('Informe o nome do documento'); return; }
    try {
      const { file_url } = await db.integrations.Core.UploadFile({ file });
      await db.entities.AssetDocument.create({
        asset_id: asset.id, asset_number: asset.asset_number,
        name: docForm.name, type: docForm.type, file_url,
        uploaded_by_name: user?.full_name || user?.email
      });
      setDocForm({ name: '', type: 'documento', file_url: '' });
      await load();
      toast.success('Documento anexado');
    } catch (err) { toast.error('Erro ao anexar documento'); }
  };

  const deleteDoc = async (d) => {
    try { await db.entities.AssetDocument.delete(d.id); await load(); toast.success('Documento removido'); }
    catch (e) { toast.error('Erro'); }
  };

  const handleDeleteAsset = async () => {
    setDeleting(true);
    try {
      await db.entities.Asset.delete(asset.id);
      toast.success('Patrimônio excluído permanentemente');
      navigate('/patrimonios');
    } catch (e) {
      toast.error('Erro ao excluir patrimônio');
      setDeleting(false);
    }
  };

  if (notFound) {
    return <Layout><div className="text-center py-20"><p className="text-xl font-bold">Patrimônio não encontrado</p><p className="text-[15px] text-muted-foreground mt-1.5">O código {assetNumber} não existe no sistema.</p><Button className="mt-5" onClick={() => navigate('/patrimonios')}>Voltar para patrimônios</Button></div></Layout>;
  }
  if (!asset) {
    return <Layout><div className="space-y-4">{Array.from({length:6}).map((_,i)=><div key={i} className="h-6 rounded bg-muted animate-pulse" />)}</div></Layout>;
  }

  return (
    <Layout>
      <PageHeader title={asset.name} description={`${asset.asset_number}${asset.variant ? ` · ${asset.variant}` : ''}`}>
        {canMoveAsset(user) && <Button variant="outline" onClick={() => setMoveOpen(true)}><ArrowLeftRight /> Movimentar</Button>}
        {canMaintainAsset(user) && <Button variant="outline" onClick={() => setMaintOpen(true)}><Wrench /> Manutenção</Button>}
        {canEditAsset(user) && <Button onClick={() => navigate(`/patrimonios/${asset.id}/editar`)}><Pencil /> Editar</Button>}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" aria-label="Mais ações"><Ellipsis /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onSelect={() => setPrintOpen(true)}><Printer /> Imprimir etiqueta</DropdownMenuItem>
            {asset.batch_id && <DropdownMenuItem onSelect={() => navigate(`/patrimonios/lote/${asset.batch_id}`)}><Layers /> Ver lote</DropdownMenuItem>}
            {((canDisposeAsset(user) && asset.status !== 'disposed') || canDeleteAsset(user)) && <DropdownMenuSeparator />}
            {canDisposeAsset(user) && asset.status !== 'disposed' && <DropdownMenuItem onSelect={() => setDisposeOpen(true)} className="text-destructive focus:text-destructive"><Archive /> Dar baixa</DropdownMenuItem>}
            {canDeleteAsset(user) && <DropdownMenuItem onSelect={() => setDeleteOpen(true)} className="text-destructive focus:text-destructive"><Trash2 /> Excluir</DropdownMenuItem>}
          </DropdownMenuContent>
        </DropdownMenu>
      </PageHeader>
      <div className="flex flex-wrap gap-2 -mt-3 mb-6">
        <AssetStatusBadge status={asset.status} className="text-sm px-3 py-1" />
        <AssetConditionBadge condition={asset.condition} className="text-sm px-3 py-1" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Foto e códigos (no celular ficam depois das informações) */}
        <div className="order-last lg:order-none">
          <div className="rounded-2xl border border-border bg-card shadow-card p-4 sm:p-5">
            {asset.photo_url ? <Image src={asset.photo_url} className="w-full aspect-[4/3] rounded-xl object-cover" fittingType="fill" /> : <div className="w-full aspect-[4/3] rounded-xl bg-accent flex flex-col items-center justify-center gap-2 text-primary/60"><ImageIcon className="w-12 h-12" aria-hidden="true" /><span className="text-sm font-medium">Sem foto</span></div>}
            <div className="mt-4 flex flex-col items-center gap-4 rounded-xl border border-border p-4">
              <AssetQRCode value={qrUrl} size={132} />
              <AssetBarcode value={asset.asset_number} height={44} fontSize={13} className="max-w-full h-auto" />
              <p className="asset-code text-lg !font-bold !text-foreground">{asset.asset_number}</p>
            </div>
          </div>
        </div>

        {/* Right: tabs */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="info">
            <TabsList>
              <TabsTrigger value="info">Informações</TabsTrigger>
              <TabsTrigger value="history">Histórico</TabsTrigger>
              <TabsTrigger value="maintenance">Manutenção</TabsTrigger>
              <TabsTrigger value="documents">Documentos</TabsTrigger>
            </TabsList>

            <TabsContent value="info" className="mt-5">
              <div className="space-y-4">
                <InfoGroup title="Identificação">
                  <Info label="Categoria" value={asset.category_name} />
                  {asset.variant && <Info label="Variante" value={asset.variant} />}
                  <Info label="Marca" value={asset.brand} />
                  <Info label="Modelo" value={asset.model} />
                  <Info label="Número de série" value={asset.serial_number} />
                </InfoGroup>
                <InfoGroup title="Onde está">
                  <Info label="Unidade" value={asset.location_name} />
                  <Info label="Local" value={asset.location_detail} />
                  <Info label="Responsável" value={asset.responsible_person} />
                </InfoGroup>
                <InfoGroup title="Aquisição">
                  <Info label="Data de aquisição" value={formatDate(asset.acquisition_date)} />
                  {canViewFinancials(user) && <Info label="Valor de aquisição" value={formatCurrency(asset.acquisition_value)} />}
                  {canViewFinancials(user) && <Info label="Fornecedor" value={asset.supplier} />}
                  {canViewFinancials(user) && <Info label="Nota fiscal" value={asset.invoice_number} />}
                </InfoGroup>
                <InfoGroup title="Registro">
                  <Info label="Data de cadastro" value={formatDateTime(asset.created_date)} />
                  <Info label="Última atualização" value={formatDateTime(asset.updated_date)} />
                  {asset.status === 'disposed' && <Info label="Motivo da baixa" value={DISPOSED_REASON_LABELS[asset.disposed_reason] || asset.disposed_reason} />}
                  {asset.notes && <div className="sm:col-span-2"><Info label="Observações" value={asset.notes} /></div>}
                </InfoGroup>
              </div>
            </TabsContent>

            <TabsContent value="history" className="mt-5">
              <div className="rounded-2xl border border-border bg-card shadow-card p-5">
                {movements.length === 0 && audits.length === 0 ? (
                  <p className="text-[15px] text-muted-foreground">Sem histórico de movimentações.</p>
                ) : (
                  <div className="space-y-4">
                    {movements.map((m) => (
                      <div key={m.id} className="flex gap-3">
                        <div className="w-2.5 h-2.5 rounded-full bg-primary mt-2 shrink-0" />
                        <div>
                          <p className="text-[15px] font-semibold">{MOVEMENT_LABELS[m.movement_type] || m.movement_type}: {m.from_location_name || '-'} → {m.to_location_name || '-'}</p>
                          <p className="text-sm text-muted-foreground">{formatDateTime(m.created_date)} · Por {m.moved_by_name || '-'}{m.notes ? ` · ${m.notes}` : ''}</p>
                        </div>
                      </div>
                    ))}
                    {audits.filter((a) => a.action === 'asset_create').map((a) => (
                      <div key={a.id} className="flex gap-3">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-600 mt-2 shrink-0" />
                        <div>
                          <p className="text-[15px] font-semibold">Patrimônio cadastrado</p>
                          <p className="text-sm text-muted-foreground">{formatDateTime(a.created_date)} · Por {a.user_name || '-'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="maintenance" className="mt-5">
              <div className="rounded-2xl border border-border bg-card shadow-card p-5">
                {maintenances.length === 0 ? (
                  <p className="text-[15px] text-muted-foreground">Sem manutenções registradas.</p>
                ) : (
                  <div className="space-y-4">
                    {maintenances.map((m) => (
                      <div key={m.id} className="border border-border rounded-xl p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-[15px] font-semibold">{m.description}</p>
                          <StatusPill tone={MAINTENANCE_TONES[m.status]}>{MAINTENANCE_LABELS[m.status]}</StatusPill>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{m.provider || '-'} · {formatDate(m.start_date)}{m.end_date ? ` → ${formatDate(m.end_date)}` : ''}{canViewFinancials(user) && m.cost ? ` · ${formatCurrency(m.cost)}` : ''}</p>
                        {m.notes && <p className="text-sm text-muted-foreground mt-1">{m.notes}</p>}
                        {m.status === 'open' && canMaintainAsset(user) && <Button size="sm" variant="outline" className="mt-2" onClick={() => finishMaint(m)}>Concluir manutenção</Button>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="documents" className="mt-5">
              <div className="rounded-2xl border border-border bg-card shadow-card p-5">
                {canEditAsset(user) && (
                  <div className="mb-4 grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
                    <div><Label>Nome</Label><Input value={docForm.name} onChange={(e) => setDocForm(f => ({...f, name: e.target.value}))} placeholder="Ex: Nota fiscal" /></div>
                    <div>
                      <Label>Tipo</Label>
                      <Select value={docForm.type} onValueChange={(v) => setDocForm(f => ({...f, type: v}))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{Object.entries(DOC_TYPE_LABELS).map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label>Arquivo</Label><input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={handleDocUpload} /></div>
                  </div>
                )}
                {documents.length === 0 ? (
                  <p className="text-[15px] text-muted-foreground">Nenhum documento anexado.</p>
                ) : (
                  <div className="space-y-2">
                    {documents.map((d) => (
                      <div key={d.id} className="flex items-center justify-between gap-3 border border-border rounded-xl p-3.5">
                        <div className="flex items-center gap-3 min-w-0">
                          <FileText className="w-5 h-5 text-primary shrink-0" />
                          <div className="min-w-0">
                            <p className="text-[15px] font-semibold truncate">{d.name}</p>
                            <p className="text-sm text-muted-foreground">{DOC_TYPE_LABELS[d.type] || d.type}</p>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <a href={d.file_url} target="_blank" rel="noreferrer" className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Baixar documento"><Download className="w-[18px] h-[18px]" /></a>
                          {canEditAsset(user) && <button onClick={() => deleteDoc(d)} className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label="Remover documento"><Trash2 className="w-[18px] h-[18px]" /></button>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Move modal */}
      <Dialog open={moveOpen} onOpenChange={setMoveOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Movimentar patrimônio</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="text-[15px] text-muted-foreground">{asset.asset_number} · {asset.name}</div>
            <div className="text-sm">Unidade atual: <span className="font-medium">{asset.location_name || '-'}</span></div>
            <div><Label>Nova unidade</Label><Select value={moveForm.to_location_id} onValueChange={(v) => setMoveForm(f => ({...f, to_location_id: v}))}><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Local na nova unidade</Label><Input value={moveForm.location_detail} onChange={(e) => setMoveForm(f => ({...f, location_detail: e.target.value}))} placeholder="Ex: Salão, armário 2" /></div>
            <div><Label>Responsável</Label><Input value={moveForm.responsible_person} onChange={(e) => setMoveForm(f => ({...f, responsible_person: e.target.value}))} /></div>
            <div><Label>Tipo</Label><Select value={moveForm.movement_type} onValueChange={(v) => setMoveForm(f => ({...f, movement_type: v}))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(MOVEMENT_LABELS).map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Observação</Label><Textarea value={moveForm.notes} onChange={(e) => setMoveForm(f => ({...f, notes: e.target.value}))} rows={2} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setMoveOpen(false)}>Cancelar</Button><Button onClick={handleMove}>Confirmar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Maintenance modal */}
      <Dialog open={maintOpen} onOpenChange={setMaintOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Enviar para manutenção</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Problema *</Label><Textarea value={maintForm.description} onChange={(e) => setMaintForm(f => ({...f, description: e.target.value}))} rows={2} /></div>
            <div><Label>Empresa/Técnico</Label><Input value={maintForm.provider} onChange={(e) => setMaintForm(f => ({...f, provider: e.target.value}))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Data</Label><Input type="date" value={maintForm.start_date} onChange={(e) => setMaintForm(f => ({...f, start_date: e.target.value}))} /></div>
              <div><Label>Custo estimado</Label><Input type="number" step="0.01" value={maintForm.cost} onChange={(e) => setMaintForm(f => ({...f, cost: e.target.value}))} /></div>
            </div>
            <div><Label>Observações</Label><Textarea value={maintForm.notes} onChange={(e) => setMaintForm(f => ({...f, notes: e.target.value}))} rows={2} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setMaintOpen(false)}>Cancelar</Button><Button onClick={handleMaint}>Registrar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dispose modal */}
      <Dialog open={disposeOpen} onOpenChange={setDisposeOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Dar baixa no patrimônio</DialogTitle><DialogDescription>O número nunca será reutilizado. Histórico e documentos são mantidos.</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div><Label>Motivo da baixa</Label><Select value={disposeForm.disposed_reason} onValueChange={(v) => setDisposeForm(f => ({...f, disposed_reason: v}))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(DISPOSED_REASON_LABELS).map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Observação *</Label><Textarea value={disposeForm.disposed_notes} onChange={(e) => setDisposeForm(f => ({...f, disposed_notes: e.target.value}))} rows={2} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDisposeOpen(false)}>Cancelar</Button><Button variant="destructive" onClick={handleDispose}>Confirmar baixa</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Print modal */}
      <PrintLabelModal open={printOpen} onOpenChange={setPrintOpen} asset={asset} qrUrl={qrUrl} />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Excluir patrimônio permanentemente?"
        description={`Isso vai apagar "${asset.asset_number} · ${asset.name}" e todo o seu histórico (movimentações, manutenções, documentos e registros de inventário) para sempre. Use "Dar baixa" em vez disso se quiser apenas registrar que o item saiu de uso mantendo o histórico. Essa ação não pode ser desfeita.`}
        confirmLabel="Excluir permanentemente"
        loading={deleting}
        onConfirm={handleDeleteAsset}
      />
    </Layout>
  );
}

function InfoGroup({ title, children }) {
  return (
    <section className="rounded-2xl border border-border bg-card shadow-card p-5">
      <h3 className="text-base font-bold mb-4">{title}</h3>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">{children}</dl>
    </section>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-[15px] font-semibold text-foreground mt-0.5">{value || '-'}</dd>
    </div>
  );
}

function PrintLabelModal({ open, onOpenChange, asset, qrUrl }) {
  const [size, setSize] = useState('50x30');
  const [showName, setShowName] = useState(true);
  const [showCategory, setShowCategory] = useState(false);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Imprimir etiqueta</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div><Label>Tamanho</Label>
            <Select value={size} onValueChange={setSize}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="50x25">50x25 mm</SelectItem>
                <SelectItem value="50x30">50x30 mm</SelectItem>
                <SelectItem value="60x30">60x30 mm</SelectItem>
                <SelectItem value="70x30">70x30 mm</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-2.5 text-[15px] font-medium cursor-pointer"><input type="checkbox" checked={showName} onChange={(e) => setShowName(e.target.checked)} /> Nome do patrimônio</label>
          <label className="flex items-center gap-2.5 text-[15px] font-medium cursor-pointer"><input type="checkbox" checked={showCategory} onChange={(e) => setShowCategory(e.target.checked)} /> Categoria</label>
          <PrintLabelPreview asset={asset} qrUrl={qrUrl} size={size} showName={showName} showCategory={showCategory} />
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button><Button onClick={() => window.print()}><Printer /> Imprimir</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}