import { formatDateTime, formatDay, INV_ITEM_LABELS, INVENTORY_STATUS_LABELS } from '@/lib/format';

// Cores (RGB) por status do item, usadas na célula "Status" da tabela.
const STATUS_COLORS = {
  found: [4, 120, 87],
  misplaced: [180, 83, 9],
  not_found: [190, 18, 60],
  pending: [71, 85, 105],
};

function fileNameFor(inventory) {
  const base = String(inventory.name || 'inventario')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase();
  return `inventario-${base || 'relatorio'}.pdf`;
}

// Monta o PDF do relatório do inventário (A4, retrato) e devolve { blob, fileName }.
// jsPDF e autotable são carregados só quando o usuário pede o PDF.
export async function buildInventoryPdf(inventory, items) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 14;

  const count = (status) => items.filter((i) => i.status === status).length;
  const total = items.length;

  // Cabeçalho
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Relatório de Inventário Patrimonial', margin, 18);
  doc.setFontSize(12);
  doc.text(inventory.name || '', margin, 25);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(80);
  const info = [
    `Unidade: ${inventory.location_name || 'Todas as unidades'}`,
    inventory.scheduled_date ? `Data prevista: ${formatDay(inventory.scheduled_date)}` : `Criado em: ${formatDateTime(inventory.created_date)}`,
    inventory.responsible_person ? `Responsável: ${inventory.responsible_person}` : null,
    `Situação: ${INVENTORY_STATUS_LABELS[inventory.status] || inventory.status}`,
    inventory.finished_at ? `Finalizado em: ${formatDateTime(inventory.finished_at)}` : null,
  ].filter(Boolean);
  let y = 31;
  info.forEach((line) => { doc.text(line, margin, y); y += 5; });
  if (inventory.notes) {
    const noteLines = doc.splitTextToSize(`Observações: ${inventory.notes}`, pageW - margin * 2);
    doc.text(noteLines, margin, y);
    y += noteLines.length * 5;
  }

  // Resumo
  y += 2;
  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [['Esperados', 'Encontrados', 'Pendentes', 'Unidade incorreta', 'Não encontrados']],
    body: [[total, count('found'), count('pending'), count('misplaced'), count('not_found')]],
    theme: 'grid',
    styles: { halign: 'center', fontSize: 11, cellPadding: 3 },
    headStyles: { fillColor: [241, 245, 249], textColor: 60, fontSize: 9, fontStyle: 'normal' },
    bodyStyles: { fontStyle: 'bold' },
  });

  // Lista dos patrimônios
  autoTable(doc, {
    startY: /** @type {any} */ (doc).lastAutoTable.finalY + 6,
    margin: { left: margin, right: margin, bottom: 16 },
    head: [['Número', 'Nome', 'Esperado', 'Encontrado', 'Status']],
    body: items.map((i) => [
      i.asset_number || '-',
      i.asset_name || '-',
      i.expected_location_name || '-',
      i.found_location_name || '-',
      INV_ITEM_LABELS[i.status] || i.status,
    ]),
    theme: 'striped',
    styles: { fontSize: 9, cellPadding: 2, overflow: 'linebreak' },
    headStyles: { fillColor: [30, 41, 59], textColor: 255 },
    columnStyles: { 0: { cellWidth: 26, font: 'courier' }, 4: { cellWidth: 32 } },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 4) {
        const color = STATUS_COLORS[items[data.row.index]?.status];
        if (color) { data.cell.styles.textColor = color; data.cell.styles.fontStyle = 'bold'; }
      }
    },
  });

  // Rodapé com data de geração e paginação
  const pages = doc.getNumberOfPages();
  const generated = `Gerado em ${formatDateTime(new Date().toISOString())}`;
  doc.setFontSize(8);
  doc.setTextColor(120);
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.text(generated, margin, pageH - 8);
    doc.text(`Página ${p} de ${pages}`, pageW - margin, pageH - 8, { align: 'right' });
  }

  return { blob: doc.output('blob'), fileName: fileNameFor(inventory) };
}

function download(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = fileName; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

// Gera o PDF e, no celular, abre o menu de compartilhar (WhatsApp etc.) com o
// arquivo anexado. Onde isso não existe (computador), baixa o arquivo.
// Devolve 'shared' | 'downloaded' | 'cancelled'.
export async function shareInventoryPdf(inventory, items) {
  const { blob, fileName } = await buildInventoryPdf(inventory, items);
  const file = new File([blob], fileName, { type: 'application/pdf' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: `Inventário · ${inventory.name}` });
      return 'shared';
    } catch (e) {
      if (e?.name === 'AbortError') return 'cancelled';
      // qualquer outra falha do compartilhamento cai para o download
    }
  }
  download(blob, fileName);
  return 'downloaded';
}

export async function downloadInventoryPdf(inventory, items) {
  const { blob, fileName } = await buildInventoryPdf(inventory, items);
  download(blob, fileName);
}
