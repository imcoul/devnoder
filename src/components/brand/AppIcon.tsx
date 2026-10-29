import type { Icon, IconProps } from '@phosphor-icons/react';
import {
  ArrowSquareOut,
  ArrowUp,
  Brain,
  Bug,
  CaretDown,
  Check,
  Code,
  DownloadSimple,
  DotsThree,
  Eye,
  File,
  FileText,
  FloppyDisk,
  FolderOpen,
  FolderSimplePlus,
  Gear,
  GitBranch,
  GithubLogo,
  Globe,
  Heart,
  Info,
  Key,
  Lightning,
  LinkSimple,
  List,
  LockSimple,
  MagnifyingGlass,
  MonitorPlay,
  PaintBrush,
  Palette,
  Play,
  Plus,
  Question,
  SpeakerHigh,
  Sparkle,
  TerminalWindow,
  TextAa,
  Translate,
  UploadSimple,
  UsersThree,
  Warning,
  X,
} from '@phosphor-icons/react';

const ICONS: Record<string, Icon> = {
  arrow: ArrowUp,
  arrowsquareout: ArrowSquareOut,
  brain: Brain,
  bug: Bug,
  caret: CaretDown,
  check: Check,
  code: Code,
  download: DownloadSimple,
  dots: DotsThree,
  eye: Eye,
  file: File,
  filetext: FileText,
  floppy: FloppyDisk,
  folder: FolderOpen,
  folderplus: FolderSimplePlus,
  gear: Gear,
  git: GitBranch,
  github: GithubLogo,
  globe: Globe,
  heart: Heart,
  info: Info,
  key: Key,
  lightning: Lightning,
  link: LinkSimple,
  list: List,
  lock: LockSimple,
  search: MagnifyingGlass,
  preview: MonitorPlay,
  paint: PaintBrush,
  palette: Palette,
  play: Play,
  plus: Plus,
  question: Question,
  speaker: SpeakerHigh,
  sparkle: Sparkle,
  terminal: TerminalWindow,
  text: TextAa,
  translate: Translate,
  upload: UploadSimple,
  users: UsersThree,
  warning: Warning,
  close: X,
};

const ALIASES: Record<string, string> = {
  ai: 'brain',
  settings: 'gear',
  projects: 'folder',
  visual: 'paint',
  docs: 'filetext',
  about: 'info',
  more: 'dots',
  chevron: 'caret',
  add: 'plus',
  save: 'floppy',
  external: 'arrowsquareout',
};

export type AppIconProps = Omit<IconProps, 'size'> & {
  name: string;
  size?: number | string;
};

function normalizeName(name: string) {
  return name.toLowerCase().replace(/[\s_-]+/g, '');
}

export function AppIcon({ name, size = 20, ...props }: AppIconProps) {
  const normalized = normalizeName(name);
  const IconComponent = ICONS[ALIASES[normalized] ?? normalized] ?? Question;
  return <IconComponent {...props} size={size} aria-hidden={props['aria-label'] ? undefined : true} />;
}

export default AppIcon;
