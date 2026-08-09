/**
 * The shared UI primitives (UI-A).
 *
 * One import surface, so a feature component reaches for `@/components/ui` and
 * gets whatever already exists rather than writing the twenty-first copy of
 * `rounded-lg border border-neutral-200 bg-white p-6`.
 *
 * Deliberately ABSENT: a Modal or ConfirmationDialog.
 *
 * The legacy dashboards put approve and reject inside a modal, and it was the one
 * pattern worth refusing. v2 already confirms terminal decisions in place — see
 * `review-actions.tsx` and `member-row-controls.tsx` — with the two-step
 * behaviour pinned by unit tests ("does not submit an approval on the first
 * click", "requires a reason field before a rejection can be confirmed"). A modal
 * primitive sitting in this barrel would be an invitation to move those
 * decisions into a dialog that has to re-solve focus trapping, scroll locking and
 * Escape handling, and nothing in the product currently needs one. UI-B adds a
 * `Sheet` for the mobile navigation drawer, which is a different problem.
 */

export { Alert, type AlertProps, type AlertTone } from './alert'
export { Badge, type BadgeProps, type BadgeTone } from './badge'
export {
  Button,
  buttonClasses,
  IconButton,
  type ButtonProps,
  type ButtonSize,
  type ButtonVariant,
  type IconButtonProps,
} from './button'
export {
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  type CardHeaderProps,
  type CardProps,
} from './card'
export { EmptyState, type EmptyStateProps } from './empty-state'
export {
  Fieldset,
  FormField,
  Input,
  Select,
  Textarea,
  type FieldWiring,
  type FormFieldProps,
} from './field'
export { Icon, ICON_NAMES, type IconName, type IconProps } from './icon'
export { LoadingState, SkeletonRows } from './loading-state'
export {
  Breadcrumbs,
  PageHeader,
  SectionHeader,
  type Crumb,
  type PageHeaderProps,
} from './page-header'
export {
  Table,
  TableCardList,
  TableFooter,
  TableFrame,
  TBody,
  Td,
  Th,
  THead,
  Tr,
  type TableProps,
} from './table'
