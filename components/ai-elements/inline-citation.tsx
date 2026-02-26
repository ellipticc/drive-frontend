"use client";

import type { CarouselApi } from "@/components/ui/carousel";
import type { ComponentProps } from "react";

import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { cn } from "@/lib/utils";
import { IconArrowRight, IconArrowLeft } from "@tabler/icons-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export type InlineCitationProps = ComponentProps<"span">;

export const InlineCitation = ({
  className,
  ...props
}: InlineCitationProps) => (
  <span
    className={cn("group inline items-center gap-1", className)}
    {...props}
  />
);

export type InlineCitationTextProps = ComponentProps<"span">;

export const InlineCitationText = ({
  className,
  ...props
}: InlineCitationTextProps) => (
  <span
    className={cn("transition-colors group-hover:bg-accent", className)}
    {...props}
  />
);

export type InlineCitationCardProps = ComponentProps<typeof HoverCard>;

export const InlineCitationCard = (props: InlineCitationCardProps) => (
  <HoverCard closeDelay={300} openDelay={100} {...props} />
);

export type InlineCitationCardTriggerProps = ComponentProps<"span"> & {
  sources: { title: string; url: string; content?: string }[];
};

export const InlineCitationCardTrigger = ({
  sources,
  className,
  ...props
}: InlineCitationCardTriggerProps) => {
  const getFavicon = (url: string) => {
    try {
      const hostname = new URL(url).hostname;
      return `https://www.google.com/s2/favicons?sz=64&domain=${hostname}`;
    } catch {
      return null;
    }
  };

  const firstDomain = sources[0] ? new URL(sources[0].url).hostname.replace('www.', '').toLowerCase() : '';

  return (
    <HoverCardTrigger asChild>
      <span
        role="button"
        className={cn(
          "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-muted/60 hover:bg-muted/90 transition-all border border-border/40 ml-1 align-baseline cursor-pointer select-none ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 active:scale-95",
          className
        )}
        {...props}
      >
        <div className="flex -space-x-1.5 overflow-hidden">
          {sources.slice(0, 1).map((s, i) => (
            <div key={i} className="inline-block h-3.5 w-3.5 rounded-full ring-1 ring-background bg-background overflow-hidden shrink-0">
              <img
                src={getFavicon(s.url) || ""}
                alt=""
                className="h-full w-full object-cover"
                onError={(e) => (e.currentTarget.style.display = 'none')}
              />
            </div>
          ))}
        </div>
        <span className="text-[10px] font-semibold text-foreground/80 whitespace-nowrap">
          {firstDomain}
          {sources.length > 1 && (
            <span className="ml-1 text-muted-foreground/70">+{sources.length - 1}</span>
          )}
        </span>
      </span>
    </HoverCardTrigger>
  );
};

export type InlineCitationCardBodyProps = ComponentProps<"div">;

export const InlineCitationCardBody = ({
  className,
  ...props
}: InlineCitationCardBodyProps) => (
  <HoverCardContent
    className={cn(
      "relative w-[320px] p-0 overflow-hidden rounded-2xl border-border/60 shadow-2xl bg-popover/95 backdrop-blur-md",
      "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
      className
    )}
    side="top"
    align="center"
    sideOffset={8}
    {...props}
  />
);

const CarouselApiContext = createContext<CarouselApi | undefined>(undefined);

const useCarouselApi = () => {
  const context = useContext(CarouselApiContext);
  return context;
};

export type InlineCitationCarouselProps = ComponentProps<typeof Carousel>;

export const InlineCitationCarousel = ({
  className,
  children,
  ...props
}: InlineCitationCarouselProps) => {
  const [api, setApi] = useState<CarouselApi>();

  return (
    <CarouselApiContext.Provider value={api}>
      <Carousel className={cn("w-full", className)} setApi={setApi} {...props}>
        {children}
      </Carousel>
    </CarouselApiContext.Provider>
  );
};

export type InlineCitationCarouselContentProps = ComponentProps<"div">;

export const InlineCitationCarouselContent = (
  props: InlineCitationCarouselContentProps
) => <CarouselContent {...props} />;

export type InlineCitationCarouselItemProps = ComponentProps<"div">;

export const InlineCitationCarouselItem = ({
  className,
  ...props
}: InlineCitationCarouselItemProps) => (
  <CarouselItem
    className={cn("w-full space-y-2 p-4 pl-4", className)}
    {...props}
  />
);

export type InlineCitationCarouselHeaderProps = ComponentProps<"div">;

export const InlineCitationCarouselHeader = ({
  className,
  sources = [],
  ...props
}: InlineCitationCarouselHeaderProps & { sources?: { url: string }[] }) => {
  const getFavicon = (url: string) => {
    try {
      const hostname = new URL(url).hostname;
      return `https://www.google.com/s2/favicons?sz=64&domain=${hostname}`;
    } catch {
      return null;
    }
  };

  return (
    <div className="space-y-0">
      <div
        className={cn(
          "flex items-center justify-between px-3 py-2 bg-muted/30",
          className
        )}
        {...props}
      >
        <div className="flex items-center gap-2">
          <InlineCitationCarouselPrev className="hover:text-foreground transition-colors" />
          <InlineCitationCarouselIndex className="p-0 text-foreground font-medium" />
          <InlineCitationCarouselNext className="hover:text-foreground transition-colors" />
        </div>

        <div className="flex items-center gap-1.5">
          <div className="flex -space-x-1.5 overflow-hidden">
            {sources.slice(0, 3).map((s, i) => (
              <div key={i} className="inline-block h-3.5 w-3.5 rounded-full ring-1 ring-background bg-background overflow-hidden shrink-0">
                <img src={getFavicon(s.url) || ""} alt="" className="h-full w-full object-cover" />
              </div>
            ))}
          </div>
          <span className="text-[10px] text-muted-foreground font-medium">
            {sources.length} sources
          </span>
        </div>
      </div>
      <div className="h-[1px] w-full bg-border/40" />
    </div>
  );
};

export type InlineCitationCarouselIndexProps = ComponentProps<"div">;

export const InlineCitationCarouselIndex = ({
  children,
  className,
  ...props
}: InlineCitationCarouselIndexProps) => {
  const api = useCarouselApi();
  const [current, setCurrent] = useState(0);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!api) {
      return;
    }

    setCount(api.scrollSnapList().length);
    setCurrent(api.selectedScrollSnap() + 1);

    const handleSelect = () => {
      setCurrent(api.selectedScrollSnap() + 1);
    };

    api.on("select", handleSelect);

    return () => {
      api.off("select", handleSelect);
    };
  }, [api]);

  return (
    <div
      className={cn(
        "flex items-center px-2 py-1 text-muted-foreground text-xs font-mono",
        className
      )}
      {...props}
    >
      {children ?? `${current}/${count}`}
    </div>
  );
};

export type InlineCitationCarouselPrevProps = ComponentProps<"button">;

export const InlineCitationCarouselPrev = ({
  className,
  ...props
}: InlineCitationCarouselPrevProps) => {
  const api = useCarouselApi();

  const handleClick = useCallback(() => {
    if (api) {
      api.scrollPrev();
    }
  }, [api]);

  return (
    <button
      aria-label="Previous"
      className={cn("shrink-0", className)}
      onClick={handleClick}
      type="button"
      {...props}
    >
      <IconArrowLeft className="size-3.5 text-muted-foreground" />
    </button>
  );
};

export type InlineCitationCarouselNextProps = ComponentProps<"button">;

export const InlineCitationCarouselNext = ({
  className,
  ...props
}: InlineCitationCarouselNextProps) => {
  const api = useCarouselApi();

  const handleClick = useCallback(() => {
    if (api) {
      api.scrollNext();
    }
  }, [api]);

  return (
    <button
      aria-label="Next"
      className={cn("shrink-0", className)}
      onClick={handleClick}
      type="button"
      {...props}
    >
      <IconArrowRight className="size-3.5 text-muted-foreground" />
    </button>
  );
};

export type InlineCitationSourceProps = ComponentProps<"div"> & {
  title?: string;
  url?: string;
  description?: string;
};

export const InlineCitationSource = ({
  title,
  url,
  description,
  className,
  children,
  ...props
}: InlineCitationSourceProps) => {
  const getFavicon = (url?: string) => {
    if (!url) return null;
    try {
      const hostname = new URL(url).hostname;
      return `https://www.google.com/s2/favicons?sz=64&domain=${hostname}`;
    } catch {
      return null;
    }
  };

  const domain = url ? new URL(url).hostname.replace('www.', '').toLowerCase() : '';

  return (
    <div className={cn("space-y-3", className)} {...props}>
      <div className="flex items-center gap-2">
        <div className="h-4 w-4 rounded-full overflow-hidden bg-muted shrink-0">
          <img src={getFavicon(url) || ""} alt="" className="h-full w-full object-cover" />
        </div>
        <span className="text-xs font-medium text-muted-foreground tracking-tight">{domain}</span>
      </div>

      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="block group/title"
      >
        <h4 className="text-base font-bold leading-snug text-foreground group-hover/title:text-primary transition-colors line-clamp-2">
          {title}
        </h4>
      </a>

      {description && (
        <p className="line-clamp-4 text-sm leading-relaxed text-muted-foreground/90">
          {description}
        </p>
      )}
      {children}
    </div>
  );
};

export type InlineCitationQuoteProps = ComponentProps<"blockquote">;

export const InlineCitationQuote = ({
  children,
  className,
  ...props
}: InlineCitationQuoteProps) => (
  <blockquote
    className={cn(
      "border-muted border-l-2 pl-3 text-muted-foreground text-sm italic",
      className
    )}
    {...props}
  >
    {children}
  </blockquote>
);
