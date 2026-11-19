import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Copy, Download, QrCode, UtensilsCrossed, X } from 'lucide-react';
import { BRAND } from '../data';
import { buildTableQrUrl } from '../landingSummary';
import { showSakugaToast } from '../sakuga';
import { SPRING } from '../ui';
import { FoodQr, renderFoodQrStandeePng } from './FoodQr';

interface TableQrSheetProps {
  tableNum: number | null;
  waiterName?: string;
  onClose: () => void;
}

/**
 * Guest-facing modal/bottom-sheet showing the table-specific Food-Themed QR
 * code pointing directly to `#/t/<tableNum>` so every table has its own QR.
 */
export default function TableQrSheet({
  tableNum,
  waiterName,
  onClose,
}: TableQrSheetProps) {
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const tableUrl =
    tableNum !== null
      ? buildTableQrUrl(window.location.origin, window.location.pathname, tableNum)
      : '';

  async function handleCopy() {
    if (!tableUrl || tableNum === null) return;
    try {
      await navigator.clipboard.writeText(tableUrl);
      setCopied(true);
      showSakugaToast(`Table ${tableNum} ka QR link copy ho gaya!`, 'green', 'COPIED!');
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      showSakugaToast('Link copy nahi ho paya.', 'gold', 'INFO');
    }
  }

  async function handleDownload() {
    if (!tableUrl || tableNum === null || downloading) return;
    setDownloading(true);
    try {
      const dataUrl = await renderFoodQrStandeePng(
        tableUrl,
        `${BRAND} · Table ${tableNum}`,
        `Table ${tableNum} par scan karo aur seedha order bhejo`
      );
      if (dataUrl) {
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = `panda-momo-table-${tableNum}-qr.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showSakugaToast(`Table ${tableNum} QR PNG download ho gaya!`, 'green', 'SAVED!');
      }
    } catch {
      showSakugaToast('QR PNG download karne mein dikkat aayi.', 'red', 'ERR');
    } finally {
      setDownloading(false);
    }
  }

  return (
    <AnimatePresence>
      {tableNum !== null && (
        <motion.div
          className="sheet-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={`Table ${tableNum} QR Code`}
            className="sheet-panel table-qr-sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={SPRING}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sheet-handle" />
            <div className="sheet-head">
              <h2 className="icon-heading">
                <QrCode size={20} strokeWidth={2.3} aria-hidden="true" />
                <span>Table {tableNum} QR Code</span>
              </h2>
              <button
                type="button"
                className="sheet-close"
                aria-label="Table QR band karo"
                onClick={onClose}
              >
                <X size={16} strokeWidth={2.4} aria-hidden="true" />
              </button>
            </div>

            <div className="table-qr-standee">
              <div className="table-qr-standee-kicker">
                <UtensilsCrossed size={12} strokeWidth={2.4} aria-hidden="true" />
                <span>TABLE {tableNum} DIRECT QR</span>
              </div>
              <div className="table-qr-standee-sub">
                {BRAND}
                {waiterName ? ` · Waiter: ${waiterName}` : ''}
              </div>
              <div className="table-qr-plate" data-testid={`table-qr-svg-${tableNum}`}>
                <FoodQr
                  value={tableUrl}
                  size={218}
                  label={`Table ${tableNum} Menu QR Code`}
                />
              </div>
              <code className="table-qr-url" data-testid="table-qr-url">
                {tableUrl}
              </code>
              <p className="table-qr-caption">
                Is QR ko scan karne par seedha <strong>Table {tableNum}</strong> ka menu khulega — table select karne ki zaroorat nahi!
              </p>
            </div>

            <div className="table-qr-actions">
              <button
                type="button"
                className="chip"
                onClick={handleCopy}
                style={{ flex: 1, justifyContent: 'center' }}
              >
                {copied ? (
                  <>
                    <Check size={14} strokeWidth={2.5} aria-hidden="true" />
                    <span>Link Copied</span>
                  </>
                ) : (
                  <>
                    <Copy size={14} strokeWidth={2.2} aria-hidden="true" />
                    <span>Copy Table {tableNum} Link</span>
                  </>
                )}
              </button>
              <button
                type="button"
                className="btn"
                onClick={handleDownload}
                disabled={downloading}
                style={{ flex: 1, justifyContent: 'center' }}
              >
                <Download size={15} strokeWidth={2.3} aria-hidden="true" />
                <span>{downloading ? 'Saving…' : `Download T${tableNum} PNG`}</span>
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
