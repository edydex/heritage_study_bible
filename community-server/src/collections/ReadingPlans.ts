import type { Block, CollectionConfig } from 'payload'
import { ValidationError } from 'payload'
import { createCommunityContent, manageCommunityContent, readPublishedOrMember } from '@/access'
import { communityContentFields } from '@/fields/communityContentFields'
import { fillContentSlug } from '@/lib/contentAdmin'

type PlainObject = Record<string, unknown>
type PublicPlanItem =
  | { type: 'passage'; passage: string }
  | {
      type: 'note'
      id: string
      title: string
      text: string
      sourceLinks: { title: string; url: string }[]
    }

const denyClientWrite = () => false

const passageBlock: Block = {
  slug: 'planPassage',
  interfaceName: 'ReadingPlanPassage',
  labels: { singular: 'Bible passage', plural: 'Bible passages' },
  fields: [
    {
      name: 'passage',
      type: 'text',
      required: true,
      admin: { description: 'Use a Heritage reference such as “Genesis 1-3” or “John 3:16-21”.' },
    },
  ],
}

const noteBlock: Block = {
  slug: 'planNote',
  interfaceName: 'ReadingPlanNote',
  labels: { singular: 'Plan note', plural: 'Plan notes' },
  fields: [
    {
      name: 'key',
      type: 'text',
      required: true,
      admin: { description: 'Stable short ID used to preserve completion when the note text changes.' },
    },
    { name: 'title', type: 'text', required: true },
    { name: 'text', type: 'textarea', required: true },
    {
      name: 'sources',
      type: 'array',
      labels: { singular: 'Source', plural: 'Sources' },
      fields: [
        { name: 'title', type: 'text', required: true },
        {
          name: 'url',
          type: 'text',
          required: true,
          validate: (value: unknown) => {
            try {
              const url = new URL(String(value || ''))
              return ['http:', 'https:'].includes(url.protocol) || 'Source URLs must use HTTP or HTTPS.'
            } catch {
              return 'Enter a valid source URL.'
            }
          },
        },
      ],
    },
  ],
}

function asObject(value: unknown): PlainObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as PlainObject : {}
}

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export const ReadingPlans: CollectionConfig = {
  slug: 'reading-plans',
  indexes: [{ fields: ['community', 'slug'], unique: true }],
  labels: { singular: 'Bible plan', plural: 'Bible plans' },
  admin: {
    useAsTitle: 'title',
    group: 'Content',
    description: 'Ordered reading days made from Bible passages and optional contextual notes.',
    defaultColumns: ['title', 'totalDays', 'status', 'revision', 'updatedAt'],
    listSearchableFields: ['title'],
    hideAPIURL: true,
  },
  access: {
    read: readPublishedOrMember,
    create: createCommunityContent,
    update: manageCommunityContent,
    delete: manageCommunityContent,
  },
  hooks: {
    beforeValidate: [fillContentSlug, ({ data, originalDoc, req }) => {
      const source = { ...asObject(originalDoc), ...asObject(data) }
      const days = Array.isArray(source.days) ? source.days.map(asObject) : []
      const errors: { message: string; path: string }[] = []
      const noteKeys = new Set<string>()

      const readings = days.map((day, dayIndex) => {
        const builderItems = Array.isArray(day.items) ? day.items.map(asObject) : []
        const items: PublicPlanItem[] = []
        builderItems.forEach((item, itemIndex) => {
          if (item.blockType === 'planPassage') {
            const passage = cleanText(item.passage)
            if (passage) items.push({ type: 'passage', passage })
            return
          }
          if (item.blockType !== 'planNote') return

          const key = cleanText(item.key)
          if (key && noteKeys.has(key)) {
            errors.push({
              path: `days.${dayIndex}.items.${itemIndex}.key`,
              message: `Plan note key “${key}” is already used in this plan.`,
            })
          }
          if (key) noteKeys.add(key)
          const sources = Array.isArray(item.sources) ? item.sources.map(asObject) : []
          items.push({
            type: 'note',
            id: key,
            title: cleanText(item.title),
            text: cleanText(item.text),
            sourceLinks: sources.map(source => ({
              title: cleanText(source.title),
              url: cleanText(source.url),
            })),
          })
        })
        const passages = items.flatMap(item => item.type === 'passage' ? [item.passage] : [])
        if (!passages.length) {
          errors.push({
            path: `days.${dayIndex}.items`,
            message: 'Each plan day needs at least one Bible passage.',
          })
        }
        const label = cleanText(day.label)
        return {
          day: dayIndex + 1,
          ...(label ? { label, month: label } : {}),
          passages,
          items,
        }
      })

      if (errors.length) throw new ValidationError({ collection: 'reading-plans', errors, req })

      const authors = Array.isArray(source.authors)
        ? source.authors.map(cleanText).filter(Boolean)
        : []
      const license = cleanText(source.license)
      return {
        ...data,
        totalDays: readings.length,
        planData: {
          id: cleanText(source.slug),
          title: cleanText(source.title),
          description: cleanText(source.description),
          revision: cleanText(source.revision) || '1',
          ...(authors.length ? { authors } : {}),
          ...(license ? { license } : {}),
          totalDays: readings.length,
          readings,
        },
      }
    }],
  },
  fields: [
    ...communityContentFields,
    {
      name: 'revision',
      type: 'text',
      required: true,
      defaultValue: '1',
      admin: {
        description: 'Change this value when published day contents change so reader progress can be reconciled safely.',
      },
    },
    {
      name: 'days',
      type: 'array',
      required: true,
      minRows: 1,
      labels: { singular: 'Plan day', plural: 'Plan days' },
      admin: {
        description: 'Days are numbered automatically in this order. Drag rows to reorder the plan.',
        initCollapsed: true,
      },
      fields: [
        {
          name: 'label',
          type: 'text',
          admin: { description: 'Optional display label, such as “Creation” or “Week 1”.' },
        },
        {
          name: 'items',
          type: 'blocks',
          required: true,
          minRows: 1,
          blocks: [passageBlock, noteBlock],
          admin: { initCollapsed: true },
        },
      ],
    },
    {
      name: 'totalDays',
      type: 'number',
      required: true,
      min: 1,
      admin: { readOnly: true, description: 'Generated from the Plan days rows.' },
      access: { create: denyClientWrite, update: denyClientWrite },
    },
    {
      name: 'planData',
      type: 'json',
      required: true,
      admin: { hidden: true },
      access: { create: denyClientWrite, update: denyClientWrite },
    },
    { name: 'authors', type: 'text', hasMany: true },
    { name: 'license', type: 'text' },
  ],
}
