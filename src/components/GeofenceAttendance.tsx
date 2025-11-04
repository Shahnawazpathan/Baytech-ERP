"use client"

import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { 
  MapPin, 
  Navigation, 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  Settings,
  Loader2,
  Wifi,
  WifiOff,
  Map,
  Target
} from 'lucide-react'

interface GeofenceLocation {
  id: string
  name: string
  address: string
  latitude: number
  longitude: number
  radius: number // in meters
  isActive: boolean
}

interface GeofenceAttendanceProps {
  onCheckIn?: (data: any) => void
  onCheckOut?: (data: any) => void
  companyId?: string
  employeeId?: string
}

export function GeofenceAttendance({
  onCheckIn,
  onCheckOut,
  companyId = 'default-company',
  employeeId = 'current-user'
}: GeofenceAttendanceProps) {
  const { toast } = useToast()
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [isLocating, setIsLocating] = useState(false)
  const [nearbyLocations, setNearbyLocations] = useState<GeofenceLocation[]>([])
  const [selectedLocation, setSelectedLocation] = useState<GeofenceLocation | null>(null)
  const [attendanceStatus, setAttendanceStatus] = useState<'idle' | 'checking-in' | 'checking-out' | 'success'>('idle')
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [lastKnownLocation, setLastKnownLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [workingLocations, setWorkingLocations] = useState<GeofenceLocation[]>([])
  const [isLoadingLocations, setIsLoadingLocations] = useState(false)
  const [hasCheckedIn, setHasCheckedIn] = useState(false)

  // Fetch geofence locations from API
  useEffect(() => {
    const fetchLocations = async () => {
      setIsLoadingLocations(true)
      try {
        const response = await fetch('/api/geofence-locations', {
          headers: {
            'x-company-id': companyId
          }
        })
        const data = await response.json()
        if (data.success && data.data) {
          setWorkingLocations(data.data)
        }
      } catch (error) {
        console.error('Error fetching geofence locations:', error)
        toast({
          title: "Error",
          description: "Failed to load work locations",
          variant: "destructive",
        })
      } finally {
        setIsLoadingLocations(false)
      }
    }

    fetchLocations()
  }, [companyId, toast])

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Calculate distance between two coordinates (Haversine formula)
  const calculateDistance = useCallback((lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371e3 // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180
    const φ2 = lat2 * Math.PI / 180
    const Δφ = (lat2 - lat1) * Math.PI / 180
    const Δλ = (lng2 - lng1) * Math.PI / 180

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))

    return R * c
  }, [])

  // Get current location with enhanced accuracy
  const getCurrentLocation = useCallback((): Promise<{ lat: number; lng: number }> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by this browser'))
        return
      }

      const options: PositionOptions = {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 60000 // 1 minute cache
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          }
          setLastKnownLocation(location)
          resolve(location)
        },
        (error) => {
          let errorMessage = 'Location access denied'
          
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = 'Location access denied by user'
              break
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'Location information unavailable'
              break
            case error.TIMEOUT:
              errorMessage = 'Location request timed out'
              break
          }
          
          // Try to use last known location if available
          if (lastKnownLocation) {
            toast({
              title: "Using Last Known Location",
              description: "Current location unavailable, using previous location",
              variant: "default",
            })
            resolve(lastKnownLocation)
          } else {
            reject(new Error(errorMessage))
          }
        },
        options
      )
    })
  }, [lastKnownLocation, toast])

  // Find nearby locations within geofence
  const findNearbyLocations = useCallback((userLocation: { lat: number; lng: number }) => {
    const nearby = workingLocations.filter(location => {
      if (!location.isActive) return false
      
      const distance = calculateDistance(
        userLocation.lat,
        userLocation.lng,
        location.latitude,
        location.longitude
      )
      
      return distance <= location.radius
    }).sort((a, b) => {
      // Sort by closest distance
      const distanceA = calculateDistance(userLocation.lat, userLocation.lng, a.latitude, a.longitude)
      const distanceB = calculateDistance(userLocation.lat, userLocation.lng, b.latitude, b.longitude)
      return distanceA - distanceB
    })

    setNearbyLocations(nearby)
    if (nearby.length > 0 && !selectedLocation) {
      setSelectedLocation(nearby[0])
    }
  }, [workingLocations, calculateDistance, selectedLocation])

  // Locate user and find nearby offices
  const locateUser = async () => {
    setIsLocating(true)
    setLocationError(null)
    
    try {
      const location = await getCurrentLocation()
      setCurrentLocation(location)
      findNearbyLocations(location)
      
      toast({
        title: "Location Found",
        description: `Found ${nearbyLocations.length} nearby work location(s)`,
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to get location'
      setLocationError(errorMessage)
      toast({
        title: "Location Error",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsLocating(false)
    }
  }

  // Handle check-in
  const handleCheckIn = async () => {
    if (!currentLocation) {
      toast({
        title: "Location Required",
        description: "Please get your current location first",
        variant: "destructive",
      })
      return
    }

    if (!selectedLocation) {
      toast({
        title: "No Work Location",
        description: "You're not within range of any work location",
        variant: "destructive",
      })
      return
    }

    setAttendanceStatus('checking-in')

    try {
      const attendanceData = {
        employeeId,
        companyId,
        latitude: currentLocation.lat,
        longitude: currentLocation.lng,
        address: selectedLocation.address,
        locationId: selectedLocation.id,
        locationName: selectedLocation.name,
        notes: `Checked in at ${selectedLocation.name}`
      }

      // Call check-in API
      const response = await fetch('/api/attendance/check-in', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(attendanceData)
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Failed to check in')
      }

      // Call parent handler if provided
      if (onCheckIn) {
        await onCheckIn(result.data)
      }

      setHasCheckedIn(true)
      setAttendanceStatus('success')
      toast({
        title: "Check-in Successful",
        description: `Checked in at ${selectedLocation.name}`,
        duration: 4000,
      })

      setTimeout(() => setAttendanceStatus('idle'), 2000)
    } catch (error) {
      setAttendanceStatus('idle')
      toast({
        title: "Check-in Failed",
        description: error instanceof Error ? error.message : 'Failed to check in',
        variant: "destructive",
      })
    }
  }

  // Handle check-out
  const handleCheckOut = async () => {
    if (!currentLocation) {
      toast({
        title: "Location Required",
        description: "Please get your current location first",
        variant: "destructive",
      })
      return
    }

    setAttendanceStatus('checking-out')

    try {
      const attendanceData = {
        employeeId,
        companyId,
        latitude: currentLocation.lat,
        longitude: currentLocation.lng,
        address: selectedLocation?.address || 'Unknown location',
        notes: selectedLocation ? `Checked out from ${selectedLocation.name}` : 'Checked out outside work area'
      }

      // Call check-out API
      const response = await fetch('/api/attendance/check-out', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(attendanceData)
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Failed to check out')
      }

      // Call parent handler if provided
      if (onCheckOut) {
        await onCheckOut(result.data)
      }

      setHasCheckedIn(false)
      setAttendanceStatus('success')
      toast({
        title: "Check-out Successful",
        description: selectedLocation ? `Checked out from ${selectedLocation.name}` : "Checked out",
        duration: 4000,
      })

      setTimeout(() => setAttendanceStatus('idle'), 2000)
    } catch (error) {
      setAttendanceStatus('idle')
      toast({
        title: "Check-out Failed",
        description: error instanceof Error ? error.message : 'Failed to check out',
        variant: "destructive",
      })
    }
  }

  // Auto-locate on component mount
  useEffect(() => {
    locateUser()
  }, [])

  // Watch position changes
  useEffect(() => {
    if (!currentLocation) return

    const watchId = navigator.geolocation?.watchPosition(
      (position) => {
        const newLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        }
        setCurrentLocation(newLocation)
        findNearbyLocations(newLocation)
      },
      (error) => {
        console.warn('Position watch error:', error)
      },
      {
        enableHighAccuracy: false,
        timeout: 30000,
        maximumAge: 300000 // 5 minutes
      }
    )

    return () => {
      if (watchId) {
        navigator.geolocation?.clearWatch(watchId)
      }
    }
  }, [currentLocation, findNearbyLocations])

  return (
    <div className="space-y-6">
      {/* Location Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Location Status
            <div className="flex items-center gap-2 ml-auto">
              {isOnline ? (
                <Badge variant="outline" className="text-green-600">
                  <Wifi className="h-3 w-3 mr-1" />
                  Online
                </Badge>
              ) : (
                <Badge variant="destructive">
                  <WifiOff className="h-3 w-3 mr-1" />
                  Offline
                </Badge>
              )}
            </div>
          </CardTitle>
          <CardDescription>
            Your current location and nearby work areas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={locateUser}
              disabled={isLocating}
            >
              {isLocating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Target className="h-4 w-4 mr-2" />
              )}
              {isLocating ? 'Locating...' : 'Get Current Location'}
            </Button>
          </div>

          {locationError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2 text-red-800">
                <AlertCircle className="h-4 w-4" />
                <span className="font-medium">Location Error</span>
              </div>
              <p className="text-sm text-red-700 mt-1">{locationError}</p>
            </div>
          )}

          {currentLocation && (
            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2 text-green-800">
                <CheckCircle className="h-4 w-4" />
                <span className="font-medium">Location Found</span>
              </div>
              <p className="text-sm text-green-700 mt-1">
                Latitude: {currentLocation.lat.toFixed(6)}, Longitude: {currentLocation.lng.toFixed(6)}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Nearby Locations */}
      {nearbyLocations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Map className="h-5 w-5" />
              Nearby Work Locations
            </CardTitle>
            <CardDescription>
              Work locations within range for attendance
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {nearbyLocations.map((location) => {
                const distance = currentLocation ? calculateDistance(
                  currentLocation.lat,
                  currentLocation.lng,
                  location.latitude,
                  location.longitude
                ) : 0

                return (
                  <div 
                    key={location.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedLocation?.id === location.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => setSelectedLocation(location)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">{location.name}</h4>
                        <p className="text-sm text-gray-600">{location.address}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {Math.round(distance)}m away
                          </Badge>
                          <Badge 
                            variant={distance <= location.radius ? "default" : "secondary"}
                            className="text-xs"
                          >
                            {distance <= location.radius ? 'In Range' : 'Out of Range'}
                          </Badge>
                        </div>
                      </div>
                      {selectedLocation?.id === location.id && (
                        <CheckCircle className="h-5 w-5 text-blue-600" />
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Nearby Locations */}
      {currentLocation && nearbyLocations.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <AlertCircle className="h-12 w-12 mx-auto text-yellow-500 mb-4" />
            <h3 className="font-medium text-gray-900 mb-2">Not in Work Area</h3>
            <p className="text-sm text-gray-600 mb-4">
              You're not currently within range of any registered work locations.
            </p>
            <p className="text-xs text-gray-500">
              You may still check in/out, but it will be marked as outside work area.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Check-in/Check-out Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Attendance Actions
          </CardTitle>
          <CardDescription>
            Check in or check out with location verification
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Button
              onClick={handleCheckIn}
              disabled={!currentLocation || attendanceStatus !== 'idle' || hasCheckedIn}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              {attendanceStatus === 'checking-in' ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Navigation className="h-4 w-4 mr-2" />
              )}
              {hasCheckedIn ? 'Already Checked In' : 'Check In'}
            </Button>

            <Button
              variant="outline"
              onClick={handleCheckOut}
              disabled={!currentLocation || attendanceStatus !== 'idle' || !hasCheckedIn}
              className="flex-1 border-red-200 text-red-700 hover:bg-red-50"
            >
              {attendanceStatus === 'checking-out' ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Navigation className="h-4 w-4 mr-2" />
              )}
              Check Out
            </Button>
          </div>

          {selectedLocation && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm">
                <strong>Selected Location:</strong> {selectedLocation.name}
              </p>
              <p className="text-xs text-gray-600 mt-1">
                Attendance will be recorded for this location
              </p>
            </div>
          )}

          {!isOnline && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                <strong>Offline Mode:</strong> Attendance will be synced when connection is restored
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Work Locations List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            All Work Locations
          </CardTitle>
          <CardDescription>
            Registered work locations for attendance tracking
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {workingLocations.map((location) => (
              <div key={location.id} className="p-3 border rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">{location.name}</h4>
                    <p className="text-sm text-gray-600">{location.address}</p>
                    <p className="text-xs text-gray-500">
                      Range: {location.radius}m radius
                    </p>
                  </div>
                  <Badge variant={location.isActive ? "default" : "secondary"}>
                    {location.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}