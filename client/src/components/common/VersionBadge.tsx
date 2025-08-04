// client/src/components/common/VersionBadge.tsx
// 🏷️ Componente per visualizzare la versione nell'header

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from '@/components/ui/popover';
import { 
  useVersion, 
  formatBuildDate, 
  getEnvironmentColor, 
  getEnvironmentEmoji 
} from '@/hooks/useVersion';
import { Info, GitCommit, Calendar, Hash } from 'lucide-react';

interface VersionBadgeProps {
  variant?: 'default' | 'compact' | 'icon-only';
  showPopover?: boolean;
  className?: string;
}

export function VersionBadge({ 
  variant = 'default', 
  showPopover = true,
  className = '' 
}: VersionBadgeProps) {
  const versionInfo = useVersion();
  const [isOpen, setIsOpen] = useState(false);

  const environmentColor = getEnvironmentColor(versionInfo.environment);
  const environmentEmoji = getEnvironmentEmoji(versionInfo.environment);

  // Versione compatta per mobile
  if (variant === 'compact') {
    return (
      <Badge 
        variant="secondary" 
        className={`text-xs ${className}`}
      >
        {versionInfo.version}
      </Badge>
    );
  }

  // Solo icona per spazi molto ridotti
  if (variant === 'icon-only') {
    return (
      <div className={`w-2 h-2 rounded-full bg-green-500 ${className}`} 
           title={`${versionInfo.version} - ${versionInfo.environment}`} />
    );
  }

  const badgeContent = (
    <Badge 
      variant="outline" 
      className={`
        cursor-pointer transition-all duration-200 
        hover:shadow-md hover:scale-105
        flex items-center gap-1 text-xs
        ${environmentColor} 
        ${className}
      `}
    >
      <span className="text-xs">{environmentEmoji}</span>
      <span className="font-mono">{versionInfo.version}</span>
      {versionInfo.environment !== 'production' && (
        <span className="text-[10px] opacity-70">
          {versionInfo.environment}
        </span>
      )}
    </Badge>
  );

  if (!showPopover) {
    return badgeContent;
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        {badgeContent}
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4" align="end">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-center gap-2 pb-2 border-b">
            <Info className="h-4 w-4 text-blue-500" />
            <h4 className="font-semibold text-sm">
              Informazioni Versione
            </h4>
          </div>

          {/* Versione principale */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Versione:</span>
              <Badge variant="default" className="font-mono">
                {versionInfo.version}
              </Badge>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Build:</span>
              <span className="text-sm font-mono">
                #{versionInfo.buildNumber}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Ambiente:</span>
              <Badge 
                variant="secondary" 
                className={`text-xs ${environmentColor}`}
              >
                {environmentEmoji} {versionInfo.environment}
              </Badge>
            </div>
          </div>

          {/* Dettagli tecnici */}
          <div className="space-y-2 pt-2 border-t">
            <div className="flex items-start gap-2">
              <Calendar className="h-3 w-3 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Build Date:</p>
                <p className="text-xs font-mono">
                  {formatBuildDate(versionInfo.buildDate)}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2">
              <GitCommit className="h-3 w-3 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Commit:</p>
                <p className="text-xs font-mono">
                  {versionInfo.commitSha}
                </p>
              </div>
            </div>

            {versionInfo.deploymentId && (
              <div className="flex items-start gap-2">
                <Hash className="h-3 w-3 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">Deploy ID:</p>
                  <p className="text-xs font-mono break-all">
                    {versionInfo.deploymentId}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Footer con link GitHub (opzionale) */}
          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground text-center">
              Family Task Tracker
            </p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Componente semplificato per la navbar mobile
export function MobileVersionBadge({ className = '' }: { className?: string }) {
  const versionInfo = useVersion();
  
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
      <span className="text-xs text-muted-foreground font-mono">
        {versionInfo.version}
      </span>
    </div>
  );
}