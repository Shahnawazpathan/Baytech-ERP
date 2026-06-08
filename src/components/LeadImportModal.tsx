"use client"

import React, { useState, useCallback, useRef } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { Upload, FileText, AlertCircle, CheckCircle, Download, FileSpreadsheet, Loader2 } from 'lucide-react'
import Papa from 'papaparse'
import { MAX_IMPORT_FILE_SIZE } from '@/lib/leads-constants'

interface LeadImportModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /**
   * Called with the parsed+validated leads. The parent owns the API call
   * (and the success/failure toast) so this modal only surfaces validation
   * errors and *its own* "Analyzed" / "Validated" feedback.
   */
  onImportComplete: (leads: any[]) => Promise<void> | void
}

type FieldType = 'text' | 'number' | 'email' | 'phone' | 'date'

interface DetectedField {
  originalName: string
  mappedName: string
  type: FieldType
  required: boolean
  sampleValue?: string
}

type Step = 'upload' | 'mapping' | 'preview' | 'importing'

const STANDARD_FIELDS: Array<{ key: string; label: string; required: boolean; type: FieldType }> = [
  { key: 'firstName', label: 'Name', required: true, type: 'text' },
  { key: 'phone', label: 'Mobile Number', required: true, type: 'phone' },
  { key: 'propertyAddress', label: 'Property Location', required: false, type: 'text' },
]

const HEADER_ALIASES: Record<string, string> = {
  // name
  'name': 'firstName',
  'first_name': 'firstName',
  'firstname': 'firstName',
  'first name': 'firstName',
  'fname': 'firstName',
  'customer_name': 'firstName',
  'client_name': 'firstName',
  'full_name': 'firstName',
  // phone
  'phone': 'phone',
  'phone_number': 'phone',
  'telephone': 'phone',
  'mobile': 'phone',
  'mobile_number': 'phone',
  'cell': 'phone',
  'contact': 'phone',
  'contact_number': 'phone',
  'mobile_no': 'phone',
  'phone_no': 'phone',
  // address
  'property_location': 'propertyAddress',
  'property location': 'propertyAddress',
  'location': 'propertyAddress',
  'property_address': 'propertyAddress',
  'property address': 'propertyAddress',
  'address': 'propertyAddress',
  'property': 'propertyAddress',
  'property_info': 'propertyAddress',
  'property details': 'propertyAddress',
}

function detectFieldType(value: string): FieldType {
  if (!value) return 'text'
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'email'
  if (/^\+?[\d\s\-()]{7,}$/.test(value)) return 'phone'
  if (/^\d+\.?\d*$/.test(value)) return 'number'
  if (!isNaN(Date.parse(value)) && /\d{4}/.test(value)) return 'date'
  return 'text'
}

function smartFieldMapping(header: string): string {
  return HEADER_ALIASES[header.toLowerCase().trim()] || ''
}

export function LeadImportModal({ open, onOpenChange, onImportComplete }: LeadImportModalProps) {
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<Step>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<string[][]>([])
  const [detectedFields, setDetectedFields] = useState<DetectedField[]>([])
  const [mappedLeads, setMappedLeads] = useState<any[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const [parsing, setParsing] = useState(false)

  const reset = useCallback(() => {
    setStep('upload')
    setFile(null)
    setHeaders([])
    setRows([])
    setDetectedFields([])
    setMappedLeads([])
    setErrors([])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  const handleClose = (next: boolean) => {
    if (step === 'importing') return
    if (!next) reset()
    onOpenChange(next)
  }

  const parseFile = useCallback(
    (selectedFile: File) => {
      if (!selectedFile.name.toLowerCase().endsWith('.csv')) {
        toast({ title: 'Invalid File Type', description: 'Please upload a CSV file', variant: 'destructive' })
        return
      }
      if (selectedFile.size > MAX_IMPORT_FILE_SIZE) {
        toast({
          title: 'File Too Large',
          description: `File exceeds the ${Math.round(MAX_IMPORT_FILE_SIZE / 1024 / 1024)} MB limit`,
          variant: 'destructive',
        })
        return
      }

      setFile(selectedFile)
      setParsing(true)
      Papa.parse<string[]>(selectedFile, {
        skipEmptyLines: true,
        complete: (result) => {
          setParsing(false)
          const data = result.data
          if (!data || data.length < 2) {
            toast({
              title: 'Empty File',
              description: 'CSV must contain a header row and at least one data row',
              variant: 'destructive',
            })
            return
          }
          if (result.errors.length > 0) {
            // Soft warn — continue with whatever parsed
            toast({
              title: 'Some rows had issues',
              description: `${result.errors.length} row(s) had parsing warnings`,
              variant: 'destructive',
            })
          }
          const headerRow = data[0].map((h) => h.trim())
          const dataRows = data.slice(1)
          setHeaders(headerRow)
          setRows(dataRows)

          // Detect fields and auto-map
          const detected: DetectedField[] = headerRow.map((header, index) => {
            const sampleValues = dataRows
              .slice(0, 5)
              .map((row) => row[index])
              .filter(Boolean) as string[]
            const sampleValue = sampleValues[0] || ''
            const mappedName = smartFieldMapping(header)
            const detectedType = detectFieldType(sampleValue)
            const isRequired = ['firstName', 'phone'].includes(mappedName)
            return {
              originalName: header,
              mappedName,
              type: detectedType,
              required: isRequired,
              sampleValue,
            }
          })
          setDetectedFields(detected)
          setStep('mapping')
          toast({
            title: 'File Analyzed',
            description: `Found ${dataRows.length} potential leads across ${detected.length} columns`,
          })
        },
        error: (err) => {
          setParsing(false)
          toast({
            title: 'File Parse Error',
            description: err.message,
            variant: 'destructive',
          })
        },
      })
    },
    [toast]
  )

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const f = event.target.files?.[0]
    if (f) parseFile(f)
  }

  const updateFieldMapping = (index: number, mappedName: string) => {
    setDetectedFields((prev) => prev.map((f, i) => (i === index ? { ...f, mappedName } : f)))
  }

  const validateMapping = (): string[] => {
    const validationErrors: string[] = []
    const mappedFields = detectedFields.filter((f) => f.mappedName && f.mappedName !== 'unmapped')

    const requiredFields = ['firstName', 'phone']
    for (const field of requiredFields) {
      if (!mappedFields.find((f) => f.mappedName === field)) {
        const fieldLabel = STANDARD_FIELDS.find((sf) => sf.key === field)?.label || field
        validationErrors.push(`${fieldLabel} is required but not mapped`)
      }
    }
    const mappings = mappedFields.map((f) => f.mappedName)
    const dupes = mappings.filter((m, i) => mappings.indexOf(m) !== i)
    if (dupes.length > 0) {
      validationErrors.push(`Duplicate mappings: ${[...new Set(dupes)].join(', ')}`)
    }
    return validationErrors
  }

  const processMapping = () => {
    const validationErrors = validateMapping()
    if (validationErrors.length > 0) {
      setErrors(validationErrors)
      return
    }

    const processed: any[] = []
    for (const row of rows) {
      const lead: any = {
        status: 'NEW',
        source: 'Import',
      }
      detectedFields.forEach((field, fieldIndex) => {
        if (field.mappedName && field.mappedName !== 'unmapped' && row[fieldIndex]) {
          let value: any = row[fieldIndex].trim()
          if (field.type === 'number') value = parseFloat(value) || 0
          else if (field.type === 'email') value = value.toLowerCase()
          lead[field.mappedName] = value
        }
      })
      if (!lead.source) lead.source = 'Import'
      processed.push(lead)
    }

    setMappedLeads(processed)
    setErrors([])
    setStep('preview')
  }

  const executeImport = async () => {
    setStep('importing')
    try {
      // Parent does the API call and shows its own toast.
      await onImportComplete(mappedLeads)
      // Brief success confirmation; close on next tick so the parent toast appears first.
      toast({
        title: 'Import Successful',
        description: `Sent ${mappedLeads.length} leads for import`,
      })
      setTimeout(() => {
        reset()
        onOpenChange(false)
      }, 600)
    } catch (error) {
      setStep('preview')
      toast({
        title: 'Import Failed',
        description: error instanceof Error ? error.message : 'Failed to import leads',
        variant: 'destructive',
      })
    }
  }

  const downloadTemplate = () => {
    const templateHeaders = ['name', 'mobile_number', 'property_location']
    const sample = [
      ['John Smith', '555-0123', '123 Main St, City, State'],
      ['Jane Doe', '555-0456', '456 Oak Ave, City, State'],
    ]
    const csv = Papa.unparse([templateHeaders, ...sample])
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'lead_import_template.csv'
    a.click()
    window.URL.revokeObjectURL(url)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="flex max-h-[calc(100dvh-1rem)] flex-col sm:max-w-4xl">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Bulk Lead Import
          </DialogTitle>
          <DialogDescription>
            Import leads from CSV files with automatic field detection and mapping
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-1">
          {step === 'upload' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Upload CSV File</CardTitle>
                  <CardDescription>
                    Upload a CSV file containing your leads. The system will automatically detect and map fields.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center hover:border-gray-300 transition-colors">
                    <Input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,text/csv"
                      onChange={handleFileUpload}
                      className="hidden"
                      id="csv-upload"
                      disabled={parsing}
                    />
                    <Label htmlFor="csv-upload" className="cursor-pointer">
                      <div className="space-y-2">
                        {parsing ? (
                          <Loader2 className="h-12 w-12 mx-auto text-gray-400 animate-spin" />
                        ) : (
                          <FileSpreadsheet className="h-12 w-12 mx-auto text-gray-400" />
                        )}
                        <p className="text-sm font-medium">
                          {parsing ? 'Parsing CSV…' : 'Click to upload CSV file'}
                        </p>
                        <p className="text-xs text-gray-500">
                          Maximum file size: {Math.round(MAX_IMPORT_FILE_SIZE / 1024 / 1024)} MB
                        </p>
                      </div>
                    </Label>
                  </div>

                  <div className="flex items-center justify-center gap-2">
                    <Button variant="outline" size="sm" onClick={downloadTemplate}>
                      <Download className="h-4 w-4 mr-2" />
                      Download Template
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Supported Fields</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {STANDARD_FIELDS.map((f) => (
                      <Badge key={f.key} variant={f.required ? 'default' : 'outline'}>
                        {f.label} {f.required && '*'}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">* Required fields</p>
                </CardContent>
              </Card>
            </div>
          )}

          {step === 'mapping' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Field Mapping</CardTitle>
                  <CardDescription>
                    Map your CSV columns to the system fields. Auto-mapping has been applied based on column names.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 flex flex-col">
                  <div className="flex-1 overflow-y-auto max-h-[30vh] pr-2 -mr-2 -ml-2">
                    <div className="space-y-4 pb-2">
                      {detectedFields.map((field, index) => (
                        <div key={`field-${index}`} className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:gap-4">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{field.originalName}</p>
                            <p className="text-sm text-gray-500 truncate">
                              Type: {field.type} | Sample: "{field.sampleValue}"
                            </p>
                          </div>
                          <div className="w-full sm:w-64">
                            <Select
                              value={field.mappedName || 'unmapped'}
                              onValueChange={(v) => updateFieldMapping(index, v)}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select field to map to" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="unmapped">Don't map</SelectItem>
                                {STANDARD_FIELDS.map((sf) => (
                                  <SelectItem key={sf.key} value={sf.key}>
                                    {sf.label} {sf.required && '*'}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          {field.required && (
                            <Badge variant="destructive" className="text-xs flex-shrink-0">
                              Required
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {errors.length > 0 && (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex-shrink-0">
                      <h4 className="font-medium text-red-800 flex items-center gap-2">
                        <AlertCircle className="h-4 w-4" />
                        Validation Errors
                      </h4>
                      <ul className="mt-2 text-sm text-red-700 list-disc list-inside">
                        {errors.map((e, i) => (
                          <li key={i}>{e}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Import Preview</CardTitle>
                  <CardDescription>
                    Review the leads that will be imported. {mappedLeads.length} leads ready for import.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="max-h-96 overflow-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2">Name</th>
                          <th className="text-left p-2">Mobile Number</th>
                          <th className="text-left p-2">Property Location</th>
                        </tr>
                      </thead>
                      <tbody>
                        {mappedLeads.slice(0, 10).map((lead, index) => (
                          <tr key={index} className="border-b">
                            <td className="p-2">{lead.firstName || 'N/A'}</td>
                            <td className="p-2">{lead.phone || 'N/A'}</td>
                            <td className="p-2">{lead.propertyAddress || 'N/A'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {mappedLeads.length > 10 && (
                      <p className="text-center p-2 text-gray-500">
                        ... and {mappedLeads.length - 10} more leads
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {step === 'importing' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Importing Leads</CardTitle>
                  <CardDescription>Please wait while the leads are imported.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-center gap-2 text-gray-600">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Importing {mappedLeads.length} leads...
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        <DialogFooter className="flex-shrink-0 pt-4 border-t">
          <Button variant="outline" onClick={() => handleClose(false)} disabled={step === 'importing'}>
            Cancel
          </Button>

          {step === 'mapping' && (
            <Button onClick={processMapping}>
              Continue to Preview
            </Button>
          )}

          {step === 'preview' && (
            <Button onClick={executeImport} className="bg-green-600 hover:bg-green-700">
              Import {mappedLeads.length} Leads
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
