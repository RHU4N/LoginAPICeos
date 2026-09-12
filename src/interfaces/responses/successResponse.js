function successResponse(res, data, message = 'Operação realizada com sucesso', status = 200) {
  return res.status(status).json({
    success: true,
    message,
    data
  });
}

module.exports = successResponse;
