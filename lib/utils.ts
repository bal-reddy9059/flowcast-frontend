export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hr${diffHours > 1 ? 's' : ''} ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toString();
}

export function congestionColor(level: string): string {
  switch (level?.toLowerCase()) {
    case 'critical':
    case 'critical high':
    case 'high': return 'text-red-500';
    case 'medium':
    case 'moderate': return 'text-amber-500';
    case 'low':
    case 'fluid':
    case 'stable low': return 'text-green-500';
    default: return 'text-gray-500';
  }
}

export function congestionBg(level: string): string {
  switch (level?.toLowerCase()) {
    case 'critical':
    case 'critical high':
    case 'high': return 'bg-red-50 text-red-700 border-red-200';
    case 'medium':
    case 'moderate': return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'low':
    case 'fluid':
    case 'stable low': return 'bg-green-50 text-green-700 border-green-200';
    default: return 'bg-gray-50 text-gray-600 border-gray-200';
  }
}

export function severityColor(severity: string): string {
  switch (severity?.toLowerCase()) {
    case 'critical':
    case 'high': return 'bg-red-100 text-red-700 border border-red-200';
    case 'medium': return 'bg-amber-100 text-amber-700 border border-amber-200';
    case 'low': return 'bg-green-100 text-green-700 border border-green-200';
    default: return 'bg-gray-100 text-gray-600 border border-gray-200';
  }
}

export function severityDot(severity: string): string {
  switch (severity?.toLowerCase()) {
    case 'critical':
    case 'high': return 'bg-red-500';
    case 'medium': return 'bg-amber-500';
    case 'low': return 'bg-green-500';
    default: return 'bg-gray-400';
  }
}

export function generateTrendData(points = 24): { time: string; congestion: number }[] {
  return Array.from({ length: points }, (_, i) => {
    const hour = i;
    const base = hour >= 8 && hour <= 10 ? 70 : hour >= 17 && hour <= 20 ? 75 : 35;
    const noise = Math.random() * 15 - 7;
    return {
      time: `${String(hour).padStart(2, '0')}:00`,
      congestion: Math.max(10, Math.min(95, Math.round(base + noise))),
    };
  });
}
