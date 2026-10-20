import { Archive, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
  titulo?: string;
  mensaje: string;
  confirmLabel?: string;
  loading?: boolean;
}

export const ConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  titulo = 'Confirmar acción',
  mensaje,
  confirmLabel = 'Confirmar',
  loading = false,
}: ConfirmModalProps) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2 text-slate-700">
            <Archive size={20} />
            <h3 className="font-bold text-slate-800">{titulo}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-200/50 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-sm text-slate-600 leading-relaxed">{mensaje}</p>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => onConfirm()}
              disabled={loading}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-800 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer"
            >
              {loading ? 'Procesando...' : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
