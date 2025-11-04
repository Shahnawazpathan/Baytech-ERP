import React from 'react';

interface ScrollableCardProps {
  children: React.ReactNode;
  maxHeight?: string;
  className?: string;
}

const ScrollableCard: React.FC<ScrollableCardProps> = ({
  children,
  maxHeight = 'max-h-[30vh]',
  className = ''
}) => {
  return (
    <div className={`px-6 space-y-4 flex flex-col ${className}`}>
      <div className={`${maxHeight} overflow-y-auto pr-2 -mr-2 -ml-2 custom-scrollbar`}>
        <div className="space-y-4 pb-2">
          {children}
        </div>
      </div>
    </div>
  );
};

interface ScrollableCardItemProps {
  title: string;
  type: string;
  sample: string;
  isRequired?: boolean;
  selectComponent?: React.ReactNode;
}

const ScrollableCardItem: React.FC<ScrollableCardItemProps> = ({
  title,
  type,
  sample,
  isRequired = false,
  selectComponent
}) => {
  return (
    <div className="flex items-center gap-4 p-3 border rounded-lg">
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{title}</p>
        <p className="text-sm text-gray-500 truncate">Type: {type} | Sample: "{sample}"</p>
      </div>
      <div className="w-64">
        {selectComponent || (
          <div className="border-input data-[placeholder]:text-muted-foreground [&_svg:not([class*='text-'])]:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 dark:hover:bg-input/50 flex w-fit items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 data-[size=default]:h-9 data-[size=sm]:h-8">
            <span className="truncate">{title} {isRequired ? '*' : ''}</span>
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="lucide lucide-chevron-down size-4 opacity-50">
              <path d="m6 9 6 6 6-6"></path>
            </svg>
          </div>
        )}
      </div>
      {isRequired && (
        <span className="inline-flex items-center justify-center rounded-md border px-2 py-0.5 font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden border-transparent bg-destructive text-white [a&]:hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60 text-xs flex-shrink-0">
          Required
        </span>
      )}
    </div>
  );
};

export { ScrollableCard, ScrollableCardItem };