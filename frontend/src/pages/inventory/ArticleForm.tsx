import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useCreateArticle, useUpdateArticle } from '@/hooks/useArticles'
import { useSuppliers } from '@/hooks/useSuppliers'
import { useToast } from '@/components/ui/Toast'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'
import { ArticleType, ARTICLE_TYPE_LABELS } from '@/types/enums'
import type { Article } from '@/types/models'

const articleSchema = z.object({
  tipo_articulo: z.string().min(1, 'El tipo es requerido'),
  subtipo: z.string().optional(),
  nombre: z.string().min(1, 'El nombre es requerido'),
  marca: z.string().optional(),
  modelo_sku: z.string().optional(),
  umbral_reposicion: z.string().min(1, 'El umbral es requerido'),
  costo_unitario: z.string().min(1, 'El costo es requerido'),
  proveedor_id: z.string().optional(),
})

type ArticleFormData = z.infer<typeof articleSchema>

interface ArticleFormProps {
  isOpen: boolean
  onClose: () => void
  article?: Article
}

export default function ArticleForm({ isOpen, onClose, article }: ArticleFormProps) {
  const { addToast } = useToast()
  const createArticle = useCreateArticle()
  const updateArticle = useUpdateArticle()
  const { data: suppliersData } = useSuppliers({ per_page: 100 })

  const isEditing = !!article

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ArticleFormData>({
    resolver: zodResolver(articleSchema),
  })

  useEffect(() => {
    if (article) {
      reset({
        tipo_articulo: article.tipo_articulo,
        subtipo: article.subtipo ?? '',
        nombre: article.nombre,
        marca: article.marca ?? '',
        modelo_sku: article.modelo_sku ?? '',
        umbral_reposicion: article.umbral_reposicion.toString(),
        costo_unitario: article.costo_unitario.toString(),
        proveedor_id: article.proveedor_id?.toString() ?? '',
      })
    } else {
      reset({
        tipo_articulo: '',
        subtipo: '',
        nombre: '',
        marca: '',
        modelo_sku: '',
        umbral_reposicion: '',
        costo_unitario: '',
        proveedor_id: '',
      })
    }
  }, [article, reset])

  const typeOptions = Object.values(ArticleType).map((t) => ({
    value: t,
    label: ARTICLE_TYPE_LABELS[t],
  }))

  const supplierOptions = (suppliersData?.data ?? []).map((s: { id: number; razon_social: string }) => ({
    value: String(s.id),
    label: s.razon_social,
  }))

  const onSubmit = async (data: ArticleFormData) => {
    try {
      const payload: Record<string, unknown> = {
        tipo_articulo: data.tipo_articulo,
        nombre: data.nombre,
        umbral_reposicion: Number(data.umbral_reposicion),
        costo_unitario: Number(data.costo_unitario),
      }
      if (data.subtipo) payload.subtipo = data.subtipo
      if (data.marca) payload.marca = data.marca
      if (data.modelo_sku) payload.modelo_sku = data.modelo_sku
      if (data.proveedor_id) payload.proveedor_id = Number(data.proveedor_id)

      if (isEditing) {
        await updateArticle.mutateAsync({ id: article.id, ...payload })
        addToast('Articulo actualizado correctamente', 'success')
      } else {
        await createArticle.mutateAsync(payload)
        addToast('Articulo creado correctamente', 'success')
      }
      onClose()
    } catch {
      addToast(
        isEditing ? 'Error al actualizar el articulo' : 'Error al crear el articulo',
        'error',
      )
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Editar Articulo' : 'Nuevo Articulo'}
      className="max-w-lg"
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Select
          id="tipo_articulo"
          label="Tipo de Articulo"
          options={typeOptions}
          placeholder="Selecciona un tipo"
          error={errors.tipo_articulo?.message}
          {...register('tipo_articulo')}
        />

        <Input
          id="subtipo"
          label="Subtipo"
          error={errors.subtipo?.message}
          {...register('subtipo')}
        />

        <Input
          id="nombre"
          label="Nombre"
          error={errors.nombre?.message}
          {...register('nombre')}
        />

        <div className="grid grid-cols-2 gap-4">
          <Input
            id="marca"
            label="Marca"
            error={errors.marca?.message}
            {...register('marca')}
          />

          <Input
            id="modelo_sku"
            label="Modelo / SKU"
            error={errors.modelo_sku?.message}
            {...register('modelo_sku')}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            id="umbral_reposicion"
            label="Umbral Reposicion"
            type="number"
            error={errors.umbral_reposicion?.message}
            {...register('umbral_reposicion')}
          />

          <Input
            id="costo_unitario"
            label="Costo Unitario"
            type="number"
            step="0.01"
            error={errors.costo_unitario?.message}
            {...register('costo_unitario')}
          />
        </div>

        <Select
          id="proveedor_id"
          label="Proveedor"
          options={supplierOptions}
          placeholder="Selecciona un proveedor"
          error={errors.proveedor_id?.message}
          {...register('proveedor_id')}
        />

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={isSubmitting}>
            {isEditing ? 'Guardar Cambios' : 'Crear Articulo'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
