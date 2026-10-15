# NuesaPedia — Design System Specification

**Project:** NuesaPedia (Digital Faculty Library)  
**Version:** 2.0 (Updated to match Visual Mockup Design Language)  
**Target Audience:** Engineering Undergraduates, Faculty Members, & Academic Researchers  
**Faculty:** Faculty of Engineering (FUOYE / NUESA)  
**Implementation Stack:** Next.js 16 (App Router) + Tailwind CSS v4 + Lucide React + Plus Jakarta Sans  

---

# 1. Design Principles & Brand Identity

NuesaPedia is an academic study vault and digital library tailored specifically for engineering students. The visual language balances **academic authority**, **clean clarity**, and **modern engineering precision**.

### 1. High Information Scent & Zero Friction
* Academic workflows demand instant answers. Materials (lecture slides, reference textbooks, past question solutions, video tutorials, and lab manuals) must be discoverable in seconds without mandatory login barriers.
* Dense metadata (course code, department, academic level, file size) is formatted cleanly using high-contrast category badges and clear typographic hierarchy.

### 2. Engineering Precision & Trust
* Sharp, clean geometry paired with smooth rounded corners (`rounded-2xl` / `rounded-3xl` for department and resource cards, `rounded-xl` for back navigation buttons, and `rounded-full` for filters).
* Systematic 8pt spacing grid that feels balanced and orderly, reflecting structural engineering rigor.

### 3. Signature Forest Green & Emerald Accents
* **Deep Forest Green (`#0C3B2E` / `#0A251D`):** Represents academic authority, institutional heritage (NUESA / Nigerian Engineering Faculty), and provides high visual weight for major page titles and card headlines.
* **Vibrant Emerald (`#00875A` / `#059669`):** Interactive focal points, download action links, "Watch now" triggers, and progress indicators.
* **Clean White & Crisp Grayscale Canvas (`#FAFAFA` / `#FFFFFF`):** Uncluttered layout ensuring effortless readability during extended study sessions.

---

# 2. Color System & Design Tokens

## 2.1 Primary Brand Tokens

| Token Name | Hex Code | RGB | Tailwind Class / Token | Purpose / Usage |
|---|---|---|---|---|
| `forest-950` | `#0A251D` | `10, 37, 29` | `bg-[#0A251D]` | Pre-footer banner & dark footer canvas |
| `forest-900` | `#0C3B2E` | `12, 59, 46` | `text-[#0C3B2E]` | **Primary Heading Title Color**, department titles, active level pills |
| `forest-800` | `#114C3C` | `17, 76, 60` | `hover:bg-[#114C3C]` | Hover state for dark buttons & active indicators |
| `emerald-600` | `#00875A` | `0, 135, 90` | `text-emerald-600` | **Primary Interactive Accent**, download links, watch buttons |
| `emerald-700` | `#047857` | `4, 120, 87` | `text-emerald-700` | Active & hover states for emerald links |
| `emerald-50` | `#F0FDF4` | `240, 253, 244` | `bg-emerald-50` | Soft highlight backgrounds, tag hover |

## 2.2 Neutral Canvas Colors

| Token Name | Hex Code | Purpose / Usage |
|---|---|---|
| `surface-canvas` | `#FAFAFA` | Page background canvas |
| `surface-white` | `#FFFFFF` | Card containers, navigation bar, modal bodies |
| `border-card` | `#E2E8F0` / `slate-200/90` | Standard card borders and back button container |
| `border-divider` | `#F1F5F9` / `slate-100` | Card internal horizontal separator lines |
| `text-heading` | `#0C3B2E` | Page titles ("Choose Your Department", "200 Level Resources", "Saved Resources") |
| `text-card-title` | `#0F172A` / `#0C3B2E` | Resource and department card titles |
| `text-body` | `#64748B` / `text-slate-500` | Subtitles, course metadata ("Mechanical Engineering • 200 Level"), file sizes |

## 2.3 Resource Type Badge Tokens

| Resource Type | Background Hex | Text Hex | Tailwind Style | Visual Preview |
|---|---|---|---|---|
| **PDF HANDOUT** | `#FFE4E6` (60%) | `#E11D48` | `bg-[#FFE4E6]/60 text-[#E11D48]` | Soft pink pill with bold rose text |
| **REFERENCE BOOK** | `#F3E8FF` | `#9333EA` | `bg-[#F3E8FF] text-[#9333EA]` | Soft lilac pill with bold purple text |
| **PAST QUESTIONS** | `#FEF3C7` | `#D97706` | `bg-[#FEF3C7] text-[#D97706]` | Soft amber pill with warm amber text |
| **VIDEO TUTORIAL** | `#DBEAFE` | `#2563EB` | `bg-[#DBEAFE] text-[#2563EB]` | Soft blue pill with play icon & blue text |
| **LAB MANUAL** | `#DCFCE7` | `#16A34A` | `bg-[#DCFCE7] text-[#16A34A]` | Soft mint pill with emerald green text |
| **GENERAL COURSE** | `#CCFBF1` | `#0D9488` | `bg-[#CCFBF1] text-[#0D9488]` | Soft teal pill with cyan/teal text |

## 2.4 Bookmark States

| State | Icon Class | Visual | Meaning |
|---|---|---|---|
| **Unsaved (Default)** | `<Bookmark className="h-5 w-5 text-slate-500 hover:text-slate-800" strokeWidth={1.8} />` | Outline glyph | Click to save resource to local study vault |
| **Saved (Bookmarked)** | `<Bookmark className="h-5 w-5 fill-slate-900 text-slate-900" />` | Solid black fill | Resource is saved; click to un-bookmark |

---

# 3. Typography System

The typography pairs **Plus Jakarta Sans** (for geometric headings and cards) with **Geist Sans** (for clean technical metadata).

## 3.1 Type Scale

| Level | Size | Weight | Color | CSS / Tailwind | Example |
|---|---|---|---|---|---|
| **Page Title (H1)** | `32px - 48px` | ExtraBold (`800`) | `#0C3B2E` | `text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#0C3B2E]` | "200 Level Resources", "Choose Your Department" |
| **Section Header (H2)** | `24px - 32px` | ExtraBold (`800`) | `#0C3B2E` | `text-2xl sm:text-3xl font-extrabold text-[#0C3B2E]` | "Browse Library by Department" |
| **Card Title (H3)** | `16px - 18px` | Bold (`700`) | `#0F172A` or `#0C3B2E` | `text-base sm:text-lg font-bold text-slate-950 leading-snug` | "MEG 201 - Engineering Thermodynamics Complete Slides" |
| **Subtitle / Lead** | `15px - 18px` | Regular (`400`) | `text-slate-600` | `text-base sm:text-lg text-slate-600 max-w-2xl` | "Select your department to find study materials for your courses." |
| **Metadata Tag** | `13px - 14px` | Regular (`400`) | `text-slate-500` | `text-sm text-slate-500` | "Mechanical Engineering • 200 Level" |
| **Badge Pill** | `11px` | Bold (`700`) | Contextual | `text-[11px] font-bold tracking-wider uppercase` | `PDF HANDOUT`, `VIDEO TUTORIAL` |
| **Footer Action Link** | `14px` | SemiBold (`600`) | `#00875A` | `text-sm font-semibold text-emerald-600 hover:text-emerald-700` | "Download file ↓", "Watch now ▷" |

---

# 4. Core Component Specifications

## 4.1 Back Navigation Button

Every inner page features a clean, accessible square back button at the top left.

### Anatomy & Specs
* **Container:** `w-10 h-10 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl border border-slate-200/90 bg-white shadow-xs`
* **Icon:** `<ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5 text-slate-800" />`
* **Interaction:** Hover `bg-slate-50 border-slate-300`, Active `scale-95`
* **Accessibility:** `aria-label="Go back"` or `aria-label="Back to Departments"`

```tsx
<button
  type="button"
  onClick={() => router.back()}
  className="inline-flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl sm:rounded-2xl border border-slate-200/90 bg-white text-slate-800 shadow-xs transition-all hover:bg-slate-50 hover:border-slate-300 active:scale-95"
>
  <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" />
</button>
```

---

## 4.2 Department Card Component

Used on `/departments` (3-column grid on desktop, 1-column on mobile) and in the landing page carousel.

### Anatomy
1. **Cover Image Banner:**
   * Aspect: `h-44 sm:h-48 w-full overflow-hidden bg-slate-100 rounded-t-2xl sm:rounded-t-3xl`
   * Image: High-resolution photorealistic/blueprint visual (`object-cover transition-transform duration-500 group-hover:scale-105`)
2. **Card Body (`p-5 sm:p-6`):**
   * Title: `text-lg sm:text-xl font-bold text-[#0C3B2E] tracking-tight group-hover:text-emerald-700`
   * Description: `mt-2 text-sm text-slate-500 leading-relaxed`
   * Divider: `mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between`
   * Action link: `View Resources` with `<ChevronRight className="h-4 w-4 text-slate-900 group-hover:translate-x-1" />`

---

## 4.3 Resource Card Component

Used across `/departments/[slug]`, `/resources`, and `/saved`.

### Structure
* **Container:** `rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md`
* **Top Header Row:**
  * Left: Resource Type Badge (`PDF HANDOUT`, `REFERENCE BOOK`, `PAST QUESTIONS`, `VIDEO TUTORIAL`, `LAB MANUAL`, `GENERAL COURSE`)
  * Right: Bookmark Button (Outline or Filled Black based on saved state)
* **Body (Document / Book Variant):**
  * Title: `text-base sm:text-lg font-bold text-slate-950 leading-snug`
  * Metadata: `text-sm text-slate-500 mt-1` (e.g., `Mechanical Engineering • 200 Level`)
  * Footer Divider: `mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between`
  * Left Footer: `Size: 8.4 MB` (`text-sm font-medium text-slate-500`)
  * Right Footer: `Download file` + Download icon (`text-sm font-semibold text-emerald-600 hover:text-emerald-700`)
* **Body (Video Tutorial Variant):**
  * Video Thumbnail: 16:9 aspect ratio with centered red YouTube play button overlay
  * Title: `CPE 202 - Object Oriented Programming in C++ Series`
  * Metadata: `Computer Engineering • 200 Level`
  * Footer Divider: `mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between`
  * Left Footer: YouTube logo + `YouTube` (`text-xs font-semibold text-slate-600`)
  * Right Footer: `Watch now` + circular play button in emerald green

---

# 5. Application Page Architecture

| Route | Page Name | Primary Purpose | Key Features |
|---|---|---|---|
| `/` | Landing Home | High-level platform intro & quick search | Hero search, feature cards, department carousel, recent resources, FAQ |
| `/departments` | Choose / Browse Department | Comprehensive directory of all 8 engineering departments | Back button, search filter, responsive 3-column department cards grid |
| `/departments/[slug]` | Department Level Vault | Department-specific study materials & level breakdown | Back button, dynamic level switcher (100L-500L), type filter pills, 3-column resource cards |
| `/resources` | Global Resource Vault | Cross-department search and multi-facet filtering | Text search, department select, level chips, material type filters, resource cards |
| `/saved` | Saved Resources | Personal study vault of bookmarked materials | Persistent client-side bookmarks, solid black bookmark glyphs, filter by type, empty state |

---

# 6. Saved Resources & State Management

* **Storage Mechanism:** Client-side `localStorage` under key `nuesapedia_saved_resource_ids`.
* **Reactive Provider:** `SavedResourcesProvider` (`context/SavedResourcesContext.tsx`) provides:
  * `savedIds`: Array of bookmarked IDs.
  * `isSaved(id: string)`: Fast membership check.
  * `toggleSave(id: string)`: Toggles resource bookmark with automatic persistence.
  * `savedCount`: Real-time counter displayed in the global `Navbar` header.
* **Seed Data:** Default bookmarked collection includes the 6 resources shown in the design mockup (`MEG 201`, `CVE 305`, `EEE 301`, `CPE 202`, `MCE 401`, `GST 111`).
