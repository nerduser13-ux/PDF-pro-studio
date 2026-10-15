import React from 'react';
import { 
  Building, 
  DollarSign, 
  Users, 
  Cpu, 
  Leaf, 
  Scale, 
  Trophy, 
  AlertTriangle, 
  Search, 
  ShieldAlert, 
  TrendingUp, 
  TrendingDown, 
  Zap, 
  FileText, 
  Smile, 
  Settings, 
  Calendar,
  HelpCircle,
  Lightbulb,
  CheckCircle,
  LucideIcon
} from 'lucide-react';

const ICON_MAP: Record<string, LucideIcon> = {
  'building': Building,
  'dollar': DollarSign,
  'users': Users,
  'cpu': Cpu,
  'leaf': Leaf,
  'scale': Scale,
  'trophy': Trophy,
  'alert-triangle': AlertTriangle,
  'search': Search,
  'shield-alert': ShieldAlert,
  'trending-up': TrendingUp,
  'trending-down': TrendingDown,
  'zap': Zap,
  'file-text': FileText,
  'smile': Smile,
  'settings': Settings,
  'calendar': Calendar,
  'help': HelpCircle,
  'lightbulb': Lightbulb,
  'check': CheckCircle,
};

interface DiagramIconProps {
  name?: string;
  size?: number;
  className?: string;
}

export const DiagramIcon: React.FC<DiagramIconProps> = ({ name, size = 16, className = '' }) => {
  if (!name) return null;
  const IconComp = ICON_MAP[name.toLowerCase()] || HelpCircle;
  return <IconComp size={size} className={className} />;
};
