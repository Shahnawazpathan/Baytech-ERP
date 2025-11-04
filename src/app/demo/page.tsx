'use client';

import React from 'react';
import { ScrollableCard, ScrollableCardItem } from '@/components/ScrollableCard';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const DemoPage = () => {
  const fields = [
    { title: 'first_name', type: 'text', sample: 'John', isRequired: true },
    { title: 'last_name', type: 'text', sample: 'Smith', isRequired: true },
    { title: 'email', type: 'email', sample: 'john.smith@email.com', isRequired: false },
    { title: 'phone', type: 'phone', sample: '555-0123', isRequired: true },
    { title: 'loan_amount', type: 'phone', sample: '450000', isRequired: false },
    { title: 'property_address', type: 'text', sample: '123 Main St', isRequired: false },
    { title: 'credit_score', type: 'text', sample: '750', isRequired: false },
    { title: 'source', type: 'text', sample: 'Website', isRequired: false },
    { title: 'priority', type: 'text', sample: 'High', isRequired: false },
    { title: 'notes', type: 'text', sample: 'Additional information', isRequired: false },
    { title: 'date_of_birth', type: 'date', sample: '1990-01-01', isRequired: false },
    { title: 'ssn', type: 'text', sample: '123-45-6789', isRequired: false },
    { title: 'employer', type: 'text', sample: 'ABC Company', isRequired: false },
    { title: 'income', type: 'number', sample: '75000', isRequired: false },
    { title: 'status', type: 'text', sample: 'Active', isRequired: false },
  ];

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">Scrollable Card Demo</h1>
      
      <div className="border rounded-lg p-6 max-w-4xl mx-auto">
        <h2 className="text-lg font-semibold mb-4">Lead Import Fields</h2>
        <ScrollableCard maxHeight="max-h-[40vh]">
          {fields.map((field, index) => (
            <ScrollableCardItem
              key={index}
              title={field.title}
              type={field.type}
              sample={field.sample}
              isRequired={field.isRequired}
              selectComponent={
                <Select>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder={`Map ${field.title}`} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="option1">Option 1</SelectItem>
                    <SelectItem value="option2">Option 2</SelectItem>
                    <SelectItem value="option3">Option 3</SelectItem>
                  </SelectContent>
                </Select>
              }
            />
          ))}
        </ScrollableCard>
      </div>
    </div>
  );
};

export default DemoPage;