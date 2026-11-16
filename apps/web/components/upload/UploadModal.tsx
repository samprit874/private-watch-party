'use client';

import React, { useState, useRef } from 'react';
import { UploadCloud, X, CheckCircle, AlertCircle, Loader2, Film } from 'lucide-react';
import { getApiBaseUrl, getAuthHeaders } from '../../lib/api';

interface UploadModalProps {
  roomId: string;
  isOpen: boolean;
  onClose: () => void;
  onUploadComplete: (streamUrlOrId: string) => void;
}

export function UploadModal({ roomId, isOpen, onClose, onUploadComplete }: UploadModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [statusText, setStatusText] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 4 * 1024 * 1024 * 1024) {
        setError('File exceeds 4GB limit.');
        return;
      }
      setSelectedFile(file);
      setError(null);
    }
  };

  const startUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setError(null);
    setStatusText('Requesting upload session...');

    try {
      const serverUrl = getApiBaseUrl();
      const headers = getAuthHeaders();

      // 1. Initiate upload
      const initRes = await fetch(`${serverUrl}/api/upload/init`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          roomId,
          filename: selectedFile.name,
          fileSizeBytes: selectedFile.size,
          mimeType: selectedFile.type || 'video/mp4',
        }),
      });

      if (!initRes.ok) {
        const data = await initRes.json().catch(() => ({}));
        throw new Error(data.message || 'Failed to initiate upload');
      }

      const { uploadId, uploadUrl } = await initRes.json();
      setStatusText('Uploading to storage...');

      // 2. Direct S3/R2/Server binary PUT with XMLHttpRequest for progress tracking
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', uploadUrl, true);
        xhr.withCredentials = true;
        xhr.setRequestHeader('Content-Type', selectedFile.type || 'video/mp4');

        xhr.upload.onprogress = (evt) => {
          if (evt.lengthComputable) {
            const percent = Math.round((evt.loaded / evt.total) * 100);
            setUploadProgress(percent);
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Storage rejected upload: HTTP ${xhr.status}`));
          }
        };

        xhr.onerror = () => reject(new Error('Network error during file upload'));
        xhr.send(selectedFile);
      });

      // 3. Finalize upload
      setStatusText('Finalizing video processing...');
      const finalizeRes = await fetch(`${serverUrl}/api/upload/finalize`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ uploadId }),
      });

      if (!finalizeRes.ok) {
        throw new Error('Failed to finalize upload');
      }

      const finalizeData = await finalizeRes.json().catch(() => ({}));
      setStatusText('Upload complete! Video ready to play.');
      setTimeout(() => {
        onUploadComplete(finalizeData.streamUrl || uploadId);
        onClose();
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#111827] border border-white/[0.1] rounded-2xl p-6 max-w-lg w-full shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Film className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Upload Personal Video</h3>
            <p className="text-xs text-gray-400">Direct streaming to all 3 seats</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Dropzone */}
        {!selectedFile ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-cinema-700 hover:border-indigo-500 rounded-xl p-8 text-center cursor-pointer transition-colors"
          >
            <UploadCloud className="w-10 h-10 text-gray-500 mx-auto mb-3" />
            <p className="text-sm font-semibold text-gray-300 mb-1">Click or drag a video file here</p>
            <p className="text-xs text-gray-500">Supports MP4, WebM, MOV, MKV up to 4 GB</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/mp4,video/webm,video/quicktime,video/x-matroska"
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>
        ) : (
          <div className="bg-cinema-950 border border-cinema-800 rounded-xl p-4 mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-white truncate max-w-[280px]">
                {selectedFile.name}
              </span>
              <span className="text-[11px] text-gray-400">
                {(selectedFile.size / (1024 * 1024)).toFixed(1)} MB
              </span>
            </div>

            {isUploading && (
              <div className="w-full bg-cinema-800 rounded-full h-2 mb-2 overflow-hidden">
                <div
                  className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            )}

            {statusText && (
              <p className="text-xs text-indigo-400 flex items-center gap-1.5 mt-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>{statusText}</span>
              </p>
            )}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs text-gray-400 hover:text-white"
          >
            Cancel
          </button>

          <button
            onClick={startUpload}
            disabled={!selectedFile || isUploading}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-5 py-2.5 rounded-xl flex items-center gap-2 transition-colors disabled:opacity-50 shadow-lg shadow-indigo-600/20"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Uploading ({uploadProgress}%)...</span>
              </>
            ) : (
              <>
                <UploadCloud className="w-4 h-4" />
                <span>Start Upload</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
