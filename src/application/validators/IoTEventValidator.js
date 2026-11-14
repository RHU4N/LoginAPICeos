const { validateEvent, EventValidationError } = require('../contracts/IoTEventContract');
const { ValidationError } = require('../../errors/AppError');

function validateIoTEvent(data) {
  try { return validateEvent(data); }
  catch (error) {
    if (error instanceof EventValidationError) throw new ValidationError(error.message);
    throw error;
  }
}
module.exports = validateIoTEvent;
