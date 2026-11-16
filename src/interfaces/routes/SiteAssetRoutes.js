const express = require('express');
const { createSiteAssets, TYPES } = require('../../infrastructure/storage/SiteAssets');

function siteAssetRoutes({ read = createSiteAssets() } = {}) {
  const router = express.Router();
  router.get('/:name', async (req, res) => {
    if (!Object.hasOwn(TYPES, req.params.name)) return res.sendStatus(404);
    if (!read) return res.status(503).json({ success: false, error: { code: 'ASSETS_UNAVAILABLE', message: 'Imagem temporariamente indisponível' } });
    try {
      const asset = await read(req.params.name);
      if (!asset) return res.sendStatus(404);
      res.set('X-Content-Type-Options', 'nosniff');
      res.set('Cache-Control', 'public, max-age=3600');
      if (asset.etag) res.set('ETag', asset.etag);
      return res.type(asset.type).send(asset.body);
    } catch (error) {
      if (error.statusCode === 404) return res.sendStatus(404);
      // Azure errors can contain authorization context. Never serialize them.
      return res.status(502).json({ success: false, error: { code: 'ASSET_FETCH_FAILED', message: 'Imagem temporariamente indisponível' } });
    }
  });
  return router;
}
module.exports = siteAssetRoutes;
