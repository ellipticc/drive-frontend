"use client";

import type { ComponentPropsWithRef, HTMLAttributes, ReactNode, Ref, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { createContext, isValidElement, useContext, useState, useEffect, useRef, forwardRef, ForwardedRef } from "react";
import { ArrowDown, ChevronSelectorVertical, Copy01, Edit01, HelpCircle, Trash01 } from "@untitledui/icons";
import type {
    CellProps as AriaCellProps,
    ColumnProps as AriaColumnProps,
    RowProps as AriaRowProps,
    TableHeaderProps as AriaTableHeaderProps,
    TableProps as AriaTableProps,
    Selection,
} from "react-aria-components";
import {
    Cell as AriaCell,
    Collection as AriaCollection,
    Column as AriaColumn,
    Group as AriaGroup,
    Row as AriaRow,
    Table as AriaTable,
    TableBody as AriaTableBody,
    TableHeader as AriaTableHeader,
    useTableOptions,
} from "react-aria-components";
import { Badge } from "@/components/base/badges/badges";
import { Checkbox } from "@/components/base/checkbox/checkbox";
import { Dropdown } from "@/components/base/dropdown/dropdown";
import { Tooltip, TooltipTrigger } from "@/components/base/tooltip/tooltip";
import { cx } from "@/utils/cx";

export const TableRowActionsDropdown = () => (
    <Dropdown.Root>
        <Dropdown.DotsButton />

        <Dropdown.Popover className="w-min">
            <Dropdown.Menu>
                <Dropdown.Item icon={Edit01}>
                    <span className="pr-4">Edit</span>
                </Dropdown.Item>
                <Dropdown.Item icon={Copy01}>
                    <span className="pr-4">Copy link</span>
                </Dropdown.Item>
                <Dropdown.Item icon={Trash01}>
                    <span className="pr-4">Delete</span>
                </Dropdown.Item>
            </Dropdown.Menu>
        </Dropdown.Popover>
    </Dropdown.Root>
);

const TableContext = createContext<{ size: "sm" | "md"; hasSelection?: boolean }>({ size: "md" });

const TableCardRoot = ({ children, className, size = "md", ...props }: HTMLAttributes<HTMLDivElement> & { size?: "sm" | "md" }) => {
    return (
        <TableContext.Provider value={{ size }}>
            <div {...props} className={cx("overflow-hidden rounded-xl bg-card shadow-xs ring-1 ring-border", className)}>
                {children}
            </div>
        </TableContext.Provider>
    );
};

interface TableCardHeaderProps {
    /** The title of the table card header. */
    title: ReactNode;
    /** The badge displayed next to the title. */
    badge?: ReactNode;
    /** The description of the table card header. */
    description?: string;
    /** The content displayed after the title and badge. */
    contentTrailing?: ReactNode;
    /** The class name of the table card header. */
    className?: string;
}

const TableCardHeader = ({ title, badge, description, contentTrailing, className }: TableCardHeaderProps) => {
    const { size } = useContext(TableContext);

    return (
        <div
            className={cx(
                "relative flex flex-row items-center justify-between gap-2 border-b border-border bg-card px-3 md:px-6 h-10 md:h-12",
                className,
            )}
        >
            <div className="flex flex-1 flex-col gap-0">
                <div className="flex items-center gap-2 w-full min-w-0">
                    {typeof title === "string" ? (
                        <h2 className={cx("font-semibold text-card-foreground truncate", size === "sm" ? "text-sm" : "text-lg")}>
                            {title}
                        </h2>
                    ) : (
                        <div className="flex-1 min-w-0">{title}</div>
                    )}
                    {badge ? (
                        isValidElement(badge) ? (
                            badge
                        ) : (
                            <Badge color="brand" size="sm">
                                {badge}
                            </Badge>
                        )
                    ) : null}
                </div>
                {description && <p className="text-sm text-muted-foreground">{description}</p>}
            </div>
            {contentTrailing}
        </div>
    );
};

interface TableRootProps extends AriaTableProps, Omit<ComponentPropsWithRef<"table">, "className" | "slot" | "style"> {
    size?: "sm" | "md";
}

interface TableRootProps extends AriaTableProps, Omit<ComponentPropsWithRef<"table">, "className" | "slot" | "style"> {
    size?: "sm" | "md";
    dependencies?: any[];
}

const TableRoot = ({ className, size = "md", onSelectionChange, ...props }: TableRootProps) => {
    const context = useContext(TableContext);
    const [hasSelection, setHasSelection] = useState(false);
    const tableRef = useRef<React.ComponentRef<typeof AriaTable>>(null);

    // Narrowed type for tableRef.state.selectionManager
    type SelectionManagerLike = { selectedKeys?: { size?: number }; subscribe?: (cb: () => void) => () => void };
    type TableWithState = { state?: { selectionManager?: SelectionManagerLike } };

    useEffect(() => {
        if (tableRef.current) {
            const updateSelection = () => {
                const selectionSize = (tableRef.current as TableWithState).state?.selectionManager?.selectedKeys?.size ?? 0;
                setHasSelection(selectionSize > 0);
            };

            // Initial check
            updateSelection();

            // Try to subscribe to changes if available
            const selectionManager = (tableRef.current as TableWithState).state?.selectionManager;
            if (selectionManager && typeof selectionManager.subscribe === 'function') {
                const unsubscribe = selectionManager.subscribe(updateSelection);
                return unsubscribe;
            }
        }
    }, []);

    const handleSelectionChange = (keys: Selection) => {
        const size = (keys as unknown as { size?: number }).size ?? 0;
        setHasSelection(size > 0);
        if (onSelectionChange) {
            onSelectionChange(keys);
        }
    };

    return (
        <TableContext.Provider value={{ size: context?.size ?? size, hasSelection }}>
            <div className="overflow-x-hidden md:overflow-x-auto">
                <AriaTable
                    ref={tableRef}
                    className={(state) => cx("w-full overflow-x-hidden", typeof className === "function" ? className(state) : className)}
                    onSelectionChange={handleSelectionChange}
                    {...props}
                />
            </div>
        </TableContext.Provider>
    );
};
TableRoot.displayName = "Table";

interface TableHeaderProps<T extends object>
    extends AriaTableHeaderProps<T>,
    Omit<ComponentPropsWithRef<"thead">, "children" | "className" | "slot" | "style"> {
    bordered?: boolean;
}

const TableHeader = <T extends object>({ columns, children, bordered = true, className, ...props }: TableHeaderProps<T>) => {
    const { size } = useContext(TableContext);
    const { selectionBehavior, selectionMode } = useTableOptions();

    return (
        <AriaTableHeader
            {...props}
            className={(state) =>
                cx(
                    "relative bg-muted",
                    size === "sm" ? "h-9" : "h-11",

                    // Row border—using an "after" pseudo-element to avoid the border taking up space.
                    bordered &&
                    "[&>tr>th]:after:pointer-events-none [&>tr>th]:after:absolute [&>tr>th]:after:inset-x-0 [&>tr>th]:after:bottom-0 [&>tr>th]:after:h-px [&>tr>th]:after:bg-border dark:[&>tr>th]:after:bg-white/20 [&>tr>th]:focus-visible:after:bg-transparent",

                    typeof className === "function" ? className(state) : className,
                )
            }
        >
            {selectionBehavior === "toggle" && (
                <AriaColumn className={cx("relative py-2 pr-0 pl-4", size === "sm" ? "w-9 md:pl-5" : "w-11 md:pl-6")}>
                    {selectionMode === "multiple" && (
                        <div className="flex items-start">
                            <Checkbox slot="selection" size={size} />
                        </div>
                    )}
                </AriaColumn>
            )}
            <AriaCollection items={columns}>{children}</AriaCollection>
        </AriaTableHeader>
    );
};

TableHeader.displayName = "TableHeader";

interface TableHeadProps extends AriaColumnProps, Omit<ThHTMLAttributes<HTMLTableCellElement>, "children" | "className" | "style" | "id"> {
    label?: string;
    tooltip?: string;
    align?: "left" | "center" | "right";
}

const TableHead = ({ className, tooltip, label, align = "left", children, ...props }: TableHeadProps) => {
    const { selectionBehavior } = useTableOptions();
    const { size } = useContext(TableContext);

    const getTextAlignClass = () => {
        switch (align) {
            case "center": return "justify-center";
            case "right": return "justify-end";
            default: return "justify-start";
        }
    };

    return (
        <AriaColumn
            {...props}
            className={(state) =>
                cx(
                    "relative p-0 outline-hidden focus-visible:z-1 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-background focus-visible:ring-inset",
                    size === "sm" && "px-2 py-2 md:px-4",
                    size === "md" && "px-4 py-3 md:px-5",
                    selectionBehavior === "toggle" && "nth-2:pl-3",
                    state.allowsSorting && "cursor-pointer",
                    typeof className === "function" ? className(state) : className,
                )
            }
        >
            {(state) => (
                <AriaGroup className={cx("flex items-center gap-1", getTextAlignClass())}>
                    <div className="flex items-center gap-1">
                        {label && <span className="text-xs font-semibold whitespace-nowrap text-muted-foreground">{label}</span>}
                        {typeof children === "function" ? children(state) : children}
                    </div>

                    {tooltip && (
                        <Tooltip title={tooltip} placement="top">
                            <TooltipTrigger className="cursor-pointer text-muted-foreground transition duration-100 ease-linear hover:text-foreground focus:text-foreground">
                                <HelpCircle className="size-4" />
                            </TooltipTrigger>
                        </Tooltip>
                    )}

                    {state.allowsSorting &&
                        (state.sortDirection ? (
                            <ArrowDown className={cx("size-3 stroke-[3px] text-muted-foreground", state.sortDirection === "ascending" && "rotate-180")} />
                        ) : (
                            <ChevronSelectorVertical size={12} strokeWidth={3} className="text-muted-foreground" />
                        ))}
                </AriaGroup>
            )}
        </AriaColumn>
    );
};
TableHead.displayName = "TableHead";

interface TableRowProps<T extends object>
    extends AriaRowProps<T>,
    Omit<ComponentPropsWithRef<"tr">, "children" | "className" | "onClick" | "slot" | "style" | "id"> {
    highlightSelectedRow?: boolean;
}

const TableRow = forwardRef(<T extends object>(
    { columns, children, className, highlightSelectedRow = true, ...props }: TableRowProps<T>,
    ref: ForwardedRef<HTMLTableRowElement>
) => {
    const { size } = useContext(TableContext);
    const { selectionBehavior } = useTableOptions();

    return (
        <AriaRow
            {...props}
            ref={ref}
            className={(state) =>
                cx(
                    "relative outline-ring transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:-outline-offset-2 group border-b border-border/60 last:border-b-0",
                    size === "sm" ? "h-10" : "h-12", // Even more compact height
                    highlightSelectedRow && state.isSelected && "!bg-blue-100 dark:!bg-blue-900/30",

                    // Removed pseudo-element borders in favor of standard border-b on the row for consistent full-width lines

                    typeof className === "function" ? className(state) : className,
                )
            }
        >
            {selectionBehavior === "toggle" && (
                <AriaCell className={cx("relative py-2 pr-0 pl-4", size === "sm" ? "md:pl-5" : "md:pl-6")}>
                    <div className="flex items-end">
                        <Checkbox slot="selection" size={size} />
                    </div>
                </AriaCell>
            )}
            <AriaCollection items={columns}>{children}</AriaCollection>
        </AriaRow>
    );
});

TableRow.displayName = "TableRow";

interface TableCellProps extends AriaCellProps, Omit<TdHTMLAttributes<HTMLTableCellElement>, "children" | "className" | "style" | "id"> {
    ref?: Ref<HTMLTableCellElement>;
}

const TableCell = ({ className, children, ...props }: TableCellProps) => {
    const { size } = useContext(TableContext);
    const { selectionBehavior } = useTableOptions();

    return (
        <AriaCell
            {...props}
            className={(state) =>
                cx(
                    "relative text-sm text-muted-foreground outline-ring focus-visible:z-1 focus-visible:outline-2 focus-visible:-outline-offset-2",
                    size === "sm" && "px-2 py-2 md:px-4",
                    size === "md" && "px-4 py-3 md:px-6",

                    selectionBehavior === "toggle" && "nth-2:pl-3",

                    typeof className === "function" ? className(state) : className,
                )
            }
        >
            {children}
        </AriaCell>
    );
};
TableCell.displayName = "TableCell";

const TableCard = {
    Root: TableCardRoot,
    Header: TableCardHeader,
};

const Table = TableRoot as typeof TableRoot & {
    Body: typeof AriaTableBody;
    Cell: typeof TableCell;
    Head: typeof TableHead;
    Header: typeof TableHeader;
    Row: typeof TableRow;
};
Table.Body = AriaTableBody;
Table.Cell = TableCell;
Table.Head = TableHead;
Table.Header = TableHeader;
Table.Row = TableRow;

export { Table, TableCard };
