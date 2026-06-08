export type LeadMetadata = {
  notesStatus?: string | null
  followUpDate?: string | null
  dnc?: boolean
  whatsappOptIn?: boolean
  lastDisposition?: string | null
  lastCallAt?: string | null
  callAttempts?: number
}

type LeadMetadataRecord = Record<string, unknown>

const parseMetadataObject = (metadata?: string | null): LeadMetadataRecord => {
  if (!metadata) return {}
  try {
    const parsed = JSON.parse(metadata)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as LeadMetadataRecord
    }
  } catch (error) {
    // Ignore malformed metadata
  }
  return {}
}

export const parseLeadMetadata = (metadata?: string | null): LeadMetadata => {
  const parsed = parseMetadataObject(metadata)
  return {
    notesStatus: typeof parsed.notesStatus === 'string' ? parsed.notesStatus : null,
    followUpDate: typeof parsed.followUpDate === 'string' ? parsed.followUpDate : null,
    dnc: parsed.dnc === true,
    whatsappOptIn: parsed.whatsappOptIn !== false,
    lastDisposition: typeof parsed.lastDisposition === 'string' ? parsed.lastDisposition : null,
    lastCallAt: typeof parsed.lastCallAt === 'string' ? parsed.lastCallAt : null,
    callAttempts: typeof parsed.callAttempts === 'number' ? parsed.callAttempts : 0,
  }
}

export const mergeLeadMetadata = (
  existingMetadata?: string | null,
  updates: LeadMetadata = {}
): string | null => {
  const parsed = parseMetadataObject(existingMetadata)
  const next: LeadMetadataRecord = { ...parsed }

  if (updates.notesStatus !== undefined) {
    if (updates.notesStatus) {
      next.notesStatus = updates.notesStatus
    } else {
      delete next.notesStatus
    }
  }

  if (updates.followUpDate !== undefined) {
    if (updates.followUpDate) {
      next.followUpDate = updates.followUpDate
    } else {
      delete next.followUpDate
    }
  }

  if (Object.keys(next).length === 0) return null
  return JSON.stringify(next)
}
