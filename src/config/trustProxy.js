// App Service terminates TLS before forwarding to Node. Trust only the closest
// platform proxy, never arbitrary client-provided forwarding chains.
// https://learn.microsoft.com/azure/app-service/configure-language-nodejs#detect-https-session
function trustProxySetting(env = process.env) {
  const explicit = env.TRUST_PROXY_HOPS;
  if (explicit !== undefined && explicit !== '') {
    return /^[1-9][0-9]?$/.test(explicit) ? Number(explicit) : false;
  }
  // These read-only variables are injected by Azure, not read from HTTP headers.
  if (env.WEBSITE_SITE_NAME && env.WEBSITE_INSTANCE_ID &&
      /^[a-z0-9.-]+\.azurewebsites\.net$/i.test(env.WEBSITE_HOSTNAME || '')) return 1;
  return false;
}
module.exports = trustProxySetting;
