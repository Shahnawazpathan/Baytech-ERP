'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CirclePause,
  CirclePlay,
  Clock3,
  MessageCircle,
  Phone,
  PhoneCall,
  ShieldAlert,
  SkipForward,
  UserRound,
} from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'

const TERMINAL_STATUSES = new Set(['APPROVED', 'REJECTED', 'CLOSED', 'JUNK', 'REAL'])
const dispositions = [
  ['INTERESTED', 'Interested'],
  ['CALLBACK', 'Callback'],
  ['BUSY', 'Busy'],
  ['NO_ANSWER', 'No answer'],
  ['NOT_INTERESTED', 'Not interested'],
  ['SALE', 'Sale'],
  ['DO_NOT_CALL', 'Do not call'],
] as const

const cleanPhone = (phone: string) => phone.replace(/[^\d+]/g, '')
const whatsappPhone = (phone: string) => phone.replace(/\D/g, '')

export function CallingWorkspace({ user }: { user: any }) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [selectedId, setSelectedId] = useState('')
  const [sessionActive, setSessionActive] = useState(false)
  const [paused, setPaused] = useState(false)
  const [callStartedAt, setCallStartedAt] = useState<number | null>(null)
  const [callInProgress, setCallInProgress] = useState(false)
  const [outcomeRequired, setOutcomeRequired] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [disposition, setDisposition] = useState('')
  const [notes, setNotes] = useState('')
  const [callbackAt, setCallbackAt] = useState('')
  const [saving, setSaving] = useState(false)
  const leftForCall = useRef(false)
  const pendingCallKey = `baytech-pending-call-${user?.id || 'unknown'}`

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['dialer-leads', user?.companyId, user?.id],
    queryFn: async () => {
      const res = await fetch('/api/leads?limit=1000', {
        headers: { 'x-user-id': user?.id || '', 'x-company-id': user?.companyId || '' },
      })
      if (!res.ok) throw new Error('Failed to load calling queue')
      return res.json()
    },
    enabled: !!user?.companyId && !!user?.id,
  })

  const queue = useMemo(() => {
    const now = Date.now()
    return (data?.data || []).filter((lead: any) => {
      const assignedToMe = lead.assignedToId === user?.id
      const unassignedForManager = !lead.assignedToId
        && /admin|manager/i.test(user?.role || '')
      const callbackDue = !lead.followUpDate || new Date(lead.followUpDate).getTime() <= now
      return (assignedToMe || unassignedForManager)
        && !lead.dnc
        && !TERMINAL_STATUSES.has(lead.status)
        && callbackDue
        && !!cleanPhone(lead.phone || '')
    })
  }, [data, user?.id, user?.role])

  const currentIndex = Math.max(0, queue.findIndex((lead: any) => lead.id === selectedId))
  const current = queue[currentIndex] || queue[0]

  useEffect(() => {
    if (!selectedId && queue[0]) setSelectedId(queue[0].id)
    if (selectedId && !queue.some((lead: any) => lead.id === selectedId)) {
      setSelectedId(queue[0]?.id || '')
    }
  }, [queue, selectedId])

  useEffect(() => {
    if (!callStartedAt) return
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - callStartedAt) / 1000)), 1000)
    return () => window.clearInterval(timer)
  }, [callStartedAt])

  useEffect(() => {
    const pending = window.localStorage.getItem(pendingCallKey)
    if (!pending) return
    try {
      const parsed = JSON.parse(pending)
      setSelectedId(parsed.leadId)
      setElapsed(parsed.elapsed || 0)
      setOutcomeRequired(true)
      setSessionActive(true)
    } catch {
      window.localStorage.removeItem(pendingCallKey)
    }
  }, [pendingCallKey])

  useEffect(() => {
    if (!callInProgress) return

    const finishCall = () => {
      if (!leftForCall.current && Date.now() - (callStartedAt || Date.now()) < 1500) return
      const duration = callStartedAt ? Math.floor((Date.now() - callStartedAt) / 1000) : elapsed
      setElapsed(duration)
      setCallStartedAt(null)
      setCallInProgress(false)
      setOutcomeRequired(true)
      window.localStorage.setItem(pendingCallKey, JSON.stringify({ leadId: selectedId, elapsed: duration }))
    }
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') leftForCall.current = true
      if (document.visibilityState === 'visible' && leftForCall.current) finishCall()
    }

    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('focus', finishCall)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('focus', finishCall)
    }
  }, [callInProgress, callStartedAt, elapsed, pendingCallKey, selectedId])

  const resetOutcome = () => {
    setDisposition('')
    setNotes('')
    setCallbackAt('')
    setCallStartedAt(null)
    setCallInProgress(false)
    setOutcomeRequired(false)
    setElapsed(0)
    leftForCall.current = false
  }

  const moveNext = () => {
    if (outcomeRequired || callInProgress) return
    const next = queue[currentIndex + 1] || queue[0]
    setSelectedId(next?.id || '')
    resetOutcome()
  }

  const startCall = () => {
    if (!current || current.dnc || paused || outcomeRequired || callInProgress) return
    setSessionActive(true)
    setPaused(false)
    const startedAt = Date.now()
    setCallStartedAt(startedAt)
    setCallInProgress(true)
    leftForCall.current = false
    window.localStorage.setItem(pendingCallKey, JSON.stringify({ leadId: current.id, elapsed: 0 }))
    window.location.href = `tel:${cleanPhone(current.phone)}`
  }

  const openWhatsApp = () => {
    if (outcomeRequired || callInProgress) return
    if (!current || current.whatsappOptIn === false) {
      toast({ title: 'WhatsApp unavailable', description: 'This lead has not opted in.', variant: 'destructive' })
      return
    }
    const message = encodeURIComponent(`Hi ${current.firstName || current.name}, thank you for speaking with Baytech. How can we help?`)
    window.open(`https://wa.me/${whatsappPhone(current.phone)}?text=${message}`, '_blank', 'noopener,noreferrer')
  }

  const saveOutcome = async () => {
    if (!current || !disposition) {
      toast({ title: 'Disposition required', description: 'Choose a call outcome before continuing.', variant: 'destructive' })
      return
    }
    if (!notes.trim()) {
      toast({ title: 'Call notes required', description: 'Add notes before continuing to the next lead.', variant: 'destructive' })
      return
    }
    if (disposition === 'CALLBACK' && !callbackAt) {
      toast({ title: 'Callback time required', description: 'Choose when this lead should return to the queue.', variant: 'destructive' })
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/dialer/disposition', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user?.id || '',
          'x-company-id': user?.companyId || '',
        },
        body: JSON.stringify({
          leadId: current.id,
          disposition,
          notes,
          callbackAt: callbackAt ? new Date(callbackAt).toISOString() : null,
          durationSeconds: elapsed,
        }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Failed to save outcome')
      toast({ title: 'Outcome saved', description: `${current.name} has been updated.` })
      window.localStorage.removeItem(pendingCallKey)
      resetOutcome()
      await refetch()
      queryClient.invalidateQueries({ queryKey: ['leads'] })
      queryClient.invalidateQueries({ queryKey: ['leads_overview'] })
      const next = queue[currentIndex + 1] || queue[0]
      setSelectedId(next?.id || '')
    } catch (error) {
      toast({
        title: 'Could not save outcome',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const formatDuration = (seconds: number) =>
    `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`

  if (isLoading) {
    return <div className="flex min-h-96 items-center justify-center text-sm text-muted-foreground">Loading calling queue...</div>
  }

  if (!current) {
    return (
      <Card className="mx-auto max-w-xl text-center">
        <CardHeader>
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
          <CardTitle>Calling queue complete</CardTitle>
          <CardDescription>No assigned, eligible leads are due right now.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
      <Card className="hidden xl:block">
        <CardHeader>
          <CardTitle className="flex items-center justify-between text-base">
            Calling queue <Badge variant="secondary">{queue.length}</Badge>
          </CardTitle>
          <CardDescription>DNC, closed, and future callbacks are excluded.</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[620px] pr-3">
            <div className="space-y-2">
              {queue.map((lead: any, index: number) => (
                <button
                  key={lead.id}
                  disabled={outcomeRequired || callInProgress}
                  onClick={() => { setSelectedId(lead.id); resetOutcome() }}
                  className={`w-full rounded-lg border p-3 text-left disabled:cursor-not-allowed disabled:opacity-50 ${lead.id === current.id ? 'border-blue-500 bg-blue-50' : 'hover:bg-muted'}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium">{lead.name}</span>
                    <span className="text-xs text-muted-foreground">#{index + 1}</span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{lead.phone}</p>
                  <div className="mt-2 flex gap-1">
                    <Badge variant="outline">{lead.priority}</Badge>
                    {lead.lastDisposition && <Badge variant="secondary">{lead.lastDisposition.replaceAll('_', ' ')}</Badge>}
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card className="overflow-hidden border-0 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 text-white shadow-xl">
          <CardContent className="p-5 sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-blue-200">Next eligible lead</p>
                <p className="mt-1 text-sm text-slate-300">{currentIndex + 1} of {queue.length} in queue</p>
              </div>
              <Badge className="bg-white/10 text-white hover:bg-white/10">{current.priority} priority</Badge>
            </div>

            {outcomeRequired ? (
              <div className="mt-6 rounded-2xl bg-white p-4 text-slate-900 sm:p-6">
                <div className="mb-5 text-center">
                  <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
                  <h2 className="mt-3 text-xl font-bold">Complete call outcome</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Add disposition and notes for {current.name} to unlock the next call.
                  </p>
                  <Badge variant="outline" className="mt-3">Call duration {formatDuration(elapsed)}</Badge>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="main-disposition">Disposition *</Label>
                    <Select value={disposition} onValueChange={setDisposition}>
                      <SelectTrigger id="main-disposition"><SelectValue placeholder="Choose outcome" /></SelectTrigger>
                      <SelectContent>
                        {dispositions.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  {disposition === 'CALLBACK' && (
                    <div className="space-y-2">
                      <Label htmlFor="main-callbackAt">Callback date and time *</Label>
                      <Input id="main-callbackAt" type="datetime-local" value={callbackAt} onChange={(event) => setCallbackAt(event.target.value)} />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="main-callNotes">Call notes *</Label>
                    <Textarea id="main-callNotes" rows={5} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Enter what happened on the call..." />
                  </div>

                  {disposition === 'DO_NOT_CALL' && (
                    <div className="flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" /> This permanently removes the lead from the auto-dial queue.
                    </div>
                  )}

                  <Button className="h-12 w-full" disabled={!disposition || !notes.trim() || saving} onClick={saveOutcome}>
                    {saving ? 'Saving...' : <>Save and unlock next call <ChevronRight className="ml-2 h-4 w-4" /></>}
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="my-8 text-center">
                  <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-white/10 ring-8 ring-white/5">
                    <UserRound className="h-9 w-9" />
                  </div>
                  <h2 className="mt-5 text-3xl font-bold">{current.name}</h2>
                  <p className="mt-2 text-lg text-blue-100">{current.phone}</p>
                  <p className="mt-1 text-sm text-slate-300">{current.propertyAddress || current.source || 'Lead details unavailable'}</p>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Button disabled={paused || callInProgress} onClick={startCall} className="col-span-2 h-14 bg-emerald-500 text-base hover:bg-emerald-600 sm:col-span-2">
                    <PhoneCall className="mr-2 h-5 w-5" /> {callInProgress ? 'Call in progress' : sessionActive ? 'Call now' : 'Start dialing'}
                  </Button>
                  <Button disabled={callInProgress} onClick={openWhatsApp} className="h-14 bg-[#25D366] hover:bg-[#1fb858]">
                    <MessageCircle className="mr-2 h-5 w-5" /> WhatsApp
                  </Button>
                  <Button disabled={callInProgress} variant="secondary" onClick={moveNext} className="h-14">
                    <SkipForward className="mr-2 h-5 w-5" /> Skip
                  </Button>
                </div>

                <div className="mt-5 flex items-center justify-between rounded-xl bg-white/10 px-4 py-3 text-sm">
                  <span className="flex items-center gap-2"><Clock3 className="h-4 w-4" /> Call timer {formatDuration(elapsed)}</span>
                  <Button
                    disabled={callInProgress}
                    size="sm"
                    variant="ghost"
                    className="text-white hover:bg-white/10 hover:text-white"
                    onClick={() => setPaused(!paused)}
                  >
                    {paused ? <CirclePlay className="mr-2 h-4 w-4" /> : <CirclePause className="mr-2 h-4 w-4" />}
                    {paused ? 'Resume queue' : 'Pause queue'}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Lead context</CardTitle>
            <CardDescription>Review this before calling.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div><p className="text-xs text-muted-foreground">Status</p><p className="font-medium">{current.status}</p></div>
            <div><p className="text-xs text-muted-foreground">Source</p><p className="font-medium">{current.source || '-'}</p></div>
            <div><p className="text-xs text-muted-foreground">Attempts</p><p className="font-medium">{current.callAttempts || 0}</p></div>
            <div className="sm:col-span-3">
              <p className="text-xs text-muted-foreground">Call script</p>
              <p className="mt-1 text-sm">Hi {current.firstName || current.name}, this is {user?.firstName || 'your advisor'} from Baytech. I am calling about your property finance inquiry. Is now a good time?</p>
            </div>
            {current.notes && <div className="sm:col-span-3"><p className="text-xs text-muted-foreground">Previous notes</p><p className="mt-1 text-sm">{current.notes}</p></div>}
          </CardContent>
        </Card>
      </div>

      <Card className="hidden">
        <CardHeader>
          <CardTitle className="text-base">Post-call outcome</CardTitle>
          <CardDescription>Required before moving to the next lead.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="disposition">Disposition *</Label>
            <Select value={disposition} onValueChange={setDisposition}>
              <SelectTrigger id="disposition"><SelectValue placeholder="Choose outcome" /></SelectTrigger>
              <SelectContent>
                {dispositions.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {disposition === 'CALLBACK' && (
            <div className="space-y-2">
              <Label htmlFor="callbackAt">Callback date and time *</Label>
              <Input id="callbackAt" type="datetime-local" value={callbackAt} onChange={(event) => setCallbackAt(event.target.value)} />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="callNotes">Notes</Label>
            <Textarea id="callNotes" rows={6} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="What happened on the call?" />
          </div>

          {disposition === 'DO_NOT_CALL' && (
            <div className="flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" /> This permanently removes the lead from the auto-dial queue.
            </div>
          )}

          <Button className="h-12 w-full" disabled={!disposition || saving} onClick={saveOutcome}>
            {saving ? 'Saving...' : <>Save and continue <ChevronRight className="ml-2 h-4 w-4" /></>}
          </Button>

          <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> Device dialer</span>
            <span className="flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" /> Due callbacks only</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
