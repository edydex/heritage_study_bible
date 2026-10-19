import type { CollectionConfig } from 'payload'

// Save intent is recorded separately from the immutable content journal, so
// Ctrl+S can create a checkpoint without changing content or Ready approval.
export const ServiceDocumentSaves: CollectionConfig = {
  slug: 'service-document-saves',
  admin: { hidden: true },
  access: { read: () => false, create: () => false, update: () => false, delete: () => false },
  indexes: [{ fields: ['serviceDocument', 'requestId'], unique: true }],
  hooks: {
    beforeChange: [({ operation, context, data }) => {
      if (operation !== 'create' || context.serviceDocumentSave !== true) throw new Error('Save checkpoints are immutable internal records.')
      return data
    }],
    beforeDelete: [() => { throw new Error('Save checkpoints are immutable.') }],
  },
  fields: [
    { name: 'community', type: 'relationship', relationTo: 'communities', required: true, index: true },
    { name: 'serviceDocument', type: 'relationship', relationTo: 'service-documents', required: true, index: true },
    { name: 'requestId', type: 'text', required: true, maxLength: 200 },
    { name: 'requestHash', type: 'text', required: true, minLength: 64, maxLength: 64 },
    { name: 'syncVersion', type: 'number', required: true, min: 1 },
    { name: 'revision', type: 'text', required: true },
    { name: 'saveKind', type: 'select', required: true, options: ['automatic', 'manual', 'restore'] },
    { name: 'savedBy', type: 'text', required: true, maxLength: 200 },
    { name: 'savedAt', type: 'date', required: true, index: true },
  ],
}
