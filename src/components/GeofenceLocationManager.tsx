"use client"

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import {
  MapPin,
  Plus,
  Edit,
  Trash2,
  Loader2,
  Save,
  X
} from 'lucide-react'

interface GeofenceLocation {
  id: string
  name: string
  address: string
  latitude: number
  longitude: number
  radius: number
  isActive: boolean
}

interface GeofenceLocationManagerProps {
  companyId?: string
}

export function GeofenceLocationManager({ companyId = 'default-company' }: GeofenceLocationManagerProps) {
  const { toast } = useToast()
  const [locations, setLocations] = useState<GeofenceLocation[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingLocation, setEditingLocation] = useState<GeofenceLocation | null>(null)

  const [formData, setFormData] = useState({
    name: '',
    address: '',
    latitude: '',
    longitude: '',
    radius: '100'
  })

  // Fetch locations
  const fetchLocations = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/geofence-locations', {
        headers: {
          'x-company-id': companyId
        }
      })
      const data = await response.json()
      if (data.success) {
        setLocations(data.data || [])
      }
    } catch (error) {
      console.error('Error fetching locations:', error)
      toast({
        title: "Error",
        description: "Failed to load geofence locations",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchLocations()
  }, [companyId])

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)

    try {
      const url = editingLocation ? '/api/geofence-locations' : '/api/geofence-locations'
      const method = editingLocation ? 'PUT' : 'POST'

      const payload = {
        ...(editingLocation && { id: editingLocation.id }),
        name: formData.name,
        address: formData.address,
        latitude: parseFloat(formData.latitude),
        longitude: parseFloat(formData.longitude),
        radius: parseInt(formData.radius),
        companyId
      }

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Failed to save location')
      }

      toast({
        title: editingLocation ? "Location Updated" : "Location Created",
        description: `${formData.name} has been ${editingLocation ? 'updated' : 'created'} successfully`,
      })

      setIsDialogOpen(false)
      resetForm()
      fetchLocations()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to save location',
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  // Handle delete
  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this location?')) return

    try {
      const response = await fetch(`/api/geofence-locations?id=${id}`, {
        method: 'DELETE',
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Failed to delete location')
      }

      toast({
        title: "Location Deleted",
        description: "The geofence location has been deleted successfully",
      })

      fetchLocations()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to delete location',
        variant: "destructive",
      })
    }
  }

  // Handle toggle active status
  const handleToggleActive = async (location: GeofenceLocation) => {
    try {
      const response = await fetch('/api/geofence-locations', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: location.id,
          isActive: !location.isActive
        })
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Failed to update location')
      }

      toast({
        title: "Status Updated",
        description: `Location has been ${!location.isActive ? 'activated' : 'deactivated'}`,
      })

      fetchLocations()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to update location',
        variant: "destructive",
      })
    }
  }

  // Edit location
  const handleEdit = (location: GeofenceLocation) => {
    setEditingLocation(location)
    setFormData({
      name: location.name,
      address: location.address,
      latitude: location.latitude.toString(),
      longitude: location.longitude.toString(),
      radius: location.radius.toString()
    })
    setIsDialogOpen(true)
  }

  // Reset form
  const resetForm = () => {
    setEditingLocation(null)
    setFormData({
      name: '',
      address: '',
      latitude: '',
      longitude: '',
      radius: '100'
    })
  }

  // Get current location for quick setup
  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast({
        title: "Not Supported",
        description: "Geolocation is not supported by your browser",
        variant: "destructive",
      })
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormData(prev => ({
          ...prev,
          latitude: position.coords.latitude.toFixed(6),
          longitude: position.coords.longitude.toFixed(6)
        }))
        toast({
          title: "Location Found",
          description: "Current coordinates have been added to the form",
        })
      },
      (error) => {
        toast({
          title: "Location Error",
          description: "Failed to get current location",
          variant: "destructive",
        })
      }
    )
  }

  return (
    <>
      {/* Add Location Button */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Geofence Location Management
          </h3>
          <p className="text-sm text-gray-500">Configure work locations for attendance tracking (Admin Only)</p>
        </div>
        <Button
          size="sm"
          onClick={() => setIsDialogOpen(true)}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Location
        </Button>
      </div>

      {/* Locations List - Only show if there are locations or loading */}
      {(isLoading || locations.length > 0) && (
        <Card className="mb-6">
          <CardContent className="pt-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : (
              <div className="space-y-3">
                {locations.map((location) => (
                  <div key={location.id} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium">{location.name}</h4>
                          <Badge variant={location.isActive ? "default" : "secondary"}>
                            {location.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600 mb-1">{location.address}</p>
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span>Lat: {location.latitude.toFixed(6)}</span>
                          <span>Lng: {location.longitude.toFixed(6)}</span>
                          <span>Radius: {location.radius}m</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleActive(location)}
                        >
                          {location.isActive ? 'Deactivate' : 'Activate'}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(location)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(location.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Add/Edit Location Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        setIsDialogOpen(open)
        if (!open) resetForm()
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingLocation ? 'Edit Location' : 'Add New Location'}
            </DialogTitle>
            <DialogDescription>
              Configure a geofence location for attendance tracking
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Location Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Main Office"
                required
              />
            </div>
            <div>
              <Label htmlFor="address">Address *</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                placeholder="123 Business St, City, State"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="latitude">Latitude *</Label>
                <Input
                  id="latitude"
                  type="number"
                  step="any"
                  value={formData.latitude}
                  onChange={(e) => setFormData(prev => ({ ...prev, latitude: e.target.value }))}
                  placeholder="40.7128"
                  required
                />
              </div>
              <div>
                <Label htmlFor="longitude">Longitude *</Label>
                <Input
                  id="longitude"
                  type="number"
                  step="any"
                  value={formData.longitude}
                  onChange={(e) => setFormData(prev => ({ ...prev, longitude: e.target.value }))}
                  placeholder="-74.0060"
                  required
                />
              </div>
            </div>
            <div>
              <Label htmlFor="radius">Radius (meters) *</Label>
              <Input
                id="radius"
                type="number"
                value={formData.radius}
                onChange={(e) => setFormData(prev => ({ ...prev, radius: e.target.value }))}
                placeholder="100"
                required
              />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={handleGetCurrentLocation}
              className="w-full"
            >
              <MapPin className="h-4 w-4 mr-2" />
              Use Current Location
            </Button>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => {
                setIsDialogOpen(false)
                resetForm()
              }}>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                {editingLocation ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
