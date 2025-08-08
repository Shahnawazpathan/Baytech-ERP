"use client"

import React, { useState, useCallback } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { Upload, FileText, AlertCircle, CheckCircle, X, Download, FileSpreadsheet } from 'lucide-react'

interface LeadImportModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImportComplete: (leads: any[]) => void
}

interface DetectedField {
  originalName: string
  mappedName: string
  type: 'text' | 'number' | 'email' | 'phone' | 'date'
  required: boolean
  sampleValue?: string
}

export function LeadImportModal({ open, onOpenChange, onImportComplete }: LeadImportModalProps) {
  const { toast } = useToast()
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview' | 'importing'>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [csvData, setCsvData] = useState<string[][]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [detectedFields, setDetectedFields] = useState<DetectedField[]>([])
  const [mappedLeads, setMappedLeads] = useState<any[]>([])
  const [importProgress, setImportProgress] = useState(0)
  const [errors, setErrors] = useState<string[]>([])

  const standardFields = [
    { key: 'firstName', label: 'First Name', required: true, type: 'text' as const },
    { key: 'lastName', label: 'Last Name', required: true, type: 'text' as const },
    { key: 'email', label: 'Email', required: false, type: 'email' as const },
    { key: 'phone', label: 'Phone', required: true, type: 'phone' as const },
    { key: 'loanAmount', label: 'Loan Amount', required: false, type: 'number' as const },
    { key: 'propertyAddress', label: 'Property Address', required: false, type: 'text' as const },
    { key: 'creditScore', label: 'Credit Score', required: false, type: 'number' as const },
    { key: 'source', label: 'Lead Source', required: false, type: 'text' as const },
    { key: 'priority', label: 'Priority', required: false, type: 'text' as const },
    { key: 'notes', label: 'Notes', required: false, type: 'text' as const },
  ]

  const detectFieldType = (value: string): 'text' | 'number' | 'email' | 'phone' | 'date' => {
    if (!value) return 'text'
    
    // Email detection
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'email'
    
    // Phone detection
    if (/^[\+]?[1-9][\d]{0,15}$/.test(value.replace(/[\s\-\(\)]/g, ''))) return 'phone'
    
    // Number detection
    if (/^\d+\.?\d*$/.test(value)) return 'number'
    
    // Date detection
    if (Date.parse(value)) return 'date'
    
    return 'text'
  }

  const smartFieldMapping = (headerName: string): string | null => {
    const normalized = headerName.toLowerCase().trim()
    
    const mappings: Record<string, string> = {
      // Name variations
      'first_name': 'firstName',
      'firstname': 'firstName',
      'first name': 'firstName',
      'fname': 'firstName',
      'last_name': 'lastName',
      'lastname': 'lastName',
      'last name': 'lastName',
      'lname': 'lastName',
      'name': 'firstName',
      'full_name': 'firstName',
      'fullname': 'firstName',
      
      // Contact variations
      'email': 'email',
      'email_address': 'email',
      'e-mail': 'email',
      'mail': 'email',
      'phone': 'phone',
      'phone_number': 'phone',
      'telephone': 'phone',
      'mobile': 'phone',
      'cell': 'phone',
      'contact': 'phone',
      
      // Loan variations
      'loan_amount': 'loanAmount',
      'loanamount': 'loanAmount',
      'loan amount': 'loanAmount',
      'amount': 'loanAmount',
      'mortgage_amount': 'loanAmount',
      'loan_value': 'loanAmount',
      
      // Address variations
      'address': 'propertyAddress',
      'property_address': 'propertyAddress',
      'property address': 'propertyAddress',
      'location': 'propertyAddress',
      'street': 'propertyAddress',
      
      // Credit variations
      'credit_score': 'creditScore',
      'creditscore': 'creditScore',
      'credit score': 'creditScore',
      'credit': 'creditScore',
      'score': 'creditScore',
      
      // Source variations
      'source': 'source',
      'lead_source': 'source',
      'lead source': 'source',
      'origin': 'source',
      'referral': 'source',
      'campaign': 'source',
      
      // Priority variations
      'priority': 'priority',
      'importance': 'priority',
      'urgency': 'priority',
      'level': 'priority',
      
      // Notes variations
      'notes': 'notes',
      'comments': 'notes',
      'description': 'notes',
      'remarks': 'notes',
      'details': 'notes',
    }
    
    return mappings[normalized] || null
  }

  const analyzeFile = useCallback((fileContent: string) => {
    const lines = fileContent.split('\n').filter(line => line.trim())
    if (lines.length < 2) {
      throw new Error('File must contain at least a header row and one data row')
    }

    // Parse CSV (basic implementation)
    const parseCSV = (text: string): string[][] => {
      const lines = text.split('\n')
      const result: string[][] = []
      
      for (const line of lines) {
        if (line.trim()) {
          // Simple CSV parsing - handles basic comma separation
          const row = line.split(',').map(cell => cell.trim().replace(/^"|"$/g, ''))
          result.push(row)
        }
      }
      
      return result
    }

    const data = parseCSV(fileContent)
    const headerRow = data[0]
    const dataRows = data.slice(1)

    setCsvData(data)
    setHeaders(headerRow)

    // Detect fields and auto-map
    const detected: DetectedField[] = headerRow.map((header, index) => {
      const sampleValues = dataRows.slice(0, 5).map(row => row[index]).filter(Boolean)
      const sampleValue = sampleValues[0] || ''
      
      const detectedType = detectFieldType(sampleValue)
      const mappedName = smartFieldMapping(header) || ''
      const isRequired = ['firstName', 'lastName', 'phone'].includes(mappedName)
      
      return {
        originalName: header,
        mappedName,
        type: detectedType,
        required: isRequired,
        sampleValue
      }
    })

    setDetectedFields(detected)
    setStep('mapping')
  }, [])

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0]
    if (!selectedFile) return

    if (!selectedFile.name.toLowerCase().endsWith('.csv')) {
      toast({
        title: "Invalid File Type",
        description: "Please upload a CSV file",
        variant: "destructive",
      })
      return
    }

    setFile(selectedFile)
    const reader = new FileReader()
    
    reader.onload = (e) => {
      const content = e.target?.result as string
      try {
        analyzeFile(content)
        toast({
          title: "File Analyzed",
          description: `Found ${csvData.length - 1} potential leads`,
        })
      } catch (error) {
        toast({
          title: "File Analysis Error",
          description: error instanceof Error ? error.message : "Failed to analyze file",
          variant: "destructive",
        })
      }
    }
    
    reader.readAsText(selectedFile)
  }

  const updateFieldMapping = (index: number, mappedName: string) => {
    setDetectedFields(prev => prev.map((field, i) => 
      i === index ? { ...field, mappedName } : field
    ))
  }

  const validateMapping = (): string[] => {
    const validationErrors: string[] = []
    const mappedFields = detectedFields.filter(f => f.mappedName)
    
    // Check required fields
    const requiredFields = ['firstName', 'lastName', 'phone']
    requiredFields.forEach(field => {
      if (!mappedFields.find(f => f.mappedName === field)) {
        const fieldLabel = standardFields.find(sf => sf.key === field)?.label || field
        validationErrors.push(`${fieldLabel} is required but not mapped`)
      }
    })
    
    // Check for duplicate mappings
    const mappings = mappedFields.map(f => f.mappedName)
    const duplicates = mappings.filter((item, index) => mappings.indexOf(item) !== index)
    if (duplicates.length > 0) {
      validationErrors.push(`Duplicate mappings found: ${duplicates.join(', ')}`)
    }
    
    return validationErrors
  }

  const processMapping = () => {
    const validationErrors = validateMapping()
    if (validationErrors.length > 0) {
      setErrors(validationErrors)
      return
    }

    // Process the data
    const processedLeads: any[] = []
    const dataRows = csvData.slice(1)
    
    dataRows.forEach((row, rowIndex) => {
      const lead: any = {
        id: Date.now() + rowIndex,
        status: "NEW",
        assignedTo: "Unassigned",
      }
      
      detectedFields.forEach((field, fieldIndex) => {
        if (field.mappedName && row[fieldIndex]) {
          let value: any = row[fieldIndex].trim()
          
          // Type conversion
          if (field.type === 'number') {
            value = parseFloat(value) || 0
          } else if (field.type === 'email') {
            value = value.toLowerCase()
          } else if (field.mappedName === 'priority' && value) {
            value = value.toUpperCase()
            if (!['LOW', 'MEDIUM', 'HIGH', 'URGENT'].includes(value)) {
              value = 'MEDIUM'
            }
          }
          
          lead[field.mappedName] = value
        }
      })
      
      // Generate full name if only firstName is provided
      if (lead.firstName && !lead.lastName) {
        const nameParts = lead.firstName.split(' ')
        if (nameParts.length > 1) {
          lead.firstName = nameParts[0]
          lead.lastName = nameParts.slice(1).join(' ')
        }
      }
      
      // Set defaults
      if (!lead.priority) lead.priority = 'MEDIUM'
      if (!lead.source) lead.source = 'Import'
      
      processedLeads.push(lead)
    })
    
    setMappedLeads(processedLeads)
    setStep('preview')
    setErrors([])
  }

  const executeImport = async () => {
    setStep('importing')
    setImportProgress(0)
    
    // Simulate import progress
    const totalLeads = mappedLeads.length
    const batchSize = Math.max(1, Math.floor(totalLeads / 10))
    
    for (let i = 0; i < totalLeads; i += batchSize) {
      await new Promise(resolve => setTimeout(resolve, 100))
      setImportProgress(Math.min(100, ((i + batchSize) / totalLeads) * 100))
    }
    
    // Complete import
    onImportComplete(mappedLeads)
    toast({
      title: "Import Successful",
      description: `Successfully imported ${mappedLeads.length} leads`,
    })
    
    // Reset and close
    setTimeout(() => {
      resetModal()
      onOpenChange(false)
    }, 1000)
  }

  const resetModal = () => {
    setStep('upload')
    setFile(null)
    setCsvData([])
    setHeaders([])
    setDetectedFields([])
    setMappedLeads([])
    setImportProgress(0)
    setErrors([])
  }

  const downloadTemplate = () => {
    const templateHeaders = ['first_name', 'last_name', 'email', 'phone', 'loan_amount', 'property_address', 'credit_score', 'source', 'priority', 'notes']
    const sampleData = [
      ['John', 'Smith', 'john.smith@email.com', '555-0123', '450000', '123 Main St, City, State', '750', 'Website', 'HIGH', 'Qualified prospect'],
      ['Jane', 'Doe', 'jane.doe@email.com', '555-0456', '320000', '456 Oak Ave, City, State', '680', 'Referral', 'MEDIUM', 'Needs follow-up']
    ]
    
    const csvContent = [templateHeaders, ...sampleData]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n')
    
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'lead_import_template.csv'
    a.click()
    window.URL.revokeObjectURL(url)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Bulk Lead Import
          </DialogTitle>
          <DialogDescription>
            Import leads from CSV files with automatic field detection and mapping
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Upload CSV File</CardTitle>
                <CardDescription>
                  Upload a CSV file containing your leads. Our system will automatically detect and map fields.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center hover:border-gray-300 transition-colors">
                  <Input
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="csv-upload"
                  />
                  <Label htmlFor="csv-upload" className="cursor-pointer">
                    <div className="space-y-2">
                      <FileSpreadsheet className="h-12 w-12 mx-auto text-gray-400" />
                      <p className="text-sm font-medium">Click to upload CSV file</p>
                      <p className="text-xs text-gray-500">Maximum file size: 10MB</p>
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
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {standardFields.map(field => (
                    <Badge key={field.key} variant={field.required ? "default" : "outline"}>
                      {field.label} {field.required && "*"}
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
                  Map your CSV columns to our system fields. Auto-mapping has been applied based on column names.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {detectedFields.map((field, index) => (
                    <div key={index} className="flex items-center gap-4 p-3 border rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium">{field.originalName}</p>
                        <p className="text-sm text-gray-500">
                          Type: {field.type} | Sample: "{field.sampleValue}"
                        </p>
                      </div>
                      <div className="flex-1">
                        <Select value={field.mappedName} onValueChange={(value) => updateFieldMapping(index, value)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select field to map to" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">Don't map</SelectItem>
                            {standardFields.map(stdField => (
                              <SelectItem key={stdField.key} value={stdField.key}>
                                {stdField.label} {stdField.required && "*"}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {field.required && (
                        <Badge variant="destructive" className="text-xs">
                          Required
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>

                {errors.length > 0 && (
                  <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <h4 className="font-medium text-red-800 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      Validation Errors
                    </h4>
                    <ul className="mt-2 text-sm text-red-700 list-disc list-inside">
                      {errors.map((error, index) => (
                        <li key={index}>{error}</li>
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
                        <th className="text-left p-2">Email</th>
                        <th className="text-left p-2">Phone</th>
                        <th className="text-left p-2">Loan Amount</th>
                        <th className="text-left p-2">Priority</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mappedLeads.slice(0, 10).map((lead, index) => (
                        <tr key={index} className="border-b">
                          <td className="p-2">
                            {lead.firstName} {lead.lastName}
                          </td>
                          <td className="p-2">{lead.email || 'N/A'}</td>
                          <td className="p-2">{lead.phone}</td>
                          <td className="p-2">
                            {lead.loanAmount ? `$${lead.loanAmount.toLocaleString()}` : 'N/A'}
                          </td>
                          <td className="p-2">
                            <Badge variant="outline">{lead.priority}</Badge>
                          </td>
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
                <CardDescription>
                  Please wait while we import your leads...
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${importProgress}%` }}
                    />
                  </div>
                  <p className="text-center text-sm text-gray-600">
                    {importProgress < 100 ? `Importing... ${Math.round(importProgress)}%` : 'Import Complete!'}
                  </p>
                  {importProgress === 100 && (
                    <div className="flex items-center justify-center text-green-600">
                      <CheckCircle className="h-5 w-5 mr-2" />
                      Successfully imported {mappedLeads.length} leads
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={step === 'importing'}>
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
          
          {step === 'upload' && file && (
            <Button onClick={() => analyzeFile}>
              Analyze File
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}