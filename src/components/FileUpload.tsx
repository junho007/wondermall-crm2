import React, { useRef, useState } from 'react';
import { Upload, FileSpreadsheet, Download, RefreshCw, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';
import { parseFileToOrders } from '../utils/csvHelper';
import { ShopeeOrder } from '../types';

interface FileUploadProps {
  onDataParsed?: (data: { orders: ShopeeOrder[]; columns: string[]; fileName: string }) => void;
  onLoadSample?: () => void;
  onExport?: () => void;
  currentOrders?: ShopeeOrder[];
  currentFileName?: string | null;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  onDataParsed,
  onLoadSample,
  onExport,
  currentOrders = [],
  currentFileName = null,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileSelect = async (file: File) => {
    if (!file) return;
    setErrorMsg(null);

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'csv' && ext !== 'xlsx' && ext !== 'xls' && !file.type.includes('csv') && !file.type.includes('spreadsheet') && !file.type.includes('excel')) {
      setErrorMsg('Please select a valid .xlsx, .xls, or .csv file exported from Shopee.');
      return;
    }

    setIsProcessing(true);

    try {
      const { orders, columns } = await parseFileToOrders(file);
      setIsProcessing(false);

      if (orders.length === 0) {
        setErrorMsg('File appears empty or could not parse valid order rows.');
        return;
      }

      if (onDataParsed) {
        onDataParsed({
          orders,
          columns,
          fileName: file.name,
        });
      }
    } catch (err: any) {
      setIsProcessing(false);
      setErrorMsg(`Failed to read file: ${err?.message || 'Invalid file format'}`);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="w-full glass-card rounded-xl p-4 sm:p-5 shadow-xl">
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Drag and Drop Zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`flex-1 flex flex-col sm:flex-row items-center gap-3 sm:gap-4 p-4 rounded-xl border-2 border-dashed transition-all duration-200 cursor-pointer ${
            isDragging
              ? 'border-cyan-400 bg-cyan-950/30 shadow-lg shadow-cyan-500/20 scale-[1.01]'
              : 'border-slate-700/80 hover:border-cyan-500/50 bg-slate-950/50 hover:bg-slate-950/80'
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleInputChange}
            accept=".xlsx,.xls,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            className="hidden"
          />

          <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center flex-shrink-0 text-cyan-400 group-hover:scale-110 transition-transform">
            {isProcessing ? (
              <RefreshCw className="w-5 h-5 animate-spin text-cyan-400" />
            ) : (
              <Upload className="w-5 h-5 text-cyan-400" />
            )}
          </div>

          <div className="flex-1 text-center sm:text-left">
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <span className="text-sm font-semibold text-slate-200">
                Upload Shopee or Lazada Excel (.xlsx / .xls) or CSV Export
              </span>
              <span className="hidden sm:inline-block px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-950 text-cyan-400 border border-cyan-800">
                .XLSX / .CSV
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Drag &amp; drop your Shopee or Lazada order export file here, or{' '}
              <span className="text-cyan-400 font-medium hover:underline">browse files</span>. Auto-parses &amp; merges Order SN, Buyer Contact, Product &amp; Financials.
            </p>
          </div>

          {currentFileName && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-950/60 border border-emerald-500/30 text-xs text-emerald-300 flex-shrink-0">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span className="font-medium max-w-[150px] sm:max-w-[180px] truncate">
                {currentFileName}
              </span>
            </div>
          )}
        </div>

        {/* Quick Actions Panel */}
        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap justify-stretch md:justify-end">
          <button
            type="button"
            onClick={onLoadSample}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-slate-800 to-slate-800 hover:from-cyan-950 hover:to-indigo-950 border border-slate-700 hover:border-cyan-500/50 text-xs font-semibold text-slate-200 hover:text-cyan-300 transition-all duration-200 shadow-sm cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-fuchsia-400" />
            Load WCG2U/AMG Demo Data
          </button>

          <button
            type="button"
            onClick={onExport}
            disabled={currentOrders.length === 0}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 via-teal-500 to-emerald-500 hover:from-cyan-500 hover:to-emerald-400 text-slate-950 font-bold text-xs shadow-md shadow-cyan-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 cursor-pointer"
          >
            <Download className="w-4 h-4 text-slate-950" />
            Export CSV ({currentOrders.length})
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="mt-3 p-3 rounded-xl bg-rose-950/80 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
    </div>
  );
};
