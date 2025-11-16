"use client"

import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { 
  FileText, 
  Upload, 
  Download, 
  Search,
  Filter,
  Eye,
  Trash2,
  Share,
  FolderOpen,
  File,
  Calendar,
  User,
  Lock,
  Unlock,
  Plus
} from 'lucide-react'

interface Document {
  id: string
  name: string
  type: string
  size: number
  category: string
  uploadedBy: string
  uploadedAt: string
  lastModified: string
  isPrivate: boolean
  tags: string[]
  description?: string
  url?: string
  mimeType: string
}

interface DocumentManagerProps {
  companyId?: string
}

export function DocumentManager({ companyId = 'default' }: DocumentManagerProps) {
  const { toast } = useToast()
  const [documents, setDocuments] = useState<Document[]>([
    {
      id: '1',
      name: 'Employee_Handbook_2024.pdf',
      type: 'PDF',
      size: 2048000,
      category: 'HR',
      uploadedBy: 'Alice Johnson',
      uploadedAt: '2024-01-15',
      lastModified: '2024-01-15',
      isPrivate: false,
      tags: ['handbook', 'hr', 'policies'],
      description: 'Company employee handbook for 2024',
      mimeType: 'application/pdf'
    },
    {
      id: '2',
      name: 'Q4_Sales_Report.xlsx',
      type: 'Excel',
      size: 1024000,
      category: 'Reports',
      uploadedBy: 'Bob Smith',
      uploadedAt: '2024-01-10',
      lastModified: '2024-01-12',
      isPrivate: true,
      tags: ['sales', 'q4', 'report'],
      description: 'Quarterly sales performance analysis',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    },
    {
      id: '3',
      name: 'Lead_Processing_SOP.docx',
      type: 'Word',
      size: 512000,
      category: 'Procedures',
      uploadedBy: 'Carol Brown',
      uploadedAt: '2024-01-08',
      lastModified: '2024-01-08',
      isPrivate: false,
      tags: ['sop', 'leads', 'process'],
      description: 'Standard operating procedure for lead processing',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    },
    {
      id: '4',
      name: 'baytechlogo.svg',
      type: 'Image',
      size: 256000,
      category: 'Assets',
      uploadedBy: 'System',
      uploadedAt: '2025-11-16',
      lastModified: '2025-11-16',
      isPrivate: false,
      tags: ['logo', 'branding', 'assets'],
      description: 'Baytech official logo',
      mimeType: 'image/svg+xml'
    }
  ])

  const [showUploadModal, setShowUploadModal] = useState(false)
  const [filters, setFilters] = useState({
    search: '',
    category: 'ALL',
    type: 'ALL',
    isPrivate: 'ALL'
  })

  const [uploadData, setUploadData] = useState({
    category: 'General',
    tags: '',
    description: '',
    isPrivate: false
  })

  const categories = [
    'General',
    'HR',
    'Reports',
    'Procedures',
    'Assets',
    'Legal',
    'Financial',
    'Marketing'
  ]

  const getFileIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'pdf':
        return <FileText className="h-5 w-5 text-red-500" />
      case 'excel':
      case 'xlsx':
        return <FileText className="h-5 w-5 text-green-500" />
      case 'word':
      case 'docx':
        return <FileText className="h-5 w-5 text-blue-500" />
      case 'image':
      case 'png':
      case 'jpg':
        return <FileText className="h-5 w-5 text-purple-500" />
      default:
        return <File className="h-5 w-5 text-gray-500" />
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.name.toLowerCase().includes(filters.search.toLowerCase()) ||
                         doc.description?.toLowerCase().includes(filters.search.toLowerCase()) ||
                         doc.tags.some(tag => tag.toLowerCase().includes(filters.search.toLowerCase()))
    const matchesCategory = filters.category === 'ALL' || doc.category === filters.category
    const matchesType = filters.type === 'ALL' || doc.type === filters.type
    const matchesPrivacy = filters.isPrivate === 'ALL' || 
                          (filters.isPrivate === 'PUBLIC' && !doc.isPrivate) ||
                          (filters.isPrivate === 'PRIVATE' && doc.isPrivate)
    
    return matchesSearch && matchesCategory && matchesType && matchesPrivacy
  })

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files) return

    Array.from(files).forEach(file => {
      const document: Document = {
        id: Date.now().toString() + Math.random().toString(36),
        name: file.name,
        type: file.name.split('.').pop()?.toUpperCase() || 'Unknown',
        size: file.size,
        category: uploadData.category,
        uploadedBy: 'Current User',
        uploadedAt: new Date().toISOString().split('T')[0],
        lastModified: new Date().toISOString().split('T')[0],
        isPrivate: uploadData.isPrivate,
        tags: uploadData.tags.split(',').map(tag => tag.trim()).filter(Boolean),
        description: uploadData.description,
        mimeType: file.type,
        url: URL.createObjectURL(file)
      }

      setDocuments(prev => [...prev, document])
      
      toast({
        title: "File Uploaded",
        description: `${file.name} has been uploaded successfully`,
      })
    })

    setShowUploadModal(false)
    setUploadData({
      category: 'General',
      tags: '',
      description: '',
      isPrivate: false
    })
  }

  const handleDownloadDocument = (doc: Document) => {
    if (doc.url) {
      const a = document.createElement('a')
      a.href = doc.url
      a.download = doc.name
      a.click()
    } else {
      // Simulate download
      toast({
        title: "Download Started",
        description: `Downloading ${doc.name}...`,
      })
    }
  }

  const handleDeleteDocument = (docId: string) => {
    setDocuments(documents.filter(doc => doc.id !== docId))
    toast({
      title: "Document Deleted",
      description: "Document has been removed from the system",
    })
  }

  const toggleDocumentPrivacy = (docId: string) => {
    setDocuments(documents.map(doc => 
      doc.id === docId ? { ...doc, isPrivate: !doc.isPrivate } : doc
    ))
    
    const doc = documents.find(d => d.id === docId)
    toast({
      title: "Privacy Updated",
      description: `Document is now ${doc?.isPrivate ? 'public' : 'private'}`,
    })
  }

  const getDocumentStats = () => {
    const stats = {
      total: documents.length,
      private: documents.filter(d => d.isPrivate).length,
      public: documents.filter(d => !d.isPrivate).length,
      totalSize: documents.reduce((acc, doc) => acc + doc.size, 0)
    }
    return stats
  }

  const stats = getDocumentStats()

  return (
    <div className="space-y-6">
      {/* Document Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Documents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Public Documents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.public}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Private Documents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.private}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Storage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{formatFileSize(stats.totalSize)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Document Management */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FolderOpen className="h-5 w-5" />
                Document Management
              </CardTitle>
              <CardDescription>
                Organize and manage company documents and files
              </CardDescription>
            </div>
            <Button onClick={() => setShowUploadModal(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Upload Documents
            </Button>
          </div>
        </CardHeader>
        
        <CardContent>
          {/* Filters */}
          <div className="flex gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search documents..."
                value={filters.search}
                onChange={(e) => setFilters({...filters, search: e.target.value})}
                className="pl-10"
              />
            </div>
            
            <Select value={filters.category} onValueChange={(value) => setFilters({...filters, category: value})}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Categories</SelectItem>
                {categories.map(category => (
                  <SelectItem key={category} value={category}>{category}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filters.type} onValueChange={(value) => setFilters({...filters, type: value})}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Types</SelectItem>
                <SelectItem value="PDF">PDF</SelectItem>
                <SelectItem value="Excel">Excel</SelectItem>
                <SelectItem value="Word">Word</SelectItem>
                <SelectItem value="Image">Image</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filters.isPrivate} onValueChange={(value) => setFilters({...filters, isPrivate: value})}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Access</SelectItem>
                <SelectItem value="PUBLIC">Public</SelectItem>
                <SelectItem value="PRIVATE">Private</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Document List */}
          <div className="space-y-4">
            {filteredDocuments.map((doc) => (
              <Card key={doc.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="flex-shrink-0">
                      {getFileIcon(doc.type)}
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium">{doc.name}</h4>
                        {doc.isPrivate && (
                          <Lock className="h-4 w-4 text-red-500" />
                        )}
                      </div>
                      
                      <p className="text-sm text-gray-600 mb-2">
                        {doc.description || 'No description available'}
                      </p>
                      
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {doc.uploadedBy}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {doc.uploadedAt}
                        </span>
                        <span>{formatFileSize(doc.size)}</span>
                        <Badge variant="outline">{doc.category}</Badge>
                      </div>
                      
                      {doc.tags.length > 0 && (
                        <div className="flex gap-1 mt-2">
                          {doc.tags.map((tag, index) => (
                            <Badge key={index} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => handleDownloadDocument(doc)}>
                      <Download className="h-4 w-4" />
                    </Button>
                    
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => toggleDocumentPrivacy(doc.id)}
                    >
                      {doc.isPrivate ? (
                        <Unlock className="h-4 w-4" />
                      ) : (
                        <Lock className="h-4 w-4" />
                      )}
                    </Button>
                    
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleDeleteDocument(doc.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}

            {filteredDocuments.length === 0 && (
              <div className="text-center py-8">
                <FolderOpen className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <h3 className="font-medium text-gray-900 mb-2">No documents found</h3>
                <p className="text-sm text-gray-500">
                  {filters.search || filters.category !== 'ALL' || filters.type !== 'ALL' || filters.isPrivate !== 'ALL'
                    ? 'Try adjusting your filters'
                    : 'Upload your first document to get started'
                  }
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Upload Modal */}
      <Dialog open={showUploadModal} onOpenChange={setShowUploadModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Upload Documents</DialogTitle>
            <DialogDescription>
              Upload and organize documents for your team
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="file-upload">Select Files</Label>
              <Input
                id="file-upload"
                type="file"
                multiple
                onChange={handleFileUpload}
                className="cursor-pointer"
              />
              <p className="text-sm text-gray-500 mt-1">
                You can select multiple files at once
              </p>
            </div>

            <div>
              <Label htmlFor="doc-category">Category</Label>
              <Select value={uploadData.category} onValueChange={(value) => setUploadData({...uploadData, category: value})}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(category => (
                    <SelectItem key={category} value={category}>{category}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="doc-description">Description</Label>
              <Input
                id="doc-description"
                value={uploadData.description}
                onChange={(e) => setUploadData({...uploadData, description: e.target.value})}
                placeholder="Brief description of the document(s)"
              />
            </div>

            <div>
              <Label htmlFor="doc-tags">Tags (comma separated)</Label>
              <Input
                id="doc-tags"
                value={uploadData.tags}
                onChange={(e) => setUploadData({...uploadData, tags: e.target.value})}
                placeholder="e.g., important, review, confidential"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="doc-private"
                checked={uploadData.isPrivate}
                onChange={(e) => setUploadData({...uploadData, isPrivate: e.target.checked})}
                className="rounded"
              />
              <Label htmlFor="doc-private" className="text-sm">
                Make documents private (restricted access)
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUploadModal(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}