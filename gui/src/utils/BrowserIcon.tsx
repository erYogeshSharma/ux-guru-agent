import edge from "@/assets/icons/microsoft-edge.svg";
import firefox from "@/assets/icons/firefox.svg";
import chrome from "@/assets/icons/chrome.svg";
import safari from "@/assets/icons/safari.svg";

import macos from "@/assets/icons/mac.svg";
import windows from "@/assets/icons/windows.svg";
import ios from "@/assets/icons/ios.svg";
import linux from "@/assets/icons/linux.svg";
import android from "@/assets/icons/android.svg";

export const getBrowserFromUserAgent = (ua: string) => {
  ua = ua.toLowerCase();
  if (ua.includes("edge")) return "Edge";
  if (ua.includes("chrome")) return "Chrome";
  if (ua.includes("firefox")) return "Firefox";
  if (ua.includes("safari")) return "Safari";
  return "Other";
};

export const getOSFromUserAgent = (ua: string) => {
  ua = ua.toLowerCase();
  if (ua.includes("windows nt")) return "Windows";
  if (ua.includes("mac os x")) return "MacOS";
  if (ua.includes("linux")) return "Linux";
  if (ua.includes("iphone") || ua.includes("ipad") || ua.includes("ipod"))
    return "iOS";
  if (ua.includes("android")) return "Android";
  return "Other";
};

export const renderOSIcon = (userAgent: string, size: number = 16) => {
  const getOSIcon = (osName: string) => {
    switch (osName) {
      case "macos":
        return <img src={macos} alt="MacOS" width={size} height={size} />;
      case "windows":
        return <img src={windows} alt="Windows" width={size} height={size} />;
      case "linux":
        return <img src={linux} alt="Linux" width={size} height={size} />;
      case "ios":
        return <img src={ios} alt="iOS" width={size} height={size} />;
      case "android":
        return <img src={android} alt="Android" width={size} height={size} />;
      default:
        return null;
    }
  };

  if (!userAgent) return null;

  const os = getOSFromUserAgent(userAgent).toLowerCase();

  return <div>{getOSIcon(os)}</div>;
};

export const renderBrowserIcon = (userAgent: string, size: number = 16) => {
  const getBrowserIcon = (browserName: string) => {
    switch (browserName) {
      case "edge":
        return <img src={edge} alt="Edge" width={size} height={size} />;
      case "firefox":
        return <img src={firefox} alt="Firefox" width={size} height={size} />;
      case "chrome":
        return <img src={chrome} alt="Chrome" width={size} height={size} />;
      case "safari":
        return <img src={safari} alt="Safari" width={size} height={size} />;
      default:
        return null;
    }
  };

  if (!userAgent) return null;

  const browser = getBrowserFromUserAgent(userAgent).toLowerCase();

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      {getBrowserIcon(browser)}
    </div>
  );
};
