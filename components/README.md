# Frontend Components Architecture

This document outlines the organized component structure for better maintainability and scalability.

## 📁 Directory Structure

```
components/
├── layout/                 # Layout-related components
│   ├── sidebar/           # Sidebar components
│   │   └── app-sidebar.tsx
│   ├── header/            # Header components
│   │   └── site-header.tsx
│   ├── navigation/        # Navigation components
│   │   ├── nav-documents.tsx
│   │   ├── nav-main.tsx
│   │   ├── nav-secondary.tsx
│   │   └── nav-user.tsx
│   └── index.ts           # Layout exports
├── modals/                # Modal components
│   ├── create-folder-modal.tsx
│   ├── move-to-folder-modal.tsx
│   ├── share-modal.tsx
│   ├── details-modal.tsx
│   ├── move-to-trash-modal.tsx
│   └── index.ts           # Modal exports
├── tables/                # Table components
│   ├── team-members-table.tsx
│   └── index.ts           # Table exports
├── shared/                # Shared/reusable components
│   ├── section-cards.tsx
│   └── index.ts           # Shared exports
├── ui/                   # shadcn/ui components (unchanged)
├── application/          # Application-specific components
├── base/                 # Base/foundation components
├── auth/                 # Authentication components
├── foundations/          # Foundation utilities
└── index.ts              # Main component exports
```

## 🎯 Organization Principles

### Layout Components (`/layout`)
- **Purpose**: Components that define the overall page structure
- **Subdirectories**:
  - `sidebar/`: Sidebar-related components
  - `header/`: Header/navigation bar components
  - `navigation/`: Navigation menu components

### Modal Components (`/modals`)
- **Purpose**: Dialog/modal components for user interactions
- **Examples**: Create folder, share, details, move to trash modals

### Table Components (`/tables`)
- **Purpose**: Data table and list components
- **Examples**: File lists, user tables, data grids

### Shared Components (`/shared`)
- **Purpose**: Reusable components used across multiple features
- **Examples**: Section cards, common UI elements

## 📝 Import Patterns

### Direct Imports (Recommended)
```typescript
// Import specific components
import { AppSidebar } from "@/components/layout/sidebar/app-sidebar"
import { CreateFolderModal } from "@/components/modals/create-folder-modal"
```

### Category Imports
```typescript
// Import from category index
import { AppSidebar, SiteHeader } from "@/components/layout"
import { CreateFolderModal, ShareModal } from "@/components/modals"
```

### Main Index Import
```typescript
// Import from main components index
import { AppSidebar, CreateFolderModal, Table01DividerLineSm } from "@/components"
```

## 🚀 Benefits

- **Scalability**: Easy to add new components in appropriate categories
- **Maintainability**: Clear separation of concerns
- **Discoverability**: Easy to find components by their purpose
- **Consistency**: Standardized naming and organization
- **Team Collaboration**: Multiple developers can work on different component categories

## 📋 Adding New Components

1. **Identify the category** that best fits your component
2. **Create the component** in the appropriate subdirectory
3. **Update the category's index.ts** to export the new component
4. **Update imports** in files that use the component
5. **Test thoroughly** to ensure all imports work correctly

## 🔧 Maintenance

- Keep index files updated when adding/removing components
- Use consistent naming conventions
- Document complex components with comments
- Regularly review and refactor as the codebase grows