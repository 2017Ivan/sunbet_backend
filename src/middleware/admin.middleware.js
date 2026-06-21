// middleware/admin.middleware.js
const adminPhoneNumbers = ['683307420', '696684997','761388019','672572874','745211365','749003366','690802328'];

const isAdminByPhone = (req, res, next) => {
  console.log('=== ADMIN MIDDLEWARE DEBUG ===');
  console.log('req.user:', JSON.stringify(req.user, null, 2));
  
  const user = req.user;
  
  if (!user) {
    console.log('❌ No user found');
    return res.status(401).json({ message: 'Unauthorized' });
  }
  
  // Check for phone_number (with underscore) OR phoneNumber (camelCase)
  const phoneNumber = user.phone_number || user.phoneNumber || user.phone || user.mobile;
  
  console.log('Extracted phone number:', phoneNumber);
  console.log('Admin list:', adminPhoneNumbers);
  console.log('Is match?', adminPhoneNumbers.includes(phoneNumber));
  
  if (phoneNumber && adminPhoneNumbers.includes(phoneNumber)) {
    req.user.isAdmin = true;
    console.log(' Admin access GRANTED for:', phoneNumber);
    return next();
  }
  
  console.log(' Admin access DENIED for:', phoneNumber);
  return res.status(403).json({ 
    message: 'Admin access required',
    yourPhone: phoneNumber,
    requiredPhones: adminPhoneNumbers
  });
};

module.exports = { isAdminByPhone };