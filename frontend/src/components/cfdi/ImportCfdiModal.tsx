import { useRef, useState } from 'react'
import { Upload, FileText, X, CheckCircle2, AlertCircle, Copy } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { useImportCfdi } from '@/hooks/useCfdi'
import { parseApiError } from '@/lib/api-errors'
import type { CfdiImportResultItem, CfdiImportEstado } from '@/types/cfdi'

interface ImportCfdiModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (mensaje: string) => void
  onError: (mensaje: string) => void
}

const estadoVariant: Record<CfdiImportEstado, 'success' | 'warning' | 'error'> = {
  importado: 'success',
  duplicado: 'warning',
  error: 'error',
}

const estadoLabel: Record<CfdiImportEstado, string> = {
  importado: 'Importado',
  duplicado: 'Duplicado',
  error: 'Error',
}

export default function ImportCfdiModal({ isOpen, onClose, onSuccess, onError }: ImportCfdiModalProps) {
  const [files, setFiles] = useState<File[]>([])
  const [resultados, setResultados] = useState<CfdiImportResultItem[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const importCfdi = useImportCfdi()

  const reset = () => {
    setFiles([])
    setResultados([])
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleSelect = (selected: FileList | null) => {
    if (!selected) return
    const xmlFiles = Array.from(selected).filter(
      (f) => f.name.toLowerCase().endsWith('.xml') || f.type === 'text/xml'
    )
    setFiles((prev) => [...prev, ...xmlFiles])
    setResultados([])
  }

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleImport = async () => {
    if (files.length === 0) {
      onError('Selecciona al menos un archivo XML.')
      return
    }

    try {
      const data = await importCfdi.mutateAsync(files)
      setResultados(data.resultados)
      const ok = data.resultados.filter((r) => r.estado === 'importado').length
      const dup = data.resultados.filter((r) => r.estado === 'duplicado').length
      const err = data.resultados.filter((r) => r.estado === 'error').length
      onSuccess(
        `Importacion: ${ok} nuevo(s), ${dup} duplicado(s), ${err} con error.`
      )
    } catch (err) {
      onError(parseApiError(err))
    }
  }

  const handleDone = () => {
    handleClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Importar CFDI (XML)" size="lg">
      <div className="space-y-4">
        {resultados.length === 0 ? (
          <>
            <div
              className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                handleSelect(e.dataTransfer.files)
              }}
            >
              <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm font-medium text-foreground">
                Arrastra archivos XML aqui o haz clic para seleccionar
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                CFDI 4.0 / 3.3 - maximo 2 MB por archivo
              </p>
              <input
                ref={inputRef}
                type="file"
                accept=".xml,text/xml,application/xml"
                multiple
                className="hidden"
                onChange={(e) => handleSelect(e.target.files)}
              />
            </div>

            {files.length > 0 && (
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {files.map((f, i) => (
                  <div
                    key={`${f.name}-${i}`}
                    className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-sm truncate">{f.name}</span>
                    </div>
                    <button
                      onClick={() => removeFile(i)}
                      className="p-1 hover:bg-muted rounded"
                      title="Quitar"
                    >
                      <X className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={handleClose} disabled={importCfdi.isPending}>
                Cancelar
              </Button>
              <Button onClick={handleImport} loading={importCfdi.isPending} disabled={files.length === 0}>
                Importar {files.length > 0 ? `(${files.length})` : ''}
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {resultados.map((r, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 rounded-md border border-border bg-card px-3 py-2"
                >
                  <div className="mt-0.5">
                    {r.estado === 'importado' && <CheckCircle2 className="h-4 w-4 text-success" />}
                    {r.estado === 'duplicado' && <Copy className="h-4 w-4 text-warning" />}
                    {r.estado === 'error' && <AlertCircle className="h-4 w-4 text-destructive" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium truncate">{r.archivo}</span>
                      <Badge variant={estadoVariant[r.estado]}>{estadoLabel[r.estado]}</Badge>
                    </div>
                    {r.errores && (
                      <p className="text-xs text-destructive mt-1">{r.errores}</p>
                    )}
                    {r.xml_comprobante && (
                      <p className="text-xs text-muted-foreground mt-1">
                        UUID: {r.xml_comprobante.uuid}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button onClick={handleDone}>Cerrar</Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
