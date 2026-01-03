import React, { useRef } from 'react'
import {
    WindowsIcon,
    MacOSIcon,
    IPhoneIcon,
    AndroidIcon,
    UbuntuIcon,
    ChromeIcon,
    FirefoxIcon,
    SafariIcon,
    EdgeIcon,
    OperaIcon
} from "@/components/icons/brand-icons"
import { IconWorld } from '@tabler/icons-react'

// Helper function to get icons
export const getUAInfo = (userAgent: string) => {
    if (!userAgent) return { osIcon: <IconWorld className="h-3.5 w-3.5" />, osName: 'Unknown', browserIcon: <IconWorld className="h-3.5 w-3.5" />, browserName: 'Unknown' };
    const ua = userAgent.toLowerCase();

    let osIcon = <IconWorld className="h-3.5 w-3.5 text-muted-foreground" />;
    let osName = 'Unknown OS';

    if (ua.includes('win')) { osIcon = <WindowsIcon className="h-3.5 w-3.5" />; osName = 'Windows'; }
    else if (ua.includes('mac') && !ua.includes('iphone') && !ua.includes('ipad')) { osIcon = <MacOSIcon className="h-3.5 w-3.5" />; osName = 'macOS'; }
    else if (ua.includes('iphone')) { osIcon = <IPhoneIcon className="h-3.5 w-3.5" />; osName = 'iOS (iPhone)'; }
    else if (ua.includes('ipad')) { osIcon = <IPhoneIcon className="h-3.5 w-3.5" />; osName = 'iOS (iPad)'; }
    else if (ua.includes('android')) { osIcon = <AndroidIcon className="h-3.5 w-3.5" />; osName = 'Android'; }
    else if (ua.includes('linux')) { osIcon = <UbuntuIcon className="h-3.5 w-3.5" />; osName = 'Linux'; }

    let browserIcon = <IconWorld className="h-3.5 w-3.5 text-muted-foreground" />;
    let browserName = 'Unknown Browser';

    if (ua.includes('edg')) { browserIcon = <EdgeIcon className="h-3.5 w-3.5" />; browserName = 'Edge'; }
    else if (ua.includes('opr')) { browserIcon = <OperaIcon className="h-3.5 w-3.5" />; browserName = 'Opera'; }
    else if (ua.includes('chrome') || ua.includes('crios')) { browserIcon = <ChromeIcon className="h-3.5 w-3.5" />; browserName = 'Chrome'; }
    else if (ua.includes('firefox') || ua.includes('fxios')) { browserIcon = <FirefoxIcon className="h-3.5 w-3.5" />; browserName = 'Firefox'; }
    else if (ua.includes('safari') && !ua.includes('chrome')) { browserIcon = <SafariIcon className="h-3.5 w-3.5" />; browserName = 'Safari'; }

    return { osIcon, osName, browserIcon, browserName };
}

// Helper to get generic OS icon from string (for Devices table where we only have 'Windows', 'Android' etc strings)
export const getOSIcon = (osName: string | undefined) => {
    if (!osName) return <IconWorld className="h-3.5 w-3.5 text-muted-foreground" />;
    const lower = osName.toLowerCase();

    if (lower.includes('win')) return <WindowsIcon className="h-3.5 w-3.5" />;
    if (lower.includes('mac')) return <MacOSIcon className="h-3.5 w-3.5" />;
    if (lower.includes('ios') || lower.includes('iphone') || lower.includes('ipad')) return <IPhoneIcon className="h-3.5 w-3.5" />;
    if (lower.includes('android')) return <AndroidIcon className="h-3.5 w-3.5" />;
    if (lower.includes('linux') || lower.includes('ubuntu')) return <UbuntuIcon className="h-3.5 w-3.5" />;

    return <IconWorld className="h-3.5 w-3.5 text-muted-foreground" />;
}

// Helper to get generic Browser icon from string
export const getBrowserIcon = (browserName: string | undefined) => {
    if (!browserName) return <IconWorld className="h-3.5 w-3.5 text-muted-foreground" />;
    const lower = browserName.toLowerCase();

    if (lower.includes('edge')) return <EdgeIcon className="h-3.5 w-3.5" />;
    if (lower.includes('opera')) return <OperaIcon className="h-3.5 w-3.5" />;
    if (lower.includes('chrome')) return <ChromeIcon className="h-3.5 w-3.5" />;
    if (lower.includes('firefox')) return <FirefoxIcon className="h-3.5 w-3.5" />;
    if (lower.includes('safari')) return <SafariIcon className="h-3.5 w-3.5" />;

    return <IconWorld className="h-3.5 w-3.5 text-muted-foreground" />;
}
