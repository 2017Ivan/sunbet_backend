const success = ({ status = 200, message = 'Success', data = null }) => {
  const response = {
    success: true,
    status,
    message,
  };

  if (data !== null && data !== undefined) {
    response.data = data;
  }

  return response;
};

const error = ({ status = 500, message = 'Something went wrong', error_message = null }) => {
  const response = {
    success: false,
    status,
    message,
  };

  if (error_message) {
    response.error_message = error_message;
  }

  return response;
};

module.exports = {
  success,
  error,
};