const TYPES = Object.freeze({
  'logo.png': 'image/png', 'image.png': 'image/png', 'funcao-png.png': 'image/png',
  'analisecombinatoria.png': 'image/png', 'estatistica.png': 'image/png',
  'financeiro.png': 'image/png', 'cinetica.jpg': 'image/jpeg', 'dinamica.png': 'image/png',
  'energia.png': 'image/png', 'estequiometria.png': 'image/png',
  'concentracao.png': 'image/png', 'termoquimica.png': 'image/png',
});
const MAX_BYTES = 4 * 1024 * 1024;

// No account keys or SAS values are accepted from a browser. Only this fixed
// collection of non-sensitive site illustrations can be read through the API.
function createSiteAssets({ account = process.env.AZURE_SITE_ASSETS_ACCOUNT,
  container = process.env.AZURE_SITE_ASSETS_CONTAINER || 'ceos-files', client } = {}) {
  if (!client && !account) return null;
  if (!client) {
    if (!/^[a-z0-9]{3,24}$/.test(account) || !/^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])$/.test(container)) {
      throw new Error('Invalid site asset storage configuration');
    }
    const { BlobServiceClient } = require('@azure/storage-blob');
    const { ManagedIdentityCredential } = require('@azure/identity');
    client = new BlobServiceClient(`https://${account}.blob.core.windows.net`, new ManagedIdentityCredential(), {
      retryOptions: { maxTries: 2, tryTimeoutInMs: 8000 },
    }).getContainerClient(container);
  }
  return async function read(name) {
    if (!Object.hasOwn(TYPES, name)) return null;
    const blob = client.getBlobClient(name);
    const properties = await blob.getProperties({ abortSignal: AbortSignal.timeout(8000) });
    if (!properties.contentLength || properties.contentLength > MAX_BYTES) throw new Error('Invalid asset size');
    // A bounded range also limits a blob replaced between properties/download.
    const body = await blob.downloadToBuffer(0, properties.contentLength, { abortSignal: AbortSignal.timeout(8000) });
    return { body, type: TYPES[name], etag: properties.etag };
  };
}
module.exports = { createSiteAssets, TYPES, MAX_BYTES };
