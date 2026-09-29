function successResponse(
  res,
  data = null,
  message = 'Operação realizada com sucesso',
  status = 200,
  extra = {},
) {
  return res.status(status).json({
    success: true,
    message,
    data,
    ...extra,
  });
}

module.exports = successResponse;
