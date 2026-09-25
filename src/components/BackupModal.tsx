import React, { useRef, useState } from 'react';
import { motion } from 'motion/react';
import { X, Download, Upload, ShieldCheck, AlertTriangle } from 'lucide-react';
import { LocalizedText } from '../constants';
import { createBackup, downloadBackup, restoreBackup } from '../utils/backup';

interface BackupModalProps {
  getLocalizedText: (text: LocalizedText | string | undefined) => string;
  onClose: () => void;
  overlayClassName: string;
}

type Status = { tone: 'ok' | 'error'; message: string } | null;

/**
 * Counts, streaks and settings only exist in this browser's localStorage, so
 * clearing site data, reinstalling the PWA or moving to a new phone loses
 * everything. This gives the user a portable copy.
 */
const BackupModal: React.FC<BackupModalProps> = ({ getLocalizedText, onClose, overlayClassName }) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [status, setStatus] = useState<Status>(null);

  const handleExport = () => {
    try {
      downloadBackup(createBackup());
      setStatus({
        tone: 'ok',
        message: getLocalizedText('Backup file saved.')
      });
    } catch {
      setStatus({
        tone: 'error',
        message: getLocalizedText('Could not create the backup file.')
      });
    }
  };

  const handleFile = async (file: File) => {
    const confirmed = window.confirm(
      getLocalizedText('Restoring replaces the counts and settings on this device. Continue?')
    );
    if (!confirmed) return;

    const text = await file.text();
    const result = restoreBackup(text);

    if (result.ok) {
      setStatus({
        tone: 'ok',
        message: getLocalizedText('Restored. Reloading…')
      });
      // A reload is the simplest way to re-hydrate every piece of state from
      // the freshly written storage.
      setTimeout(() => window.location.reload(), 700);
      return;
    }

    setStatus({
      tone: 'error',
      message:
        result.reason === 'storage-full'
          ? getLocalizedText('Not enough storage space to restore.')
          : getLocalizedText('That file is not a Tasbeeh backup.')
    });
  };

  const buttonClass =
    'flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-bg px-4 py-3.5 text-sm font-bold text-text-main transition-all hover:border-gold/40 hover:text-gold-ink';

  return (
    <motion.div
      key="backup-modal"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={overlayClassName}
      role="dialog"
      aria-modal="true"
    >
      <div className="min-h-full flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          className="bg-card border border-border w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl p-6 my-8"
        >
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-gold-ink flex items-center gap-2">
              <ShieldCheck size={20} />
              {getLocalizedText('Backup & Restore')}
            </h3>
            <button
              onClick={onClose}
              className="text-text-muted hover:text-text-main"
              aria-label={getLocalizedText('Close')}
            >
              <X size={24} />
            </button>
          </div>

          <p className="text-sm text-text-sub leading-relaxed mb-6">
            {getLocalizedText('Your counts and settings live only on this device. Save a backup file to keep them safe or move them to a new phone.')}
          </p>

          <div className="space-y-3">
            <button onClick={handleExport} className={buttonClass}>
              <Download size={16} />
              {getLocalizedText('Export backup')}
            </button>
            <button onClick={() => fileInputRef.current?.click()} className={buttonClass}>
              <Upload size={16} />
              {getLocalizedText('Restore from file')}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) void handleFile(file);
              }}
            />
          </div>

          {status && (
            <div
              className={`mt-5 flex items-start gap-2 rounded-2xl border p-3 text-xs font-bold leading-relaxed ${
                status.tone === 'ok'
                  ? 'border-gold/30 bg-gold/10 text-gold-ink'
                  : 'border-red-500/30 bg-red-500/10 text-red-400'
              }`}
            >
              {status.tone === 'ok' ? <ShieldCheck size={14} className="mt-0.5 shrink-0" /> : <AlertTriangle size={14} className="mt-0.5 shrink-0" />}
              <span>{status.message}</span>
            </div>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
};

export default BackupModal;
