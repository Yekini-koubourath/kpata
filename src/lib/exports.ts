import { jsPDF } from 'jspdf';
import ExcelJS from 'exceljs';
import { formatMoney } from '../shared/types';
import type { MemberBalance } from '../shared/finance';

export interface GroupReportPayload {
  groupName: string;
  currency: string;
  balances: MemberBalance[];
  expenses: any[];
  settlements: any[];
  contributions: any[];
}

export function exportGroupReportPdf(data: GroupReportPayload): void {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  let y = 48;

  const addLine = (text: string, size = 10, bold = false) => {
    if (y > 770) {
      doc.addPage();
      y = 48;
    }
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.text(text, 44, y);
    y += size + 7;
  };

  addLine(`KPATA — Bilan financier : ${data.groupName}`, 16, true);
  addLine(`Généré le ${new Date().toLocaleDateString('fr-FR')} · Devise : ${data.currency}`, 10);
  y += 10;

  addLine('1. Soldes nets par membre', 13, true);
  for (const b of data.balances) {
    const statusLabel =
      b.netBalanceInt > 0 ? 'À recevoir' : b.netBalanceInt < 0 ? 'À payer' : 'Équilibré';
    addLine(
      `${b.displayName}${b.isExternal ? ' (Externe)' : ''} — Avances: ${formatMoney(b.totalAdvancedInt, data.currency)} | Parts: ${formatMoney(b.totalShareInt, data.currency)} | Net: ${formatMoney(b.netBalanceInt, data.currency)} (${statusLabel})`,
      9
    );
  }

  y += 10;
  addLine('2. Dépenses enregistrées (Actives vs Annulées)', 13, true);
  if (data.expenses.length === 0) {
    addLine('Aucune dépense enregistrée.', 9);
  } else {
    for (const e of data.expenses.slice(0, 40)) {
      const payersText = (e.payers || [])
        .map((p: any) => `${p.memberName}: ${formatMoney(p.amountPaidInt, data.currency)}`)
        .join(', ');
      addLine(
        `[${e.expenseDate}] ${e.title} (${e.status === 'CANCELLED' ? 'ANNULÉE' : e.paymentStatus}) — ${formatMoney(e.amountInt, data.currency)} | Payeurs: ${payersText}`,
        9
      );
    }
  }

  y += 10;
  addLine('3. Remboursements (Confirmés vs En attente / Contestés)', 13, true);
  if (data.settlements.length === 0) {
    addLine('Aucun remboursement enregistré.', 9);
  } else {
    for (const s of data.settlements.slice(0, 30)) {
      addLine(
        `[${s.settlementDate}] ${s.fromName} -> ${s.toName} : ${formatMoney(s.amountInt, data.currency)} [${s.status}] (${s.paymentMethod})`,
        9
      );
    }
  }

  const safeName = data.groupName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  doc.save(`kpata-rapport-${safeName}.pdf`);
}

export async function exportGroupReportExcel(data: GroupReportPayload): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'KPATA';
  wb.created = new Date();

  const sheetBal = wb.addWorksheet('Soldes');
  sheetBal.columns = [
    { header: 'Membre', key: 'name', width: 26 },
    { header: 'Type', key: 'type', width: 16 },
    { header: `Avances (${data.currency})`, key: 'adv', width: 18 },
    { header: `Parts (${data.currency})`, key: 'share', width: 18 },
    { header: `Remb. envoyés`, key: 'sent', width: 16 },
    { header: `Remb. reçus`, key: 'recv', width: 16 },
    { header: `Solde net (${data.currency})`, key: 'net', width: 20 },
  ];
  for (const b of data.balances) {
    sheetBal.addRow({
      name: b.displayName,
      type: b.isExternal ? 'Sans compte' : 'Compte KPATA',
      adv: b.totalAdvancedInt,
      share: b.totalShareInt,
      sent: b.settlementsPaidInt,
      recv: b.settlementsReceivedInt,
      net: b.netBalanceInt,
    });
  }

  const sheetExp = wb.addWorksheet('Dépenses');
  sheetExp.columns = [
    { header: 'Date', key: 'date', width: 14 },
    { header: 'Intitulé', key: 'title', width: 32 },
    { header: 'Catégorie', key: 'category', width: 20 },
    { header: `Montant (${data.currency})`, key: 'amount', width: 18 },
    { header: 'Méthode répartition', key: 'split', width: 20 },
    { header: 'Statut paiement', key: 'pstatus', width: 18 },
    { header: 'Statut opération', key: 'status', width: 16 },
  ];
  for (const e of data.expenses) {
    sheetExp.addRow({
      date: e.expenseDate,
      title: e.title,
      category: e.categoryName || 'Non catégorisé',
      amount: e.amountInt,
      split: e.splitMethod,
      pstatus: e.paymentStatus,
      status: e.status,
    });
  }

  const sheetStl = wb.addWorksheet('Remboursements');
  sheetStl.columns = [
    { header: 'Date', key: 'date', width: 14 },
    { header: 'Débiteur', key: 'from', width: 22 },
    { header: 'Créancier', key: 'to', width: 22 },
    { header: `Montant (${data.currency})`, key: 'amount', width: 18 },
    { header: 'Canal', key: 'method', width: 16 },
    { header: 'Statut', key: 'status', width: 16 },
  ];
  for (const s of data.settlements) {
    sheetStl.addRow({
      date: s.settlementDate,
      from: s.fromName,
      to: s.toName,
      amount: s.amountInt,
      method: s.paymentMethod,
      status: s.status,
    });
  }

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeName = data.groupName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  a.download = `kpata-export-${safeName}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
