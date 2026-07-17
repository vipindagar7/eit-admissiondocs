export default function PreviewModal({ src, mimeType, filename, onClose }) {
  const isImage = mimeType?.startsWith('image/');

  return (
    <div
      className="fixed inset-0 z-50 flex animate-in fade-in items-center justify-center bg-black/70 p-4 duration-150"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-3xl animate-in zoom-in-95 flex-col overflow-hidden rounded-lg bg-white shadow-xl duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-4 py-2.5">
          <p className="truncate text-sm font-medium text-gray-700">{filename}</p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">
            ✕
          </button>
        </div>
        <div className="flex flex-1 items-center justify-center overflow-auto bg-gray-50 p-4">
          {isImage ? (
            <img src={src} alt={filename} className="max-h-[70vh] max-w-full rounded object-contain shadow-sm" />
          ) : (
            <iframe src={src} title={filename} className="h-[70vh] w-full rounded border-0 bg-white" />
          )}
        </div>
      </div>
    </div>
  );
}