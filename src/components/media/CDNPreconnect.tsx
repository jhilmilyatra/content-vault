import { memo } from 'react';

const VPS_CDN_URL = 'https://cloudvaults.in';

/**
 * CDNPreconnect - Renders preconnect and dns-prefetch hints for the VPS CDN.
 * Place this component high in the tree (e.g., DashboardLayout) so hints
 * are injected early in the page lifecycle.
 * 
 * Note: These render in <body> not <head>, which is suboptimal but still
 * provides benefit on most browsers. For maximum effect, add these to index.html.
 */
export const CDNPreconnect = memo(function CDNPreconnect() {
  return (
    <>
      <link rel="preconnect" href={VPS_CDN_URL} crossOrigin="anonymous" />
      <link rel="dns-prefetch" href={VPS_CDN_URL} />
    </>
  );
});

export default CDNPreconnect;
