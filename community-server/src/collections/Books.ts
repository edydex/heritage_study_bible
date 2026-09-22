import type { CollectionConfig } from 'payload'
import { createCommunityContent, manageCommunityContent, readBooksByVisibility } from '@/access'
import { communityContentFields } from '@/fields/communityContentFields'
import { fillContentSlug } from '@/lib/contentAdmin'

export const Books: CollectionConfig = {
  slug: 'books',
  indexes: [{ fields: ['community', 'slug'], unique: true }],
  admin: {
    useAsTitle: 'title',
    group: 'Content',
    description: 'Readable books and study resources, with optional downloadable files.',
    defaultColumns: ['title', 'author', 'publishedYear', 'status', 'updatedAt'],
    listSearchableFields: ['title', 'author'],
    hideAPIURL: true,
  },
  access: { read: readBooksByVisibility, create: createCommunityContent, update: manageCommunityContent, delete: manageCommunityContent },
  hooks: { beforeValidate: [fillContentSlug] },
  fields: [
    ...communityContentFields,
    { name:'visibility',type:'select',required:true,defaultValue:'members',options:[{label:'Signed-in church members',value:'members'},{label:'Public — everyone',value:'public'}] },
    { name:'readAlong',type:'json',admin:{hidden:true},access:{create:()=>false,update:()=>false} },
    { name:'readAlongUpload',type:'ui',admin:{components:{Field:'@/components/BookReadAlongUpload'}} },
    { name: 'author', type: 'text', required: true },
    { name: 'publishedYear', label: 'Year published', type: 'number' },
    { name: 'body', label: 'Book text', type: 'richText' },
    { name: 'files', label: 'Downloadable files', type: 'upload', relationTo: 'media', hasMany: true },
    { name: 'license', label: 'License or permission', type: 'text', admin: { position: 'sidebar' } },
  ],
}
