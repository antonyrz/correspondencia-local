import React, { useState } from 'react';
import { Trash2, X } from 'lucide-react';

interface ConfirmModalEliminarProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (motivo: string) => Promise<void> | void;
  titulo?: string;
  identificadorDoc?: string;
  loading?: boolean;
}

export const ConfirmModalEliminar: React.FC<ConfirmModalEliminarProps> = ({
  isOpen,
  onClose,
  onConfirm,
  titulo = 'Anular Registros',
  identificadorDoc,
  loading = false,
}) => {
  const [motivo, setMotivo] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!motivo.trim()) return;

    await onConfirm(motivo.trim());
    setMotivo(''); // Limpiar campo al terminar
  };

  const handleClose = () => {
    setMotivo('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2 text-red-600">
            <Trash2 size={20} />
            <h3 className="font-bold text-slate-800">{titulo}</h3>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-200/50 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <p className="text-sm text-slate-600 leading-relaxed">
            ¿Estás seguro de que deseas anular la correspondencia/documento{' '}
            {identificadorDoc && (
              <strong className="text-slate-800">N° {identificadorDoc}</strong>
            )}
            ? Esta acción registrará la anulación permanentemente.
          </p>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
              Motivo de la Anulación <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              rows={3}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Escriba la razón..."
              className="w-full border border-slate-300 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-red-500 outline-none resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={loading}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !motivo.trim()}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-2"
            >
              {loading ? 'Eliminando...' : 'Confirmar Anulación'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};