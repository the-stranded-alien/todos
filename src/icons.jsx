// ── Icon wrapper ───────────────────────────────────────────
// Components import icons from here, never from the library, so the set
// can be swapped in one place. IconPark (Apache-2.0) renders with four
// placeholder colours that index.css maps to theme tokens.
import { createContext, createElement, useContext } from 'react'
import {
  Attention, SortThree, AtSign as PAtSign, Book as PBook, BookOpen as PBookOpen, Briefcase as PBriefcase,
  Calendar as PCalendar, CalendarDot, Camera as PCamera, CheckOne, CheckCorrect, Down, Left, Right,
  Code as PCode, Cup, Command as PCommand, Contrast as PContrast, Download as PDownload, Filter as PFilter,
  Flag as PFlag, FolderClose, FolderFocus, HashtagKey, Heart as PHeart, Help, Home as PHome, ListView,
  Leaf as PLeaf, Microphone, VoiceOff, Moon as PMoon, Music as PMusic, Platte, MenuUnfoldOne, MenuFoldOne,
  Play as PPlay, Square as PSquare, Plus as PPlus, LoopOnce, RowHeight, Search as PSearch, Snowflake as PSnowflake,
  Star as PStar, Sun as PSun, SunOne, Sunrise as PSunrise, TagOne, Delete, Upload as PUpload, Waves as PWaves,
  Close, Lightning, Inbox as PInbox, ChartHistogram, Edit, PreviewOpen, PreviewClose, Copy as PCopy, SettingTwo, Keyboard as PKeyboard, Magic, Remind, ShareOne, More, LinkOne, FileText as PFileText,
} from '@icon-park/react'

const SLOTS = ['#0a0b01', '#0a0b02', '#0a0b03', '#0a0b04'] // outer stroke, outer fill, inner stroke, inner fill
export const LARGE_ICON = 16
export const IconStyleContext = createContext('two-tone') // 'two-tone' on light themes, 'filled' on dark

function make(ParkIcon, name) {
  function Icon({ size = 24, strokeWidth, fill, variant, className, style, color, 'aria-hidden': ariaHidden, ...rest }) {
    const small = useContext(IconStyleContext)
    const px = Number(size) || 24
    let theme = variant ?? (px >= LARGE_ICON ? 'multi-color' : small)
    if (fill && fill !== 'none') theme = 'filled' // keep Lucide-style "solid" meaning
    return createElement(ParkIcon, {
      ...rest,
      theme,
      size: px,
      fill: SLOTS,
      strokeWidth: strokeWidth ? Number(strokeWidth) * 2 : 4,
      className: `ip ip-${theme}${className ? ` ${className}` : ''}`,
      style: color ? { ...style, color } : style,
      'aria-hidden': ariaHidden ?? true, // decorative by default
    })
  }
  Icon.displayName = name
  return Icon
}

// Stable app-level names (the same action uses the same icon everywhere)
export const AlertTriangle = make(Attention, 'AlertTriangle')
export const ArrowDownUp = make(SortThree, 'ArrowDownUp')
export const AtSign = make(PAtSign, 'AtSign')
export const Book = make(PBook, 'Book')
export const BookOpen = make(PBookOpen, 'BookOpen')
export const Briefcase = make(PBriefcase, 'Briefcase')
export const Calendar = make(PCalendar, 'Calendar')
export const CalendarDays = make(CalendarDot, 'CalendarDays')
export const Camera = make(PCamera, 'Camera')
export const CheckCircle2 = make(CheckOne, 'CheckCircle2')
export const CheckSquare = make(CheckCorrect, 'CheckSquare')
export const ChevronDown = make(Down, 'ChevronDown')
export const ChevronLeft = make(Left, 'ChevronLeft')
export const ChevronRight = make(Right, 'ChevronRight')
export const Code = make(PCode, 'Code')
export const Copy = make(PCopy, 'Copy')
export const Coffee = make(Cup, 'Coffee')
export const Command = make(PCommand, 'Command')
export const Contrast = make(PContrast, 'Contrast')
export const Download = make(PDownload, 'Download')
export const Eye = make(PreviewOpen, 'Eye')
export const EyeOff = make(PreviewClose, 'EyeOff')
export const Filter = make(PFilter, 'Filter')
export const Flag = make(PFlag, 'Flag')
export const Folder = make(FolderClose, 'Folder')
export const FolderInput = make(FolderFocus, 'FolderInput')
export const Hash = make(HashtagKey, 'Hash')
export const Heart = make(PHeart, 'Heart')
export const HelpCircle = make(Help, 'HelpCircle')
export const Home = make(PHome, 'Home')
export const Inbox = make(PInbox, 'Inbox')
export const LayoutList = make(ListView, 'LayoutList')
export const BarChart3 = make(ChartHistogram, 'BarChart3')
export const Leaf = make(PLeaf, 'Leaf')
export const Mic = make(Microphone, 'Mic')
export const MicOff = make(VoiceOff, 'MicOff')
export const Moon = make(PMoon, 'Moon')
export const Music = make(PMusic, 'Music')
export const Palette = make(Platte, 'Palette')
export const PanelLeft = make(MenuUnfoldOne, 'PanelLeft')
export const PanelLeftClose = make(MenuFoldOne, 'PanelLeftClose')
export const Pencil = make(Edit, 'Pencil')
export const Play = make(PPlay, 'Play')
export const Plus = make(PPlus, 'Plus')
export const RotateCcw = make(LoopOnce, 'RotateCcw')
export const Rows3 = make(RowHeight, 'Rows3')
export const Search = make(PSearch, 'Search')
export const Settings = make(SettingTwo, 'Settings')
export const Keyboard = make(PKeyboard, 'Keyboard')
export const Snowflake = make(PSnowflake, 'Snowflake')
export const Sparkles = make(Magic, 'Sparkles')
export const Bell = make(Remind, 'Bell')
export const Share = make(ShareOne, 'Share')
export const MoreHorizontal = make(More, 'MoreHorizontal')
export const Link = make(LinkOne, 'Link')
export const FileText = make(PFileText, 'FileText')
export const Square = make(PSquare, 'Square')
export const Star = make(PStar, 'Star')
export const Sun = make(PSun, 'Sun')
export const SunDim = make(SunOne, 'SunDim')
export const Sunrise = make(PSunrise, 'Sunrise')
export const Tag = make(TagOne, 'Tag')
export const Trash2 = make(Delete, 'Trash2')
export const Upload = make(PUpload, 'Upload')
export const Waves = make(PWaves, 'Waves')
export const X = make(Close, 'X')
export const Zap = make(Lightning, 'Zap')

// Project icons are stored by name in the data; map them here.
export const PROJECT_ICONS = { Folder, Star, Briefcase, Home, Heart, Book, Code, Music, Camera, Coffee }
export const PROJECT_ICON_NAMES = Object.keys(PROJECT_ICONS)
