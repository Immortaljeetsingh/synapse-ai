'use client';

import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileText,
  FileSpreadsheet,
  FileCode,
  Trash2,
  RefreshCw,
  Eye,
  AlertTriangle,
  CheckCircle,
  Loader2,
  File,
} from 'lucide-react';
import { DocumentRecord } from '@/lib/types';

interface SourcesTabProps {
  documents: DocumentRecord[];
  onUploadFiles: (files: FileList) => Promise<void>;
  onReprocessDocument: (docId: string) => Promise<void>;
  onDeleteDocument: (docId: string) => Promise<void>;
  onOpenViewer: (doc: DocumentRecord) => void;
  isUploading?: boolean;
}

export const SourcesTab: React.FC<SourcesTabProps> = ({
  documents,
  onUploadFiles,
  onReprocessDocument,
  onDeleteDocument,
  onOpenViewer,
  isUploading = false,
}) => {
  const [dragOver, setDragOver] = useState(false);
  const [processingDocId, setProcessingDocId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await onUploadFiles(e.dataTransfer.files);
    }
  };

  const handleReprocess = async (docId: string) => {
    setProcessingDocId(docId);
    try {
      await onReprocessDocument(docId);
    } finally {
      setProcessingDocId(null);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const getDocIcon = (type: string) => {
    switch (type) {
      case 'pdf':
        return <FileText className="w-5 h-5 text-neutral-300" />;
      case 'docx':
        return <FileText className="w-5 h-5 text-neutral-300" />;
      case 'xlsx':
      case 'csv':
        return <FileSpreadsheet className="w-5 h-5 text-neutral-300" />;
      case 'md':
      case 'txt':
        return <FileCode className="w-5 h-5 text-neutral-300" />;
      default:
        return <File className="w-5 h-5 text-neutral-400" />;
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto select-none">
      {/* Upload Drop Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
          dragOver
            ? 'border-neutral-500 bg-neutral-900 shadow-3d-sm'
            : 'border-neutral-800 hover:border-neutral-700 bg-neutral-900 shadow-3d'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.doc,.xlsx,.xls,.csv,.txt,.md"
          className="hidden"
          onChange={async (e) => {
            if (e.target.files && e.target.files.length > 0) {
              await onUploadFiles(e.target.files);
            }
          }}
        />

        <div className="w-12 h-12 rounded-2xl bg-neutral-800 bevel text-neutral-300 flex items-center justify-center mx-auto mb-3">
          {isUploading ? (
            <Loader2 className="w-6 h-6 animate-spin text-neutral-300" />
          ) : (
            <UploadCloud className="w-6 h-6" />
          )}
        </div>

        <h3 className="text-sm font-semibold text-neutral-100 mb-1">
          {isUploading ? 'Uploading and indexing documents...' : 'Upload research documents'}
        </h3>
        <p className="text-xs text-neutral-500 max-w-md mx-auto mb-3">
          Drag and drop PDF, DOCX, XLSX, CSV, TXT, or Markdown files here, or click to browse
        </p>

        <div className="flex items-center justify-center gap-2 text-[11px] text-neutral-500 font-mono">
          <span className="bg-neutral-800 border border-neutral-700 px-2 py-0.5 rounded">PDF</span>
          <span className="bg-neutral-800 border border-neutral-700 px-2 py-0.5 rounded">DOCX</span>
          <span className="bg-neutral-800 border border-neutral-700 px-2 py-0.5 rounded">XLSX</span>
          <span className="bg-neutral-800 border border-neutral-700 px-2 py-0.5 rounded">CSV</span>
          <span className="bg-neutral-800 border border-neutral-700 px-2 py-0.5 rounded">TXT/MD</span>
        </div>
      </div>

      {/* Document List */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
            Indexed Source Documents ({documents.length})
          </h3>
        </div>

        {documents.length === 0 ? (
          <div className="p-8 text-center bg-neutral-900 border border-neutral-800 rounded-2xl text-xs text-neutral-500 shadow-3d-sm">
            No source documents uploaded to this notebook yet.
          </div>
        ) : (
          <div className="space-y-3">
            {documents.map((doc) => {
              const isProcessing = processingDocId === doc.id || doc.processing_status === 'processing';
              return (
                <div
                  key={doc.id}
                  className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 flex items-center justify-between gap-4 hover:border-neutral-700 transition-colors shadow-3d"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="p-2.5 rounded-xl bg-neutral-950 border border-neutral-800 shrink-0">
                      {getDocIcon(doc.file_type)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-xs text-neutral-100 truncate">
                          {doc.filename}
                        </span>
                        {doc.is_scanned && (
                          <span
                            title="Scanned document with low text density"
                            className="text-[10px] bg-neutral-800 text-neutral-300 border border-neutral-700 px-1.5 py-0.5 rounded flex items-center gap-1 font-mono"
                          >
                            <AlertTriangle className="w-3 h-3 text-amber-400" /> Scanned
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-neutral-500 mt-1">
                        <span className="uppercase font-mono font-medium">{doc.file_type}</span>
                        <span>•</span>
                        <span>{doc.page_count || 1} {doc.page_count === 1 ? 'page' : 'pages'}</span>
                        <span>•</span>
                        <span>{formatBytes(doc.file_size)}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          {doc.processing_status === 'ready' ? (
                            <span className="text-emerald-400 flex items-center gap-1">
                              <CheckCircle className="w-3 h-3" /> Ready
                            </span>
                          ) : isProcessing ? (
                            <span className="text-neutral-300 flex items-center gap-1">
                              <Loader2 className="w-3 h-3 animate-spin" /> Processing
                            </span>
                          ) : (
                            <span className="text-neutral-500">{doc.processing_status}</span>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => onOpenViewer(doc)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded-xl text-xs font-medium transition-colors shadow-3d-sm"
                      title="Open Document Viewer"
                    >
                      <Eye className="w-3.5 h-3.5 text-neutral-400" />
                      <span>View</span>
                    </button>

                    <button
                      onClick={() => handleReprocess(doc.id)}
                      disabled={isProcessing}
                      className="p-2 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 rounded-xl transition-colors border border-neutral-800 disabled:opacity-40 shadow-3d-sm"
                      title="Reprocess Document"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isProcessing ? 'animate-spin' : ''}`} />
                    </button>

                    <button
                      onClick={() => {
                        if (confirm(`Remove "${doc.filename}" from notebook?`)) {
                          onDeleteDocument(doc.id);
                        }
                      }}
                      className="p-2 text-neutral-400 hover:text-red-400 hover:bg-neutral-800 rounded-xl transition-colors border border-neutral-800 shadow-3d-sm"
                      title="Delete Document"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
