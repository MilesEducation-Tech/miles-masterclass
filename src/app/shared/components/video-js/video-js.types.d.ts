// Type declarations for video.js plugins without official type definitions

declare module 'videojs-youtube' {
  import videojs from 'video.js';
  const Plugin: videojs.Plugin;
  export default Plugin;
}

declare module '@videojs/http-streaming' {
  import videojs from 'video.js';
  const VhsPlugin: videojs.Plugin;
  export default VhsPlugin;
}
