import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

interface LeadAssignmentProps {
  lead: any;
  employees: any[];
  onAssign: (leadId: string, employeeId: string, notes?: string) => Promise<boolean>;
  disabled?: boolean;
}

const LeadAssignmentComponent: React.FC<LeadAssignmentProps> = ({ 
  lead, 
  employees, 
  onAssign, 
  disabled = false 
}) => {
  const { toast } = useToast();
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(lead.assignedToId || '');
  const [isAssigning, setIsAssigning] = useState(false);
  const eligibleEmployees = employees.filter(
    employee => employee.status === 'ACTIVE' && employee.autoAssignEnabled !== false
  );

  const handleAssign = async () => {
    if (!selectedEmployeeId) {
      toast({
        title: 'Error',
        description: 'Please select an employee to assign the lead',
        variant: 'destructive',
      });
      return false;
    }

    setIsAssigning(true);
    try {
      const success = await onAssign(lead.id, selectedEmployeeId);
      if (success) {
        toast({
          title: 'Success',
          description: `Lead has been assigned to ${employees.find(e => e.id === selectedEmployeeId)?.firstName} ${employees.find(e => e.id === selectedEmployeeId)?.lastName}`,
        });
      } else {
        toast({
          title: 'Error',
          description: 'Failed to assign lead',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to assign lead',
        variant: 'destructive',
      });
    } finally {
      setIsAssigning(false);
    }
  };

  const handleReassign = async () => {
    if (!selectedEmployeeId) {
      toast({
        title: 'Error',
        description: 'Please select an employee to reassign the lead',
        variant: 'destructive',
      });
      return false;
    }

    setIsAssigning(true);
    try {
      const success = await onAssign(lead.id, selectedEmployeeId, `Reassigned from ${lead.assignedTo || 'Unassigned'}`);
      if (success) {
        toast({
          title: 'Success',
          description: `Lead has been reassigned to ${employees.find(e => e.id === selectedEmployeeId)?.firstName} ${employees.find(e => e.id === selectedEmployeeId)?.lastName}`,
        });
      } else {
        toast({
          title: 'Error',
          description: 'Failed to reassign lead',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to reassign lead',
        variant: 'destructive',
      });
    } finally {
      setIsAssigning(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Select 
        value={selectedEmployeeId} 
        onValueChange={setSelectedEmployeeId}
        disabled={isAssigning || disabled}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Assign to...">
            {selectedEmployeeId 
              ? `${employees.find(e => e.id === selectedEmployeeId)?.firstName} ${employees.find(e => e.id === selectedEmployeeId)?.lastName}`
              : 'Assign to...'}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {eligibleEmployees.map((employee) => (
            <SelectItem key={employee.id} value={employee.id}>
              {employee.firstName} {employee.lastName} ({employee.department})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button 
        size="sm"
        onClick={lead.assignedToId ? handleReassign : handleAssign}
        disabled={isAssigning || disabled || !selectedEmployeeId}
      >
        {isAssigning ? 'Assigning...' : lead.assignedToId ? 'Reassign' : 'Assign'}
      </Button>
    </div>
  );
};

export { LeadAssignmentComponent as LeadAssignment };
