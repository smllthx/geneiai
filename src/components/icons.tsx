// A compatible icon entry point keeps existing screens on the same GENEAI artwork.
// Utility glyphs with no supplied equivalent keep their original, recognizable geometry.
export * from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { geneIcon } from "./GeneIcon";
const icon = (name: string) => geneIcon(name) as LucideIcon;
export const Home = icon("home"), House = Home;
export const GitBranch = icon("tree"), Network = icon("branches"), TreePine = icon("tree");
export const Archive = icon("archive"), Compass = icon("compass"), Search = icon("search"), SearchIcon = Search;
export const Image = icon("photo"), ImageIcon = Image, Images = icon("photos"), ImagePlus = Images;
export const Dna = icon("dna"), Settings = icon("settings"), Settings2 = icon("sliders"), SlidersHorizontal = Settings2;
export const User = icon("user"), UserRound = User, UserPlus = User, Users = icon("people"), Users2 = Users;
export const MapPin = icon("pin"), Calendar = icon("calendar"), CalendarDays = Calendar;
export const Clock = icon("clock"), Clock3 = Clock, History = Clock, Activity = icon("timeline");
export const FileText = icon("document"), FileSearch = icon("source"), FileCheck = FileText, Files = FileText;
export const Upload = icon("upload"), UploadCloud = Upload, Download = icon("download"), DownloadCloud = Download;
export const Merge = icon("merge"), GitMerge = Merge, BookOpen = icon("book"), Book = BookOpen, Library = icon("book");
export const Sparkles = icon("spark"), Sparkle = Sparkles, Wand2 = Sparkles, Bot = Sparkles, Brain = Sparkles;
export const Mail = icon("mail"), Inbox = Mail, Languages = icon("language"), Globe = icon("globe"), Globe2 = Globe;
export const Grid = icon("grid"), Grid2X2 = Grid, LayoutGrid = Grid, Folder = icon("folder"), FolderOpen = Folder;
export const Lightbulb = icon("bulb"), Heart = icon("heart"), Tag = icon("tag"), Tags = Tag;
export const Layers = icon("layers"), ListChecks = icon("checklist"), ListOrdered = icon("tag");
export const Building = icon("building"), Building2 = Building, Landmark = Building;
export const FlaskConical = icon("flask"), TestTube = FlaskConical, TestTube2 = FlaskConical;
export const Scan = icon("compare"), ScanFace = Scan, ScanLine = Scan, GitCompare = Scan;
export const Baby = icon("birth"), Church = icon("baptism"), Cross = icon("death"), Ship = icon("ship");
export const Briefcase = icon("work"), BriefcaseBusiness = Briefcase;
